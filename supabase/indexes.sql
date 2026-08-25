-- High-performance B-tree Indexes for Rotello (Tasks, Assignees, Events, Checklists)
-- Run this in your Supabase SQL Editor for instant query performance acceleration!

-- 1. Tasks Indexes
create index if not exists idx_tasks_project_id on public.tasks(project_id);
create index if not exists idx_tasks_status on public.tasks(status);
create index if not exists idx_tasks_created_by on public.tasks(created_by);
create index if not exists idx_tasks_created_at on public.tasks(created_at desc);

-- 2. Task Assignees Indexes
create index if not exists idx_task_assignees_user_id on public.task_assignees(user_id);
create index if not exists idx_task_assignees_task_id on public.task_assignees(task_id);

-- 3. Checklists & Items Indexes
create index if not exists idx_checklists_task_id on public.checklists(task_id);
create index if not exists idx_checklist_items_checklist_id on public.checklist_items(checklist_id);
create index if not exists idx_checklist_items_done_by on public.checklist_items(done_by);

-- 4. Task Reports Indexes
create index if not exists idx_task_reports_task_id on public.task_reports(task_id);
create index if not exists idx_task_reports_author_id on public.task_reports(author_id);

-- 5. Events & Event Checklist Items Indexes
create index if not exists idx_events_lead_id on public.events(lead_id);
create index if not exists idx_events_status on public.events(status);
create index if not exists idx_events_created_at on public.events(created_at desc);
create index if not exists idx_event_checklist_items_event_id on public.event_checklist_items(event_id);
create index if not exists idx_event_checklist_items_assignee_id on public.event_checklist_items(assignee_id);
create index if not exists idx_event_checklist_items_done_by on public.event_checklist_items(done_by);
