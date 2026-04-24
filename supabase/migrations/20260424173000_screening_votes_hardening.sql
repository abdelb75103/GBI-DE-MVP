-- Harden full-text screening votes.
-- Votes are stored relationally and written through an RPC that locks the
-- parent screening row before recalculating the denormalized record summary.

create table if not exists public.screening_votes (
  id uuid primary key default gen_random_uuid(),
  screening_record_id uuid not null references public.screening_records (id) on delete cascade,
  vote_order smallint not null check (vote_order in (1, 2, 3)),
  vote_role text not null check (vote_role in ('reviewer_vote', 'consensus_resolution')),
  reviewer_profile_id uuid not null references public.profiles (id) on delete restrict,
  reviewer_name text,
  decision text not null check (decision in ('include', 'exclude')),
  reason text,
  decided_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint screening_votes_reason_required_chk
    check (decision <> 'exclude' or coalesce(nullif(trim(reason), ''), '') <> ''),
  constraint screening_votes_reason_length_chk
    check (reason is null or char_length(reason) <= 500),
  constraint screening_votes_role_order_chk
    check (
      (vote_role = 'reviewer_vote' and vote_order in (1, 2))
      or (vote_role = 'consensus_resolution' and vote_order = 3)
    ),
  constraint screening_votes_record_order_key unique (screening_record_id, vote_order)
);

create unique index if not exists screening_votes_record_reviewer_vote_key
  on public.screening_votes (screening_record_id, reviewer_profile_id)
  where vote_role = 'reviewer_vote';

create unique index if not exists screening_votes_record_consensus_key
  on public.screening_votes (screening_record_id)
  where vote_role = 'consensus_resolution';

create index if not exists screening_votes_reviewer_profile_idx
  on public.screening_votes (reviewer_profile_id, decided_at desc);

create index if not exists screening_votes_record_idx
  on public.screening_votes (screening_record_id, vote_order);

alter table public.screening_votes enable row level security;

alter table public.screening_records
  add constraint screening_records_manual_reason_length_chk
  check (manual_reason is null or char_length(manual_reason) <= 500) not valid;

insert into public.screening_votes (
  screening_record_id,
  vote_order,
  vote_role,
  reviewer_profile_id,
  reviewer_name,
  decision,
  reason,
  decided_at,
  updated_at
)
select
  sr.id,
  least(item.ordinality::smallint, 3::smallint),
  case when item.ordinality = 3 then 'consensus_resolution' else 'reviewer_vote' end,
  (item.value->>'reviewerProfileId')::uuid,
  nullif(item.value->>'reviewerName', ''),
  item.value->>'decision',
  left(nullif(item.value->>'reason', ''), 500),
  coalesce((item.value->>'decidedAt')::timestamptz, sr.manual_decided_at, sr.updated_at),
  sr.updated_at
from public.screening_records sr
cross join lateral jsonb_array_elements(sr.metadata->'fullTextDecisions') with ordinality as item(value, ordinality)
where jsonb_typeof(sr.metadata->'fullTextDecisions') = 'array'
  and item.ordinality <= 3
  and item.value->>'reviewerProfileId' is not null
  and item.value->>'decision' in ('include', 'exclude')
on conflict (screening_record_id, vote_order) do nothing;

create or replace function public.save_screening_vote(
  p_record_id uuid,
  p_reviewer_profile_id uuid,
  p_reviewer_name text,
  p_decision text,
  p_decision_action text default 'reviewer_vote',
  p_reason text default null
)
returns public.screening_records
language plpgsql
security definer
set search_path = public
as $$
declare
  v_record public.screening_records%rowtype;
  v_decided_at timestamptz := now();
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_existing_order smallint;
  v_first_count integer;
  v_first_include_count integer;
  v_first_exclude_count integer;
  v_has_conflict boolean;
  v_third_decision text;
  v_resolution text;
  v_manual_decision text;
  v_manual_reason text;
  v_decisions jsonb;
  v_previous_audit jsonb;
  v_action text;
  v_resolution_before text;
