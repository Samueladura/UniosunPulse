-- UniOsunPulse RPC Functions
-- Run this in Supabase SQL Editor after schema.sql

create or replace function public.increment_like(post_id text)
returns void as $$
begin
  update public.posts set like_count = like_count + 1 where id = post_id;
end;
$$ language plpgsql;

create or replace function public.decrement_like(post_id text)
returns void as $$
begin
  update public.posts set like_count = greatest(like_count - 1, 0) where id = post_id;
end;
$$ language plpgsql;

create or replace function public.increment_comment(post_id text)
returns void as $$
begin
  update public.posts set comment_count = comment_count + 1 where id = post_id;
end;
$$ language plpgsql;

create or replace function public.decrement_comment(post_id text)
returns void as $$
begin
  update public.posts set comment_count = greatest(comment_count - 1, 0) where id = post_id;
end;
$$ language plpgsql;

-- Fix cast_vote ambiguity
drop function if exists public.cast_vote(uuid, text, uuid, text);
drop function if exists public.cast_vote(uuid, uuid, uuid, text);

create or replace function public.cast_vote(
  p_election_id uuid,
  p_position_id text,
  p_candidate_id uuid,
  p_user_id text
) returns jsonb as $$
declare
  v_receipt_hash text;
  v_existing_id uuid;
  v_result jsonb;
begin
  select id, receipt_hash into v_existing_id, v_receipt_hash
  from public.election_votes
  where election_id = p_election_id
    and voter_id = p_user_id
    and position_id = p_position_id;

  if v_existing_id is not null then
    v_result := jsonb_build_object(
      'receipt_hash', v_receipt_hash,
      'is_duplicate', true
    );
    return v_result;
  end if;

  v_receipt_hash := 'BAL-' ||
    substr(encode(gen_random_bytes(3), 'hex'), 1, 6) || '-' ||
    substr(encode(gen_random_bytes(4), 'hex'), 1, 8);

  insert into public.election_votes (
    election_id, voter_id, candidate_id, position_id, receipt_hash
  ) values (
    p_election_id, p_user_id, p_candidate_id, p_position_id, v_receipt_hash
  );

  update public.election_candidates
  set vote_count = vote_count + 1
  where id = p_candidate_id;

  update public.elections
  set total_votes = total_votes + 1
  where id = p_election_id;

  v_result := jsonb_build_object(
    'receipt_hash', v_receipt_hash,
    'is_duplicate', false
  );
  return v_result;
end;
$$ language plpgsql security definer;