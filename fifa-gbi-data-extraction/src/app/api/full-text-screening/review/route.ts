import { NextResponse } from 'next/server';
import { z } from 'zod';

import { mockDb } from '@/lib/mock-db';
import { ScreeningAiParseError, reviewFullTextScreeningRecord } from '@/lib/screening/ai-review';
import { readActiveProfileSession } from '@/lib/session';

export const runtime = 'nodejs';

const requestSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(25),
});

export async function POST(request: Request) {
  const profile = await readActiveProfileSession();
  if (!profile) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((issue) => issue.message).join(', ') }, { status: 400 });
  }

  const apiKey = await mockDb.getProfileGeminiKey(profile.id);
  if (!apiKey) {
    return NextResponse.json({ error: 'Add your Gemini API key in Settings > API before running screening review.' }, { status: 400 });
  }

  const ids = Array.from(new Set(parsed.data.ids));
  await mockDb.markScreeningAiRunning(ids);

  const reviewed = [];
  const errors = [];

  for (const id of ids) {
    const record = await mockDb.getScreeningRecord(id);
    if (!record) {
      errors.push({ id, message: 'Screening record not found' });
      continue;
    }

    try {
      const result = await reviewFullTextScreeningRecord(record, apiKey);
      const updated = await mockDb.updateScreeningAiSuggestion(id, {
        status: 'completed',
        suggestedDecision: result.suggestedDecision,
        reason: result.reason,
        evidenceQuote: result.evidenceQuote,
        sourceLocation: result.sourceLocation,
        confidence: result.confidence,
        model: result.model,
        criteriaVersion: result.criteriaVersion,
        rawResponse: result.rawResponse,
      });
      reviewed.push(updated);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI review failed';
      const rawResponse = error instanceof ScreeningAiParseError
        ? {
          rawText: error.rawText.slice(0, 12000),
          truncated: error.rawText.length > 12000,
        }
        : undefined;
      const updated = await mockDb.updateScreeningAiSuggestion(id, {
        status: 'failed',
        error: message,
        rawResponse,
      });
      reviewed.push(updated);
      errors.push({ id, message });
    }
  }

  return NextResponse.json({ reviewed, errors });
}
