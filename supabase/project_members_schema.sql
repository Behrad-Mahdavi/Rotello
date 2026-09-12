-- ==============================================================================
-- ROTELLO PROJECT MEMBERS MIGRATION
-- ==============================================================================

-- 1. Create project_members table
create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text default 'member',
  created_at timestamptz default now(),
  unique (project_id, user_id)
);

-- 2. Indexes for performance
create index if not exists idx_project_members_project_id on public.project_members(project_id);
create index if not exists idx_project_members_user_id on public.project_members(user_id);

-- 3. Enable RLS
alter table public.project_members enable row level security;

-- 4. Policies
drop policy if exists "Authenticated users can read project members" on public.project_members;
create policy "Authenticated users can read project members"
  on public.project_members for select
  to authenticated
  using (true);

drop policy if exists "Admins and Mentors can manage project members" on public.project_members;
create policy "Admins and Mentors can manage project members"
  on public.project_members for all
  to authenticated
  using (
    public.is_admin() or exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'mentor'
    )
  )
  with check (
    public.is_admin() or exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'mentor'
    )
  );
