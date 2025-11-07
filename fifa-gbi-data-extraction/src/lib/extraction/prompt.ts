import type { ExtractionFieldDefinition } from '@/lib/extraction/schema';
import type { ExtractionTab } from '@/lib/types';

type PromptOptions = {
  tab: ExtractionTab;
  fieldDefinitions: ExtractionFieldDefinition[];
  documentText: string;
  paperTitle?: string;
  doi?: string;
};

const TAB_TITLES: Partial<Record<ExtractionTab, string>> = {
  studyDetails: 'Tab 1: Study Details',
  participantCharacteristics: 'Tab 2: Participant Characteristics',
  definitions: 'Tab 3: Definition & Data Collection',
  exposure: 'Tab 4: Exposure Data',
};

export function buildExtractionPrompt(options: PromptOptions) {
  const { tab, fieldDefinitions, documentText, paperTitle, doi } = options;
  const tabTitle = TAB_TITLES[tab] ?? `Tab: ${tab}`;

  const fieldInstructions = fieldDefinitions
    .map(
      (field, index) =>
        `${index + 1}. Key: "${field.id}" — ${field.label}. Instruction: ${field.description}`,
    )
    .join('\n');

  return [
    'You are an expert sports science data abstractor helping the FIFA Global Burden of Injury & Illness project. Extract only the requested data fields and respond in strict JSON.',
    '',
    'Context:',
    `- Target worksheet: ${tabTitle}`,
    `- Paper title (if known): ${paperTitle ?? 'Unknown'}`,
    `- DOI (if known): ${doi ?? 'Unknown'}`,
    '',
    'Instructions:',
    '1. Read the supplied document text carefully.',
    '2. For each requested field, return an object with keys "key", "value", and "source".',
    "3. \"key\" must match the field's identifier exactly.",
    '4. If the value is not reported, set "value" to an empty string.',
    '5. "source" should contain a short supporting quote (≤320 characters); if no quote is available, return an empty string.',
    '6. Return a flat JSON array like: [ { "key": "FIELD_ID", "value": "...", "source": "..." }, ... ]',
    '7. Do not include any additional commentary, markdown fences, or fields not requested.',
    '',
    '8. MULTI-POPULATION FORMATTING (CRITICAL):',
    '   - If data varies by subgroups (sex, age, tournaments), enter ONE VALUE PER LINE.',
    '   - LINE POSITION links values across fields (Line 1 = Population 1, Line 2 = Population 2).',
    '   ',
    '   POPULATION-DEFINING FIELDS (use identifiers):',
    '     * Sex field: "male\\nfemale"',
    '     * Age Category field: "U19\\nU21"',
    '     * Level of Play field: "professional\\namateur"',
    '   ',
    '   ALL OTHER FIELDS (values only, NO labels):',
    '     * Mean Age: "20.5\\n22.1" (NOT "male — 20.5\\nfemale — 22.1")',
    '     * Sample Size: "62\\n60"',
    '     * Match Exposure: "250 h\\n210 h"',
    '     * Total Injuries: "150\\n120"',
    '     * Incidence: "3.2\\n2.8"',
    '   ',
    '   EXAMPLES:',
    '   Paper says: "62 male players (mean age 20.5) and 60 female players (mean age 22.1)"',
    '   →',
    '     sex: "male\\nfemale"',
    '     sampleSizePlayers: "62\\n60"',
    '     meanAge: "20.5\\n22.1"',
    '   ',
    '   Paper says: "U19 had 150 injuries (incidence 3.2), U21 had 120 injuries (incidence 2.8)"',
    '   →',
    '     ageCategory: "U19\\nU21"',
    '     injuryTotalCount: "150\\n120"',
    '     injuryIncidenceOverall: "3.2\\n2.8"',
    '   ',
    '   - If only ONE population: output single value (no newlines).',
    '   - Always use newline (\\n) to separate, never semicolons or commas.',
    '',
    'Requested fields:',
    fieldInstructions,
    '',
    'Document text:',
    documentText,
  ].join('\n');
}
