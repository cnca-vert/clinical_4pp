"use client";

import { useActionState } from "react";
import { FileText } from "lucide-react";
import { approveSubmission, rejectSubmission } from "../actions";
import SubmitButton from "@/components/ui/SubmitButton";

type CaseType = { id: string; name: string };
type AreaOfDuty = { id: string; name: string };
type Rotation = { id: string; name: string };

interface Submission {
  id: string;
  case_type_id: string;
  area_of_duty_id: string;
  rotation_id: string | null;
  upload_id: string | null;
  date: string;
  notes: string | null;
}

interface Props {
  submission: Submission;
  caseTypes: CaseType[];
  areasOfDuty: AreaOfDuty[];
  rotations: Rotation[];
  upload: { id: string; file_name: string } | null;
  signedUrl: string | null;
}

type ActionState = { error: string | null };
const initialState: ActionState = { error: null };

export default function ReviewForm({
  submission,
  caseTypes,
  areasOfDuty,
  rotations,
  upload,
  signedUrl,
}: Props) {
  const [approveState, approveAction] = useActionState(
    async (_prev: ActionState, formData: FormData): Promise<ActionState> => {
      const result = await approveSubmission(formData);
      if (!result) return { error: null };
      return { error: result.error ?? null };
    },
    initialState
  );

  const [rejectState, rejectAction] = useActionState(
    async (_prev: ActionState, formData: FormData): Promise<ActionState> => {
      const result = await rejectSubmission(formData);
      if (!result) return { error: null };
      return { error: result.error ?? null };
    },
    initialState
  );

  const isPdf = upload?.file_name.toLowerCase().endsWith(".pdf");

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">Review &amp; Edit Details</h2>
      </div>

      <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
        {/* Left: file preview */}
        <div className="p-5 flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-(--text-secondary)">Preview</p>
          {upload ? (
            signedUrl && !isPdf ? (
              <div className="rounded-lg overflow-hidden border border-border bg-background flex-1 min-h-48">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={signedUrl}
                  alt={upload.file_name}
                  className="w-full h-full object-contain max-h-96"
                />
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-background flex flex-col items-center justify-center gap-2 py-12">
                <FileText className="h-10 w-10 text-(--text-muted)" />
                <p className="text-sm font-medium text-foreground text-center px-4">{upload.file_name}</p>
                {signedUrl && (
                  <a
                    href={signedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-accent hover:underline"
                  >
                    Open PDF
                  </a>
                )}
              </div>
            )
          ) : (
            <div className="rounded-lg border border-border bg-background flex flex-col items-center justify-center gap-2 py-12">
              <FileText className="h-10 w-10 text-(--text-muted)" />
              <p className="text-xs text-(--text-muted)">No file attached</p>
            </div>
          )}
          {upload && (
            <p className="text-xs text-(--text-muted) truncate">{upload.file_name}</p>
          )}
        </div>

        {/* Right: form fields */}
        <div className="p-5 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-(--text-secondary)">Case Details</p>

          <form action={approveAction} className="space-y-4">
            <input type="hidden" name="submission_id" value={submission.id} />
            {upload && <input type="hidden" name="upload_id" value={upload.id} />}

            {/* Case type */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-(--text-secondary)">
                Case Type <span className="text-red-400">*</span>
              </label>
              <select
                name="case_type_id"
                required
                defaultValue={submission.case_type_id}
                className="w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="">Select case type…</option>
                {caseTypes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Area of duty */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-(--text-secondary)">
                Area of Duty <span className="text-red-400">*</span>
              </label>
              <select
                name="area_of_duty_id"
                required
                defaultValue={submission.area_of_duty_id}
                className="w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="">Select area…</option>
                {areasOfDuty.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-(--text-secondary)">
                Date <span className="text-(--text-muted) font-normal">(optional)</span>
              </label>
              <input
                type="date"
                name="date"
                defaultValue={submission.date ?? ""}
                className="w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            {/* Rotation */}
            {rotations.length > 0 && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-(--text-secondary)">
                  Rotation (optional)
                </label>
                <select
                  name="rotation_id"
                  defaultValue={submission.rotation_id ?? ""}
                  className="w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  <option value="">— No rotation —</option>
                  {rotations.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-(--text-secondary)">
                Notes (optional)
              </label>
              <textarea
                name="notes"
                rows={3}
                defaultValue={submission.notes ?? ""}
                className="w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent resize-none"
              />
            </div>

            {approveState.error && (
              <p className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-400">
                {approveState.error}
              </p>
            )}

            <SubmitButton label="Approve & Log" />
          </form>

          {/* Reject — separate form to avoid nesting */}
          <form action={rejectAction} className="space-y-3 pt-3 border-t border-border">
            <input type="hidden" name="submission_id" value={submission.id} />
            <label className="block text-xs font-medium text-(--text-secondary)">
              Rejection reason <span className="text-(--text-muted) font-normal">(optional — student will see this)</span>
            </label>
            <textarea
              name="admin_note"
              rows={2}
              placeholder="e.g., Incorrect case type selected, please resubmit."
              className="w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-foreground placeholder:text-(--text-muted) focus:outline-none focus:ring-1 focus:ring-red-500 resize-none"
            />
            {rejectState.error && (
              <p className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-400">
                {rejectState.error}
              </p>
            )}
            <SubmitButton label="Reject" variant="danger" />
          </form>
        </div>
      </div>
    </div>
  );
}
