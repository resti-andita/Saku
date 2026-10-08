-- Skema Saku (SQLite). Satu sumber untuk aplikasi (lib/db.ts) dan
-- skrip admin (scripts/saku-user.mjs). Idempoten: aman dijalankan berulang.

create table if not exists ledgers (
  id text primary key,
  data text not null,
  version integer not null default 0
);

create table if not exists receipts (
  id text primary key,
  name text not null,
  type text not null,
  size integer not null,
  actor text not null,
  ready integer not null default 0,
  created_at text not null default ''
);

create table if not exists team_access (
  user_id text primary key,
  name text not null,
  first_seen text not null,
  last_seen text not null,
  last_edit text,
  last_action text
);

create table if not exists users (
  email text primary key,
  name text not null,
  pass_hash text not null,
  created_at text not null
);

create table if not exists sessions (
  token_hash text primary key,
  email text not null,
  created_at text not null,
  expires_at text not null
);

create index if not exists sessions_email_idx on sessions(email);
