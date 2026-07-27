import {
  parseAnalysisSourceTreatment,
  type AnalysisSourceLinkMetadata,
} from '@/lib/analysis-source-policy';
import type { AnalysisSourceLink } from '@/lib/types';
import { supabaseClient } from '@/lib/db/shared';

type PaperMetadataRow = {
  id: string;
  assigned_study_id: string;
  metadata: Record<string, unknown> | null;
};

const toLink = (
  sourcePaperId: string,
  sourceStudyId: string,
  anchorPaperId: string,
  link: AnalysisSourceLinkMetadata,
): AnalysisSourceLink => ({
  id: `${sourceStudyId}|${link.anchorStudyId}|${link.relationship}|${link.tournamentKey}`,
  sourcePaperId,
  sourceStudyId,
  anchorPaperId,
  anchorStudyId: link.anchorStudyId,
  relationship: link.relationship,
  tournamentKey: link.tournamentKey,
  notes: link.notes,
});

export const listAnalysisSourceLinks = async (
  paperId: string,
  studyId: string,
  metadata: Record<string, unknown> | undefined,
): Promise<AnalysisSourceLink[]> => {
  const supabase = supabaseClient();
  const currentTreatment = parseAnalysisSourceTreatment(metadata);
  const anchorStudyIds = Array.from(new Set(
    currentTreatment.sourceLinks.map((link) => link.anchorStudyId),
  ));
  const { data: anchors, error: anchorsError } = anchorStudyIds.length > 0
    ? await supabase
        .from('papers')
        .select('id,assigned_study_id,metadata')
        .in('assigned_study_id', anchorStudyIds)
    : { data: [], error: null };
  if (anchorsError) {
    throw new Error(`Failed to resolve analysis source anchors: ${anchorsError.message}`);
  }

  const anchorsByStudyId = new Map(
    ((anchors ?? []) as PaperMetadataRow[]).map((paper) => [paper.assigned_study_id, paper]),
  );
  const outgoing = currentTreatment.sourceLinks.map((link) => {
    const anchor = anchorsByStudyId.get(link.anchorStudyId);
    if (!anchor) {
      throw new Error(
        `Analysis source anchor ${link.anchorStudyId} referenced by ${studyId} is missing`,
      );
    }
    return toLink(paperId, studyId, anchor.id, link);
  });

  const { data: sources, error: sourcesError } = await supabase
    .from('papers')
    .select('id,assigned_study_id,metadata')
    .contains('metadata', {
      analysisSourceTreatment: {
        sourceLinks: [{ anchorStudyId: studyId }],
      },
    });
  if (sourcesError) {
    throw new Error(`Failed to resolve linked analysis sources: ${sourcesError.message}`);
  }

  const incoming = ((sources ?? []) as PaperMetadataRow[]).flatMap((source) => {
    const treatment = parseAnalysisSourceTreatment(source.metadata);
    return treatment.sourceLinks
      .filter((link) => link.anchorStudyId === studyId)
      .map((link) => toLink(source.id, source.assigned_study_id, paperId, link));
  });

  return [...outgoing, ...incoming].sort((left, right) =>
    left.tournamentKey.localeCompare(right.tournamentKey)
    || left.sourceStudyId.localeCompare(right.sourceStudyId)
  );
};
