"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { logout } from "@/lib/actions/auth";
import { LayoutDashboard, CalendarClock, ClipboardList, Menu, X, Rss, FilePlus, BookUser } from "lucide-react";

const NAV = [
  { href: "/feed", label: "Feed", icon: Rss },
  { href: "/student/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/student/upload", label: "Submit Case", icon: FilePlus },
  { href: "/student/assignments", label: "Assignments", icon: CalendarClock },
  { href: "/student/history", label: "Case History", icon: ClipboardList },
  { href: "/student/directory", label: "Directory", icon: BookUser },
];

export default function StudentNav({ displayName }: { displayName: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [prevPathname, setPrevPathname] = useState(pathname);

  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  return (
    <header className="shrink-0 border-b border-border bg-surface">
      <div className="flex h-16 items-center justify-between px-4 md:px-6">
        {/* Brand + desktop nav */}
        <div className="flex items-center gap-4 md:gap-6">
          <span className="text-sm font-semibold text-foreground">NurseSync</span>
          <nav className="hidden md:flex items-center gap-1">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                  pathname.startsWith(href)
                    ? "bg-accent/15 text-accent font-medium"
                    : "text-(--text-secondary) hover:text-foreground hover:bg-elevated"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-bold text-black">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <p className="text-sm font-medium text-foreground hidden sm:block">{displayName}</p>
          <form action={logout} className="hidden md:block">
            <button className="text-xs text-(--text-secondary) hover:text-foreground transition-colors">
              Sign out
            </button>
          </form>
          {/* Mobile hamburger */}
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center justify-center rounded-lg p-1.5 text-(--text-secondary) hover:bg-elevated hover:text-foreground transition-colors md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown nav */}
      {open && (
        <nav className="flex flex-col border-t border-border px-4 py-2 md:hidden">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                pathname.startsWith(href)
                  ? "bg-accent/15 text-accent font-medium"
                  : "text-(--text-secondary) hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          ))}
          <div className="border-t border-border mt-2 pt-2">
            <form action={logout}>
              <button className="text-sm text-(--text-secondary) hover:text-foreground transition-colors px-3 py-2">
                Sign out
              </button>
            </form>
          </div>
        </nav>
      )}
    </header>
  );
}
