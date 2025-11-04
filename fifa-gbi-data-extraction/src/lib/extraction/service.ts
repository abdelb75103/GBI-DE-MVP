import { z } from 'zod';

import { buildExtractionPrompt } from '@/lib/extraction/prompt';
import { extractionFieldDefinitions, ExtractionFieldDefinition } from '@/lib/extraction/schema';
import { createGeminiModel, getModelName } from '@/lib/extraction/gemini-client';
import type { ExtractionFieldResult, ExtractionTab } from '@/lib/types';
import type { Part } from '@google/generative-ai';

export type TabExtractionResponse = {
  tab: ExtractionTab;
  fields: ExtractionFieldResult[];
  raw: unknown;
  model: string;
};

type ExtractTabOptions = {
  tab: ExtractionTab;
  documentText: string;
  paperTitle?: string;
  doi?: string;
  apiKey: string;
  fieldIds?: string[];
  pdfBase64?: string;
};

const MAX_DOCUMENT_CHARS = 60_000;

const extractionItemSchema = z.object({
  key: z.string(),
  value: z.union([z.string(), z.null()]).optional(),
  source: z.string().optional(),
});

export async function extractTab(options: ExtractTabOptions): Promise<TabExtractionResponse> {
  const tabFields = filterTabFields(options.tab, options.fieldIds);
  if (tabFields.length === 0) {
    throw new Error('No valid fields requested for extraction');
  }

  const prompt = buildExtractionPrompt({
    tab: options.tab,
    fieldDefinitions: tabFields,
    documentText: limitDocumentText(options.documentText),
    paperTitle: options.paperTitle,
    doi: options.doi,
  });

  const model = createGeminiModel(options.apiKey);
  let generation;
  try {
    const parts: Part[] = [];
    if (options.pdfBase64) {
      parts.push({
        inlineData: { mimeType: 'application/pdf', data: options.pdfBase64 },
      });
    }
    parts.push({ text: prompt });

    generation = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts,
        },
      ],
    });
  } catch (error) {
    throw new Error(`Gemini request failed for tab ${options.tab}: ${(error as Error).message}`);
  }

  const candidate = generation.response?.candidates?.[0];
  if (!candidate) {
    throw new Error(`Gemini returned no candidates for tab ${options.tab}`);
  }

  const rawText = candidate.content?.parts
    ?.map((part) => ('text' in part ? part.text ?? '' : ''))
    .join('')
    .trim();

  const cleanedText = sanitiseJsonText(rawText ?? '');
  if (!cleanedText) {
    throw new Error(`Gemini returned an empty response for tab ${options.tab}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleanedText);
  } catch (error) {
    throw new Error(
      `Gemini returned invalid JSON for tab ${options.tab}: ${(error as Error).message}. Response snippet: ${cleanedText.slice(0, 200)}`,
    );
  }

  const validated = z.array(extractionItemSchema).parse(parsed);
  const fields = mapValidatedResults(tabFields, validated);

  return {
    tab: options.tab,
    fields,
    raw: validated,
    model: getModelName(),
  };
}

function mapValidatedResults(
  definitions: ExtractionFieldDefinition[],
  validated: Array<z.infer<typeof extractionItemSchema>>,
): ExtractionFieldResult[] {
  const timestamp = new Date().toISOString();
  const lookup = new Map<string, z.infer<typeof extractionItemSchema>>();

  for (const item of validated) {
    if (!item.key) {
      continue;
    }
    lookup.set(item.key, item);
    lookup.set(item.key.toLowerCase(), item);
  }

  return definitions.map((definition) => {
    const candidate =
      lookup.get(definition.id) || lookup.get(definition.id.toLowerCase()) || lookup.get(definition.label) || null;

    const rawValue = candidate?.value ?? null;
    const trimmed = typeof rawValue === 'string' ? rawValue.trim() : null;
    const value = trimmed && trimmed.length > 0 ? trimmed : null;
    const source = candidate?.source?.trim();
    const status: ExtractionFieldResult['status'] = value ? 'reported' : 'not_reported';

    return {
      fieldId: definition.id,
      value,
      confidence: null,
      status,
      sourceQuote: source || undefined,
      pageHint: undefined,
      updatedAt: timestamp,
      updatedBy: 'ai',
    };
  });
}

function sanitiseJsonText(text: string) {
  return text
    .replace(/^```json\s*/i, '')
    .replace(/^```/i, '')
    .replace(/```$/i, '')
    .trim();
}

function limitDocumentText(text: string) {
  if (text.length <= MAX_DOCUMENT_CHARS) {
    return text;
  }

  return `${text.slice(0, MAX_DOCUMENT_CHARS)}

[Document truncated for prompt length]`;
}

function filterTabFields(tab: ExtractionTab, fieldIds?: string[]) {
  const definitions = extractionFieldDefinitions.filter((field) => field.tab === tab);
  if (!fieldIds || fieldIds.length === 0) {
    return definitions;
  }

  const requested = new Set(fieldIds);
  return definitions.filter((definition) => requested.has(definition.id));
}
