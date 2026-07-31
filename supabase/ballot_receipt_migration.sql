-- Ballot Receipt Migration
-- Run this in Supabase SQL Editor if you already have the old election_votes table.
-- Adds position_id and updates unique constraints so users can vote once per position
-- and each ballot receipt is unique per position.

alter table public.election_votes add column if not exists position_id text;

-- Drop old global constraints if they exist
alter table public.election_votes drop constraint if exists election_votes_receipt_hash_key;
alter table public.election_votes drop constraint if exists election_votes_election_id_voter_id_key;

-- New constraints: one vote per (election, voter, position) + unique receipt per (election, position, receipt)
alter table public.election_votes add unique if not exists (election_id, voter_id, position_id);
alter table public.election_votes add unique if not exists (election_id, position_id, receipt_hash);

create index if not exists idx_election_votes_position on public.election_votes(position_id);
 