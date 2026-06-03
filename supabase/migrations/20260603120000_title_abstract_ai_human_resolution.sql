-- Title/abstract screening now resolves from one AI recommendation plus one
-- human reviewer decision. Keep this SQL mirror in sync with
-- src/lib/screening/title-abstract-decisions.ts.

create or replace function public.ta_compute_resolution(
  meta jsonb,
  ai_status text,
  ai_suggested_decision text
)
returns text
language plpgsql
immutable
as $$
declare
  elem jsonb;
  valid jsonb := '[]'::jsonb;
  valid_len int;
  resolver jsonb;
  human_decision text;
  has_flag boolean := false;
  ai_decision text;
begin
  if meta is null or jsonb_typeof(meta) <> 'object' then
    if ai_status = 'completed' and ai_suggested_decision in ('include', 'exclude') then
      return 'pending';
    end if;
    return 'pending';
  end if;

  if coalesce(meta->>'titleAbstractPromotedRecordId', '') <> '' then
    return 'promoted_to_full_text';
  end if;

  if jsonb_typeof(meta->'titleAbstractDecisions') = 'array' then
    for elem in select value from jsonb_array_elements(meta->'titleAbstractDecisions')
    loop
      if jsonb_array_length(valid) >= 3 then
        exit;
      end if;
      if coalesce(elem->>'reviewerProfileId', '') <> ''
         and (elem->>'decision') in ('include', 'exclude', 'flag')
         and coalesce(elem->>'decidedAt', '') <> '' then
        valid := valid || jsonb_build_array(elem);
      end if;
    end loop;
  end if;

  valid_len := jsonb_array_length(valid);

  select value
    into resolver
  from jsonb_array_elements(valid) with ordinality as t(value, ord)
  where value->>'action' = 'resolver_decision'
  order by ord
  limit 1;

  if resolver is null and valid_len >= 3 then
    resolver := valid->2;
  end if;

  if resolver is not null then
    if resolver->>'decision' = 'flag' then
      return 'flagged';
    end if;
    return case when resolver->>'decision' = 'include' then 'ready_for_full_text' else 'excluded' end;
  end if;

  for elem in
    select value
    from jsonb_array_elements(valid) with ordinality as t(value, ord)
    where coalesce(value->>'action', '') <> 'resolver_decision'
    order by ord
  loop
    if elem->>'decision' = 'flag' then
      has_flag := true;
    elsif human_decision is null and elem->>'decision' in ('include', 'exclude') then
      human_decision := elem->>'decision';
    end if;
  end loop;

  if has_flag then
    return 'flagged';
  end if;
  if human_decision is null then
    return 'pending';
  end if;

  ai_decision := case
    when ai_status = 'completed' and ai_suggested_decision in ('include', 'exclude') then ai_suggested_decision
    else null
  end;

  if ai_decision is null then
    return 'pending';
  end if;
  if human_decision = ai_decision then
    return case when ai_decision = 'include' then 'ready_for_full_text' else 'excluded' end;
  end if;
  return 'needs_resolver';
end;
$$;

-- Backward-compatible wrapper for any ad hoc SQL still calling the old helper.
create or replace function public.ta_compute_resolution(meta jsonb)
returns text
language sql
immutable
as $$
  select public.ta_compute_resolution(meta, null, null);
$$;

drop index if exists screening_records_ta_resolution_idx;
drop function if exists public.list_title_abstract_queue(text, text, text, int, int);
drop function if exists public.count_title_abstract_queue(text, text, text);
drop function if exists public.get_title_abstract_queue_counts(text);

alter table public.screening_records
  drop constraint if exists screening_records_assigned_study_id_key;

create unique index if not exists screening_records_stage_assigned_study_id_key
  on public.screening_records (stage, assigned_study_id);

alter table public.screening_records
  drop column if exists ta_resolution;

alter table public.screening_records
  add column ta_resolution text
  generated always as (public.ta_compute_resolution(metadata, ai_status, ai_suggested_decision)) stored;

create index if not exists screening_records_ta_resolution_idx
  on public.screening_records (stage, ta_resolution, created_at desc);

