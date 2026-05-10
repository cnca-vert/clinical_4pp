import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CIStudentProfilePage({ params }: PageProps) {
  const supabase = await createClient();

  const { id } = await params;

  const [profileRes, caseTypesRes, requirementsRes, caseLogsRes, assignmentsRes] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email, section")
        .eq("id", id)
        .single(),
      supabase.from("case_types").select("id, name").eq("is_active", true),
      supabase.from("requirements").select("case_type_id, required_count"),
      supabase
        .from("case_logs")
        .select("id, date, notes, case_type_id, case_types(name), areas_of_duty(name)")
        .eq("student_id", id)
        .order("date", { ascending: false }),
      supabase
        .from("assignments")
        .select("id, scheduled_date, end_date, shift_id, status, areas_of_duty(name), shifts(name)")
        .eq("student_id", id)
        .order("scheduled_date", { ascending: false }),
    ]);

  if (!profileRes.data) notFound();

  const profile = profileRes.data;
  const caseTypes = caseTypesRes.data ?? [];
  const requirements = requirementsRes.data ?? [];
  const caseLogs = caseLogsRes.data ?? [];
  const assignments = assignmentsRes.data ?? [];

  // Requirement map
  const reqMap: Record<string, number> = {};
  for (const r of requirements) {
    reqMap[r.case_type_id] = (reqMap[r.case_type_id] ?? 0) + r.required_count;
  }
  const totalRequired = Object.values(reqMap).reduce((s, n) => s + n, 0);

  // Per case type completed
  const casesByType: Record<string, number> = {};
  for (const log of caseLogs) {
    casesByType[log.case_type_id] = (casesByType[log.case_type_id] ?? 0) + 1;
  }

  const completedRequired = Object.entries(reqMap).reduce(
    (sum, [ctId, req]) => sum + Math.min(casesByType[ctId] ?? 0, req),
    0
  );
  const completionPct =
    totalRequired > 0
      ? Math.round((completedRequired / totalRequired) * 100)
      : 0;

  type CaseLogRow = {
    id: string;
    date: string;
    notes: string | null;
    case_type_id: string;
    case_types: { name: string } | null;
    areas_of_duty: { name: string } | null;
  };

  type AssignmentRow = {
    id: string;
    scheduled_date: string;
    end_date: string | null;
    shift_id: string | null;
    shifts: { name: string } | null;
    status: string;
    areas_of_duty: { name: string } | null;
  };

  const typedLogs = caseLogs as unknown as CaseLogRow[];
  const typedAssignments = assignments as unknown as AssignmentRow[];

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
      {/* Back */}
      <Link
        href="/ci/students"
        className="text-xs text-white/40 hover:text-white/70 transition-colors"
      >
        ← Back to Students
      </Link>

      {/* Header */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">{profile.full_name}</h1>
            <p className="text-sm text-white/40">{profile.email}</p>
            {profile.section && (
              <p className="text-xs text-white/40 mt-0.5">{profile.section}</p>
            )}
          </div>
          <div className="text-right">
            <p
              className={`text-2xl font-bold ${
                completionPct >= 100
                  ? "text-green-400"
                  : completionPct >= 50
                    ? "text-accent"
                    : "text-red-400"
              }`}
            >
              {completionPct}%
            </p>
            <p className="text-xs text-white/40">Complete</p>
          </div>
        </div>

        {/* Summary row */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-white/5 p-3">
            <p className="text-lg font-bold text-white">{caseLogs.length}</p>
            <p className="text-xs text-white/40">Cases Logged</p>
          </div>
          <div className="rounded-lg bg-white/5 p-3">
            <p className="text-lg font-bold text-white">
              {typedAssignments.filter((a) => a.status === "scheduled").length}
            </p>
            <p className="text-xs text-white/40">Open Assignments</p>
          </div>
          <div className="rounded-lg bg-white/5 p-3">
            <p className="text-lg font-bold text-white">{totalRequired}</p>
            <p className="text-xs text-white/40">Required Total</p>
          </div>
        </div>

        {/* Per Case Type Progress */}
        {caseTypes.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/50">
              Requirements
            </p>
            {caseTypes.map((ct) => {
              const req = reqMap[ct.id] ?? 0;
              const done = casesByType[ct.id] ?? 0;
              const pct =
                req > 0 ? Math.min(100, Math.round((done / req) * 100)) : 0;
              const met = req > 0 && done >= req;
              return (
                <div key={ct.id}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-white/70">{ct.name}</span>
                    <span
                      className={`text-xs font-semibold ${met ? "text-green-400" : "text-accent"}`}
                    >
                      {done}/{req || "—"}
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-white/10">
                    <div
                      className={`h-2.5 rounded-full transition-all ${met ? "bg-green-500" : "bg-accent"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Case Log History */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider">
          Case History ({typedLogs.length})
        </h2>
        {typedLogs.length === 0 ? (
          <EmptyState message="No cases logged yet." />
        ) : (
          <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
            <div className="divide-y divide-white/5">
              {typedLogs.map((log) => (
                <div
                  key={log.id}
                  className="grid grid-cols-[1fr_1fr_120px] gap-2 items-center px-4 py-3"
                >
                  <span className="text-sm text-white">
                    {log.case_types?.name ?? "—"}
                  </span>
                  <span className="text-sm text-white/60">
                    {log.areas_of_duty?.name ?? "—"}
                  </span>
                  <span className="text-sm text-white/50 text-right">
                    {log.date
                      ? new Date(log.date).toLocaleDateString("en-AU", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}
                  </span>
                  {log.notes && (
                    <p className="col-span-3 text-xs text-white/40 -mt-1 pb-1">
                      {log.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Assignments */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider">
          Assignments ({typedAssignments.length})
        </h2>
        {typedAssignments.length === 0 ? (
          <EmptyState message="No assignments." />
        ) : (
          <div className="space-y-2">
            {typedAssignments.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-white">
                    {a.areas_of_duty?.name ?? "—"}
                  </p>
                  <p className="text-xs text-white/50">
                    {a.scheduled_date
                      ? new Date(a.scheduled_date).toLocaleDateString(
                          "en-AU",
                          { day: "numeric", month: "short", year: "numeric" }
                        )
                      : "—"}
                    {a.end_date && a.end_date !== a.scheduled_date && (
                      <> – {new Date(a.end_date).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}</>
                    )}
                    {a.shifts?.name && <> · {a.shifts.name}</>}
                  </p>
                </div>
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${
                    a.status === "assigned"
                      ? "bg-accent/20 text-accent"
                      : a.status === "completed"
                        ? "bg-green-500/20 text-green-400"
                        : "bg-red-500/20 text-red-400"
                  }`}
                >
                  {a.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
      <p className="text-sm text-white/40">{message}</p>
    </div>
  );
}
