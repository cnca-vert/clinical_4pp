"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

type Result = { error?: string; success?: boolean; email?: string; password?: string };

// ─── helpers ────────────────────────────────────────────────────────────────

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 30);
}

function randomStr(len: number) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function generatePassword(len = 12) {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "@#$!";
  const all = upper + lower + digits + special;
  const required = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    special[Math.floor(Math.random() * special.length)],
  ];
  const rest = Array.from({ length: len - 4 }, () => all[Math.floor(Math.random() * all.length)]);
  return [...required, ...rest].sort(() => Math.random() - 0.5).join("");
}

// ─── actions ────────────────────────────────────────────────────────────────

/** Create a CI record (name only — no auth user yet, no credentials) */
export async function createClinicalInstructor(formData: FormData): Promise<Result> {
  const fullName = (formData.get("full_name") as string ?? "").trim();
  if (!fullName) return { error: "Name is required." };

  // We need an auth user to satisfy profiles FK. Create a placeholder with a
  // system email but no confirmed credentials yet.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const serviceClient = createServiceClient();

  const slug = slugify(fullName);
  const loginEmail = `ci.${slug}.${randomStr(6)}@nursesync.app`;
  const placeholderPw = randomStr(32); // never shown, just satisfies creation

  const { data, error } = await serviceClient.auth.admin.createUser({
    email: loginEmail,
    password: placeholderPw,
    email_confirm: true,
    user_metadata: { full_name: fullName },
    app_metadata: { role: "ci" },
  });

  if (error) return { error: error.message };

  const userId = data.user.id;

  const { error: profileError } = await serviceClient.from("profiles").upsert(
    {
      id: userId,
      full_name: fullName,
      email: loginEmail,
      ci_login_email: loginEmail,
      role: "ci",
      is_verified: true,
      is_active: true,
    },
    { onConflict: "id" },
  );

  if (profileError) {
    await serviceClient.auth.admin.deleteUser(userId);
    return { error: profileError.message };
  }

  revalidatePath("/admin/config/clinical-instructors");
  return { success: true };
}

/** Generate (or regenerate) login credentials for an existing CI */
export async function generateCICredentials(formData: FormData): Promise<Result> {
  const id = formData.get("id") as string;
  const daysRaw = parseInt((formData.get("days") as string) ?? "90", 10);
  const days = [30, 60, 90, 180].includes(daysRaw) ? daysRaw : 90;

  if (!id) return { error: "Missing CI ID." };

  const serviceClient = createServiceClient();

  // Fetch current login email
  const { data: profile, error: fetchError } = await serviceClient
    .from("profiles")
    .select("ci_login_email, full_name")
    .eq("id", id)
    .single();

  if (fetchError || !profile) return { error: "CI not found." };

  const password = generatePassword();
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  // Update auth user password
  const { error: updateError } = await serviceClient.auth.admin.updateUserById(id, {
    password,
  });
  if (updateError) return { error: updateError.message };

  // Store expiry
  await serviceClient
    .from("profiles")
    .update({ ci_credentials_expire_at: expiresAt })
    .eq("id", id);

  revalidatePath("/admin/config/clinical-instructors");
  return { success: true, email: profile.ci_login_email!, password };
}

/** Edit a CI's display name */
export async function updateClinicalInstructor(formData: FormData): Promise<Result> {
  const id = formData.get("id") as string;
  const fullName = (formData.get("full_name") as string ?? "").trim();
  if (!id || !fullName) return { error: "Name is required." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", id)
    .eq("role", "ci");

  if (error) return { error: error.message };

  revalidatePath("/admin/config/clinical-instructors");
  return { success: true };
}

/** Permanently delete a CI */
export async function deleteClinicalInstructor(formData: FormData): Promise<Result> {
  const id = formData.get("id") as string;
  if (!id) return { error: "Missing ID." };

  const serviceClient = createServiceClient();
  const { error } = await serviceClient.auth.admin.deleteUser(id);
  if (error) return { error: error.message };

  revalidatePath("/admin/config/clinical-instructors");
  return { success: true };
}

/** Activate / deactivate a CI (name + record persists) */
export async function toggleClinicalInstructor(formData: FormData) {
  const id = formData.get("id") as string;
  const currentActive = formData.get("is_active") === "true";

  const supabase = await createClient();
  await supabase.from("profiles").update({ is_active: !currentActive }).eq("id", id);
  revalidatePath("/admin/config/clinical-instructors");
}
