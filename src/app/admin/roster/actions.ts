"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export type BulkResult = { added: number; skipped: number };

type NameParts = { last_name: string | null; first_name: string | null; middle_initial: string | null };

/** Parse "SURNAME, FIRSTNAME MI." into split columns */
function parseName(fullName: string): NameParts {
  const commaIdx = fullName.indexOf(",");
  if (commaIdx === -1) return { last_name: null, first_name: null, middle_initial: null };
  const lastName = fullName.slice(0, commaIdx).trim().toUpperCase();
  const rest = fullName.slice(commaIdx + 1).trim().toUpperCase();
  const miMatch = rest.match(/^(.*?)\s+([A-Z])\.$/);
  if (miMatch) return { last_name: lastName, first_name: miMatch[1].trim(), middle_initial: miMatch[2] };
  return { last_name: lastName, first_name: rest, middle_initial: null };
}

/** Build canonical "SURNAME, FIRSTNAME MI." from parts */
function buildFullName(lastName: string, firstName: string, mi: string | null): string {
  const base = `${lastName.trim().toUpperCase()}, ${firstName.trim().toUpperCase()}`;
  return mi ? `${base} ${mi.trim().toUpperCase()}.` : base;
}

/** Bulk-insert multiple students from a pasted list into the whitelist */
export async function bulkAddToRoster(
  _prev: BulkResult | null,
  formData: FormData,
): Promise<BulkResult> {
  const raw = formData.get("names") as string;
  if (!raw?.trim()) return { added: 0, skipped: 0 };

  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  const parsed: { full_name: string; last_name: string | null; first_name: string | null; middle_initial: string | null; email: string | null; section: string | null }[] = [];

  for (const line of lines) {
    const parts = line.split("|").map((p) => p.trim());
    const rawName = parts[0];
    if (!rawName) continue;
    const email = parts[1]?.toLowerCase() || null;
    const section = parts[2] || null;
    const { last_name, first_name, middle_initial } = parseName(rawName);
    const full_name = last_name && first_name ? buildFullName(last_name, first_name, middle_initial) : rawName.toUpperCase();
    parsed.push({ full_name, last_name, first_name, middle_initial, email, section });
  }

  if (parsed.length === 0) return { added: 0, skipped: 0 };

  const supabase = await createClient();
  const { data: existing } = await supabase.from("student_roster").select("full_name");
  const existingLower = new Set((existing ?? []).map((r) => r.full_name.toLowerCase()));

  const toInsert = parsed.filter((p) => !existingLower.has(p.full_name.toLowerCase()));
  const skipped = parsed.length - toInsert.length;

  if (toInsert.length > 0) {
    await supabase.from("student_roster").insert(toInsert);
  }

  revalidatePath("/admin/roster");
  return { added: toInsert.length, skipped };
}

/** Add a student to the pre-registration whitelist */
export async function addToRoster(formData: FormData) {
  const lastName = (formData.get("last_name") as string ?? "").trim();
  const firstName = (formData.get("first_name") as string ?? "").trim();
  const mi = (formData.get("middle_initial") as string ?? "").trim().toUpperCase().charAt(0) || null;
  const email = (formData.get("email") as string ?? "").trim().toLowerCase() || null;
  const section = (formData.get("section") as string ?? "").trim() || null;

  if (!lastName || !firstName) return;

  const full_name = buildFullName(lastName, firstName, mi);

  const supabase = await createClient();
  await supabase.from("student_roster").insert({
    full_name,
    last_name: lastName.toUpperCase(),
    first_name: firstName.toUpperCase(),
    middle_initial: mi,
    email,
    section,
  });
  revalidatePath("/admin/roster");
}

/** Approve a signed-up student (set is_verified = true) */
export async function verifyStudent(formData: FormData) {
  const id = formData.get("id") as string;

  const supabase = await createClient();
  await supabase.from("profiles").update({ is_verified: true }).eq("id", id);
  revalidatePath("/admin/roster");
}

/** Toggle a student's active status */
export async function toggleStudentActive(formData: FormData) {
  const id = formData.get("id") as string;
  const currentActive = formData.get("is_active") === "true";

  const supabase = await createClient();
  await supabase
    .from("profiles")
    .update({ is_active: !currentActive })
    .eq("id", id);
  revalidatePath("/admin/roster");
}

/**
 * Permanently delete a student's auth account, freeing their email for re-use.
 * Their profile row and all case history are kept for audit purposes.
 * Only allowed for deactivated accounts (is_active = false).
 */
export async function deleteStudentAccount(formData: FormData) {
  const id = formData.get("id") as string;
  if (!id) return;

  const serviceClient = createServiceClient();

  // Confirm the account is deactivated before deleting
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("is_active, email")
    .eq("id", id)
    .single();

  if (!profile || profile.is_active) return; // refuse to delete an active account

  // Nullify the profile email BEFORE deleting the auth user.
  // The sync_role_to_app_metadata trigger fires on UPDATE — if the auth user
  // is already gone when it runs, the trigger fails and rolls back the update.
  await serviceClient
    .from("profiles")
    .update({ email: null, is_active: false })
    .eq("id", id);

  // Free the roster slot
  if (profile.email) {
    await serviceClient
      .from("student_roster")
      .update({ email: null })
      .eq("email", profile.email);
  }

  // Now safe to delete the auth user (trigger won't fire again)
  const { error } = await serviceClient.auth.admin.deleteUser(id);
  if (error) {
    console.error("[deleteStudentAccount] auth delete failed:", error.message);
    // Profile email is already nulled so it won't show in the roster
  }

  revalidatePath("/admin/roster");
  revalidatePath("/admin/students");
}

/** Remove an entry from the roster whitelist (only if no profile linked) */
export async function removeFromRoster(formData: FormData) {
  const id = formData.get("id") as string;

  const supabase = await createClient();
  await supabase.from("student_roster").delete().eq("id", id);
  revalidatePath("/admin/roster");
}

/** Update the section for a signed-up student profile */
export async function updateStudentSection(formData: FormData) {
  const id = formData.get("id") as string;
  const section = ((formData.get("section") as string) ?? "").trim() || null;
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("profiles").update({ section }).eq("id", id);
  revalidatePath("/admin/roster");
  revalidatePath("/admin/students");
}

/** Bulk-assign the same section to multiple student profiles */
export async function bulkUpdateStudentSection(formData: FormData) {
  const ids = formData.getAll("student_ids") as string[];
  const section = ((formData.get("section") as string) ?? "").trim() || null;
  if (!ids.length) return;

  const supabase = await createClient();
  await supabase.from("profiles").update({ section }).in("id", ids);
  revalidatePath("/admin/roster");
  revalidatePath("/admin/students");
}

/** Update the section for a pre-registration whitelist entry */
export async function updateRosterEntrySection(formData: FormData) {
  const id = formData.get("id") as string;
  const section = ((formData.get("section") as string) ?? "").trim() || null;
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("student_roster").update({ section }).eq("id", id);
  revalidatePath("/admin/roster");
}
