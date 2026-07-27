export type AnalysisExportScope = 'analysis' | 'source';

export type AnalysisPaperRole =
  | 'standalone'
  | 'anchor'
  | 'multi_tournament_ledger'
  | 'supplement'
  | 'cross_tournament_supplement'
  | 'nested_subset'
  | 'audit_only'
  | 'separate_family';

export type AnalysisSourceRelationship =
  | 'incorporated'
  | 'supports'
  | 'overlaps'
  | 'nested'
  | 'pooled_across'
  | 'separate_family';

type ExportablePaper = {
  includeInAnalysisExport: boolean;
};

type PositionedPopulationGroup = {
  id: string;
  position: number;
  label: string;
};

type PopulationFieldValue = {
  populationGroupId: string;
  fieldId: string;
  value: string | null;
};

type PopulationExclusion = {
  populationPosition: number;
  expectedLabel: string;
};

export type AnalysisSourceLinkMetadata = {
  anchorStudyId: string;
  relationship: AnalysisSourceRelationship;
  tournamentKey: string;
  notes: string | null;
};

export type AnalysisPopulationExclusionMetadata = PopulationExclusion & {
  anchorStudyId: string | null;
  tournamentKey: string;
  notes: string;
};

export type AnalysisPopulationTreatmentMetadata = {
  populationPosition: number;
  expectedLabel: string;
  tournamentKey: string;
  includeInAnalysisExport: boolean;
  expectedValues: Record<string, string>;
};

export type AnalysisSourceTreatment = {
  version: string;
  role: AnalysisPaperRole;
  includeInAnalysisExport: boolean;
  sourceLinks: AnalysisSourceLinkMetadata[];
  populationExclusions: AnalysisPopulationExclusionMetadata[];
  requireCompletePopulationMap: boolean;
  populationTreatments: AnalysisPopulationTreatmentMetadata[];
};

const ANALYSIS_ROLES = new Set<AnalysisPaperRole>([
  'standalone',
  'anchor',
  'multi_tournament_ledger',
  'supplement',
  'cross_tournament_supplement',
  'nested_subset',
  'audit_only',
  'separate_family',
]);

const SOURCE_RELATIONSHIPS = new Set<AnalysisSourceRelationship>([
  'incorporated',
  'supports',
  'overlaps',
  'nested',
  'pooled_across',
  'separate_family',
]);

const PAPER_ROLE_LABELS: Record<AnalysisPaperRole, string> = {
  standalone: 'Standalone source',
  anchor: 'Tournament anchor',
  multi_tournament_ledger: 'Multi-tournament row ledger',
  supplement: 'Supplementary source',
  cross_tournament_supplement: 'Cross-tournament supplement',
  nested_subset: 'Nested subset',
  audit_only: 'Audit only',
  separate_family: 'Separate analysis family',
};

export const getAnalysisPaperRoleLabel = (role: AnalysisPaperRole): string =>
  PAPER_ROLE_LABELS[role];

export const parseAnalysisSourceTreatment = (
  metadata: Record<string, unknown> | null | undefined,
): AnalysisSourceTreatment => {
  const raw = metadata?.analysisSourceTreatment;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      version: '',
      role: 'standalone',
      includeInAnalysisExport: true,
      sourceLinks: [],
      populationExclusions: [],
      requireCompletePopulationMap: false,
      populationTreatments: [],
    };
  }

  const treatment = raw as Record<string, unknown>;
  const role = ANALYSIS_ROLES.has(treatment.role as AnalysisPaperRole)
    ? treatment.role as AnalysisPaperRole
    : 'standalone';
  const sourceLinks = Array.isArray(treatment.sourceLinks)
    ? treatment.sourceLinks.flatMap((entry) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
        const link = entry as Record<string, unknown>;
        if (
          typeof link.anchorStudyId !== 'string'
          || !SOURCE_RELATIONSHIPS.has(link.relationship as AnalysisSourceRelationship)
          || typeof link.tournamentKey !== 'string'
        ) return [];
        return [{
          anchorStudyId: link.anchorStudyId,
          relationship: link.relationship as AnalysisSourceRelationship,
          tournamentKey: link.tournamentKey,
          notes: typeof link.notes === 'string' ? link.notes : null,
        }];
      })
    : [];
  const populationExclusions = Array.isArray(treatment.populationExclusions)
    ? treatment.populationExclusions.flatMap((entry) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
        const exclusion = entry as Record<string, unknown>;
        if (
          !Number.isInteger(exclusion.populationPosition)
          || typeof exclusion.expectedLabel !== 'string'
          || typeof exclusion.tournamentKey !== 'string'
          || typeof exclusion.notes !== 'string'
        ) return [];
        return [{
          populationPosition: exclusion.populationPosition as number,
          expectedLabel: exclusion.expectedLabel,
          anchorStudyId: typeof exclusion.anchorStudyId === 'string'
            ? exclusion.anchorStudyId
            : null,
          tournamentKey: exclusion.tournamentKey,
          notes: exclusion.notes,
        }];
      })
    : [];
  const populationTreatments = Array.isArray(treatment.populationTreatments)
    ? treatment.populationTreatments.flatMap((entry) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
        const row = entry as Record<string, unknown>;
        const expectedValues = row.expectedValues;
        if (
          !Number.isInteger(row.populationPosition)
          || typeof row.expectedLabel !== 'string'
          || typeof row.tournamentKey !== 'string'
          || typeof row.includeInAnalysisExport !== 'boolean'
          || !expectedValues
          || typeof expectedValues !== 'object'
          || Array.isArray(expectedValues)
          || !Object.values(expectedValues).every((value) => typeof value === 'string')
        ) return [];
        return [{
          populationPosition: row.populationPosition as number,
          expectedLabel: row.expectedLabel,
          tournamentKey: row.tournamentKey,
          includeInAnalysisExport: row.includeInAnalysisExport,
          expectedValues: expectedValues as Record<string, string>,
        }];
      })
    : [];

  return {
    version: typeof treatment.version === 'string' ? treatment.version : '',
    role,
    includeInAnalysisExport: treatment.includeInAnalysisExport !== false,
    sourceLinks,
    populationExclusions,
    requireCompletePopulationMap: treatment.requireCompletePopulationMap === true,
    populationTreatments,
  };
};

