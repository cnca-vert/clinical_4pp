"use client";

import { useActionState, useState, useCallback, useMemo, useTransition } from "react";
import { createAssignment, bulkAssign, checkConflicts } from "./actions";
import type { ConflictWarning } from "./actions";
import SubmitButton from "@/components/ui/SubmitButton";

type AreaOfDuty = { id: string; name: string };
type Shift = { id: string; name: string };
type Rotation = { id: string; name: string; inclusive_days: number[] | null };
type ClinicalInstructor = { id: string; full_name: string };

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type RecommendedStudent = {
  id: string;
  full_name: string;
  section: string | null;
  total_assignments: number;
  total_cases: number;
  last_assigned: string | null;
  area_duty_count: number;
  priority: "high" | "medium" | "low";
};

interface Props {
  areasOfDuty: AreaOfDuty[];
  shifts: Shift[];
  rotations: Rotation[];
  recommended: RecommendedStudent[];
  quickStats: { noAssignments: number; completedPct: number; totalStudents: number };
  semesterWindow: { name: string; start: string; end: string | null } | null;
  clinicalInstructors: ClinicalInstructor[];
}

type ActionState = { error: string | null; success: boolean; message?: string };
const initialState: ActionState = { error: null, success: false };

const PRIORITY_LABEL = {
  high: { label: "No assignments", color: "text-(--status-rejected)", bg: "bg-red-500/10" },
  medium: { label: "Few assignments", color: "text-(--status-pending)", bg: "bg-yellow-500/10" },
  low: { label: "Well assigned", color: "text-(--status-processed)", bg: "bg-green-500/10" },
};

type SortKey = "priority" | "total_cases" | "total_assignments" | "last_assigned" | "area_duty_count";

