"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  LogOut,
  Menu,
  X,
  Rss,
} from "lucide-react";
import { logout } from "@/lib/actions/auth";

const NAV = [
  { href: "/feed", label: "Feed", icon: Rss, exact: false },
  { href: "/ci", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/ci/students", label: "Students", icon: Users },
  { href: "/ci/cases", label: "Case Logs", icon: ClipboardList },
];

function CINavContent({
  displayName,
  role,
  onNav,
}: {
  displayName: string;
  role: string;
  onNav?: () => void;
}) {
  const pathname = usePathname();

  function isActive(href: string, exact = false) {
    return exact ? pathname === href : pathname.startsWith(href);
  }

  return (
    <>
      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5 px-3 py-4">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNav}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-accent/15 text-accent"
                  : "text-white/60 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User + Logout */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2.5 rounded-lg px-3 py-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-black">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-foreground">
              {displayName}
            </p>
            <p className="truncate text-[10px] text-white/40 capitalize">{role}</p>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="text-white/40 hover:text-white transition-colors"
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

export default function CINav({
  displayName,
  role,
}: {
  displayName: string;
  role: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [prevPathname, setPrevPathname] = useState(pathname);

  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  const brand = (
    <div className="flex h-16 items-center gap-2.5 border-b border-border px-5">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent">
        <ClipboardList className="h-4 w-4 text-black" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">NurseSync</p>
        <p className="text-xs text-white/40 capitalize">{role} view</p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-surface">
        {brand}
        <CINavContent displayName={displayName} role={role} />
      </aside>

      {/* Mobile overlay */}
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
            <div>
              <p className="text-sm font-semibold text-foreground">NurseSync</p>
              <p className="text-xs text-white/40 capitalize">{role} view</p>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="text-white/40 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <CINavContent
          displayName={displayName}
          role={role}
          onNav={() => setOpen(false)}
        />
      </aside>

      {/* Mobile FAB trigger */}
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