begin
  if p_decision not in ('include', 'exclude') then
    raise exception 'Invalid screening decision.';
  end if;

  if coalesce(p_decision_action, 'reviewer_vote') not in ('reviewer_vote', 'consensus_resolution') then
    raise exception 'Invalid screening decision action.';
  end if;

  if p_decision = 'exclude' and v_reason is null then
    raise exception 'A reason is required for excluded full-text records.';
  end if;

  if v_reason is not null and char_length(v_reason) > 500 then
    raise exception 'Exclusion reason must be 500 characters or fewer.';
  end if;

  select *
    into v_record
  from public.screening_records
  where id = p_record_id
  for update;

  if not found then
    raise exception 'Screening record not found.';
  end if;

  select vote_order
    into v_existing_order
  from public.screening_votes
  where screening_record_id = p_record_id
    and reviewer_profile_id = p_reviewer_profile_id
    and vote_role = 'reviewer_vote'
  limit 1;

  select
    count(*),
    count(*) filter (where decision = 'include'),
    count(*) filter (where decision = 'exclude')
    into v_first_count, v_first_include_count, v_first_exclude_count
  from public.screening_votes
  where screening_record_id = p_record_id
    and vote_order in (1, 2);

  v_has_conflict := v_first_count = 2 and v_first_include_count = 1 and v_first_exclude_count = 1;

  if coalesce(p_decision_action, 'reviewer_vote') = 'reviewer_vote' and not v_has_conflict then
    delete from public.screening_votes
    where screening_record_id = p_record_id
      and vote_order = 3;
  end if;

  select decision
    into v_third_decision
  from public.screening_votes
  where screening_record_id = p_record_id
    and vote_order = 3;

  v_resolution_before := coalesce(v_record.metadata->>'fullTextResolution', 'pending');

  if coalesce(p_decision_action, 'reviewer_vote') = 'consensus_resolution' then
    if not v_has_conflict then
      raise exception 'Conflict resolution is only available when the first two reviewer decisions conflict.';
    end if;

    v_action := case when v_third_decision is null then 'consensus_resolution' else 'updated_consensus_resolution' end;

    insert into public.screening_votes (
      screening_record_id,
      vote_order,
      vote_role,
      reviewer_profile_id,
      reviewer_name,
      decision,
      reason,
      decided_at,
      updated_at
    )
    values (
      p_record_id,
      3,
      'consensus_resolution',
      p_reviewer_profile_id,
      p_reviewer_name,
      p_decision,
      v_reason,
      v_decided_at,
      v_decided_at
    )
    on conflict (screening_record_id, vote_order) do update set
      reviewer_profile_id = excluded.reviewer_profile_id,
      reviewer_name = excluded.reviewer_name,
      decision = excluded.decision,
      reason = excluded.reason,
      decided_at = excluded.decided_at,
      updated_at = excluded.updated_at;
  elsif v_existing_order is not null then
    v_action := 'updated_vote';
    update public.screening_votes
    set
      reviewer_name = p_reviewer_name,
      decision = p_decision,
      reason = v_reason,
      decided_at = v_decided_at,
      updated_at = v_decided_at
    where screening_record_id = p_record_id
      and reviewer_profile_id = p_reviewer_profile_id
      and vote_role = 'reviewer_vote';
  elsif v_first_count < 2 then
    v_action := 'initial_vote';
    insert into public.screening_votes (
      screening_record_id,
      vote_order,
      vote_role,
      reviewer_profile_id,
      reviewer_name,
      decision,
      reason,
      decided_at,
      updated_at
    )
    values (
      p_record_id,
      (v_first_count + 1)::smallint,
      'reviewer_vote',
      p_reviewer_profile_id,
      p_reviewer_name,
      p_decision,
      v_reason,
      v_decided_at,
      v_decided_at
    );
  else
    raise exception 'This record already has two reviewer decisions. Update an existing decision or resolve a conflict.';
  end if;

  select
    count(*),
    count(*) filter (where decision = 'include'),
    count(*) filter (where decision = 'exclude')
    into v_first_count, v_first_include_count, v_first_exclude_count
  from public.screening_votes
  where screening_record_id = p_record_id
    and vote_order in (1, 2);

  v_has_conflict := v_first_count = 2 and v_first_include_count = 1 and v_first_exclude_count = 1;

  select decision
    into v_third_decision
  from public.screening_votes
  where screening_record_id = p_record_id
    and vote_order = 3;

  if v_first_count < 2 then
    v_resolution := 'pending';
  elsif v_has_conflict and v_third_decision is not null then
    v_resolution := case when v_third_decision = 'include' then 'ready_for_extraction' else 'excluded' end;
  elsif v_first_include_count = 2 then
    v_resolution := 'ready_for_extraction';
  elsif v_first_exclude_count = 2 then
    v_resolution := 'excluded';
  else
    v_resolution := 'conflict';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'reviewerProfileId', reviewer_profile_id,
        'reviewerName', reviewer_name,
        'decision', decision,
        'reason', reason,
        'decidedAt', decided_at
      )
      order by vote_order
    ),
    '[]'::jsonb
  )
    into v_decisions
  from public.screening_votes
  where screening_record_id = p_record_id;

  select string_agg(distinct reason, ' / ')
    into v_manual_reason
  from public.screening_votes
  where screening_record_id = p_record_id
    and decision = 'exclude'
    and nullif(trim(reason), '') is not null;

  v_manual_decision := case
    when v_resolution = 'ready_for_extraction' then 'include'
    when v_resolution = 'excluded' then 'exclude'
    else null
  end;

  v_previous_audit := case
    when jsonb_typeof(v_record.metadata->'fullTextDecisionAudit') = 'array'
      then v_record.metadata->'fullTextDecisionAudit'
    else '[]'::jsonb
  end;

  update public.screening_records
  set
    manual_decision = v_manual_decision,
    manual_reason = case when v_resolution = 'excluded' then v_manual_reason else null end,
    manual_decided_by = p_reviewer_profile_id,
    manual_decided_at = v_decided_at,
    metadata = coalesce(metadata, '{}'::jsonb)
      || jsonb_build_object(
        'fullTextDecisions', v_decisions,
        'fullTextResolution', v_resolution,
        'fullTextDecisionAudit',
        v_previous_audit || jsonb_build_array(
          jsonb_build_object(
            'reviewerProfileId', p_reviewer_profile_id,
            'reviewerName', p_reviewer_name,
            'decision', p_decision,
            'reason', v_reason,
            'decidedAt', v_decided_at,
            'action', v_action,
            'resolutionBefore', v_resolution_before
          )
        )
      ),
    updated_at = v_decided_at
  where id = p_record_id
  returning * into v_record;

  return v_record;
end;
$$;

revoke all on function public.save_screening_vote(
  uuid,
  uuid,
  text,
  text,
  text,
  text
) from public;

grant execute on function public.save_screening_vote(
  uuid,
  uuid,
  text,
  text,
  text,
  text
) to service_role;
