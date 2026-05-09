import { createClient } from "@/lib/supabase/server";
import { toggleClinicalInstructor } from "./actions";
import SubmitButton from "@/components/ui/SubmitButton";

type ClinicalInstructor = { id: string; full_name: string; email: string; is_active: boolean };

export default async function ClinicalInstructorsConfigPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, is_active")
    .eq("role", "ci")
    .order("full_name");
  const items = (data ?? []) as ClinicalInstructor[];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">Clinical Instructors</h1>
        <p className="mt-1 text-sm text-(--text-secondary)">
          Accounts with the Clinical Instructor role. Activate or deactivate their access here.
          New CI accounts are created via the Sign Up page using the CI registration flow.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        {items.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-(--text-muted)">
            No clinical instructors found.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((ci) => (
              <li key={ci.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${ci.is_active ? "text-foreground" : "text-(--text-muted) line-through"}`}>
                    {ci.full_name}
                  </p>
                  <p className="text-xs text-(--text-muted)">{ci.email}</p>
                </div>
                <form action={toggleClinicalInstructor}>
                  <input type="hidden" name="id" value={ci.id} />
                  <input type="hidden" name="is_active" value={String(ci.is_active)} />
                  <SubmitButton
                    label={ci.is_active ? "Deactivate" : "Restore"}
                    loadingLabel="…"
                    variant={ci.is_active ? "danger" : "ghost"}
                  />
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>

      {items.length > 0 && (
        <p className="mt-3 text-xs text-(--text-muted)">
          {items.filter((ci) => ci.is_active).length} active ·{" "}
          {items.filter((ci) => !ci.is_active).length} inactive
        </p>
      )}
    </div>
  );
}
