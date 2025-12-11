import { z } from 'zod';
import { jsonrepair } from 'jsonrepair';

import type { Part } from '@google/generative-ai';

import { buildExtractionPrompt } from '@/lib/extraction/prompt';
import { extractionFieldDefinitions, ExtractionFieldDefinition } from '@/lib/extraction/schema';
import { createGeminiModel, getFallbackModelName, getModelName } from '@/lib/extraction/gemini-client';
import type { ExtractionFieldResult, ExtractionTab } from '@/lib/types';

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
  source: z.union([z.string(), z.null()]).optional().nullable(),
}).passthrough(); // Allow extra fields, be lenient

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

  const primaryModelName = getModelName();
  const fallbackModelName = getFallbackModelName();

  let generation;
  let usedModelName = primaryModelName;

  const parts: Part[] = [];
  if (options.pdfBase64) {
    parts.push({
      inlineData: { mimeType: 'application/pdf', data: options.pdfBase64 },
    } as Part);
  }
  parts.push({ text: prompt } as Part);

  try {
    const model = createGeminiModel(options.apiKey, primaryModelName);
    generation = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts,
        },
      ],
    });
  } catch (error) {
    const message = (error as Error).message ?? '';
    const lower = message.toLowerCase();
    const isLimitError =
      lower.includes('rate') ||
      lower.includes('quota') ||
      lower.includes('limit') ||
      lower.includes('exceeded');

    if (!isLimitError) {
      throw new Error('AI extraction failed. Please try again.');
    }

    try {
      const fallbackModel = createGeminiModel(options.apiKey, fallbackModelName);
      generation = await fallbackModel.generateContent({
        contents: [
          {
            role: 'user',
            parts,
          },
        ],
      });
      usedModelName = fallbackModelName;
    } catch (fallbackError) {
      throw new Error('AI extraction hit usage limits. Please wait a few minutes and try again.');
    }
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
    try {
      const repaired = jsonrepair(cleanedText);
      parsed = JSON.parse(repaired);
      console.warn(`[extractTab] Repaired Gemini JSON for ${options.tab}: ${(error as Error).message}`);
    } catch (repairError) {
      throw new Error(
        `Gemini returned invalid JSON for tab ${options.tab}: ${(error as Error).message}. Response snippet: ${cleanedText.slice(0, 200)}. Repair failed: ${(repairError as Error).message}`,
      );
    }
  }

  // Use safeParse for lenient validation - don't fail on minor issues
  const validationResult = z.array(extractionItemSchema).safeParse(parsed);
  
  if (!validationResult.success) {
    // Log the error but try to continue with partial data
    console.warn(`[extractTab] Validation warnings for ${options.tab}:`, validationResult.error.issues);
    
    // Try to extract what we can - filter out invalid items and continue
    const validItems: z.infer<typeof extractionItemSchema>[] = [];
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        const itemResult = extractionItemSchema.safeParse(item);
        if (itemResult.success) {
          validItems.push(itemResult.data);
        } else {
          console.warn(`[extractTab] Skipping invalid item:`, item, itemResult.error.issues);
        }
      }
    }
    
    // If we have some valid items, use them; otherwise throw
    if (validItems.length === 0) {
      throw new Error(
        `Extraction validation failed for tab ${options.tab}: ${validationResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`
      );
    }
    
    const fields = mapValidatedResults(tabFields, validItems);
    return {
      tab: options.tab,
      fields,
      raw: validItems,
      model: usedModelName,
    };
  }
  
  const fields = mapValidatedResults(tabFields, validationResult.data);

  return {
    tab: options.tab,
    fields,
    raw: validationResult.data,
    model: usedModelName,
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
    // Handle source being null, undefined, or string - be lenient
    const source = candidate?.source 
      ? (typeof candidate.source === 'string' ? candidate.source.trim() : null)
      : null;
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
