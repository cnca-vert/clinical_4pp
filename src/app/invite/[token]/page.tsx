import { createServiceClient } from "@/lib/supabase/service";
import AdminInviteForm from "./AdminInviteForm";
import { ShieldCheck, AlertTriangle } from "lucide-react";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: Props) {
  const { token } = await params;

  // Validate token server-side before rendering the form
  const supabase = createServiceClient();
  const { data: invite } = await supabase
    .from("admin_invites")
    .select("used, expires_at")
    .eq("token", token)
    .single();

  const invalid =
    !invite ||
    invite.used ||
    new Date(invite.expires_at) < new Date();

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
            {invalid ? (
              <AlertTriangle className="h-6 w-6 text-amber-400" />
            ) : (
              <ShieldCheck className="h-6 w-6 text-accent" />
            )}
          </div>
          <h1 className="text-xl font-bold text-foreground">
            {invalid ? "Invalid Invite" : "Create Admin Account"}
          </h1>
          <p className="mt-1 text-sm text-(--text-muted)">
            {invalid
              ? "This invite link is expired, already used, or invalid."
              : "You have been invited to create an administrator account."}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6">
          {invalid ? (
            <p className="text-center text-sm text-(--text-secondary)">
              Please contact the system owner to request a new invite link.
            </p>
          ) : (
            <AdminInviteForm token={token} />
          )}
        </div>
      </div>
    </main>
  );
}
