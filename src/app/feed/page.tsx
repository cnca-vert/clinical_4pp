import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AnnouncementCard, { type Comment } from "@/components/shared/AnnouncementCard";
import { Bell, Users, ClipboardList, Megaphone } from "lucide-react";

type Announcement = {
  id: string;
  title: string;
  content: string;
  created_at: string;
  image_url: string | null;
  profiles: { full_name: string } | null;
  announcement_comments: Comment[];
};

export default async function FeedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const role = (user.app_metadata?.role as string) ?? "student";

  // Run ALL queries in parallel — no sequential waits
  const [profileRes, announcementsRes, studentsRes, casesRes] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).single(),
    supabase
      .from("announcements")
      .select(`
        id,
        title,
        content,
        created_at,
        image_url,
        profiles(full_name),
        announcement_comments(
          id,
          content,
          created_at,
          user_id,
          profiles(full_name)
        )
      `)
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "student"),
    supabase.from("case_logs").select("id", { count: "exact", head: true }),
  ]);

  const displayName = profileRes.data?.full_name ?? "there";
  const announcements = (announcementsRes.data ?? []) as unknown as Announcement[];
  const totalStudents = studentsRes.count ?? 0;
  const totalCases = casesRes.count ?? 0;
  const totalAnnouncements = announcements.length;

  return (
    <div className="min-h-full">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-surface border-b border-border">
        {/* Decorative accent glow */}
        <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-accent/6 blur-3xl" />

        <div className="relative mx-auto max-w-3xl px-6 py-12 md:py-16">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
              <Bell className="h-4 w-4 text-black" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-accent">
              NurseSync
            </span>
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-foreground leading-tight mb-3">
            Clinicals, simplified.
          </h1>
          <p className="text-sm md:text-base text-(--text-secondary) max-w-lg">
            Stay on top of your area assignments, shift schedules, case logs and clinical
            advisories — synced in one central hub.
          </p>

          {/* Stats row */}
          <div className="mt-8 grid grid-cols-3 gap-4 max-w-sm">
            <div className="rounded-xl border border-border bg-elevated p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Users className="h-3.5 w-3.5 text-accent" />
                <span className="text-lg font-bold text-foreground">{totalStudents}</span>
              </div>
              <p className="text-[11px] text-(--text-muted)">Students</p>
            </div>
            <div className="rounded-xl border border-border bg-elevated p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <ClipboardList className="h-3.5 w-3.5 text-accent" />
                <span className="text-lg font-bold text-foreground">{totalCases}</span>
              </div>
              <p className="text-[11px] text-(--text-muted)">Cases Logged</p>
            </div>
            <div className="rounded-xl border border-border bg-elevated p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Megaphone className="h-3.5 w-3.5 text-accent" />
                <span className="text-lg font-bold text-foreground">{totalAnnouncements}</span>
              </div>
              <p className="text-[11px] text-(--text-muted)">Posts</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Feed ── */}
      <section className="mx-auto max-w-2xl px-4 md:px-6 py-8 space-y-6">
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
            Updates &amp; Announcements
          </h2>
        </div>

        {announcements.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface p-16 text-center">
            <Megaphone className="mx-auto h-8 w-8 text-(--text-muted) mb-3" />
            <p className="text-sm text-(--text-secondary)">No announcements yet.</p>
            {role === "admin" && (
              <p className="text-xs text-(--text-muted) mt-1">
                Post one from the{" "}
                <a href="/admin/announcements" className="text-accent hover:underline">
                  Announcements
                </a>{" "}
                page.
              </p>
            )}
          </div>
        ) : (
          announcements.map((a) => (
            <AnnouncementCard
              key={a.id}
              id={a.id}
              title={a.title}
              content={a.content}
              created_at={a.created_at}
              image_url={a.image_url}
              profiles={a.profiles}
              comments={a.announcement_comments}
              currentUserId={user.id}
              currentUserRole={role}
            />
          ))
        )}
      </section>
    </div>
  );
}
