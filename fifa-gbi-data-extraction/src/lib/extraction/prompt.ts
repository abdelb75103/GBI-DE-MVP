import type { ExtractionFieldDefinition, ExtractionTab } from '@/lib/extraction/schema';

type PromptOptions = {
  tab: ExtractionTab;
  fieldDefinitions: ExtractionFieldDefinition[];
  documentText: string;
  paperTitle?: string;
  doi?: string;
};

const TAB_TITLES: Record<ExtractionTab, string> = {
  studyDetails: 'Tab 1: Study Details',
  participantCharacteristics: 'Tab 2: Participant Characteristics',
  definitions: 'Tab 3: Definition & Data Collection',
  exposure: 'Tab 4: Exposure Data',
};

export function buildExtractionPrompt(options: PromptOptions) {
  const { tab, fieldDefinitions, documentText, paperTitle, doi } = options;

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
    `- Target worksheet: ${TAB_TITLES[tab]}`,
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
    'Requested fields:',
    fieldInstructions,
    '',
    'Document text:',
    documentText,
  ].join('\n');
}
