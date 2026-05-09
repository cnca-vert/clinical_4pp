import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AssignmentsClient from "./AssignmentsClient";

export type Assignment = {
  id: string;
  area_of_duty_id: string;
  scheduled_date: string;
  end_date: string | null;
  shift_id: string | null;
  rotation_id: string | null;
  shifts: { name: string } | null;
  rotations: { name: string; inclusive_days: number[] | null } | null;
  status: "scheduled" | "completed" | "missed" | "cancel_requested" | "cancelled";
  notes: string | null;
  cancellation_reason: string | null;
  areas_of_duty: { name: string } | null;
};

export default async function StudentAssignmentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch the student's roster_id so we can include pre-assigned rotations
  const { data: profile } = await supabase
    .from("profiles")
    .select("roster_id")
    .eq("id", user.id)
    .single();

  const rosterId = profile?.roster_id ?? null;

  const baseQuery = supabase
    .from("assignments")
    .select(
      "id, area_of_duty_id, shift_id, rotation_id, scheduled_date, end_date, status, notes, cancellation_reason, areas_of_duty(name), shifts(name), rotations(name, inclusive_days)"
    )
    .order("scheduled_date", { ascending: false });

  const { data } = await (rosterId
    ? baseQuery.or(`student_id.eq.${user.id},roster_id.eq.${rosterId}`)
    : baseQuery.eq("student_id", user.id));

  const assignments: Assignment[] = (data ?? []) as unknown as Assignment[];

  const open = assignments.filter((a) => a.status === "scheduled" || a.status === "cancel_requested");
  const past = assignments.filter((a) => a.status !== "scheduled" && a.status !== "cancel_requested");

  return <AssignmentsClient open={open} past={past} />;
}

