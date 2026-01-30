import { supabaseClient } from '@/lib/db/shared';
import type { ExtractionTab } from '@/lib/types';
import type { AiReviewDecisionInsert, AiReviewDecisionRow } from '@/lib/db/types';

export type AiReviewDecision = {
  paperId: string;
  tab: ExtractionTab;
  fieldId: string;
  decision: 'approved' | 'declined';
  reviewerProfileId: string;
};

export async function upsertAiReviewDecision(input: AiReviewDecision): Promise<void> {
  const supabase = supabaseClient();
  const payload: AiReviewDecisionInsert = {
    paper_id: input.paperId,
    tab: input.tab,
    field_id: input.fieldId,
    decision: input.decision,
    reviewer_profile_id: input.reviewerProfileId,
  };

  const { error } = await supabase
    .from('ai_review_decisions')
    .upsert(payload, { onConflict: 'paper_id,tab,field_id' });

  if (error) {
    throw new Error(`Failed to save AI review decision: ${error.message}`);
  }
}

export async function clearAiReviewDecisionsForFields(input: {
  paperId: string;
  tab: ExtractionTab;
  fieldIds: string[];
}): Promise<void> {
  if (!input.fieldIds.length) {
    return;
  }

  const supabase = supabaseClient();
  const { error } = await supabase
    .from('ai_review_decisions')
    .delete()
    .eq('paper_id', input.paperId)
    .eq('tab', input.tab)
    .in('field_id', input.fieldIds);

  if (error) {
    throw new Error(`Failed to clear AI review decisions: ${error.message}`);
  }
}

export async function listAiReviewDecisions(): Promise<AiReviewDecision[]> {
  const supabase = supabaseClient();
  const { data, error } = await supabase.from('ai_review_decisions').select('*');

  if (error) {
    throw new Error(`Failed to list AI review decisions: ${error.message}`);
  }

  return (data ?? []).map((row) => {
    const typed = row as AiReviewDecisionRow;
    return {
      paperId: typed.paper_id,
      tab: typed.tab,
      fieldId: typed.field_id,
      decision: typed.decision,
      reviewerProfileId: typed.reviewer_profile_id,
    };
  });
}

export async function listProfileNamesById(profileIds: string[]): Promise<Map<string, string>> {
  const uniqueIds = Array.from(new Set(profileIds)).filter(Boolean);
  const map = new Map<string, string>();
  if (!uniqueIds.length) {
    return map;
  }

  const supabase = supabaseClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', uniqueIds);

  if (error) {
    throw new Error(`Failed to load reviewer profiles: ${error.message}`);
  }

  (data ?? []).forEach((row) => {
    const id = (row as { id: string }).id;
    const name = (row as { full_name?: string | null }).full_name ?? '';
    map.set(id, name);
  });

  return map;
}

