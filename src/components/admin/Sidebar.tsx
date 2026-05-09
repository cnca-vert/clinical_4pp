"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  ClipboardList,
  CalendarPlus,
  Users,
  GraduationCap,
  Settings,
  Megaphone,
  ScrollText,
  Download,
  LogOut,
  Menu,
  X,
  Rss,
  ClipboardCheck,
  BookOpen,
} from "lucide-react";
import { logout } from "@/lib/actions/auth";

const NAV = [
  { href: "/feed", label: "Feed", icon: Rss },
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/cases/review", label: "Cases", icon: ClipboardCheck },
  { href: "/admin/assignments", label: "Assignments", icon: CalendarPlus },
  { href: "/admin/students", label: "Students", icon: GraduationCap },
  { href: "/admin/roster", label: "Enrollment", icon: Users },
  { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
  {
    href: "/admin/config",
    label: "Configuration",
    icon: Settings,
    children: [
      { href: "/admin/config/case-types", label: "Case Types" },
      { href: "/admin/config/areas-of-duty", label: "Areas of Duty" },
      { href: "/admin/config/shifts", label: "Shifts" },
      { href: "/admin/config/rotations", label: "Rotations" },
      { href: "/admin/config/clinical-instructors", label: "Clinical Instructors" },
      { href: "/admin/config/requirements", label: "Requirements" },
      { href: "/admin/config/storage", label: "Storage" },
    ],
  },
  { href: "/admin/semester", label: "Semester", icon: BookOpen },
  { href: "/admin/audit", label: "Audit Logs", icon: ScrollText },
  { href: "/admin/export", label: "Export Data", icon: Download },
];

function SidebarContent({
  pathname,
  onNav,
}: {
  pathname: string;
  onNav?: () => void;
}) {
  function isActive(href: string, exact = false) {
    return exact ? pathname === href : pathname.startsWith(href);
  }

  return (
    <>
      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-4">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href, item.exact);

          if (item.children) {
            const groupActive = isActive(item.href);
            return (
              <div key={item.href}>
                <div
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    groupActive
                      ? "text-accent"
                      : "text-(--text-secondary) hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </div>
                <div className="ml-4 mt-0.5 flex flex-col gap-0.5 border-l border-border pl-3">
                  {item.children.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={onNav}
                      className={`rounded-md px-2 py-1.5 text-xs transition-colors ${
                        pathname === child.href
                          ? "bg-accent-muted text-accent font-medium"
                          : "text-(--text-secondary) hover:text-foreground"
                      }`}
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNav}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-accent-muted text-accent"
                  : "text-(--text-secondary) hover:bg-elevated hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="border-t border-border p-3">
        <form action={logout}>
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-(--text-secondary) transition-colors hover:bg-elevated hover:text-foreground"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Sign out
          </button>
        </form>
      </div>
    </>
  );
}

export function AdminMobileMenuButton({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center justify-center rounded-lg p-2 text-(--text-secondary) hover:bg-elevated hover:text-foreground transition-colors md:hidden"
      aria-label={open ? "Close menu" : "Open menu"}
    >
      {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
    </button>
  );
}

export default function AdminSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const brand = (
    <div className="flex h-16 items-center gap-2.5 border-b border-border px-5">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent">
        <ClipboardList className="h-4 w-4 text-black" />
      </div>
      <span className="text-sm font-semibold text-foreground">
        Clinical Cases
      </span>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-surface">
        {brand}
        <SidebarContent pathname={pathname} />
      </aside>

      {/* Mobile: hamburger button injected via layout header */}
      {/* Mobile drawer overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border bg-surface transition-transform duration-200 md:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-border px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent">
              <ClipboardList className="h-4 w-4 text-black" />
            </div>
            <span className="text-sm font-semibold text-foreground">
              Clinical Cases
            </span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="text-(--text-secondary) hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <SidebarContent pathname={pathname} onNav={() => setOpen(false)} />
      </aside>

      {/* Mobile hamburger trigger (rendered into layout header via sibling component) */}
      <div className="fixed bottom-4 left-4 z-30 md:hidden">
        <button
          onClick={() => setOpen(true)}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-black shadow-lg"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>
    </>
  );
}
