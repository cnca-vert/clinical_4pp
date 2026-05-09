"use client";

import { useState, useActionState } from "react";
import { createRotation, updateRotation, deleteRotation } from "./actions";
import SubmitButton from "@/components/ui/SubmitButton";

export type Rotation = { id: string; name: string; inclusive_days: number[] };

const DAYS = [
  { label: "Sun", value: 0 },
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
];

function DayCheckboxes({ name, defaultChecked }: { name: string; defaultChecked?: number[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {DAYS.map((d) => (
        <label
          key={d.value}
          className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-elevated px-2.5 py-1 text-xs font-medium text-foreground has-checked:border-accent has-checked:bg-accent/10 has-checked:text-accent"
        >
          <input
            type="checkbox"
            name={name}
            value={String(d.value)}
            defaultChecked={defaultChecked?.includes(d.value)}
            className="sr-only"
          />
          {d.label}
        </label>
      ))}
    </div>
  );
}

type ActionState = { error?: string | null; success?: boolean };
const initialState: ActionState = {};

function CreateForm() {
  const [state, action] = useActionState(
    async (_prev: ActionState, fd: FormData) => (await createRotation(fd)) ?? {},
    initialState,
  );
  return (
    <form action={action} className="mb-6 rounded-xl border border-border bg-surface p-4 space-y-3">
      <input
        name="name"
        type="text"
        required
        placeholder="e.g. Rotation 1, Q1 2025"
        className="w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-foreground placeholder-(--text-muted) outline-none focus:border-accent focus:ring-1 focus:ring-accent"
      />
      <div>
        <p className="mb-2 text-xs font-medium text-(--text-secondary)">
          Duty Days <span className="text-(--text-muted) font-normal">(optional)</span>
        </p>
        <DayCheckboxes name="inclusive_days" />
      </div>
      {state.error && <p className="text-sm text-(--status-rejected)">{state.error}</p>}
      <SubmitButton label="Add Rotation" loadingLabel="Adding…" />
    </form>
  );
}

function RotationRow({ rotation }: { rotation: Rotation }) {
  const [editing, setEditing] = useState(false);

  const [updateState, updateAction] = useActionState(
    async (_prev: ActionState, fd: FormData) => {
      const res = await updateRotation(fd);
      if (res?.success) setEditing(false);
      return res ?? {};
    },
    initialState,
  );
  const [deleteState, deleteAction] = useActionState(
    async (_prev: ActionState, fd: FormData) => (await deleteRotation(fd)) ?? {},
    initialState,
  );

  const dayLabels =
    rotation.inclusive_days.length === 0
      ? "Any day"
      : rotation.inclusive_days
          .slice()
          .sort((a, b) => a - b)
          .map((d) => DAYS.find((x) => x.value === d)?.label ?? "")
          .join(", ");

  if (!editing) {
    return (
      <li className="flex items-start gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{rotation.name}</p>
          <p className="text-xs text-(--text-muted) mt-0.5">Duty days: {dayLabels}</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="shrink-0 rounded-md border border-border px-2.5 py-1 text-xs text-(--text-secondary) hover:text-foreground hover:bg-elevated transition-colors"
        >
          Edit
        </button>
      </li>
    );
  }

  return (
    <li className="px-4 py-3 space-y-3">
      <form action={updateAction} className="space-y-2">
        <input type="hidden" name="id" value={rotation.id} />
        <input
          name="name"
          type="text"
          required
          defaultValue={rotation.name}
          className="w-full rounded-lg border border-border bg-elevated px-3 py-1.5 text-sm text-foreground outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        />
        <DayCheckboxes name="inclusive_days" defaultChecked={rotation.inclusive_days} />
        {updateState.error && <p className="text-sm text-(--status-rejected)">{updateState.error}</p>}
        <div className="flex gap-2">
          <SubmitButton label="Save" loadingLabel="Saving…" variant="ghost" />
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-(--text-secondary) hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
      <form action={deleteAction}>
        <input type="hidden" name="id" value={rotation.id} />
        {deleteState.error && <p className="mb-1 text-sm text-(--status-rejected)">{deleteState.error}</p>}
        <SubmitButton label="Delete" loadingLabel="Deleting…" variant="danger" />
      </form>
    </li>
  );
}

export default function RotationsConfigClient({ rotations }: { rotations: Rotation[] }) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">Rotations</h1>
        <p className="mt-1 text-sm text-(--text-secondary)">
          Named scheduling periods. Select the days of the week that apply when creating assignments.
        </p>
      </div>

      <CreateForm />

      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        {rotations.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-(--text-muted)">
            No rotations yet. Add one above.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {rotations.map((r) => (
              <RotationRow key={r.id} rotation={r} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
