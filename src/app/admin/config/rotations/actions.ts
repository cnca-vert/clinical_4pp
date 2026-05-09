"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const REVALIDATE = "/admin/config/rotations";

export async function createRotation(formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  const inclusiveDaysRaw = formData.getAll("inclusive_days") as string[];
  const inclusiveDays = inclusiveDaysRaw.map(Number);

  if (!name) return { error: "Name is required." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized." };

  const { error } = await supabase.from("rotations").insert({
    name,
    inclusive_days: inclusiveDays,
    created_by: user.id,
  });

  if (error) return { error: error.message };

  revalidatePath(REVALIDATE);
  return { success: true };
}

export async function updateRotation(formData: FormData) {
  const id = formData.get("id") as string;
  const name = (formData.get("name") as string)?.trim();
  const inclusiveDaysRaw = formData.getAll("inclusive_days") as string[];
  const inclusiveDays = inclusiveDaysRaw.map(Number);

  if (!id || !name) return { error: "Name is required." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("rotations")
    .update({ name, inclusive_days: inclusiveDays })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath(REVALIDATE);
  return { success: true };
}

export async function deleteRotation(formData: FormData) {
  const id = formData.get("id") as string;
  if (!id) return { error: "Missing rotation ID." };

  const supabase = await createClient();
  const { error } = await supabase.from("rotations").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath(REVALIDATE);
  return { success: true };
}
