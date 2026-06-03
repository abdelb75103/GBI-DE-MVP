export const REASON_LABELS = {
  soccer_injury_surveillance: 'Football/soccer injury or illness surveillance signal with potentially extractable numbers.',
  referee_surveillance: 'Football/soccer referee or match-official injury, illness, health-problem, or mental-health surveillance signal.',
  unclear_plausible_surveillance: 'Plausible football/soccer injury or illness surveillance signal, but title/abstract detail is incomplete.',
  missing_abstract: 'Missing or too-thin abstract; cannot safely exclude from title/citation alone.',
  mental_health_possible_quantitative: 'Football/soccer mental-health or injury-anxiety record with possible quantitative participant-health outcome data.',
  pure_return_to_play_no_surveillance: 'Pure return-to-play/return-to-sport record without a plausible injury or illness surveillance data signal.',
  post_injury_functional_outcome_no_surveillance: 'Already-injured football/soccer population with post-injury functional, treatment, rehabilitation, or return-to-function outcomes rather than surveillance data.',
  retrospective_injury_history_no_surveillance: 'Cross-sectional retrospective injury-history association rather than prospective or repeated injury surveillance.',
  downstream_consequence_no_injury_surveillance: 'Downstream consequence, imaging, biomarker, or neurocognitive outcome rather than prevalence, incidence, or burden of actual injuries.',
  attitude_survey_no_health_outcome_numbers: 'Attitude, knowledge, belief, awareness, perception, or questionnaire-method survey without direct injury, illness, or mental-health outcome numbers.',
  qualitative_reflection_no_surveillance: 'Qualitative reflection, experience, support, or demands record without direct injury, illness, mental-health, incidence, prevalence, burden, or exposure surveillance data.',
  wrong_sport_no_football_subgroup: 'Wrong sport or football code with no football/soccer/futsal/beach/para-football subgroup.',
  non_competitive_football: 'Non-competitive football context without eligible competitive football participants.',
  protocol: 'Protocol record without primary injury or illness surveillance data.',
  editorial_commentary: 'Editorial/commentary record without primary injury or illness surveillance data.',
  narrative_review: 'Narrative review not retained as systematic-review/reference-list screening.',
  register_or_hospital_only: 'Register-only or hospital-record-only data source outside project eligibility.',
  public_media_dataset: 'Public-media-only dataset without eligible player/referee/match-official denominator.',
  video_analysis_no_exposure: 'Retrospective video or match-footage event-characteristic analysis without eligible player exposure, incidence, prevalence, or burden surveillance data.',
  counts_only_no_rates: 'Counts or proportions only with no exposure, rates, or information to calculate rates.',
  non_human_or_unrelated: 'Non-human or unrelated topic.',
  review_not_primary_extraction: 'Review is not a primary extraction study; not retained here except systematic reviews for reference-list checks.',
};

