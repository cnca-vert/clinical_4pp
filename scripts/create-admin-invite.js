#!/usr/bin/env node
/**
 * Generates a one-time admin invite link and inserts the token into the DB.
 *
 * Usage (from project root):
 *   node scripts/create-admin-invite.js
 *
 * Requires a .env.local (or environment variables) with:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   NEXT_PUBLIC_APP_URL  (optional, defaults to http://localhost:3000)
 */

const { createClient } = require("@supabase/supabase-js");
const { randomBytes } = require("crypto");

// Load .env.local if present (Next.js style)
try {
  const { config } = require("dotenv");
  config({ path: ".env.local" });
} catch {
  // dotenv not installed — rely on process.env being already set
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://clinical-4pp.vercel.app").replace(/\/$/, "");

if (!url || !key) {
  console.error("❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

(async () => {
  const token = randomBytes(32).toString("hex"); // 64-char hex, cryptographically random
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from("admin_invites")
    .insert({ token, expires_at: expiresAt });

  if (error) {
    console.error("❌  Failed to insert token:", error.message);
    process.exit(1);
  }

  const link = `${appUrl}/invite/${token}`;
  console.log("\n✅  Admin invite link created (valid for 24 hours):\n");
  console.log("  " + link);
  console.log("\n⚠️   Send this link only once. It becomes invalid after the account is created.\n");
})();
