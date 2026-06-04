-- Hide title/abstract records reserved for an offline pack from the normal
-- online queue for that reviewer. The reserved_offline filter remains available
-- as an audit view.

create or replace function public.ta_reserved_offline(meta jsonb, p_reviewer text)
returns boolean
language sql
immutable
as $$
  select coalesce(meta->'titleAbstractOfflineReservation'->>'status', '') = 'active'
    and coalesce(meta->'titleAbstractOfflineReservation'->>'reviewerProfileId', '') = coalesce(p_reviewer, '');
$$;

drop function if exists public.list_title_abstract_queue(text, text, text, int, int);
drop function if exists public.count_title_abstract_queue(text, text, text);
drop function if exists public.get_title_abstract_queue_counts(text);

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
      p_filter = 'reserved_offline'
      or not public.ta_reserved_offline(sr.metadata, p_reviewer)
    )
    and (
      p_filter = 'all'
      or (p_filter = 'reserved_offline' and public.ta_reserved_offline(sr.metadata, p_reviewer))
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
      p_filter = 'reserved_offline'
      or not public.ta_reserved_offline(sr.metadata, p_reviewer)
    )
    and (
      p_filter = 'all'
      or (p_filter = 'reserved_offline' and public.ta_reserved_offline(sr.metadata, p_reviewer))
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
  ai_not_run bigint,
  reserved_offline bigint
)
language sql
stable
as $$
  select
    count(*) filter (where not public.ta_reserved_offline(metadata, p_reviewer)),
    count(*) filter (where not public.ta_reserved_offline(metadata, p_reviewer) and public.ta_reviewer_voted(metadata, p_reviewer)),
    count(*) filter (where not public.ta_reserved_offline(metadata, p_reviewer) and ta_resolution = 'pending' and not public.ta_reviewer_voted(metadata, p_reviewer)),
    count(*) filter (where not public.ta_reserved_offline(metadata, p_reviewer) and ta_resolution = 'pending' and public.ta_reviewer_voted(metadata, p_reviewer)),
    count(*) filter (where not public.ta_reserved_offline(metadata, p_reviewer) and ta_resolution = 'needs_resolver'),
    count(*) filter (where not public.ta_reserved_offline(metadata, p_reviewer) and ta_resolution = 'ready_for_full_text'),
    count(*) filter (where not public.ta_reserved_offline(metadata, p_reviewer) and ta_resolution = 'excluded'),
    count(*) filter (where not public.ta_reserved_offline(metadata, p_reviewer) and ta_resolution = 'promoted_to_full_text'),
    count(*) filter (where not public.ta_reserved_offline(metadata, p_reviewer) and coalesce(nullif(btrim(abstract), ''), '') = ''),
    count(*) filter (where not public.ta_reserved_offline(metadata, p_reviewer) and public.ta_has_flag(metadata)),
    count(*) filter (where not public.ta_reserved_offline(metadata, p_reviewer) and ai_suggested_decision = 'include'),
    count(*) filter (where not public.ta_reserved_offline(metadata, p_reviewer) and ai_suggested_decision = 'exclude'),
    count(*) filter (where not public.ta_reserved_offline(metadata, p_reviewer) and (ai_raw_response->>'targetTag') = 'systematic_review'),
    count(*) filter (where not public.ta_reserved_offline(metadata, p_reviewer) and ai_status <> 'completed'),
    count(*) filter (where public.ta_reserved_offline(metadata, p_reviewer))
  from public.screening_records
  where stage = 'title_abstract';
$$;

grant execute on function public.ta_reserved_offline(jsonb, text) to service_role, authenticated;
grant execute on function public.list_title_abstract_queue(text, text, text, int, int) to service_role, authenticated;
grant execute on function public.count_title_abstract_queue(text, text, text) to service_role, authenticated;
grant execute on function public.get_title_abstract_queue_counts(text) to service_role, authenticated;