export default function AssignForm({ areasOfDuty, shifts, rotations, recommended, quickStats, semesterWindow, clinicalInstructors }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("priority");
  const [filterMode, setFilterMode] = useState<"all" | "low_exposure">("all");
  const [warnings, setWarnings] = useState<ConflictWarning[]>([]);
  const [selectedRotationId, setSelectedRotationId] = useState("");
  const [inclusiveDays, setInclusiveDays] = useState<Set<number>>(new Set());
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [, startTransition] = useTransition();

  const toggleInclusiveDay = useCallback((day: number) => {
    setInclusiveDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }, []);

  const toggleStudent = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllFiltered = useCallback((ids: string[]) => {
    setSelected((prev) => {
      const allSelected = ids.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }, []);

  // Filter -> search -> sort
  const filteredStudents = useMemo(() => {
    let list = recommended;

    if (filterMode === "low_exposure") {
      list = list.filter((s) => s.total_assignments === 0);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.full_name.toLowerCase().includes(q) ||
          (s.section && s.section.toLowerCase().includes(q)),
      );
    }

    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case "priority": {
          const order = { high: 0, medium: 1, low: 2 };
          return order[a.priority] - order[b.priority] || a.total_assignments - b.total_assignments;
        }
        case "total_cases":
          return a.total_cases - b.total_cases;
        case "total_assignments":
          return a.total_assignments - b.total_assignments;
        case "last_assigned": {
          const aDate = a.last_assigned ?? "";
          const bDate = b.last_assigned ?? "";
          return aDate.localeCompare(bDate);
        }
        case "area_duty_count":
          return b.area_duty_count - a.area_duty_count;
        default:
          return 0;
      }
    });

    return list;
  }, [recommended, search, sortBy, filterMode]);

  const [singleState, singleAction] = useActionState(
    async (_prev: ActionState, formData: FormData): Promise<ActionState> => {
      const result = await createAssignment(formData);
      if (!result || result.success) {
        setSelected(new Set());
        return { error: null, success: true, message: "Assignment created." };
      }
      return { error: result.error ?? "Unknown error.", success: false };
    },
    initialState,
  );

  const [bulkState, bulkAction] = useActionState(
    async (_prev: ActionState, formData: FormData): Promise<ActionState> => {
      const result = await bulkAssign(formData);
      if (!result || result.success) {
        setSelected(new Set());
        return { error: null, success: true, message: `${result?.count ?? 0} assignments created.` };
      }
      return { error: result.error ?? "Unknown error.", success: false };
    },
    initialState,
  );

  const state = selected.size > 1 ? bulkState : singleState;

  const handleCheckConflicts = useCallback(
    (date: string, areaOfDutyId: string) => {
      if (!date || !areaOfDutyId || selected.size === 0) {
        setWarnings([]);
        return;
      }
      startTransition(async () => {
        const w = await checkConflicts(Array.from(selected), date, areaOfDutyId);
        setWarnings(w);
      });
    },
    [selected, startTransition],
  );

  const isBulk = selected.size > 1;

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-surface px-3 py-2 text-center">
          <p className="text-lg font-bold text-(--status-rejected)">{quickStats.noAssignments}</p>
          <p className="text-[10px] text-(--text-muted) uppercase tracking-wider">No assignments</p>
        </div>
        <div className="rounded-lg border border-border bg-surface px-3 py-2 text-center">
          <p className="text-lg font-bold text-(--status-processed)">{quickStats.completedPct}%</p>
          <p className="text-[10px] text-(--text-muted) uppercase tracking-wider">Cases complete</p>
        </div>
        <div className="rounded-lg border border-border bg-surface px-3 py-2 text-center">
          <p className="text-lg font-bold text-foreground">{quickStats.totalStudents}</p>
          <p className="text-[10px] text-(--text-muted) uppercase tracking-wider">Total students</p>
        </div>
      </div>

      {/* Assignment form */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-(--text-secondary)">
          {isBulk ? `Bulk Assign (${selected.size} selected)` : "Create Assignment"}
        </h2>
        <form action={isBulk ? bulkAction : singleAction} className="space-y-4">
          {isBulk ? (
            <input type="hidden" name="student_ids" value={JSON.stringify(Array.from(selected))} />
          ) : (
            <input type="hidden" name="student_id" value={Array.from(selected)[0] ?? ""} />
          )}
          <input type="hidden" name="inclusive_days" value={JSON.stringify([...inclusiveDays].sort((a, b) => a - b))} />

          <div>
            <label className="mb-1.5 block text-xs font-medium text-(--text-secondary)">
              Rotation
            </label>
            <select
              name="rotation_id"
              value={selectedRotationId}
              onChange={(e) => {
                setSelectedRotationId(e.target.value);
                setStartDate("");
                setEndDate("");
              }}
              className="w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="">No rotation</option>
              {rotations.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-(--text-secondary)">
              Area of Duty <span className="text-(--status-rejected)">*</span>
            </label>
            <select
              name="area_of_duty_id"
              required
              onChange={(e) => {
                const dateInput = document.querySelector<HTMLInputElement>("input[name=scheduled_date]");
                if (dateInput?.value) handleCheckConflicts(dateInput.value, e.target.value);
              }}
              className="w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="">Select area of duty...</option>
              {areasOfDuty.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-(--text-secondary)">
                Start Date <span className="text-(--status-rejected)">*</span>
              </label>
              <input
                type="date"
                name="scheduled_date"
                required
                min={semesterWindow?.start ?? undefined}
                max={endDate || semesterWindow?.end || undefined}
                value={startDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setStartDate(val);
                  // Auto-set end date to +6 days (full week) if not yet set
                  if (val && !endDate) {
                    const d = new Date(val + "T00:00:00");
                    d.setDate(d.getDate() + 6);
                    const iso = d.toISOString().slice(0, 10);
                    setEndDate(iso);
                  }
                  const locSelect = document.querySelector<HTMLSelectElement>("select[name=area_of_duty_id]");
                  if (locSelect?.value) handleCheckConflicts(val, locSelect.value);
                  if (semesterWindow && val) {
                    const outOfRange = val < semesterWindow.start || (semesterWindow.end ? val > semesterWindow.end : false);
                    if (outOfRange) {
                      setWarnings((prev) => {
                        const filtered = prev.filter((w) => w.type !== "out_of_semester");
                        return [...filtered, { type: "out_of_semester" as const, studentName: "All", reason: `Date range is outside the active semester (${semesterWindow.start}${semesterWindow.end ? ` – ${semesterWindow.end}` : ""})` }];
                      });
                    } else {
                      setWarnings((prev) => prev.filter((w) => w.type !== "out_of_semester"));
                    }
                  }
                }}
                className="w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-(--text-secondary)">
                End Date <span className="text-(--status-rejected)">*</span>
              </label>
              <input
                type="date"
                name="end_date"
                required
              min={startDate || semesterWindow?.start || undefined}
              max={semesterWindow?.end ?? undefined}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-(--text-secondary)">
              Shift
            </label>
            <select
              name="shift_id"
              className="w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="">No shift assigned</option>
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-(--text-secondary)">
              Clinical Instructor
            </label>
            <select
              name="clinical_instructor_id"
              className="w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="">No CI assigned</option>
              {clinicalInstructors.map((ci) => (
                <option key={ci.id} value={ci.id}>{ci.full_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-(--text-secondary)">
              Duty Days <span className="text-(--text-muted) font-normal">(optional)</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAY_LABELS.map((label, day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleInclusiveDay(day)}
                  className={`rounded px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    inclusiveDays.has(day)
                      ? "bg-accent text-black"
                      : "border border-border bg-elevated text-(--text-secondary) hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {inclusiveDays.size > 0 && (
              <p className="mt-1.5 text-xs text-(--text-muted)">
                Date must fall on:{" "}
                <span className="text-foreground font-medium">
                  {[...inclusiveDays].sort((a, b) => a - b).map((d) => WEEKDAY_LABELS[d]).join(", ")}
                </span>
              </p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-(--text-secondary)">
              Notes
            </label>
            <input
              type="text"
              name="notes"
              placeholder="Optional notes..."
              className="w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-foreground placeholder-(--text-muted) focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          {/* Conflict warnings */}
          {warnings.length > 0 && (
            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2.5">
              <p className="mb-1 text-xs font-semibold text-yellow-400">Conflicts detected:</p>
              <ul className="space-y-0.5">
                {warnings.map((w, i) => (
                  <li key={i} className="text-xs text-yellow-300">
                    <span className="font-medium">{w.studentName}</span> � {w.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {state.error && (
            <p className="text-sm text-(--status-rejected)">{state.error}</p>
          )}
          {state.success && (
            <p className="text-sm text-(--status-processed)">{state.message}</p>
          )}

          <SubmitButton
            variant="primary"
            label={isBulk ? `Assign ${selected.size} Students` : "Assign"}
            loadingLabel="Assigning..."
          />
        </form>
      </div>

      {/* Student list controls */}
      <div>
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-(--text-secondary)">
            Students ({filteredStudents.length})
          </h2>
          <button
            type="button"
            onClick={() => selectAllFiltered(filteredStudents.map((s) => s.id))}
            className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-(--text-secondary) hover:bg-elevated transition-colors"
          >
            {filteredStudents.every((s) => selected.has(s.id)) && filteredStudents.length > 0
              ? "Deselect All"
              : "Select All"}
          </button>
        </div>

        {/* Search + Sort + Filter bar */}
        <div className="mb-3 flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 rounded-lg border border-border bg-elevated px-3 py-1.5 text-sm text-foreground placeholder-(--text-muted) focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="rounded-lg border border-border bg-elevated px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="priority">Sort: Priority</option>
            <option value="total_assignments">Sort: Least assigned</option>
            <option value="total_cases">Sort: Lowest total</option>
            <option value="last_assigned">Sort: Least recent</option>
            <option value="area_duty_count">Sort: Most at this area</option>
          </select>
          <select
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value as "all" | "low_exposure")}
            className="rounded-lg border border-border bg-elevated px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="all">Filter: All</option>
            <option value="low_exposure">Never assigned</option>
          </select>
        </div>

        {/* Student list */}
        {filteredStudents.length === 0 ? (
          <div className="flex items-center justify-center rounded-xl border border-dashed border-border py-10">
            <p className="text-xs text-(--text-muted)">No students found</p>
          </div>
        ) : (
          <ul className="space-y-1.5 max-h-120 overflow-y-auto pr-1">
            {filteredStudents.map((s) => {
              const p = PRIORITY_LABEL[s.priority];
              const isSelected = selected.has(s.id);
              return (
                <li
                  key={s.id}
                  onClick={() => toggleStudent(s.id)}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                    isSelected
                      ? "border-accent bg-accent/10"
                      : "border-border bg-surface hover:bg-elevated"
                  }`}
                >
                  <div
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      isSelected ? "border-accent bg-accent" : "border-border"
                    }`}
                  >
                    {isSelected && (
                      <svg className="h-3 w-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{s.full_name}</p>
                    <p className="text-xs text-(--text-muted)">
                      {s.section ?? "No section"}
                      {" \u00B7 "}
                      {s.total_assignments} assigned · {s.total_cases} cases
                      {s.last_assigned && ` \u00B7 Last: ${s.last_assigned}`}
                    </p>
                  </div>

                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${p.color} ${p.bg}`}>
                    {p.label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