export const compact = (value, max = 1000) => {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max)}...` : text;
};

export const normalizeText = (value) => String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

export const getRecordId = (record) => record.id ?? record.key ?? record.recordId;

export const getStudyId = (record) => record.assigned_study_id ?? record.studyId ?? record.key ?? getRecordId(record);

export const sourceText = (record) => [
  record.title,
  record.abstract,
  record.journal,
  record.authors,
  record.lead_author,
  record.doi,
  record.keywords,
  record.source_label,
  record.sourceRecordId,
  record.source_record_id,
  record.publisher,
  record.location,
  record.notes,
  record.url,
  record.pubmedId,
  record.pmcId,
].filter(Boolean).join('\n');

export const quoteAppearsInRecord = (record, quote) => {
  const normalizedQuote = compact(quote, 5000).toLowerCase();
  return Boolean(normalizedQuote) && sourceText(record).toLowerCase().includes(normalizedQuote);
};

export const firstAvailableQuote = (record, patterns = []) => {
  const fields = [
    ['Title', record.title],
    ['Abstract', record.abstract],
    ['Journal', record.journal],
    ['Citation metadata', record.keywords || record.source_label || record.sourceMetadata || record.notes || record.doi || record.source_record_id],
  ];
  for (const pattern of patterns) {
    for (const [location, value] of fields) {
      const text = String(value ?? '').trim();
      if (text && pattern.test(text)) return { sourceQuote: compact(text, 300), sourceLocation: location };
    }
  }
  for (const [location, value] of fields) {
    const text = String(value ?? '').trim();
    if (text) return { sourceQuote: compact(text, 300), sourceLocation: location };
  }
  return { sourceQuote: String(getRecordId(record) ?? ''), sourceLocation: 'Citation metadata' };
};

export const looksLikeSystematicReview = (record) => {
  const text = `${record.title ?? ''} ${record.abstract ?? ''}`;
  return /(systematic|scoping|umbrella|meta[- ]?analysis|evidence synthesis)/i.test(text)
    && /(soccer|football|futbol|fútbol|futsal|beach soccer|para football|blind football)/i.test(text)
    && /(injur|illness|concussion|hamstring|acl|return[- ]?to[- ]?(play|sport|competition)|epidemiolog|surveillance|health|pain)/i.test(text);
};

export const normalizeTags = (value, max = 10) => {
  const tags = Array.isArray(value) ? value : (value ? [value] : []);
  return tags.map(String).filter(Boolean).slice(0, max);
};

export const expandCompactRecommendation = (item) => {
  const recordId = item?.recordId ?? item?.id;
  const decision = item?.decision ?? item?.d;
  const reasonCode = String(item?.r ?? item?.reasonCode ?? '').trim();
  const note = compact(item?.n ?? item?.reason ?? REASON_LABELS[reasonCode] ?? reasonCode, 700);
  return {
    recordId,
    decision,
    reason: note || REASON_LABELS[reasonCode] || 'No rationale supplied.',
    exclusionReason: item?.exclusionReason ?? item?.x ?? (String(decision).toLowerCase() === 'exclude' ? (REASON_LABELS[reasonCode] || note) : null),
    sourceQuote: item?.sourceQuote ?? item?.q ?? null,
    sourceLocation: item?.sourceLocation ?? item?.l ?? null,
    confidence: item?.confidence ?? item?.c,
    targetTag: item?.targetTag ?? item?.target_tag ?? null,
    tags: normalizeTags(item?.tags ?? item?.t),
    auditNotes: item?.auditNotes ?? item?.a ?? null,
  };
};

export const normalizeScreeningRecommendation = (record, item, {
  modelLabel = 'title/abstract screening',
  includeStudyId = true,
  reasonMax = 700,
  exclusionMax = 400,
  auditMax = 700,
} = {}) => {
  const expanded = expandCompactRecommendation(item);
  const decision = String(expanded.decision ?? '').toLowerCase();
  const recordId = getRecordId(record);
  const studyId = getStudyId(record);
  if (!['include', 'exclude', 'undecided'].includes(decision)) {
    throw new Error(`${studyId}: invalid decision ${expanded.decision}`);
  }

  const reason = compact(expanded.reason, reasonMax);
  if (!reason) throw new Error(`${studyId}: missing reason`);

  let confidence = Number(expanded.confidence);
  if (!Number.isFinite(confidence)) confidence = 0.65;
  confidence = Math.max(0, Math.min(1, confidence));

  const tags = normalizeTags(expanded.tags);
  let targetTag = ['systematic_review', 'referee'].includes(expanded.targetTag) ? expanded.targetTag : null;
  if (!targetTag && tags.includes('referee')) targetTag = 'referee';
  if (!targetTag && tags.includes('systematic_review')) targetTag = 'systematic_review';
  if (decision === 'include' && looksLikeSystematicReview(record)) {
    targetTag = 'systematic_review';
    if (!tags.includes('systematic_review')) tags.push('systematic_review');
  }

  const base = {
    recordId,
    title: record.title,
    decision,
    reason,
    confidence,
    targetTag,
    tags,
  };
  if (includeStudyId) base.studyId = studyId;

  if (decision === 'exclude') {
    const exclusionReason = compact(expanded.exclusionReason, exclusionMax);
    let sourceQuote = String(expanded.sourceQuote ?? '').trim();
    let sourceLocation = compact(expanded.sourceLocation, 80);
    let auditNotes = compact(expanded.auditNotes, auditMax) || `${modelLabel} title/abstract screening.`;
    if (!exclusionReason || !sourceQuote || !sourceLocation) {
      throw new Error(`${studyId}: exclude missing exclusionReason, sourceQuote, or sourceLocation`);
    }
    if (!quoteAppearsInRecord(record, sourceQuote)) {
      sourceQuote = String(record.title ?? '').trim();
      sourceLocation = 'Title';
      auditNotes = `${auditNotes} Exact quote repaired to title after model returned a non-matching quote.`;
    }
    if (!sourceQuote || !quoteAppearsInRecord(record, sourceQuote)) {
      throw new Error(`${studyId}: exclusion quote is not present in supplied record`);
    }
    return {
      ...base,
      targetTag: null,
      exclusionReason,
      sourceQuote,
      sourceLocation,
      auditNotes: compact(auditNotes, auditMax),
    };
  }

  return {
    ...base,
    exclusionReason: null,
    sourceQuote: null,
    sourceLocation: null,
    auditNotes: compact(expanded.auditNotes, auditMax) || `${modelLabel} title/abstract screening.`,
  };
};

const deterministicRecommendation = (record, {
  decision,
  reasonCode,
  confidence,
  targetTag = null,
  tags = [],
  sourceQuote = null,
  sourceLocation = null,
  auditNotes,
}, modelLabel) => normalizeScreeningRecommendation(record, {
  id: getRecordId(record),
  d: decision,
  r: reasonCode,
  c: confidence,
  t: tags,
  targetTag,
  q: sourceQuote,
  l: sourceLocation,
  a: auditNotes || `Deterministic pre-triage before ${modelLabel}.`,
}, { modelLabel: `deterministic pre-triage before ${modelLabel}` });

export const preTriageRecord = (record, modelLabel = 'codex-cli') => {
  const text = normalizeText(sourceText(record));
  const title = normalizeText(record.title);
  const abstract = normalizeText(record.abstract);
  const coreText = normalizeText([record.title, record.abstract, record.journal].filter(Boolean).join('\n'));
  const metadataText = normalizeText([record.keywords, record.source_label, record.notes, record.location, record.publisher].filter(Boolean).join('\n'));
  const hasAbstract = Boolean(abstract);
  const soccerSignal = /\b(soccer|association football|futbol|fútbol|futsal|beach soccer|para football|blind football|footballer|footballers)\b/.test(text)
    || /\bfootball\b/.test(text)
    || /\b(fifa world cup|fifa tournament|fifa beach soccer world cup|fifa futsal world cup)\b/.test(text);
  const refereeSignal = /\b(referee|referees|assistant referee|assistant referees|match official|match officials)\b/.test(text);
  const footballMetadataSignal = /\b(football|soccer|futsal|beach soccer|para football)\b/.test(metadataText);
  const wrongFootballCode = /\b(nfl|national football league|american football|gridiron|canadian football|australian rules|afl|gaelic football|rugby)\b/.test(coreText)
    && !/\b(soccer|association football|futsal|futbol|fútbol|beach soccer|para football|a-league)\b/.test(coreText)
    && !footballMetadataSignal;
  const nonCompetitive = /\b(walking football|football fitness|exercise intervention|medical intervention|recreational-only|non-competitive|noncompetitive)\b/.test(coreText)
    && !/\b(elite|professional|academy|league|tournament|competition|competitive|club|national team)\b/.test(text);
  const injurySignal = /\b(injur\w*|illness|concussion|health problem|health problems|mental health|psychological|psychosocial|anxiety|depression|distress|stress|burnout|wellbeing|well-being|pain|ostrc|time loss|medical attention)\b/.test(text);
  const surveillanceSignal = /\b(incidence|prevalence|burden|rate|rates|risk|epidemiolog|surveillance|count|counts|frequency|frequencies|exposure|denominator|player[- ]?hours|match[- ]?hours|athlete[- ]?exposures|person[- ]?time|ostr c|ostrc|prospective|cohort)\b/.test(text);
  const eligibleSurveillanceDataSignal = /\b(incidence|prevalence|burden|epidemiolog|surveillance|exposure|denominator|frequency|frequencies|player[- ]?hours|match[- ]?hours|athlete[- ]?exposures|person[- ]?time|per 1000|per 365 player-days|ostr c|ostrc|reported all health problems|weekly)\b/.test(text)
    || /\bprospective\b.{0,80}\b(cohort|surveillance|follow-up|follow up)\b/.test(text);
  const mentalHealthPossible = /\b(mental health|psychological|psychosocial|anxiety|depression|distress|stress|burnout|wellbeing|well-being|injury anxiety|sports injury anxiety)\b/.test(text);
  const attitudeOnlySurvey = /\b(attitude|attitudes|knowledge|belief|beliefs|awareness|perception|perceptions|acceptability|preference|preferences|questionnaire|survey)\b/.test(coreText)
    && !/\b(prevalence|incidence|burden|rate|rates|frequency|frequencies|count|counts|surveillance|exposure|denominator|injury anxiety|sports injury anxiety|mental health disorder|depression|anxiety symptoms|distress|burnout)\b/.test(text);
  const qualitativeReflection = /\b(reflection|reflections|experience|experiences|perspective|perspectives|interview|interviews|qualitative|support|demands|evolving demands|lived experience|stakeholder|narrative)\b/.test(coreText)
    && !/\b(prevalence|incidence|burden|rate|rates|frequency|frequencies|count|counts|surveillance|exposure|denominator|player[- ]?hours|match[- ]?hours|athlete[- ]?exposures|person[- ]?time|ostrc|reported all health problems|mental health disorder|depression|anxiety symptoms|distress|burnout|injury anxiety|sports injury anxiety)\b/.test(text);
  const systematicSignal = /\b(systematic review|scoping review|umbrella review|meta-analysis|metaanalysis|evidence synthesis)\b/.test(text);
  const protocol = /\b(protocol|study protocol|trial protocol)\b/.test(title);
  const editorial = /\b(editorial|commentary|letter to the editor|opinion)\b/.test(title);
  const publicMedia = /\b(transfermarkt|premierinjuries|public media|media reports?)\b/.test(coreText)
    || /\bpublicly available\b/.test(coreText) && !/\b(exposure|rate|incidence|surveillance|prospective)\b/.test(coreText);
  const videoAnalysisNoExposure = /\b(video analysis|video-based|match footage|broadcast footage|publicly available|publicly obtained|public video|television broadcast)\b/.test(coreText)
    && /\b(potential head injury situation|potential head injury situations|head injury situation|head injury situations|head impact|visible signs|concussion substitution|medical assessment|aerial duel|aerial duels|event characteristic|event characteristics|characteristics)\b/.test(coreText)
    && !/\b(player[- ]?hours|match[- ]?hours|athlete[- ]?exposures|person[- ]?time|exposure hours|training exposure|individual match exposure|incidence rate|incidence rates|per 1000|per 365 player-days|prevalence|burden|weekly|prospective follow-up|reported all health problems)\b/.test(text);
  const registerOnly = /\b(register|registry|hospital record|medical record|emergency department|hospitali[sz]ation)\b/.test(coreText)
    && !mentalHealthPossible
    && !/\b(exposure|rate|incidence|player[- ]?hours|match[- ]?hours)\b/.test(text);
  const pureRtp = /\b(return to play|return-to-play|return to sport|return-to-sport|rtp|rts|rehabilitation|rehab|treatment|surgery|imaging|prognosis)\b/.test(title)
    && !eligibleSurveillanceDataSignal;
  const alreadyInjuredSelection = /\b(previously injured|prior injur|history of injur|after injury|post-injury|postinjury|injured players|injured footballers|injured soccer players|acl reconstruction|aclr|anterior cruciate ligament reconstruction|postoperative|postoperatively|surgery|surgeries|surgical|graft failure|rerupture|re-rupture)\b/.test(coreText)
    || /\b(players|athletes|footballers|soccer players|participants|patients)\s+with\s+[^.]{0,100}\b(fractures?|injur(?:y|ies)|sprains?|strains?|ruptures?|tears?|concussions?|acl|pain)\b/.test(coreText)
    || /\b(fractures?|injur(?:y|ies)|sprains?|strains?|ruptures?|tears?|concussions?|acl)\s+in\s+[^.]{0,100}\b(players|athletes|footballers|soccer players)\b/.test(coreText);
  const treatmentOrFunctionOutcome = /\b(function|functional|clinical outcomes?|treatment outcomes?|outcome|outcomes|symptom|symptoms|rehabilitation|treatment|treated|fixation|k-wire|kirschner|return to function|quality of life|pain|return to play|return-to-play|return to sport|return-to-sport|return to training|return to competition|range of motion|rom\b|grip strength|visual analog scale|vas\b|dash scores?|radiographic healing|radiographic union|volume of play|career longevity|seasons played|minutes played|games played|playing status|graft failure|rerupture|re-rupture|complication rates?)\b/.test(coreText);
  const postInjuryFunctionalOutcome = alreadyInjuredSelection
    && treatmentOrFunctionOutcome
    && !eligibleSurveillanceDataSignal;
  const retrospectiveInjuryHistoryAssociation = /\b(cross-sectional|cross sectional|case-control|case control)\b/.test(coreText)
    && /\b(history of injur|injury history|previous injur|prior injur|past injur|self-reported (?:their )?injury history|recalled injur|retrospective recall)\b/.test(coreText)
    && /\b(association|associated|risk factor|risk-factor|odds ratio|logistic regression|dependent variable|independent variable|navicular drop)\b/.test(coreText)
    && !eligibleSurveillanceDataSignal;
  const injuryEpidemiologyDataSignal = /\b(incidence|prevalence|epidemiolog|surveillance|player[- ]?hours|match[- ]?hours|athlete[- ]?exposures|person[- ]?time|per 1000|per 365 player-days|reported all health problems|weekly)\b/.test(text)
    || /\b(injur\w*|illness|concussion|mtbi|head injur\w*|health problems?)\b.{0,80}\b(burden|rate|rates)\b/.test(text)
    || /\b(burden|rate|rates)\b.{0,80}\b(injur\w*|illness|concussion|mtbi|head injur\w*|health problems?)\b/.test(text);
  const downstreamConsequenceNoSurveillance = /\b(white matter hyperintensit|wmh\b|flair|mri|imaging|brain scan|neuroimaging|biomarker|p-tau|chronic traumatic encephalopathy|cte\b|lesion|lesions|gray matter|grey matter|neurocognitive|cognitive function|behavioral|behavioural|emotional|diagnostic consensus|neuroradiolog|alzheimer)\b/.test(coreText)
    && /\b(repetitive head impact|rhi\b|remote history|history of exposure|long-term|long term|years of .*play|contact sports?|exposed to rhi|downstream|consequence|consequences)\b/.test(coreText)
    && !injuryEpidemiologyDataSignal;

  if (wrongFootballCode) {
    const quote = firstAvailableQuote(record, [/nfl|national football league|american football|gridiron|canadian football|australian rules|australian football|afl|gaelic football|rugby/i]);
    return deterministicRecommendation(record, { decision: 'exclude', reasonCode: 'wrong_sport_no_football_subgroup', confidence: 0.92, ...quote }, modelLabel);
  }

  if (protocol || editorial) {
    const quote = firstAvailableQuote(record, [protocol ? /protocol/i : /editorial|commentary|letter to the editor|opinion/i]);
    return deterministicRecommendation(record, { decision: 'exclude', reasonCode: protocol ? 'protocol' : 'editorial_commentary', confidence: 0.88, ...quote }, modelLabel);
  }

  if (nonCompetitive) {
    const quote = firstAvailableQuote(record, [/walking football|football fitness|exercise intervention|medical intervention|recreational|non-competitive|noncompetitive/i]);
    return deterministicRecommendation(record, { decision: 'exclude', reasonCode: 'non_competitive_football', confidence: 0.82, ...quote }, modelLabel);
  }

  if (publicMedia || registerOnly) {
    const reasonCode = publicMedia ? 'public_media_dataset' : 'register_or_hospital_only';
    const quote = firstAvailableQuote(record, [/transfermarkt|premierinjuries|publicly available|register|registry|hospital|proportion|number of injuries|counts only/i]);
    return deterministicRecommendation(record, { decision: 'exclude', reasonCode, confidence: 0.78, ...quote }, modelLabel);
  }

  if (videoAnalysisNoExposure && soccerSignal) {
    const quote = firstAvailableQuote(record, [/video analysis|video-based|match footage|broadcast footage|potential head injury situation|potential head injury situations|head injury situation|head injury situations|head impact|visible signs|concussion substitution|medical assessment|aerial duel|aerial duels/i]);
    return deterministicRecommendation(record, { decision: 'exclude', reasonCode: 'video_analysis_no_exposure', confidence: 0.82, ...quote }, modelLabel);
  }

  if (retrospectiveInjuryHistoryAssociation && soccerSignal) {
    const quote = firstAvailableQuote(record, [/cross-sectional|cross sectional|case-control|case control|history of injur|injury history|self-reported (?:their )?injury history|odds ratio|logistic regression/i]);
    return deterministicRecommendation(record, { decision: 'exclude', reasonCode: 'retrospective_injury_history_no_surveillance', confidence: 0.84, ...quote }, modelLabel);
  }

  if (downstreamConsequenceNoSurveillance && soccerSignal) {
    const quote = firstAvailableQuote(record, [/white matter hyperintensit|wmh|flair|mri|neuroimaging|biomarker|p-tau|chronic traumatic encephalopathy|repetitive head impact|rhi|neurocognitive|behavioral|behavioural/i]);
    return deterministicRecommendation(record, { decision: 'exclude', reasonCode: 'downstream_consequence_no_injury_surveillance', confidence: 0.84, ...quote }, modelLabel);
  }

  if (postInjuryFunctionalOutcome && soccerSignal) {
    const quote = firstAvailableQuote(record, [/previously injured|prior injur|history of injur|after injury|post-injury|postinjury|injured players|injured footballers|injured soccer players|acl reconstruction|aclr|anterior cruciate ligament reconstruction|postoperative|postoperatively|surgery|surgical|graft failure|rerupture|re-rupture|functional|function|symptom|rehabilitation|treatment|return to play|return-to-play|return to sport|return-to-sport|volume of play|career longevity|seasons played|minutes played|games played|playing status|quality of life|pain/i]);
    return deterministicRecommendation(record, { decision: 'exclude', reasonCode: 'post_injury_functional_outcome_no_surveillance', confidence: 0.82, ...quote }, modelLabel);
  }

  if (pureRtp && soccerSignal) {
    const quote = firstAvailableQuote(record, [/return to play|return-to-play|return to sport|return-to-sport|rehabilitation|rehab|treatment|surgery|imaging|prognosis/i]);
    return deterministicRecommendation(record, { decision: 'exclude', reasonCode: 'pure_return_to_play_no_surveillance', confidence: 0.78, ...quote }, modelLabel);
  }

  if (attitudeOnlySurvey && soccerSignal) {
    const quote = firstAvailableQuote(record, [/attitude|attitudes|knowledge|belief|beliefs|awareness|perception|perceptions|acceptability|preference|preferences|questionnaire|survey/i]);
    return deterministicRecommendation(record, { decision: 'exclude', reasonCode: 'attitude_survey_no_health_outcome_numbers', confidence: 0.78, ...quote }, modelLabel);
  }

  if (qualitativeReflection && soccerSignal) {
    const quote = firstAvailableQuote(record, [/reflection|reflections|experience|experiences|perspective|perspectives|interview|interviews|qualitative|support|demands|evolving demands|lived experience|stakeholder|narrative/i]);
    return deterministicRecommendation(record, { decision: 'exclude', reasonCode: 'qualitative_reflection_no_surveillance', confidence: 0.74, ...quote }, modelLabel);
  }

  if ((soccerSignal || refereeSignal) && injurySignal && surveillanceSignal) {
    const tags = [];
    let targetTag = null;
    let reasonCode = 'soccer_injury_surveillance';
    if (refereeSignal) {
      tags.push('referee');
      targetTag = 'referee';
      reasonCode = 'referee_surveillance';
    }
    if (systematicSignal) {
      tags.push('systematic_review');
      targetTag = targetTag || 'systematic_review';
    }
    return deterministicRecommendation(record, {
      decision: 'include',
      reasonCode,
      confidence: refereeSignal ? 0.88 : 0.84,
      targetTag,
      tags,
    }, modelLabel);
  }

  if (soccerSignal && mentalHealthPossible) {
    return deterministicRecommendation(record, {
      decision: 'include',
      reasonCode: 'mental_health_possible_quantitative',
      confidence: 0.68,
      tags: ['mental_health'],
    }, modelLabel);
  }

  if (!hasAbstract && soccerSignal) {
    return deterministicRecommendation(record, {
      decision: 'undecided',
      reasonCode: 'missing_abstract',
      confidence: 0.2,
      tags: ['missing_abstract'],
    }, modelLabel);
  }

  return null;
};

export const validateScreeningOutput = (records, rawItems, modelLabel, options = {}) => {
  const byId = new Map(records.map((record) => [getRecordId(record), record]));
  const seen = new Set();
  const normalized = [];

  for (const item of rawItems) {
    const recordId = item?.recordId ?? item?.id;
    const record = byId.get(recordId);
    if (!record) throw new Error(`unexpected recordId ${recordId || '(missing)'}`);
    if (seen.has(recordId)) throw new Error(`${getStudyId(record)}: duplicate recommendation`);
    seen.add(recordId);
    normalized.push(normalizeScreeningRecommendation(record, item, { modelLabel, ...options }));
  }

  const missing = records.filter((record) => !seen.has(getRecordId(record))).map((record) => getStudyId(record));
  if (missing.length > 0) {
    throw new Error(`missing recommendations: ${missing.slice(0, 10).join(', ')}`);
  }

  return normalized.sort((left, right) => {
    const leftIndex = records.findIndex((record) => getRecordId(record) === left.recordId);
    const rightIndex = records.findIndex((record) => getRecordId(record) === right.recordId);
    return leftIndex - rightIndex;
  });
};
