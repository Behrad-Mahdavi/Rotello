-- SQL Migration / Setup Script for Events & Event Checklist System (Rotello)

-- 1. Create events table
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_date timestamptz,
  location text,
  target_audience text,
  lead_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'planning' check (status in ('planning', 'ready', 'in_progress', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Create event_checklist_items table
create table if not exists public.event_checklist_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  category_key text not null,
  category_title text not null,
  title text not null,
  is_done boolean not null default false,
  notes text,
  assignee_id uuid references public.profiles(id) on delete set null,
  done_by uuid references public.profiles(id) on delete set null,
  done_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.events enable row level security;
alter table public.event_checklist_items enable row level security;

-- Trigger to update events.updated_at
drop trigger if exists update_events_updated_at on public.events;
create trigger update_events_updated_at
  before update on public.events
  for each row execute procedure public.update_updated_at_column();

-- RLS POLICIES FOR events --

-- All authenticated users can view events
drop policy if exists "Authenticated users can read events" on public.events;
create policy "Authenticated users can read events"
  on public.events for select
  using (auth.uid() is not null);

-- Any authenticated user can create an event (they will be lead)
drop policy if exists "Authenticated users can insert events" on public.events;
create policy "Authenticated users can insert events"
  on public.events for insert
  with check (auth.uid() is not null);

-- Event lead or admins can update the event
drop policy if exists "Lead or Admin can update event" on public.events;
create policy "Lead or Admin can update event"
  on public.events for update
  using (lead_id = auth.uid() or public.is_admin());

-- Event lead or admins can delete the event
drop policy if exists "Lead or Admin can delete event" on public.events;
create policy "Lead or Admin can delete event"
  on public.events for delete
  using (lead_id = auth.uid() or public.is_admin());


-- RLS POLICIES FOR event_checklist_items --

-- All authenticated users can read checklist items
drop policy if exists "Authenticated users can read event checklist items" on public.event_checklist_items;
create policy "Authenticated users can read event checklist items"
  on public.event_checklist_items for select
  using (auth.uid() is not null);

-- Event lead or admin can insert checklist items
drop policy if exists "Lead or Admin can insert event checklist items" on public.event_checklist_items;
create policy "Lead or Admin can insert event checklist items"
  on public.event_checklist_items for insert
  with check (
    public.is_admin() or 
    exists (
      select 1 from public.events
      where id = event_checklist_items.event_id and lead_id = auth.uid()
    )
  );

-- Lead, Admin, or the assigned member can update checklist items (toggle done, update notes)
drop policy if exists "Lead, Admin or Assignee can update event checklist items" on public.event_checklist_items;
create policy "Lead, Admin or Assignee can update event checklist items"
  on public.event_checklist_items for update
  using (
    public.is_admin() or 
    assignee_id = auth.uid() or
    exists (
      select 1 from public.events
      where id = event_checklist_items.event_id and lead_id = auth.uid()
    )
  );

-- Lead or Admin can delete checklist items
drop policy if exists "Lead or Admin can delete event checklist items" on public.event_checklist_items;
create policy "Lead or Admin can delete event checklist items"
  on public.event_checklist_items for delete
  using (
    public.is_admin() or 
    exists (
      select 1 from public.events
      where id = event_checklist_items.event_id and lead_id = auth.uid()
    )
  );
