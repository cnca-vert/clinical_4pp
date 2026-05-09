"use server";

import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";

export async function createAdminAccount(
  token: string,
  _prev: { error?: string | null },
  formData: FormData,
): Promise<{ error: string }> {
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;
  const fullName = (formData.get("full_name") as string)?.trim();

  if (!email || !password || !fullName) {
    return { error: "All fields are required." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const supabase = createServiceClient();

  // --- Atomically validate + consume the token ---
  const { data: invite, error: fetchErr } = await supabase
    .from("admin_invites")
    .select("id, used, expires_at")
    .eq("token", token)
    .single();

  if (fetchErr || !invite) return { error: "Invalid invite link." };
  if (invite.used) return { error: "This invite link has already been used." };
  if (new Date(invite.expires_at) < new Date()) {
    return { error: "This invite link has expired." };
  }

  // Mark used BEFORE creating the user to prevent race conditions
  const { error: markErr } = await supabase
    .from("admin_invites")
    .update({ used: true })
    .eq("id", invite.id)
    .eq("used", false); // optimistic lock — fails if another request already set it

  if (markErr) return { error: "Invite already claimed — try again or generate a new link." };

  // --- Create the auth user (email already confirmed) ---
  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: "admin", full_name: fullName },
  });

  if (authErr || !authData.user) {
    // Roll back the used flag so it's not wasted
    await supabase.from("admin_invites").update({ used: false }).eq("id", invite.id);
    return { error: authErr?.message ?? "Failed to create account." };
  }

  // --- Insert profile ---
  await supabase.from("profiles").upsert({
    id: authData.user.id,
    email,
    full_name: fullName,
    role: "admin",
    is_verified: true,
    is_active: true,
  });

  redirect("/login?msg=admin-created");
}
