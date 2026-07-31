-- UniOsunPulse Admin Schema
-- Run this AFTER schema.sql in Supabase SQL Editor
-- Creates admin tables, adds them to realtime, and sets RLS

-- Student Verifications Queue
create table if not exists public.student_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  full_name text not null,
  matric_number text not null,
  department text not null,
  campus text not null default 'Osogbo',
  id_card_url text,
  status text not null default 'pending',
  rejection_reason text,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_verifications_status on public.student_verifications(status);

-- Reported Posts (Content Moderation)
create table if not exists public.reported_posts (
  id uuid primary key default gen_random_uuid(),
  post_id text not null references public.posts(id) on delete cascade,
  reporter_id text not null,
  reporter_name text,
  reason text not null,
  details text,
  status text not null default 'pending',
  action_taken text,
  resolved_by text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_reported_posts_status on public.reported_posts(status);

-- Elections
create table if not exists public.elections (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'SUG',
  description text,
  status text not null default 'draft',
  start_time timestamptz,
  end_time timestamptz,
  total_votes integer not null default 0,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure new columns exist even if the table was created before this migration
do $$
begin
  if to_regclass('public.elections') is not null then
    alter table public.elections add column if not exists start_at timestamptz;
    alter table public.elections add column if not exists end_at timestamptz;
    alter table public.elections add column if not exists faculty text;
    alter table public.elections add column if not exists image_url text;
    alter table public.elections add column if not exists max_candidates integer;
  end if;
end
$$;

create table if not exists public.election_candidates (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections(id) on delete cascade,
  name text not null,
  position text not null,
  department text,
  manifesto text,
  avatar_url text,
  vote_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.election_votes (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections(id) on delete cascade,
  voter_id text not null,
  candidate_id uuid not null references public.election_candidates(id) on delete cascade,
  position_id text not null,
  receipt_hash text not null,
  created_at timestamptz not null default now(),
  unique(election_id, voter_id, position_id),
  unique(election_id, position_id, receipt_hash)
);

create index if not exists idx_election_votes_position on public.election_votes(position_id);

create index if not exists idx_candidates_election on public.election_candidates(election_id);
create index if not exists idx_votes_election on public.election_votes(election_id);

-- Admin Audit Logs
create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id text not null,
  admin_name text,
  action text not null,
  target_type text not null,
  target_id text,
  details jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_created on public.admin_audit_logs(created_at desc);

-- Realtime: add admin tables if they exist
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'public.student_verifications',
    'public.reported_posts',
    'public.elections',
    'public.election_candidates',
    'public.election_votes',
    'public.admin_audit_logs'
  ]
  loop
    if to_regclass(tbl) is not null then
      if not exists (
        select 1
        from pg_publication p
        join pg_publication_rel pr on pr.prpubid = p.oid
        join pg_class c on c.oid = pr.prrelid
        where p.pubname = 'supabase_realtime'
          and c.oid = to_regclass(tbl)
      ) then
        execute format('alter publication supabase_realtime add table %s;', tbl);
      end if;
    end if;
  end loop;
end
$$;

-- RLS Policies for admin tables
do $$
begin
  if to_regclass('public.student_verifications') is not null then
    alter table public.student_verifications enable row level security;
    create policy "Allow all" on public.student_verifications for all using (true) with check (true);
  end if;

  if to_regclass('public.reported_posts') is not null then
    alter table public.reported_posts enable row level security;
    create policy "Allow all" on public.reported_posts for all using (true) with check (true);
  end if;

  if to_regclass('public.elections') is not null then
    alter table public.elections enable row level security;
    create policy "Allow all" on public.elections for all using (true) with check (true);
  end if;

  if to_regclass('public.election_candidates') is not null then
    alter table public.election_candidates enable row level security;
    create policy "Allow all" on public.election_candidates for all using (true) with check (true);
  end if;

  if to_regclass('public.election_votes') is not null then
    alter table public.election_votes enable row level security;
    create policy "Allow all" on public.election_votes for all using (true) with check (true);
  end if;

  if to_regclass('public.admin_audit_logs') is not null then
    alter table public.admin_audit_logs enable row level security;
    create policy "Allow all" on public.admin_audit_logs for all using (true) with check (true);
  end if;
end
$$;
