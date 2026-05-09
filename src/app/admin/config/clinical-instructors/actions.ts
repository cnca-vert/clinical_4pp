"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function toggleClinicalInstructor(formData: FormData) {
  const id = formData.get("id") as string;
  const currentActive = formData.get("is_active") === "true";

  const supabase = await createClient();
  await supabase.from("profiles").update({ is_active: !currentActive }).eq("id", id);
  revalidatePath("/admin/config/clinical-instructors");
}
