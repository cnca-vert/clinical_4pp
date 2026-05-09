import { createClient } from "@/lib/supabase/server";
import { createRotation, updateRotation, deleteRotation } from "./actions";
import SubmitButton from "@/components/ui/SubmitButton";

type Rotation = { id: string; name: string; inclusive_days: number[] };

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

function RotationRow({ rotation }: { rotation: Rotation }) {
  const dayLabels =
    rotation.inclusive_days.length === 0
      ? "Any day"
      : rotation.inclusive_days
          .slice()
          .sort((a, b) => a - b)
          .map((d) => DAYS.find((x) => x.value === d)?.label ?? "")
          .join(", ");

  return (
    <li className="px-4 py-3 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">{rotation.name}</p>
          <p className="text-xs text-(--text-muted) mt-0.5">Duty days: {dayLabels}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {/* Inline edit form */}
        <form action={updateRotation} className="col-span-2 space-y-2">
          <input type="hidden" name="id" value={rotation.id} />
          <input
            name="name"
            type="text"
            required
            defaultValue={rotation.name}
            className="w-full rounded-lg border border-border bg-elevated px-3 py-1.5 text-sm text-foreground outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
          <DayCheckboxes name="inclusive_days" defaultChecked={rotation.inclusive_days} />
          <div className="flex gap-2">
            <SubmitButton label="Save" loadingLabel="Saving…" variant="ghost" />
          </div>
        </form>
        <form action={deleteRotation}>
          <input type="hidden" name="id" value={rotation.id} />
          <SubmitButton label="Delete" loadingLabel="Deleting…" variant="danger" />
        </form>
      </div>
    </li>
  );
}

export default async function RotationsConfigPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("rotations")
    .select("id, name, inclusive_days")
    .order("name");
  const items = (data ?? []) as Rotation[];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">Rotations</h1>
        <p className="mt-1 text-sm text-(--text-secondary)">
          Named scheduling periods. Select the days of the week that apply when creating assignments.
        </p>
      </div>

      {/* Add form */}
      <form
        action={createRotation}
        className="mb-6 rounded-xl border border-border bg-surface p-4 space-y-3"
      >
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
        <SubmitButton label="Add Rotation" loadingLabel="Adding…" />
      </form>

      {/* List */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        {items.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-(--text-muted)">
            No rotations yet. Add one above.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((r) => (
              <RotationRow key={r.id} rotation={r} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
