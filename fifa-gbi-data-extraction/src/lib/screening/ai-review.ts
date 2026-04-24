import { Buffer } from 'node:buffer';

import { jsonrepair } from 'jsonrepair';
import { z } from 'zod';
import type { Part } from '@google/generative-ai';

import { supabaseClient } from '@/lib/db/shared';
import { FULL_TEXT_SCREENING_CRITERIA, SCREENING_CRITERIA_VERSION } from '@/lib/screening/criteria';
import { createGeminiModel, getFallbackModelName, getModelName } from '@/lib/extraction/gemini-client';
import type { ScreeningDecision, ScreeningRecord } from '@/lib/types';

const screeningAiSchema = z.object({
  suggestedDecision: z.enum(['include', 'exclude']),
  reason: z.string().min(1),
  evidenceQuote: z.string().nullable().optional(),
  sourceLocation: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
});

export type ScreeningAiResult = {
  suggestedDecision: ScreeningDecision;
  reason: string;
  evidenceQuote: string | null;
  sourceLocation: string | null;
  confidence: number | null;
  model: string;
  criteriaVersion: string;
  rawResponse: unknown;
};

export class ScreeningAiParseError extends Error {
  rawText: string;

  constructor(message: string, rawText: string) {
    super(message);
    this.name = 'ScreeningAiParseError';
    this.rawText = rawText;
  }
}

export async function reviewFullTextScreeningRecord(
  record: ScreeningRecord,
  apiKey: string,
): Promise<ScreeningAiResult> {
  const pdfBase64 = await loadScreeningPdfBase64(record);
  const prompt = buildScreeningPrompt(record);
  const primaryModelName = getModelName();
  const fallbackModelName = getFallbackModelName();
  let usedModelName = primaryModelName;
  let generation;

  const parts: Part[] = [
    {
      inlineData: { mimeType: record.mimeType || 'application/pdf', data: pdfBase64 },
    } as Part,
    { text: prompt } as Part,
  ];

  try {
    generation = await createGeminiModel(apiKey, primaryModelName).generateContent({
      contents: [{ role: 'user', parts }],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    const isLimitError =
      message.includes('rate') ||
      message.includes('quota') ||
      message.includes('limit') ||
      message.includes('exceeded');
    if (!isLimitError) {
      throw new Error('AI full-text screening failed. Please try again.');
    }
    generation = await createGeminiModel(apiKey, fallbackModelName).generateContent({
      contents: [{ role: 'user', parts }],
    });
    usedModelName = fallbackModelName;
  }

  const rawText = generation.response?.candidates?.[0]?.content?.parts
    ?.map((part) => ('text' in part ? part.text ?? '' : ''))
    .join('')
    .trim();

  if (!rawText) {
    throw new Error('AI full-text screening returned an empty response.');
  }

  let parsed: unknown;
  try {
    parsed = parseJson(rawText);
  } catch {
    throw new ScreeningAiParseError('AI full-text screening returned malformed JSON.', rawText);
  }

  const validated = screeningAiSchema.safeParse(parsed);
  if (!validated.success) {
    throw new ScreeningAiParseError(
      `AI full-text screening response did not match the expected schema: ${validated.error.issues.map((issue) => issue.message).join(', ')}`,
      rawText,
    );
  }

  return {
    suggestedDecision: validated.data.suggestedDecision,
    reason: validated.data.reason,
    evidenceQuote: validated.data.evidenceQuote ?? null,
    sourceLocation: validated.data.sourceLocation ?? null,
    confidence: validated.data.confidence ?? null,
    model: usedModelName,
    criteriaVersion: SCREENING_CRITERIA_VERSION,
    rawResponse: parsed,
  };
}

async function loadScreeningPdfBase64(record: ScreeningRecord): Promise<string> {
  if (record.dataBase64) {
    return record.dataBase64;
  }
  if (!record.storageBucket || !record.storageObjectPath) {
    throw new Error('Screening record has no accessible PDF file.');
  }

  const { data, error } = await supabaseClient()
    .storage
    .from(record.storageBucket)
    .download(record.storageObjectPath);

  if (error || !data) {
    throw new Error(`Failed to download screening PDF: ${error?.message ?? 'No data returned'}`);
  }

  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer).toString('base64');
}

function buildScreeningPrompt(record: ScreeningRecord) {
  return `
You are supporting FIFA GBI full-text screening. Make an advisory preliminary decision only. A human reviewer will make the final decision.

Return strict JSON with exactly:
{
  "suggestedDecision": "include" | "exclude",
  "reason": "short audit-ready reason",
  "evidenceQuote": "short direct quote from the PDF supporting the decision, or null",
  "sourceLocation": "page/table/section hint if visible, or null",
  "confidence": number from 0 to 1
}

Study ID: ${record.assignedStudyId}
Title: ${record.title}
Lead author: ${record.leadAuthor ?? 'not provided'}
Year: ${record.year ?? 'not provided'}
DOI: ${record.doi ?? 'not provided'}

${FULL_TEXT_SCREENING_CRITERIA}
`.trim();
}

function parseJson(rawText: string): unknown {
  const cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```/i, '')
    .replace(/```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    return JSON.parse(jsonrepair(cleaned));
  }
}