export const partitionAnalysisExportPapers = <T extends ExportablePaper>(
  papers: T[],
  scope: AnalysisExportScope = 'analysis',
): { included: T[]; excluded: T[] } => {
  if (scope === 'source') {
    return { included: papers, excluded: [] };
  }

  return papers.reduce<{ included: T[]; excluded: T[] }>(
    (result, paper) => {
      result[paper.includeInAnalysisExport ? 'included' : 'excluded'].push(paper);
      return result;
    },
    { included: [], excluded: [] },
  );
};

export const selectAnalysisPopulationGroups = <T extends PositionedPopulationGroup>(
  groups: T[],
  values: PopulationFieldValue[],
  treatment: Pick<
    AnalysisSourceTreatment,
    'populationExclusions' | 'populationTreatments' | 'requireCompletePopulationMap'
  >,
  scope: AnalysisExportScope = 'analysis',
): T[] => {
  const groupsByPosition = new Map(groups.map((group) => [group.position, group]));
  const valuesByGroupId = new Map<string, Map<string, string | null>>();
  for (const value of values) {
    const groupValues = valuesByGroupId.get(value.populationGroupId) ?? new Map();
    groupValues.set(value.fieldId, value.value);
    valuesByGroupId.set(value.populationGroupId, groupValues);
  }

  const populationPositions = new Set<number>();
  for (const row of treatment.populationTreatments) {
    if (populationPositions.has(row.populationPosition)) {
      throw new Error(`Duplicate analysis population treatment at position ${row.populationPosition}`);
    }
    populationPositions.add(row.populationPosition);
    const group = groupsByPosition.get(row.populationPosition);
    if (!group || group.label !== row.expectedLabel) {
      throw new Error(
        `Analysis population treatment no longer matches position ${row.populationPosition} (${row.expectedLabel})`,
      );
    }
    const groupValues = valuesByGroupId.get(group.id) ?? new Map();
    for (const [fieldId, expectedValue] of Object.entries(row.expectedValues)) {
      if (groupValues.get(fieldId) !== expectedValue) {
        throw new Error(
          `Analysis population treatment for ${row.tournamentKey} no longer matches ${fieldId}=${expectedValue}`,
        );
      }
    }
  }

  if (
    treatment.requireCompletePopulationMap
    && (
      treatment.populationTreatments.length !== groups.length
      || groups.some((group) => !populationPositions.has(group.position))
    )
  ) {
    throw new Error('Analysis population treatment does not cover every source population row');
  }

  for (const exclusion of treatment.populationExclusions) {
    const row = treatment.populationTreatments.find(
      (candidate) =>
        candidate.populationPosition === exclusion.populationPosition
        && candidate.tournamentKey === exclusion.tournamentKey,
    );
    if (!row || row.includeInAnalysisExport) {
      throw new Error(
        `Population exclusion for ${exclusion.tournamentKey} lacks a matching source-verified row treatment`,
      );
    }
  }

  if (scope === 'source') {
    return groups;
  }

  const excludedPositions = new Set(
    treatment.populationTreatments
      .filter((row) => !row.includeInAnalysisExport)
      .map((row) => row.populationPosition),
  );
  return groups.filter((group) => !excludedPositions.has(group.position));
};
