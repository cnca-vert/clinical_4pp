"use client";

import { useActionState } from "react";
import { createAdminAccount } from "./actions";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface Props {
  token: string;
}

type State = { error?: string | null };
const initial: State = {};

export default function AdminInviteForm({ token }: Props) {
  const [showPassword, setShowPassword] = useState(false);

  const boundAction = createAdminAccount.bind(null, token);
  const [state, action, pending] = useActionState(boundAction, initial);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-(--text-secondary)">
          Full Name
        </label>
        <input
          name="full_name"
          type="text"
          required
          autoFocus
          placeholder="e.g. Maria Santos"
          className="w-full rounded-lg border border-border bg-elevated px-3 py-2.5 text-sm text-foreground placeholder:(--text-muted) outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-(--text-secondary)">
          Email
        </label>
        <input
          name="email"
          type="email"
          required
          placeholder="admin@example.com"
          className="w-full rounded-lg border border-border bg-elevated px-3 py-2.5 text-sm text-foreground placeholder:(--text-muted) outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-(--text-secondary)">
          Password
        </label>
        <div className="relative">
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            required
            minLength={8}
            placeholder="Minimum 8 characters"
            className="w-full rounded-lg border border-border bg-elevated px-3 py-2.5 pr-10 text-sm text-foreground placeholder:(--text-muted) outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-(--text-muted) hover:text-foreground"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {state.error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-accent-hover disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {pending ? "Creating account…" : "Create admin account"}
      </button>
    </form>
  );
}
