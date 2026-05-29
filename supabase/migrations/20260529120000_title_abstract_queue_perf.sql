-- Title/abstract queue performance.
--
-- Previously the whole title_abstract dataset was loaded into Node on every
-- request, mapped, then filtered/counted in JavaScript. This migration pushes
-- the work into Postgres:
--   * ta_compute_resolution(metadata) precomputes the reviewer-independent
--     resolution into a STORED generated column (ta_resolution).
--   * ta_search_text is a STORED generated column for substring search.
--   * RPCs paginate, filter, search, and count entirely in SQL.
--
-- The SQL resolution logic below MUST stay in sync with
-- src/lib/screening/title-abstract-decisions.ts (getTitleAbstractResolution,
-- hasTitleAbstractReviewerVoted, getTitleAbstractDecisions). The app falls back
-- to the in-memory computation when these functions are absent, so applying
-- this migration is safe and non-breaking.

create extension if not exists pg_trgm;

-- Mirror of getTitleAbstractResolution(): operates only on the decisions JSONB.
create or replace function public.ta_compute_resolution(meta jsonb)
returns text
language plpgsql
immutable
as $$
declare
  elem jsonb;
  valid jsonb := '[]'::jsonb;
  valid_len int;
  resolver jsonb;
  include_count int := 0;
  exclude_count int := 0;
  reviewer_count int := 0;
  has_flag boolean := false;
begin
  if meta is null or jsonb_typeof(meta) <> 'object' then
    return 'pending';
  end if;

  if coalesce(meta->>'titleAbstractPromotedRecordId', '') <> '' then
    return 'promoted_to_full_text';
  end if;

  -- getTitleAbstractDecisions(): keep valid reviewer decisions, first 3.
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

  -- resolverDecision = decisions.find(action === 'resolver_decision') ?? decisions[2]
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

  -- reviewerVotes = decisions.filter(action !== 'resolver_decision').slice(0, 2)
  for elem in
    select value
    from jsonb_array_elements(valid) with ordinality as t(value, ord)
    where coalesce(value->>'action', '') <> 'resolver_decision'
    order by ord
    limit 2
  loop
    reviewer_count := reviewer_count + 1;
    if elem->>'decision' = 'flag' then
      has_flag := true;
    elsif elem->>'decision' = 'include' then
      include_count := include_count + 1;
    elsif elem->>'decision' = 'exclude' then
      exclude_count := exclude_count + 1;
    end if;
  end loop;

  if has_flag then
    return 'flagged';
  end if;
  if reviewer_count < 2 then
    return 'pending';
  end if;
  if include_count = 2 then
    return 'ready_for_full_text';
  end if;
  if exclude_count = 2 then
    return 'excluded';
  end if;
  return 'needs_resolver';
end;
$$;

-- Mirror of hasTitleAbstractReviewerVoted(): a non-resolver vote by this reviewer
-- among the first 3 valid decisions.
create or replace function public.ta_reviewer_voted(meta jsonb, reviewer text)
returns boolean
language plpgsql
immutable
as $$
declare
  elem jsonb;
  seen int := 0;
begin
  if reviewer is null or reviewer = '' then
    return false;
  end if;
  if meta is null or jsonb_typeof(meta->'titleAbstractDecisions') <> 'array' then
    return false;
  end if;

  for elem in select value from jsonb_array_elements(meta->'titleAbstractDecisions')
  loop
    if seen >= 3 then
      exit;
    end if;
    if coalesce(elem->>'reviewerProfileId', '') <> ''
       and (elem->>'decision') in ('include', 'exclude', 'flag')
       and coalesce(elem->>'decidedAt', '') <> '' then
      seen := seen + 1;
      if coalesce(elem->>'action', '') <> 'resolver_decision'
         and elem->>'reviewerProfileId' = reviewer then
        return true;
      end if;
    end if;
  end loop;
  return false;
end;
$$;

-- Mirror of the 'flagged' filter/count: any of the first 3 valid decisions is a flag.
create or replace function public.ta_has_flag(meta jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  elem jsonb;
  seen int := 0;
begin
  if meta is null or jsonb_typeof(meta->'titleAbstractDecisions') <> 'array' then
    return false;
  end if;

  for elem in select value from jsonb_array_elements(meta->'titleAbstractDecisions')
  loop
    if seen >= 3 then
      exit;
    end if;
    if coalesce(elem->>'reviewerProfileId', '') <> ''
       and (elem->>'decision') in ('include', 'exclude', 'flag')
       and coalesce(elem->>'decidedAt', '') <> '' then
      seen := seen + 1;
      if elem->>'decision' = 'flag' then
        return true;
      end if;
    end if;
  end loop;
  return false;
end;
$$;

-- Generated columns (auto-backfill on existing rows; recompute on every write).
alter table public.screening_records
  add column if not exists ta_resolution text
  generated always as (public.ta_compute_resolution(metadata)) stored;

-- NOTE: concat_ws()/concat() are STABLE (not IMMUTABLE), so they cannot be used
-- in a generated column. Use the immutable text || operator with coalesce instead.
alter table public.screening_records
  add column if not exists ta_search_text text
  generated always as (
    lower(
      coalesce(assigned_study_id, '') || ' ' ||
      coalesce(title, '') || ' ' ||
      coalesce(abstract, '') || ' ' ||
      coalesce(lead_author, '') || ' ' ||
      coalesce(year, '') || ' ' ||
      coalesce(journal, '') || ' ' ||
      coalesce(doi, '') || ' ' ||
      coalesce(source_record_id, '') || ' ' ||
      coalesce(source_label, '')
    )
  ) stored;

create index if not exists screening_records_ta_resolution_idx
  on public.screening_records (stage, ta_resolution, created_at desc);

create index if not exists screening_records_ta_search_trgm_idx
  on public.screening_records using gin (ta_search_text gin_trgm_ops);

-- Paginated, filtered, searched page of queue rows (full row shape for mapping).
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
      or (p_filter = 'awaiting_other_reviewer' and sr.ta_resolution = 'pending' and public.ta_reviewer_voted(sr.metadata, p_reviewer))
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

-- Total rows matching the same filter + search (for hasMore / "showing N of M").
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
      or (p_filter = 'awaiting_other_reviewer' and sr.ta_resolution = 'pending' and public.ta_reviewer_voted(sr.metadata, p_reviewer))
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

-- Sidebar bucket counts over the whole queue (filter/search independent),
-- mirroring getTitleAbstractQueueCounts().
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

grant execute on function public.list_title_abstract_queue(text, text, text, int, int) to service_role, authenticated;
grant execute on function public.count_title_abstract_queue(text, text, text) to service_role, authenticated;
grant execute on function public.get_title_abstract_queue_counts(text) to service_role, authenticated;
