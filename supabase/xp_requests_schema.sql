-- ==============================================================================
-- ROTELLO XP REQUESTS SCHEMA: MEMBER REQUESTS & LEADER APPROVAL WORKFLOW
-- ==============================================================================

-- 1. Table for tracking member XP requests
create table if not exists public.xp_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null, -- عنوان فعالیت یا تسک انجام‌شده
  description text, -- توضیح کوتاه کار انجام‌شده و گزارش
  suggested_xp integer, -- امتیاز پیشنهادی عضو (اختیاری)
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  
  -- فیلدهای مربوط به بررسی راهبر:
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  award_type text check (award_type is null or award_type in ('task_completion', 'reward')), -- نوع: تسک یا تشویقی
  awarded_xp integer, -- مقدار نهایی امتیاز تخصیص‌یافته
  final_task_name text, -- نام تسک / فعالیت تاییدشده توسط راهبر
  reviewer_note text, -- یادداشت یا دلیل راهبر در زمان تایید یا رد
  target_user_ids uuid[], -- لیست افرادی که امتیاز به آن‌ها تعلق گرفت
  
  project_id uuid references public.projects(id) on delete set null, -- پروژه مرتبط با تسک/فعالیت (اختیاری)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Migration support if table already exists
alter table public.xp_requests add column if not exists project_id uuid references public.projects(id) on delete set null;
create index if not exists idx_xp_requests_project_id on public.xp_requests(project_id);

-- Enable Row Level Security (RLS)
alter table public.xp_requests enable row level security;

-- 2. Policies for xp_requests

-- Authenticated users can read their own requests, recipients can read requests awarded to them, Admins can read all requests
drop policy if exists "Users can read own xp requests or admins read all" on public.xp_requests;
create policy "Users can read own xp requests or admins read all"
  on public.xp_requests for select
  using (
    auth.uid() is not null and (
      user_id = auth.uid() or
      (target_user_ids is not null and auth.uid() = any(target_user_ids)) or
      public.is_admin()
    )
  );

-- Authenticated users can insert requests for themselves with status = 'pending'
drop policy if exists "Users can insert own pending xp requests" on public.xp_requests;
create policy "Users can insert own pending xp requests"
  on public.xp_requests for insert
  with check (
    auth.uid() is not null and
    user_id = auth.uid() and
    status = 'pending' and
    reviewed_by is null and
    reviewed_at is null and
    awarded_xp is null
  );

-- Admins can update xp_requests (to approve or reject)
drop policy if exists "Admins can update xp requests" on public.xp_requests;
create policy "Admins can update xp requests"
  on public.xp_requests for update
  using (public.is_admin());

-- Users can delete their own requests only if still pending; Admins can delete any
drop policy if exists "Users can delete own pending xp requests or admins delete" on public.xp_requests;
create policy "Users can delete own pending xp requests or admins delete"
  on public.xp_requests for delete
  using (
    (user_id = auth.uid() and status = 'pending') or
    public.is_admin()
  );

-- 3. Indexes for performance
create index if not exists idx_xp_requests_user_id on public.xp_requests(user_id);
create index if not exists idx_xp_requests_status on public.xp_requests(status);
create index if not exists idx_xp_requests_created_at on public.xp_requests(created_at desc);

-- 4. Trigger to automatically update updated_at timestamp
drop trigger if exists update_xp_requests_updated_at on public.xp_requests;
create trigger update_xp_requests_updated_at
  before update on public.xp_requests
  for each row execute procedure public.update_updated_at_column();

-- 5. RPC function for leader/admin to approve or reject XP requests atomically in database
create or replace function public.admin_review_xp_request(
  p_request_id uuid,
  p_action text, -- 'approve' or 'reject'
  p_final_task_name text default null,
  p_award_type text default 'task_completion',
  p_awarded_xp integer default null,
  p_target_user_ids uuid[] default null,
  p_reviewer_note text default null,
  p_project_id uuid default null
)
returns jsonb as $$
declare
  v_admin_id uuid;
  v_req record;
  v_target_id uuid;
  v_target_role text;
  v_target_name text;
  v_reason text;
begin
  v_admin_id := auth.uid();
  if v_admin_id is null or not public.is_admin() then
    raise exception 'فقط راهبران سیستم مجاز به بررسی درخواست‌های امتیاز هستند.';
  end if;

  select * into v_req from public.xp_requests where id = p_request_id;
  if not found then
    raise exception 'درخواست مورد نظر یافت نشد.';
  end if;

  if v_req.status <> 'pending' then
    raise exception 'این درخواست قبلاً تعیین وضعیت شده است.';
  end if;

  if p_action = 'reject' then
    update public.xp_requests
    set 
      status = 'rejected',
      reviewed_by = v_admin_id,
      reviewed_at = now(),
      reviewer_note = trim(p_reviewer_note),
      updated_at = now()
    where id = p_request_id;

    return jsonb_build_object('success', true, 'status', 'rejected');
  elsif p_action = 'approve' then
    if trim(p_final_task_name) = '' or p_final_task_name is null then
      raise exception 'ثبت عنوان/نام نهایی تسک الزامی است.';
    end if;

    if p_awarded_xp is null or p_awarded_xp <= 0 then
      raise exception 'مقدار امتیاز باید یک عدد مثبت باشد.';
    end if;

    if p_target_user_ids is null or array_length(p_target_user_ids, 1) = 0 then
      raise exception 'حداقل یک عضو باید به عنوان دریافت‌کننده امتیاز انتخاب شود.';
    end if;

    if p_award_type not in ('task_completion', 'reward') then
      raise exception 'نوع امتیاز باید تکمیل تسک یا پاداش تشویقی باشد.';
    end if;

    if p_award_type = 'reward' then
      v_reason := 'تشویقی درخواستی: ' || trim(p_final_task_name);
    else
      v_reason := 'تکمیل تسک درخواستی: ' || trim(p_final_task_name);
    end if;

    -- Award XP to each member in target list
    foreach v_target_id in array p_target_user_ids loop
      select role, full_name into v_target_role, v_target_name from public.profiles where id = v_target_id;
      if not found then
        raise exception 'کاربر با شناسه % یافت نشد.', v_target_id;
      end if;

      if v_target_role <> 'member' then
        raise exception 'امکان اعطای امتیاز به «%» وجود ندارد؛ سیستم امتیاز منحصراً برای اعضای عادی فعال است.', v_target_name;
      end if;

      -- Update profile xp_total
      update public.profiles
      set xp_total = greatest(0, xp_total + p_awarded_xp)
      where id = v_target_id;

      -- Insert into xp_adjustments
      insert into public.xp_adjustments (user_id, amount, reason, type, created_by)
      values (v_target_id, p_awarded_xp, v_reason, p_award_type, v_admin_id);
    end loop;

    -- Update xp_requests status
    update public.xp_requests
    set
      status = 'approved',
      reviewed_by = v_admin_id,
      reviewed_at = now(),
      final_task_name = trim(p_final_task_name),
      award_type = p_award_type,
      awarded_xp = p_awarded_xp,
      target_user_ids = p_target_user_ids,
      project_id = p_project_id,
      reviewer_note = trim(p_reviewer_note),
      updated_at = now()
    where id = p_request_id;

    return jsonb_build_object('success', true, 'status', 'approved');
  else
    raise exception 'عملیات نامعتبر است (approve یا reject).';
  end if;
end;
$$ language plpgsql security definer;

