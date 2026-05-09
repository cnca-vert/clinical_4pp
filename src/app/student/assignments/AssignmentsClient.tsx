"use client";

import { useState } from "react";
import type { Assignment } from "./page";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_STYLES: Record<string, string> = {
  scheduled: "bg-accent/20 text-accent",
  completed: "bg-green-500/20 text-green-400",
  missed: "bg-red-500/20 text-red-400",
  cancel_requested: "bg-amber-500/20 text-amber-400",
  cancelled: "bg-neutral-500/20 text-white/40",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-AU", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AssignmentsClient({
  open,
  past,
}: {
  open: Assignment[];
  past: Assignment[];
}) {
  const [selected, setSelected] = useState<Assignment | null>(null);

  return (
    <>
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white">My Assignments</h1>
          <p className="text-sm text-white/50 mt-1">
            Clinical rotations assigned by your instructor.
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">
            Upcoming ({open.length})
          </h2>
          {open.length === 0 ? (
            <EmptyState message="No upcoming assignments." />
          ) : (
            open.map((a) => (
              <AssignmentCard key={a.id} assignment={a} onOpen={() => setSelected(a)} />
            ))
          )}
        </section>

        {past.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">
              Past ({past.length})
            </h2>
            {past.map((a) => (
              <AssignmentCard key={a.id} assignment={a} onOpen={() => setSelected(a)} />
            ))}
          </section>
        )}
      </div>

      {selected && (
        <AssignmentModal assignment={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}

function AssignmentCard({
  assignment: a,
  onOpen,
}: {
  assignment: Assignment;
  onOpen: () => void;
}) {
  const dateStr = a.scheduled_date ? formatDate(a.scheduled_date) : "—";

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-start justify-between gap-4">
      {/* Clickable area */}
      <button
        type="button"
        onClick={onOpen}
        className="flex-1 text-left space-y-1 min-w-0"
      >
        <p className="text-sm font-semibold text-white truncate">
          {a.areas_of_duty?.name ?? "Unknown Area of Duty"}
        </p>
        <p className="text-xs text-white/50">
          {dateStr}
          {a.end_date && a.end_date !== a.scheduled_date && (
            <> – {formatDate(a.end_date)}</>
          )}
          {a.shifts?.name && <> · {a.shifts.name}</>}
        </p>
        {a.notes && (
          <p className="text-xs text-white/40 mt-1 line-clamp-2">{a.notes}</p>
        )}
        {a.cancellation_reason && (
          <p className="text-xs text-amber-400/70 mt-1">
            Cancel reason: {a.cancellation_reason}
          </p>
        )}
        <p className="text-[10px] text-white/30 mt-1">Tap to view details →</p>
      </button>

      {/* Right side: status badge + cancel form */}
      <div className="shrink-0 flex flex-col items-end gap-2">
        <span
          className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${
            STATUS_STYLES[a.status] ?? "bg-white/10 text-white/60"
          }`}
        >
          {a.status === "cancel_requested" ? "Pending Cancel" : a.status}
        </span>

      </div>
    </div>
  );
}

function AssignmentModal({
  assignment: a,
  onClose,
}: {
  assignment: Assignment;
  onClose: () => void;
}) {
  const rotation = a.rotations;
  const inclusiveDays = rotation?.inclusive_days ?? null;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      {/* Panel */}
      <div
        className="w-full max-w-md bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-bold text-white">
              {a.areas_of_duty?.name ?? "Assignment Details"}
            </p>
            <span
              className={`mt-1 inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${
                STATUS_STYLES[a.status] ?? "bg-white/10 text-white/60"
              }`}
            >
              {a.status === "cancel_requested" ? "Pending Cancel" : a.status}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/40 hover:text-white transition-colors text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="h-px bg-white/10" />

        {/* Details grid */}
        <dl className="space-y-3 text-sm">
          <DetailRow label="Date">
            {a.scheduled_date ? formatDate(a.scheduled_date) : "—"}
            {a.end_date && a.end_date !== a.scheduled_date && (
              <> – {formatDate(a.end_date)}</>
            )}
          </DetailRow>

          {a.shifts?.name && (
            <DetailRow label="Shift">{a.shifts.name}</DetailRow>
          )}

          {rotation?.name && (
            <DetailRow label="Rotation">{rotation.name}</DetailRow>
          )}

          {inclusiveDays && inclusiveDays.length > 0 && (
            <DetailRow label="Days">
              <div className="flex flex-wrap gap-1 mt-0.5">
                {WEEKDAY_LABELS.map((label, idx) => (
                  <span
                    key={idx}
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      inclusiveDays.includes(idx)
                        ? "bg-accent/20 text-accent"
                        : "bg-white/5 text-white/20"
                    }`}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </DetailRow>
          )}

          {a.notes && (
            <DetailRow label="Notes">{a.notes}</DetailRow>
          )}

          {a.cancellation_reason && (
            <DetailRow label="Cancel Reason">
              <span className="text-amber-400">{a.cancellation_reason}</span>
            </DetailRow>
          )}
        </dl>

        <div className="h-px bg-white/10" />

        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-xl bg-white/5 hover:bg-white/10 transition-colors py-2.5 text-sm font-medium text-white/70"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <dt className="w-24 shrink-0 text-white/40 font-medium">{label}</dt>
      <dd className="text-white/80">{children}</dd>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
      <p className="text-sm text-white/40">{message}</p>
    </div>
  );
}
