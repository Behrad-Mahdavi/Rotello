-- SQL Setup Script for Roka Task Manager (Rotello)

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. profiles table (extends auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('admin', 'member')),
  xp_total integer not null default 0,
  created_at timestamptz not null default now()
);

-- 2. projects table
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  deadline date,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- 3. tasks table
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text,
  deadline date,
  status text not null default 'backlog' check (status in ('backlog', 'todo', 'in_progress', 'review', 'done')),
  priority text not null default 'normal' check (priority in ('normal', 'important', 'urgent')),
  xp_value integer not null default 0,
  xp_awarded boolean not null default false,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. task_assignees table (many-to-many)
create table if not exists public.task_assignees (
  task_id uuid references public.tasks(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

-- 5. checklists table
create table if not exists public.checklists (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  title text not null,
  sort_order integer not null default 0
);

-- 6. checklist_items table
create table if not exists public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.checklists(id) on delete cascade,
  content text not null,
  is_done boolean not null default false,
  done_by uuid references public.profiles(id) on delete set null,
  done_at timestamptz,
  sort_order integer not null default 0
);

-- 7. task_reports table (append-only)
create table if not exists public.task_reports (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

-- Enable Row Level Security (RLS) on all tables
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignees enable row level security;
alter table public.checklists enable row level security;
alter table public.checklist_items enable row level security;
alter table public.task_reports enable row level security;

-- Helper Function to check if current user is an admin
create or replace function public.is_admin()
returns boolean as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
end;
$$ language plpgsql security definer;

-- Trigger to handle auth.users registration and automatically create profile
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role, xp_total)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Anonymous User'),
    coalesce(new.raw_user_meta_data->>'role', 'member'),
    0
  );
  return new;
end;
$$ language plpgsql security definer;

-- Recreate trigger on auth.users (ensure to drop first if exists)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Trigger to prevent non-admins from changing roles or XP
create or replace function public.check_profile_updates()
returns trigger as $$
begin
  if auth.uid() = new.id and not public.is_admin() then
    if new.role <> old.role or new.xp_total <> old.xp_total then
      raise exception 'Only administrators can modify roles or XP.';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trigger_check_profile_updates on public.profiles;
create trigger trigger_check_profile_updates
  before update on public.profiles
  for each row execute procedure public.check_profile_updates();

-- Trigger to update tasks.updated_at
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_tasks_updated_at on public.tasks;
create trigger update_tasks_updated_at
  before update on public.tasks
  for each row execute procedure public.update_updated_at_column();


-- RLS POLICIES --

-- 1. Profiles Policies
create policy "Authenticated users can read profiles"
  on public.profiles for select
  using (auth.uid() is not null);

create policy "Admins or user itself can update profile"
  on public.profiles for update
  using (auth.uid() = id or public.is_admin());

create policy "Admins can insert profiles"
  on public.profiles for insert
  with check (public.is_admin());

create policy "Admins can delete profiles"
  on public.profiles for delete
  using (public.is_admin());


-- 2. Projects Policies
create policy "Authenticated users can read projects"
  on public.projects for select
  using (auth.uid() is not null);

create policy "Admins can manage projects"
  on public.projects for all
  using (public.is_admin());


-- 3. Tasks Policies
create policy "Authenticated users can read tasks"
  on public.tasks for select
  using (auth.uid() is not null);

create policy "Admins can manage tasks (except RPC status changes)"
  on public.tasks for all
  using (public.is_admin());


-- 4. Task Assignees Policies
create policy "Authenticated users can read task assignees"
  on public.task_assignees for select
  using (auth.uid() is not null);

create policy "Admins can manage task assignees"
  on public.task_assignees for all
  using (public.is_admin());


-- 5. Checklists Policies
create policy "Authenticated users can read checklists"
  on public.checklists for select
  using (auth.uid() is not null);

create policy "Admins can manage checklists"
  on public.checklists for all
  using (public.is_admin());


-- 6. Checklist Items Policies
create policy "Authenticated users can read checklist items"
  on public.checklist_items for select
  using (auth.uid() is not null);

create policy "Admins can manage checklist items"
  on public.checklist_items for all
  using (public.is_admin());

create policy "Assignees can update checklist items"
  on public.checklist_items for update
  using (
    public.is_admin() or 
    exists (
      select 1 from public.task_assignees
      where task_id = (select task_id from public.checklists where id = checklist_id)
      and user_id = auth.uid()
    )
  );


-- 7. Task Reports Policies (Append-only)
create policy "Admins and assignees can read task reports"
  on public.task_reports for select
  using (
    public.is_admin() or 
    exists (
      select 1 from public.task_assignees
      where task_id = task_reports.task_id
      and user_id = auth.uid()
    )
  );

create policy "Admins and assignees can insert task reports"
  on public.task_reports for insert
  with check (
    public.is_admin() or 
    (
      exists (
        select 1 from public.task_assignees
        where task_id = task_reports.task_id
        and user_id = auth.uid()
      ) 
      and auth.uid() = author_id
    )
  );


-- RPC FUNCTION FOR MOVING TASK STATUS --

create or replace function public.move_task_status(p_task_id uuid, p_new_status text)
returns void as $$
declare
  v_user_id uuid;
  v_user_role text;
  v_current_status text;
  v_xp_value integer;
  v_xp_awarded boolean;
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

  select status, xp_value, xp_awarded into v_current_status, v_xp_value, v_xp_awarded
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

  if p_new_status = 'done' and not v_xp_awarded then
    update public.tasks set xp_awarded = true where id = p_task_id;
    update public.profiles
    set xp_total = xp_total + v_xp_value
    where id in (
      select user_id from public.task_assignees where task_id = p_task_id
    );
  end if;

end;
$$ language plpgsql security definer;

-- INDEXES FOR MAXIMUM QUERY SPEED --
create index if not exists idx_tasks_project_id on public.tasks(project_id);
create index if not exists idx_tasks_status on public.tasks(status);
create index if not exists idx_tasks_created_by on public.tasks(created_by);
create index if not exists idx_task_assignees_user_id on public.task_assignees(user_id);
create index if not exists idx_task_assignees_task_id on public.task_assignees(task_id);
create index if not exists idx_checklists_task_id on public.checklists(task_id);
create index if not exists idx_checklist_items_checklist_id on public.checklist_items(checklist_id);
create index if not exists idx_task_reports_task_id on public.task_reports(task_id);

