const AWAITING_FULL_TEXT_PDF_SENTINEL = Buffer.from('awaiting-full-text-pdf').toString('base64');

const isDecision = (value) => value === 'include' || value === 'exclude' || value === 'flag';

const getMetadata = (record) =>
  record?.metadata && typeof record.metadata === 'object' && !Array.isArray(record.metadata)
    ? record.metadata
    : {};

export const getTitleAbstractSupabaseDecisions = (record) => {
  const metadata = getMetadata(record);
  return Array.isArray(metadata.titleAbstractDecisions)
    ? metadata.titleAbstractDecisions
      .filter((item) => item && typeof item === 'object' && item.reviewerProfileId && isDecision(item.decision) && item.decidedAt)
      .slice(0, 3)
    : [];
};

export const getTitleAbstractSupabaseResolution = (record) => {
  const metadata = getMetadata(record);
  if (metadata.titleAbstractPromotedRecordId) return 'promoted_to_full_text';

  const decisions = getTitleAbstractSupabaseDecisions(record);
  const resolverDecision = decisions.find((decision) => decision.action === 'resolver_decision') ?? decisions[2];
  if (resolverDecision?.decision === 'flag') return 'flagged';
  if (resolverDecision) return resolverDecision.decision === 'include' ? 'ready_for_full_text' : 'excluded';

  const reviewerVotes = decisions.filter((decision) => decision.action !== 'resolver_decision');
  if (reviewerVotes.some((decision) => decision.decision === 'flag')) return 'flagged';

  const humanDecision = reviewerVotes.find((decision) => decision.decision === 'include' || decision.decision === 'exclude');
  if (!humanDecision) return 'pending';

  const aiDecision = record.ai_status === 'completed' && (record.ai_suggested_decision === 'include' || record.ai_suggested_decision === 'exclude')
    ? record.ai_suggested_decision
    : null;
  if (!aiDecision) return 'pending';
  if (humanDecision.decision === aiDecision) return aiDecision === 'include' ? 'ready_for_full_text' : 'excluded';
  return 'needs_resolver';
};

const getFinalDecisionEntry = (record, resolution) => {
  const decisions = getTitleAbstractSupabaseDecisions(record);
  const resolverDecision = decisions.find((decision) => decision.action === 'resolver_decision');
  if (resolverDecision && resolution !== 'pending') return resolverDecision;
  return decisions.find((decision) => decision.action !== 'resolver_decision');
};

const getManualDecision = (resolution) => {
  if (resolution === 'ready_for_full_text') return 'include';
  if (resolution === 'excluded') return 'exclude';
  return null;
};

const getExclusionReason = (record) => {
  const notes = getTitleAbstractSupabaseDecisions(record)
    .filter((decision) => decision.decision === 'exclude')
    .map((decision) => decision.note?.trim())
    .filter(Boolean);
  return Array.from(new Set(notes)).join(' / ') || 'Excluded at title/abstract screening';
};

export const finalizeTitleAbstractRecommendation = async (supabase, recordId, options = {}) => {
  const { data: record, error: loadError } = await supabase
    .from('screening_records')
    .select('*')
    .eq('id', recordId)
    .eq('stage', 'title_abstract')
    .maybeSingle();

  if (loadError) throw new Error(`Failed to load ${recordId} for title/abstract finalization: ${loadError.message}`);
  if (!record) return { resolution: 'missing', promoted: false };

  const resolution = getTitleAbstractSupabaseResolution(record);
  const finalEntry = getFinalDecisionEntry(record, resolution);
  const finalProfileId = finalEntry?.reviewerProfileId ?? record.manual_decided_by ?? record.created_by ?? null;
  const manualDecision = getManualDecision(resolution);
  const metadata = {
    ...getMetadata(record),
    titleAbstractResolution: resolution,
  };

  const { data: updated, error: updateError } = await supabase
    .from('screening_records')
    .update({
      metadata,
      manual_decision: manualDecision,
      manual_reason: manualDecision === 'exclude' ? getExclusionReason(record) : null,
      manual_decided_by: finalProfileId,
      manual_decided_at: finalEntry ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', record.id)
    .select('*')
    .single();

  if (updateError) throw new Error(`Failed to update ${record.assigned_study_id} final title/abstract resolution: ${updateError.message}`);

  if (resolution !== 'ready_for_full_text' || !finalProfileId) {
    return { resolution, promoted: false };
  }

  const updatedMetadata = getMetadata(updated);
  if (updatedMetadata.titleAbstractPromotedRecordId) {
    return { resolution: 'promoted_to_full_text', promoted: false };
  }

  const { data: existingFullTextRecord, error: existingFullTextError } = await supabase
    .from('screening_records')
    .select('id')
    .eq('stage', 'full_text')
    .eq('assigned_study_id', updated.assigned_study_id)
    .maybeSingle();

  if (existingFullTextError) {
    throw new Error(`Failed to check existing full-text placeholder for ${updated.assigned_study_id}: ${existingFullTextError.message}`);
  }

  const now = new Date().toISOString();
  if (existingFullTextRecord?.id) {
    const { error: linkedError } = await supabase
      .from('screening_records')
      .update({
        metadata: {
          ...updatedMetadata,
          titleAbstractPromotedRecordId: existingFullTextRecord.id,
          titleAbstractPromotedAt: now,
          titleAbstractPromotedBy: finalProfileId,
        },
        updated_at: now,
      })
      .eq('id', updated.id);

    if (linkedError) throw new Error(`Failed to link existing full-text placeholder for ${updated.assigned_study_id}: ${linkedError.message}`);
    return { resolution: 'promoted_to_full_text', promoted: false, fullTextRecordId: existingFullTextRecord.id };
  }

  const { data: fullTextRecord, error: insertError } = await supabase
    .from('screening_records')
    .insert({
      stage: 'full_text',
      assigned_study_id: updated.assigned_study_id,
      title: updated.title,
      abstract: updated.abstract,
      lead_author: updated.lead_author,
      journal: updated.journal,
      year: updated.year,
      doi: updated.doi,
      normalized_doi: updated.normalized_doi,
      source_label: updated.source_label ?? 'title-abstract-screening',
      source_record_id: updated.source_record_id,
      data_base64: AWAITING_FULL_TEXT_PDF_SENTINEL,
      file_name: null,
      original_file_name: null,
      mime_type: null,
      size: null,
      created_by: finalProfileId,
      metadata: {
        ...updatedMetadata,
        titleAbstractRecordId: updated.id,
        titleAbstractStudyId: updated.assigned_study_id,
        titleAbstractPromotedAt: now,
        titleAbstractPromotedBy: finalProfileId,
        awaitingFullTextPdf: true,
      },
    })
    .select('id')
    .single();

  if (insertError) throw new Error(`Failed to promote ${updated.assigned_study_id} to full-text screening: ${insertError.message}`);

  const { error: promotedError } = await supabase
    .from('screening_records')
    .update({
      metadata: {
        ...updatedMetadata,
        titleAbstractPromotedRecordId: fullTextRecord.id,
        titleAbstractPromotedAt: now,
        titleAbstractPromotedBy: finalProfileId,
      },
      updated_at: now,
    })
    .eq('id', updated.id);

  if (promotedError) throw new Error(`Failed to mark ${updated.assigned_study_id} as promoted: ${promotedError.message}`);
  if (!options.quiet) console.log(`promoted ${updated.assigned_study_id} to full-text screening`);

  return { resolution: 'promoted_to_full_text', promoted: true, fullTextRecordId: fullTextRecord.id };
};
