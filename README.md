# رکاد (Roka) — Task Manager

Kanban-based task management for "باشگاه کسب‌وکار رکاد" startup school.

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2.12 (Turbopack, App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 (`@theme inline`, CSS-first config) |
| Auth / DB | Supabase (PostgreSQL, RLS, Auth) |
| Drag & Drop | `@dnd-kit/core` + `@dnd-kit/sortable` |
| Icons | `lucide-react` |
| Font | IRANSansX (11 weights, Persian + numerals) |

## Project Structure

```
src/
├── app/
│   ├── admin/
│   │   ├── layout.tsx          — White sidebar + bg-canvas
│   │   ├── members/page.tsx    — List + create members (admin only)
│   │   └── projects/page.tsx   — List + create/delete projects (admin only)
│   ├── api/admin/create-user/route.ts  — Create auth user via service-role key
│   ├── login/page.tsx          — Email/password login
│   ├── signup/page.tsx         — Self-register → redirects to /login
│   ├── profile/page.tsx        — User profile with XP display
│   ├── projects/
│   │   ├── [projectId]/board/page.tsx   — Kanban board with DnD columns
│   │   └── [projectId]/tasks/[taskId]/page.tsx  — Full-page task detail
│   ├── globals.css             — Theme tokens, font faces, base styles
│   ├── layout.tsx              — Root layout (rtl, font-sans)
│   └── page.tsx                — Redirects to /login
├── components/
│   ├── LogoutButton.tsx        — Minimal outline-style logout
│   ├── TaskCard.tsx            — Sortable card (useSortable)
│   ├── TaskColumn.tsx          — Droppable column (useDroppable)
│   ├── TaskDetailModal.tsx     — Detail/checklist/reports/delete modal
│   └── CreateTaskModal.tsx     — Admin-only: create task + assignees + checklists
├── utils/
│   ├── supabase/
│   │   ├── client.ts           — createBrowserClient (browser)
│   │   ├── server.ts           — createServerClient (RSC, Route Handlers)
│   │   ├── admin.ts            — createClient with service-role key
│   │   ├── middleware.ts       — Session refresh helper (updateSession)
│   │   └── user.ts             — getCurrentUserProfile() helper
│   └── database.types.ts       — TypeScript interfaces matching DB schema
└── proxy.ts                    — Auth middleware (login redirect, role guard)
```

## Roles & Permissions

| Action | Admin | Member (Assignee) | Member (not assignee) |
|--------|-------|-------------------|----------------------|
| Read projects/tasks | ✓ | ✓ | ✓ |
| Create project | ✓ | — | — |
| Delete project | ✓ | — | — |
| Create task | ✓ | — | — |
| Delete task | ✓ | — | — |
| Move task (any status) | ✓ | — | — |
| Move task (backlog→todo→in_progress) | — | ✓ | — |
| Move to done | ✓ | — | — |
| Toggle checklist item | ✓ | ✓ | — |
| Add report | ✓ | ✓ | — |
| Read reports | ✓ | ✓ (assigned tasks) | — |
| Award XP | Auto on move to done | — | — |
| Create member accounts | ✓ (via API) | — | — |

## Task Status Flow

```
backlog → todo → in_progress → done
  ↑          ↑          ↑          ↑
 admin    assignee   assignee     admin only
```

Members can only move their assigned tasks one step forward. Only admin can set `done`.

## XP System

- Defined per task (`xp_value`) in CreateTaskModal
- Awarded once when task moves to `done`
- Split equally among all assignees
- `xp_awarded` flag prevents double-award (checked in `move_task_status` RPC)
- Displayed on profile page and board header

## Database Schema (`supabase/setup.sql`)

**Tables:** `profiles`, `projects`, `tasks`, `task_assignees`, `checklists`, `checklist_items`, `task_reports`

**RLS policies:** All tables have row-level security. Admin can manage all. Members read-only with specific update/insert scopes on their assigned tasks.

**Triggers:**
- `handle_new_user` — auto-create profile on auth signup
- `check_profile_updates` — prevent non-admin role/XP edits
- `update_updated_at_column` — auto-update `tasks.updated_at`

**RPC:** `move_task_status(p_task_id, p_new_status)` — enforces role-based transitions, XP award

### Foreign Key Cascades

- `profiles.id → auth.users.id` → `on delete cascade`
- `tasks.project_id → projects.id` → `on delete cascade`
- `task_assignees.task_id → tasks.id` → `on delete cascade`
- All checklists, items, reports cascade from `tasks.id`

## Auth Middleware (`src/proxy.ts`)

- Reads session from cookies via `@supabase/ssr`
- Unauthenticated users redirected to `/login` or `/signup`
- Authenticated users at `/login` redirected to their landing page
- Non-admin users accessing `/admin/*` redirected to `/projects`
- Root `/` redirects based on role

## Design Tokens (`globals.css`)

```css
@theme inline {
  --color-canvas:      #FAF5F7;  /* pastel pink/purple bg */
  --color-surface:     #FFFFFF;  /* white cards */
  --color-action:      #59BBAF;  /* verdigris teal */
  --color-admin:       #5E308B;  /* rebecca purple */
  --color-xp:          #ECA842;  /* crayola gold */
  --color-danger:      #E0195B;  /* ruby */
  --color-stage-*:     /* per-status column colors */
}
```

Style approach: **flat, borderless, minimal** — soft shadows (`shadow-sm`), rounded corners (`rounded-xl`/`rounded-2xl`), pill-shaped buttons with pastel backgrounds, no visible borders.

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # for admin user creation API
```

## Scripts

| Command | Action |
|---------|--------|
| `npm run dev` | Start Turbopack dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
# Rotello
