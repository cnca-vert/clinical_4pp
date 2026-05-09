-- One-time admin invite tokens
create table if not exists public.admin_invites (
  id          uuid primary key default gen_random_uuid(),
  token       text not null unique,
  used        boolean not null default false,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '24 hours')
);

-- Only service role / postgres can touch this table
alter table public.admin_invites enable row level security;

-- No SELECT/INSERT/UPDATE/DELETE for authenticated or anon users via RLS
-- (all access goes through the service-role client in server actions)
