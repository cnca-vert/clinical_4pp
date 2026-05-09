-- Make student_id nullable to support pre-roster assignments
ALTER TABLE public.assignments ALTER COLUMN student_id DROP NOT NULL;

-- Add roster_id FK for pre-signup assignments
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS roster_id uuid REFERENCES public.student_roster(id) ON DELETE CASCADE;

-- Ensure at least one target is set
ALTER TABLE public.assignments
  ADD CONSTRAINT chk_assignment_has_target
  CHECK (student_id IS NOT NULL OR roster_id IS NOT NULL);

-- Update RLS: students can see assignments via roster_id too
DROP POLICY IF EXISTS "assignments: student read own" ON public.assignments;
CREATE POLICY "assignments: student read own"
  ON public.assignments FOR SELECT
  USING (
    student_id = auth.uid()
    OR roster_id = (SELECT roster_id FROM public.profiles WHERE id = auth.uid())
    OR get_my_role() = ANY (ARRAY['admin'::user_role, 'ci'::user_role])
  );