create or replace function public.list_title_abstract_queue(
  p_reviewer text,
  p_filter text default 'all',
  p_search text default '',
  p_offset int default 0,
  p_limit int default 50
)
returns setof public.screening_records
language sql
stable
as $$
  select sr.*
  from public.screening_records sr
  where sr.stage = 'title_abstract'
    and (
      p_filter = 'all'
      or (p_filter = 'needs_your_vote' and sr.ta_resolution = 'pending' and not public.ta_reviewer_voted(sr.metadata, p_reviewer))
      or (p_filter in ('awaiting_ai_recommendation', 'awaiting_other_reviewer') and sr.ta_resolution = 'pending' and public.ta_reviewer_voted(sr.metadata, p_reviewer))
      or (p_filter = 'needs_resolver' and sr.ta_resolution = 'needs_resolver')
      or (p_filter = 'ready_for_full_text' and sr.ta_resolution = 'ready_for_full_text')
      or (p_filter = 'excluded' and sr.ta_resolution = 'excluded')
      or (p_filter = 'promoted_to_full_text' and sr.ta_resolution = 'promoted_to_full_text')
      or (p_filter = 'flagged' and public.ta_has_flag(sr.metadata))
      or (p_filter = 'missing_abstract' and coalesce(nullif(btrim(sr.abstract), ''), '') = '')
      or (p_filter = 'ai_include' and sr.ai_suggested_decision = 'include')
      or (p_filter = 'ai_exclude' and sr.ai_suggested_decision = 'exclude')
      or (p_filter = 'ai_systematic_review' and (sr.ai_raw_response->>'targetTag') = 'systematic_review')
      or (p_filter = 'ai_not_run' and sr.ai_status <> 'completed')
    )
    and (
      coalesce(p_search, '') = ''
      or sr.ta_search_text like '%' || lower(p_search) || '%'
    )
  order by sr.created_at desc, sr.id desc
  offset greatest(coalesce(p_offset, 0), 0)
  limit least(greatest(coalesce(p_limit, 50), 1), 150);
$$;

create or replace function public.count_title_abstract_queue(
  p_reviewer text,
  p_filter text default 'all',
  p_search text default ''
)
returns bigint
language sql
stable
as $$
  select count(*)
  from public.screening_records sr
  where sr.stage = 'title_abstract'
    and (
      p_filter = 'all'
      or (p_filter = 'needs_your_vote' and sr.ta_resolution = 'pending' and not public.ta_reviewer_voted(sr.metadata, p_reviewer))
      or (p_filter in ('awaiting_ai_recommendation', 'awaiting_other_reviewer') and sr.ta_resolution = 'pending' and public.ta_reviewer_voted(sr.metadata, p_reviewer))
      or (p_filter = 'needs_resolver' and sr.ta_resolution = 'needs_resolver')
      or (p_filter = 'ready_for_full_text' and sr.ta_resolution = 'ready_for_full_text')
      or (p_filter = 'excluded' and sr.ta_resolution = 'excluded')
      or (p_filter = 'promoted_to_full_text' and sr.ta_resolution = 'promoted_to_full_text')
      or (p_filter = 'flagged' and public.ta_has_flag(sr.metadata))
      or (p_filter = 'missing_abstract' and coalesce(nullif(btrim(sr.abstract), ''), '') = '')
      or (p_filter = 'ai_include' and sr.ai_suggested_decision = 'include')
      or (p_filter = 'ai_exclude' and sr.ai_suggested_decision = 'exclude')
      or (p_filter = 'ai_systematic_review' and (sr.ai_raw_response->>'targetTag') = 'systematic_review')
      or (p_filter = 'ai_not_run' and sr.ai_status <> 'completed')
    )
    and (
      coalesce(p_search, '') = ''
      or sr.ta_search_text like '%' || lower(p_search) || '%'
    );
$$;

create or replace function public.get_title_abstract_queue_counts(p_reviewer text)
returns table (
  all_count bigint,
  my_votes bigint,
  needs_your_vote bigint,
  awaiting_other bigint,
  resolver bigint,
  ready bigint,
  excluded_count bigint,
  promoted bigint,
  missing_abstract bigint,
  flagged bigint,
  ai_include bigint,
  ai_exclude bigint,
  ai_systematic_review bigint,
  ai_not_run bigint
)
language sql
stable
as $$
  select
    count(*),
    count(*) filter (where public.ta_reviewer_voted(metadata, p_reviewer)),
    count(*) filter (where ta_resolution = 'pending' and not public.ta_reviewer_voted(metadata, p_reviewer)),
    count(*) filter (where ta_resolution = 'pending' and public.ta_reviewer_voted(metadata, p_reviewer)),
    count(*) filter (where ta_resolution = 'needs_resolver'),
    count(*) filter (where ta_resolution = 'ready_for_full_text'),
    count(*) filter (where ta_resolution = 'excluded'),
    count(*) filter (where ta_resolution = 'promoted_to_full_text'),
    count(*) filter (where coalesce(nullif(btrim(abstract), ''), '') = ''),
    count(*) filter (where public.ta_has_flag(metadata)),
    count(*) filter (where ai_suggested_decision = 'include'),
    count(*) filter (where ai_suggested_decision = 'exclude'),
    count(*) filter (where (ai_raw_response->>'targetTag') = 'systematic_review'),
    count(*) filter (where ai_status <> 'completed')
  from public.screening_records
  where stage = 'title_abstract';
$$;

grant execute on function public.ta_compute_resolution(jsonb, text, text) to service_role, authenticated;
grant execute on function public.ta_compute_resolution(jsonb) to service_role, authenticated;
grant execute on function public.list_title_abstract_queue(text, text, text, int, int) to service_role, authenticated;
grant execute on function public.count_title_abstract_queue(text, text, text) to service_role, authenticated;
grant execute on function public.get_title_abstract_queue_counts(text) to service_role, authenticated;
