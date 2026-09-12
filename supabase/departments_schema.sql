-- ==============================================================================
-- ROTELLO DEPARTMENTS, LEVELS AND 3-TIER ROLES MIGRATION
-- ==============================================================================

-- 1. Update role check constraint on public.profiles to allow 'admin', 'mentor', 'member'
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('admin', 'mentor', 'member'));

-- 2. Add departments column to public.profiles
-- Format: JSONB array of objects: [{"department": "engineers", "level": "A"}, ...]
alter table public.profiles add column if not exists departments jsonb default '[]'::jsonb;
alter table public.profiles add column if not exists avatar_url text;

-- 3. Add department column to public.projects
-- Can be 'engineers', 'artists', 'generalists', or null (general/all)
alter table public.projects add column if not exists department text;

-- 4. Update check_profile_updates trigger function to support mentor role
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

-- 5. Restrict XP to 'member' role only (Mentors and Admins do not receive XP)
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
  v_target_role text;
begin
  v_admin_id := auth.uid();
  if v_admin_id is null or not public.is_admin() then
    raise exception 'فقط مدیران سیستم مجاز به تغییر امتیاز هستند.';
  end if;

  select role into v_target_role from public.profiles where id = p_user_id;
  if v_target_role is null then
    raise exception 'عضو مورد نظر یافت نشد.';
  end if;

  if v_target_role <> 'member' then
    raise exception 'سیستم امتیاز (XP) منحصراً برای اعضا است و منتورها و راهبرها امتیاز دریافت نمی‌کنند.';
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

  update public.profiles
  set xp_total = greatest(0, xp_total + v_delta)
  where id = p_user_id and role = 'member'
  returning xp_total into v_new_xp;

  insert into public.xp_adjustments (user_id, amount, reason, type, created_by)
  values (p_user_id, v_delta, trim(p_reason), p_type, v_admin_id);

  return v_new_xp;
end;
$$ language plpgsql security definer;

-- 6. Update update_task_status_with_xp to only grant XP to 'member' role
create or replace function public.update_task_status_with_xp(
  p_task_id uuid,
  p_new_status text
)
returns void as $$
declare
  v_user_id uuid;
  v_current_status text;
  v_xp_value integer;
  v_xp_awarded boolean;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select status, xp_value, coalesce(xp_awarded, false)
  into v_current_status, v_xp_value, v_xp_awarded
  from public.tasks
  where id = p_task_id;

  if not found then
    raise exception 'Task not found';
  end if;

  if v_current_status = p_new_status then
    return;
  end if;

  update public.tasks set status = p_new_status where id = p_task_id;

  -- Case A: Moved to done and not previously awarded -> Award XP strictly to 'member' role
  if p_new_status = 'done' and not v_xp_awarded then
    update public.tasks set xp_awarded = true where id = p_task_id;
    if v_xp_value > 0 then
      update public.profiles
      set xp_total = xp_total + v_xp_value
      where id in (
        select ta.user_id from public.task_assignees ta
        join public.profiles p on p.id = ta.user_id
        where ta.task_id = p_task_id and p.role = 'member'
      );

      insert into public.xp_adjustments (user_id, amount, reason, type, created_by)
      select 
        ta.user_id, 
        v_xp_value, 
        'تکمیل تسک: ' || (select coalesce(title, 'بدون عنوان') from public.tasks where id = p_task_id), 
        'task_completion', 
        v_user_id
      from public.task_assignees ta
      join public.profiles p on p.id = ta.user_id
      where ta.task_id = p_task_id and p.role = 'member';
    end if;

  -- Case B: Moved OUT of done and was previously awarded -> Reverse XP strictly for 'member' role
  elsif v_current_status = 'done' and p_new_status <> 'done' and v_xp_awarded then
    update public.tasks set xp_awarded = false where id = p_task_id;
    if v_xp_value > 0 then
      update public.profiles
      set xp_total = greatest(0, xp_total - v_xp_value)
      where id in (
        select ta.user_id from public.task_assignees ta
        join public.profiles p on p.id = ta.user_id
        where ta.task_id = p_task_id and p.role = 'member'
      );

      insert into public.xp_adjustments (user_id, amount, reason, type, created_by)
      select 
        ta.user_id, 
        -v_xp_value, 
        'خروج تسک از تکمیل‌شده: ' || (select coalesce(title, 'بدون عنوان') from public.tasks where id = p_task_id), 
        'task_reversal', 
        v_user_id
      from public.task_assignees ta
      join public.profiles p on p.id = ta.user_id
      where ta.task_id = p_task_id and p.role = 'member';
    end if;
  end if;

end;
$$ language plpgsql security definer;

-- 7. Helpful comments
comment on column public.profiles.departments is 'Array of departments and levels assigned to the user: [{"department": "engineers"|"artists"|"generalists", "level": "A"|"B"}]';
comment on column public.projects.department is 'Department this project belongs to: "engineers"|"artists"|"generalists" or null for general';

