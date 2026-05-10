import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AnnouncementsFeed from "@/components/shared/AnnouncementsFeed";
import { ClipboardList, Target, Upload, CalendarClock, MapPin, TrendingUp } from "lucide-react";

export default async function StudentDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch everything in parallel
  const [caseTypesRes, requirementsRes, caseLogsRes, uploadsRes, assignmentsRes, announcementsRes] =
    await Promise.all([
      supabase.from("case_types").select("id, name").eq("is_active", true),
      supabase.from("requirements").select("case_type_id, required_count"),
      supabase
        .from("case_logs")
        .select("case_type_id, area_of_duty_id, date, areas_of_duty(name)")
        .eq("student_id", user.id),
      supabase
        .from("uploads")
        .select("id, status")
        .eq("student_id", user.id),
      supabase
        .from("assignments")
        .select("id, status")
        .eq("student_id", user.id),
      supabase
        .from("announcements")
        .select("id, title, content, created_at, profiles(full_name)")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  const caseTypes = caseTypesRes.data ?? [];
  const requirements = requirementsRes.data ?? [];
  const caseLogs = caseLogsRes.data ?? [];
  const uploads = uploadsRes.data ?? [];
  const assignments = assignmentsRes.data ?? [];
  const announcements = (announcementsRes.data ?? []) as unknown as Parameters<typeof AnnouncementsFeed>[0]["announcements"];

  // Build requirement map: case_type_id → required_count
  const reqMap: Record<string, number> = {};
  for (const r of requirements) {
    reqMap[r.case_type_id] = (reqMap[r.case_type_id] ?? 0) + r.required_count;
  }

  // Build completed map: case_type_id → count from case_logs
  const completedMap: Record<string, number> = {};
  for (const log of caseLogs) {
    completedMap[log.case_type_id] = (completedMap[log.case_type_id] ?? 0) + 1;
  }

  // Build location distribution
  const locationMap: Record<string, number> = {};
  for (const log of caseLogs) {
    const locName = (log.areas_of_duty as unknown as { name: string } | null)?.name ?? "Unknown";
    locationMap[locName] = (locationMap[locName] ?? 0) + 1;
  }
  const locationEntries = Object.entries(locationMap).sort((a, b) => b[1] - a[1]);

  // Summary stats
  const totalRequired = Object.values(reqMap).reduce((a, b) => a + b, 0);
  const totalCompleted = caseLogs.length;
  const pendingUploads = uploads.filter((u) => u.status === "pending").length;
  const pendingAssignments = assignments.filter(
    (a) => a.status === "scheduled"
  ).length;

  const overallPct =
    totalRequired > 0
      ? Math.min(100, Math.round((totalCompleted / totalRequired) * 100))
      : 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">My Progress</h1>
        <p className="text-sm text-white/50 mt-1">
          Track your clinical case completion across all required categories.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard label="Cases Completed" value={totalCompleted} icon={<ClipboardList className="h-5 w-5" />} />
        <SummaryCard label="Cases Required" value={totalRequired} icon={<Target className="h-5 w-5" />} />
        <SummaryCard label="Pending Uploads" value={pendingUploads} icon={<Upload className="h-5 w-5" />} />
        <SummaryCard label="Open Assignments" value={pendingAssignments} icon={<CalendarClock className="h-5 w-5" />} />
      </div>

      {/* Overall Progress */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-accent" />
            <span className="text-sm font-medium text-white/80">
              Overall Completion
            </span>
          </div>
          <span className="text-sm font-bold text-accent">
            {totalCompleted} / {totalRequired}
          </span>
        </div>
        <ProgressBar pct={overallPct} />
        <p className="text-xs text-white/40 mt-2">{overallPct}% complete</p>
      </div>

      {/* Per-Case-Type Progress */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-5">
        <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wider">
          Progress by Case Type
        </h2>
        {caseTypes.length === 0 ? (
          <p className="text-sm text-white/40">No case types configured yet.</p>
        ) : (
          caseTypes.map((ct) => {
            const required = reqMap[ct.id] ?? 0;
            const completed = completedMap[ct.id] ?? 0;
            const pct =
              required > 0
                ? Math.min(100, Math.round((completed / required) * 100))
                : completed > 0
                ? 100
                : 0;
            const met = required > 0 && completed >= required;
            return (
              <div key={ct.id}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-white/80">{ct.name}</span>
                  <span
                    className={`text-xs font-semibold ${
                      met
                        ? "text-green-400"
                        : required > 0
                        ? "text-accent"
                        : "text-white/40"
                    }`}
                  >
                    {completed} / {required || "—"}
                  </span>
                </div>
                <ProgressBar pct={pct} met={met} />
              </div>
            );
          })
        )}
      </div>

      {/* Location Distribution */}
      {locationEntries.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wider">
              Cases by Area of Duty
            </h2>
          </div>
          {locationEntries.map(([loc, count]) => (
            <div key={loc} className="flex items-center gap-3">
              <span className="text-sm text-white/70 w-40 truncate">{loc}</span>
              <div className="flex-1 bg-white/10 rounded-full h-3">
                <div
                  className="h-3 rounded-full bg-accent/70 transition-all"
                  style={{
                    width: `${Math.round(
                      (count / caseLogs.length) * 100
                    )}%`,
                  }}
                />
              </div>
              <span className="text-xs font-medium text-white/50 w-8 text-right">
                {count}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Announcements */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wider">
          Announcements
        </h2>
        <AnnouncementsFeed announcements={announcements} />
      </div>
    </div>
  );
}

function SummaryCard({ label, value, icon }: { label: string; value: number; icon?: React.ReactNode }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white/50">
          {icon}
        </div>
        <p className="text-3xl font-bold text-accent">{value}</p>
      </div>
      <p className="text-xs font-medium text-white/50">{label}</p>
    </div>
  );
}

function ProgressBar({ pct, met }: { pct: number; met?: boolean }) {
  return (
    <div className="w-full bg-white/10 rounded-full h-3.5">
      <div
        className={`h-3.5 rounded-full transition-all ${
          met ? "bg-green-500" : "bg-accent"
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
