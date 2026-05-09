import { createClient } from "@/lib/supabase/server";
import { format } from "date-fns";
import AssignForm from "./AssignForm";
import { updateAssignmentStatus } from "./actions";
import SubmitButton from "@/components/ui/SubmitButton";

const STATUS_STYLE: Record<string, string> = {
  scheduled: "text-(--status-assigned) bg-blue-500/10",
  completed: "text-(--status-completed) bg-green-500/10",
  missed: "text-(--status-rejected) bg-red-500/10",
  cancel_requested: "text-amber-400 bg-amber-500/10",
  cancelled: "text-(--text-muted) bg-neutral-500/10",
};

export default async function AssignmentsPage() {
  const supabase = await createClient();

  const [{ data: areasOfDuty }, { data: shifts }, { data: rotations }, { data: students }, { data: clinicalInstructors }] =
    await Promise.all([
      supabase.from("areas_of_duty").select("id, name").eq("is_active", true).order("name"),
      supabase.from("shifts").select("id, name").eq("is_active", true).order("name"),
      supabase.from("rotations").select("id, name, inclusive_days").order("name"),
      supabase
        .from("profiles")
        .select("id, full_name, section")
        .eq("role", "student")
        .eq("is_active", true)
        .order("full_name"),
      supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "ci")
        .eq("is_active", true)
        .order("full_name"),
    ]);

  // Build enriched student list (location-first: no case type)
  let recommended: {
    id: string;
    full_name: string;
    section: string | null;
    total_assignments: number;
    total_cases: number;
    last_assigned: string | null;
    area_duty_count: number;
    priority: "high" | "medium" | "low";
  }[] = [];

  const quickStats = { noAssignments: 0, completedPct: 0, totalStudents: students?.length ?? 0 };

  if (students && students.length > 0) {
    const { data: allLogs } = await supabase.from("case_logs").select("student_id");

    const { data: allAssignments } = await supabase
      .from("assignments")
      .select("student_id, scheduled_date, area_of_duty_id, status")
      .in("status", ["scheduled", "completed"]);

    const totalCaseMap: Record<string, number> = {};
    for (const log of allLogs ?? []) {
      totalCaseMap[log.student_id] = (totalCaseMap[log.student_id] ?? 0) + 1;
    }

    const totalAssignmentMap: Record<string, number> = {};
    const lastAssignedMap: Record<string, string> = {};
    const areaDutyCountMap: Record<string, number> = {};
    for (const a of allAssignments ?? []) {
      totalAssignmentMap[a.student_id] = (totalAssignmentMap[a.student_id] ?? 0) + 1;
      if (!lastAssignedMap[a.student_id] || a.scheduled_date > lastAssignedMap[a.student_id]) {
        lastAssignedMap[a.student_id] = a.scheduled_date;
      }
      areaDutyCountMap[a.student_id] = (areaDutyCountMap[a.student_id] ?? 0) + 1;
    }

    recommended = students.map((s) => {
      const totalAssignments = totalAssignmentMap[s.id] ?? 0;
      const priority: "high" | "medium" | "low" =
        totalAssignments === 0 ? "high" : totalAssignments <= 2 ? "medium" : "low";
      return {
        id: s.id,
        full_name: s.full_name,
        section: s.section,
        total_assignments: totalAssignments,
        total_cases: totalCaseMap[s.id] ?? 0,
        last_assigned: lastAssignedMap[s.id] ?? null,
        area_duty_count: areaDutyCountMap[s.id] ?? 0,
        priority,
      };
    }).sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.priority] - order[b.priority] || a.total_assignments - b.total_assignments;
    });

    quickStats.noAssignments = recommended.filter((s) => s.total_assignments === 0).length;
    const withCases = recommended.filter((s) => s.total_cases > 0).length;
    quickStats.completedPct = quickStats.totalStudents > 0
      ? Math.round((withCases / quickStats.totalStudents) * 100)
      : 0;
  }

  const { data: activeSemester } = await supabase
    .from("semesters")
    .select("name, start_date, end_date")
    .eq("is_active", true)
    .maybeSingle();

  const { data: assignments } = await supabase
    .from("assignments")
    .select(
      "id, scheduled_date, end_date, shift_id, rotation_id, status, notes, cancellation_reason, student:profiles!student_id(full_name), location:areas_of_duty(name), shift:shifts(name), rotation:rotations(name)"
    )
    .order("scheduled_date", { ascending: false })
    .limit(50);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-xl font-bold text-foreground">Assignments</h1>
        <p className="mt-1 text-sm text-(--text-secondary)">
          Assign students to areas of duty. Select one or multiple students for bulk assignment.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <AssignForm
          areasOfDuty={areasOfDuty ?? []}
          shifts={shifts ?? []}
          rotations={rotations ?? []}
          recommended={recommended}
          quickStats={quickStats}
          clinicalInstructors={clinicalInstructors ?? []}
          semesterWindow={
            activeSemester
              ? {
                  name: activeSemester.name,
                  start: activeSemester.start_date,
                  end: activeSemester.end_date ?? null,
                }
              : null
          }
        />

        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-(--text-secondary)">
            Recent Assignments
          </h2>
          {(assignments ?? []).length === 0 ? (
            <div className="flex items-center justify-center rounded-xl border border-dashed border-border py-12">
              <p className="text-xs text-(--text-muted)">No assignments yet</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {(assignments ?? []).map((a) => {
                const student = Array.isArray(a.student) ? a.student[0] : a.student;
                const location = Array.isArray(a.location) ? a.location[0] : a.location;
                const statusStyle = STATUS_STYLE[a.status] ?? STATUS_STYLE.scheduled;

                return (
                  <li
                    key={a.id}
                    className="rounded-xl border border-border bg-surface px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {student?.full_name ?? "\u2014"}
                        </p>
                        <p className="text-xs text-(--text-muted)">
                          {location?.name ?? "\u2014"}
                        </p>
                        <p className="text-xs text-(--text-muted)">
                          {format(new Date(a.scheduled_date), "MMM d, yyyy")}
                          {a.end_date && a.end_date !== a.scheduled_date && ` � ${format(new Date(a.end_date), "MMM d, yyyy")}`}
                          {(a.shift as unknown as { name: string } | null)?.name && ` � ${(a.shift as unknown as { name: string } | null)?.name}`}
                          {(a.rotation as unknown as { name: string } | null)?.name && ` � ${(a.rotation as unknown as { name: string } | null)?.name}`}
                          {a.notes && ` � ${a.notes}`}
                        </p>
                        {a.cancellation_reason && (
                          <p className="text-xs text-amber-400/80 mt-0.5">
                            Cancel reason: {a.cancellation_reason}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusStyle}`}>
                          {a.status === "cancel_requested" ? "Cancel Req" : a.status}
                        </span>
                        {a.status === "scheduled" && (
                          <div className="flex gap-1">
                            <form action={updateAssignmentStatus}>
                              <input type="hidden" name="assignment_id" value={a.id} />
                              <input type="hidden" name="status" value="completed" />
                              <SubmitButton variant="ghost" label="Complete" />
                            </form>
                            <form action={updateAssignmentStatus}>
                              <input type="hidden" name="assignment_id" value={a.id} />
                              <input type="hidden" name="status" value="missed" />
                              <SubmitButton variant="danger" label="Missed" />
                            </form>
                            <form action={updateAssignmentStatus}>
                              <input type="hidden" name="assignment_id" value={a.id} />
                              <input type="hidden" name="status" value="cancelled" />
                              <SubmitButton variant="ghost" label="Cancel" />
                            </form>
                          </div>
                        )}
                        {a.status === "cancel_requested" && (
                          <div className="flex gap-1">
                            <form action={updateAssignmentStatus}>
                              <input type="hidden" name="assignment_id" value={a.id} />
                              <input type="hidden" name="status" value="cancelled" />
                              <SubmitButton variant="danger" label="Approve" />
                            </form>
                            <form action={updateAssignmentStatus}>
                              <input type="hidden" name="assignment_id" value={a.id} />
                              <input type="hidden" name="status" value="scheduled" />
                              <SubmitButton variant="ghost" label="Deny" />
                            </form>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
