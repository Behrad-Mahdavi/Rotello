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
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable Row Level Security (RLS)
alter table public.xp_requests enable row level security;

-- 2. Policies for xp_requests

-- Authenticated users can read their own requests, Admins can read all requests
drop policy if exists "Users can read own xp requests or admins read all" on public.xp_requests;
create policy "Users can read own xp requests or admins read all"
  on public.xp_requests for select
  using (
    auth.uid() is not null and (
      user_id = auth.uid() or
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
    status = 'pending'
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
