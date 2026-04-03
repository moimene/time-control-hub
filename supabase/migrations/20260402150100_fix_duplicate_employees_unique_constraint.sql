-- Migration: Fix duplicate employees and add UNIQUE constraint on employees.user_id
--
-- Root cause: The seed was run multiple times with different prefixes (INTEMP vs BAR),
-- creating 2 employee records per user_id. This causes:
-- 1. HTTP 406 errors when .single() queries return multiple rows
-- 2. Empty absence type dropdown (query fails before loading types)
-- 3. Inconsistent data visible in admin and asesor tables
--
-- Strategy:
-- 1. Delete INTEMP-prefixed employees that have NO time_events (safe to delete)
-- 2. For INTEMP employees WITH data: nullify user_id to break the duplicate link
--    (preserves historical data but deactivates them)
-- 3. Add UNIQUE constraint on user_id (allowing NULLs - multiple employees can have NULL user_id)

-- Step 1: Delete INTEMP employees that have no dependencies
-- First, clean up any rule_assignments for INTEMP employees with no time_events
DELETE FROM public.rule_assignments
WHERE employee_id IN (
  SELECT e.id FROM public.employees e
  WHERE e.employee_code LIKE 'INTEMP%'
  AND NOT EXISTS (
    SELECT 1 FROM public.time_events te WHERE te.employee_id = e.id
  )
);

-- Delete INTEMP employees with no time_events
DELETE FROM public.employees
WHERE employee_code LIKE 'INTEMP%'
AND NOT EXISTS (
  SELECT 1 FROM public.time_events te WHERE te.employee_id = id
);

-- Step 2: For remaining INTEMP employees (those with time_events),
-- set user_id to NULL and status to inactive to prevent duplicate conflicts
UPDATE public.employees
SET user_id = NULL,
    status = 'inactive',
    updated_at = now()
WHERE employee_code LIKE 'INTEMP%'
AND user_id IS NOT NULL;

-- Step 3: Add UNIQUE constraint on user_id (NULLs are allowed and not considered duplicates in PostgreSQL)
-- This prevents future duplicate employee records per user
ALTER TABLE public.employees
ADD CONSTRAINT employees_user_id_unique UNIQUE (user_id);

-- Verify: After this migration, each user_id should appear at most once
-- SELECT user_id, count(*) FROM employees WHERE user_id IS NOT NULL GROUP BY user_id HAVING count(*) > 1;
-- Should return 0 rows
