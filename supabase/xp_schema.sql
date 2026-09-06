-- ==============================================================================
-- ROTELLO XP MANAGEMENT SCHEMA: REVERSALS, PENALTIES, REWARDS
-- ==============================================================================

-- 1. Table for tracking all XP adjustments (Penalties, Rewards, Task Completions, Reversals)
create table if not exists public.xp_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null, -- positive for rewards & completions, negative for penalties & reversals
  reason text not null,
  type text not null check (type in ('penalty', 'reward', 'task_completion', 'task_reversal')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.xp_adjustments enable row level security;

-- Policies for xp_adjustments
drop policy if exists "Authenticated users can read their own xp adjustments" on public.xp_adjustments;
create policy "Authenticated users can read their own xp adjustments"
  on public.xp_adjustments for select
  using (
    auth.uid() = user_id or public.is_admin()
  );

drop policy if exists "Admins can insert xp adjustments" on public.xp_adjustments;
create policy "Admins can insert xp adjustments"
  on public.xp_adjustments for insert
  with check (public.is_admin());

drop policy if exists "Admins can delete xp adjustments" on public.xp_adjustments;
create policy "Admins can delete xp adjustments"
  on public.xp_adjustments for delete
  using (public.is_admin());

-- Indexes for performance
create index if not exists idx_xp_adjustments_user_id on public.xp_adjustments(user_id);
create index if not exists idx_xp_adjustments_created_at on public.xp_adjustments(created_at desc);


-- 2. Trigger function: Automatically reverse XP when a completed task is deleted
create or replace function public.handle_task_deletion_xp()
returns trigger as $$
begin
  -- If this task was completed and had XP awarded, deduct the XP from all assignees
  if old.xp_awarded and old.xp_value > 0 then
    -- Deduct XP from profiles of assignees
    update public.profiles
    set xp_total = greatest(0, xp_total - old.xp_value)
    where id in (
      select user_id from public.task_assignees where task_id = old.id
    );

    -- Log reversal adjustment in xp_adjustments
    insert into public.xp_adjustments (user_id, amount, reason, type, created_by)
    select 
      user_id, 
      -old.xp_value, 
      'حذف تسک تکمیل‌شده: ' || coalesce(old.title, 'بدون عنوان'), 
      'task_reversal', 
      auth.uid()
    from public.task_assignees 
    where task_id = old.id;
  end if;

  return old;
end;
$$ language plpgsql security definer;

drop trigger if exists trigger_handle_task_deletion_xp on public.tasks;
create trigger trigger_handle_task_deletion_xp
  before delete on public.tasks
  for each row execute procedure public.handle_task_deletion_xp();


-- 3. Update move_task_status RPC to support XP reversal when moved out of 'done'
create or replace function public.move_task_status(
  p_task_id uuid,
  p_new_status text
)
returns void as $$
declare
  v_user_id uuid;
  v_user_role text;
  v_current_status text;
  v_xp_value integer;
  v_xp_awarded boolean;
  v_task_title text;
  v_is_assignee boolean;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select role into v_user_role from public.profiles where id = v_user_id;
  if v_user_role is null then
    raise exception 'User profile not found';
  end if;

  select status, xp_value, xp_awarded, title into v_current_status, v_xp_value, v_xp_awarded, v_task_title
  from public.tasks where id = p_task_id;
  
  if v_current_status is null then
    raise exception 'Task not found';
  end if;

  if v_user_role = 'admin' then
    null;
  elsif v_user_role = 'member' then
    select exists (
      select 1 from public.task_assignees
      where task_id = p_task_id and user_id = v_user_id
    ) into v_is_assignee;

    if not v_is_assignee then
      raise exception 'Only assigned members can move this task';
    end if;

    if p_new_status = 'done' then
      raise exception 'Only administrators can set a task to done';
    end if;

    if (v_current_status = 'backlog' and p_new_status <> 'todo') or
       (v_current_status = 'todo' and p_new_status <> 'in_progress') or
       (v_current_status = 'in_progress' and p_new_status <> 'review') or
       (v_current_status = 'review') or
       (v_current_status = 'done') then
      raise exception 'You can only move the task one step forward';
    end if;
  else
    raise exception 'Unknown role: %', v_user_role;
  end if;

  update public.tasks set status = p_new_status where id = p_task_id;

  -- Case A: Moved to done and not previously awarded -> Award XP
  if p_new_status = 'done' and not v_xp_awarded then
    update public.tasks set xp_awarded = true where id = p_task_id;
    if v_xp_value > 0 then
      update public.profiles
      set xp_total = xp_total + v_xp_value
      where id in (
        select user_id from public.task_assignees where task_id = p_task_id
      );

      insert into public.xp_adjustments (user_id, amount, reason, type, created_by)
      select 
        user_id, 
        v_xp_value, 
        'تکمیل تسک: ' || coalesce(v_task_title, 'بدون عنوان'), 
        'task_completion', 
        v_user_id
      from public.task_assignees 
      where task_id = p_task_id;
    end if;

  -- Case B: Moved OUT of done and was previously awarded -> Reverse XP
  elsif v_current_status = 'done' and p_new_status <> 'done' and v_xp_awarded then
    update public.tasks set xp_awarded = false where id = p_task_id;
    if v_xp_value > 0 then
      update public.profiles
      set xp_total = greatest(0, xp_total - v_xp_value)
      where id in (
        select user_id from public.task_assignees where task_id = p_task_id
      );

      insert into public.xp_adjustments (user_id, amount, reason, type, created_by)
      select 
        user_id, 
        -v_xp_value, 
        'خروج تسک از تکمیل‌شده: ' || coalesce(v_task_title, 'بدون عنوان'), 
        'task_reversal', 
        v_user_id
      from public.task_assignees 
      where task_id = p_task_id;
    end if;
  end if;

end;
$$ language plpgsql security definer;


-- 4. Admin RPC function to give Rewards or Penalties with reason and XP
create or replace function public.admin_adjust_member_xp(
  p_user_id uuid,
  p_amount integer,
  p_reason text,
  p_type text
)
returns integer as $$
declare
  v_admin_id uuid;
  v_delta integer;
  v_new_xp integer;
begin
  v_admin_id := auth.uid();
  if v_admin_id is null or not public.is_admin() then
    raise exception 'فقط مدیران سیستم مجاز به تغییر امتیاز هستند.';
  end if;

  if p_type not in ('penalty', 'reward') then
    raise exception 'نوع عملیات باید penalty یا reward باشد.';
  end if;

  if trim(p_reason) = '' or p_reason is null then
    raise exception 'ثبت دلیل الزامی است.';
  end if;

  if p_amount <= 0 then
    raise exception 'مقدار امتیاز باید بزرگتر از صفر باشد.';
  end if;

  if p_type = 'penalty' then
    v_delta := -abs(p_amount);
  else
    v_delta := abs(p_amount);
  end if;

  -- Update member's xp_total in profiles (preventing negative total XP)
  update public.profiles
  set xp_total = greatest(0, xp_total + v_delta)
  where id = p_user_id
  returning xp_total into v_new_xp;

  if not found then
    raise exception 'عضو مورد نظر یافت نشد.';
  end if;

  -- Log adjustment in xp_adjustments
  insert into public.xp_adjustments (user_id, amount, reason, type, created_by)
  values (p_user_id, v_delta, trim(p_reason), p_type, v_admin_id);

  return v_new_xp;
end;
$$ language plpgsql security definer;
