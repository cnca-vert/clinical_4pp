import { createClient } from "@/lib/supabase/server";
import ClinicalInstructorsClient from "./ClinicalInstructorsClient";
import type { ClinicalInstructor } from "./ClinicalInstructorsClient";

export default async function ClinicalInstructorsConfigPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, ci_login_email, ci_credentials_expire_at, is_active")
    .eq("role", "ci")
    .order("full_name");

  return <ClinicalInstructorsClient items={(data ?? []) as ClinicalInstructor[]} />;
}
