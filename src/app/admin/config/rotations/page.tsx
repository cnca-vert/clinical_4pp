import { createClient } from "@/lib/supabase/server";
import RotationsConfigClient from "./RotationsConfigClient";
import type { Rotation } from "./RotationsConfigClient";

export default async function RotationsConfigPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("rotations")
    .select("id, name, inclusive_days")
    .order("name");

  return <RotationsConfigClient rotations={(data ?? []) as Rotation[]} />;
}
