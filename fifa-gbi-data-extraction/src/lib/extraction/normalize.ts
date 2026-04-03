const GLOBAL_SINGLE_VALUE_FIELD_IDS = new Set([
  'studyId',
  'leadAuthor',
  'title',
  'yearOfPublication',
  'journal',
  'doi',
  'studyDesign',
  'fifaDiscipline',
  'country',
  'levelOfPlay',
  'numberOfTeams',
  'observationDuration',
  'injuryDefinition',
  'illnessDefinition',
  'incidenceDefinition',
  'burdenDefinition',
  'severityDefinition',
  'recurrenceDefinition',
  'mechanismReporting',
  'seasonLength',
  'numberOfSeasons',
  'exposureMeasurementUnit',
]);

export function collapseRepeatedLineSequence(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return trimmed;
  }

  for (let size = 1; size <= Math.floor(lines.length / 2); size += 1) {
    if (lines.length % size !== 0) {
      continue;
    }

    const base = lines.slice(0, size);
    let isRepeatedSequence = true;

    for (let index = size; index < lines.length; index += size) {
      const chunk = lines.slice(index, index + size);
      if (chunk.length !== base.length || chunk.some((line, lineIndex) => line !== base[lineIndex])) {
        isRepeatedSequence = false;
        break;
      }
    }

    if (isRepeatedSequence) {
      return base.join('\n');
    }
  }

  return trimmed;
}

export function normalizeStudyDetailsFieldValue(value: string | null | undefined): string | null {
  return collapseRepeatedLineSequence(value);
}

export function normalizeGlobalFieldValue(fieldId: string, value: string | null | undefined): string | null {
  if (!GLOBAL_SINGLE_VALUE_FIELD_IDS.has(fieldId)) {
    if (typeof value !== 'string') {
      return null;
    }

    const normalizedLineEndings = value.replace(/\r\n/g, '\n');
    return normalizedLineEndings.trim().length > 0 ? normalizedLineEndings : null;
  }

  return collapseRepeatedLineSequence(value);
}
