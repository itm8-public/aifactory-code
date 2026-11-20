-- Ids use the built-in gen_random_uuid(): no PostgreSQL extensions.
-- Add a new numbered file for every change; never edit one that has been applied.

create table items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  created_by text not null,
  created_at timestamptz not null default now()
);

-- Who changed what. The app's role may only read and insert here (see app/migrate.py).
create table audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id text not null,
  action text not null,
  entity text not null,
  entity_id text not null,
  detail jsonb
);

-- One row per AI request, for the per-user limit (any replica may serve any request).
create table ai_usage (
  id bigint generated always as identity primary key,
  user_id text not null,
  at timestamptz not null default now()
);
create index ai_usage_user_at_idx on ai_usage (user_id, at);

-- Actions the agent proposed. The model can only propose; a person approves or rejects them in
-- the app, and only then does the server run the action (see app/tools.py).
create table agent_actions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  tool text not null,
  arguments jsonb not null,
  summary text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'failed')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index agent_actions_user_status_idx on agent_actions (user_id, status);
