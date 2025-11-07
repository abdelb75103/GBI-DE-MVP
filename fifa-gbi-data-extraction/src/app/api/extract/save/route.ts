import { NextResponse } from 'next/server';
import { z } from 'zod';

import { extractionFieldDefinitions, extractionTabs } from '@/lib/extraction/schema';
import { mockDb } from '@/lib/mock-db';
import { readActiveProfileSession } from '@/lib/session';

const tabEnum = z.enum(extractionTabs);

const bodySchema = z.object({
  paperId: z.string().min(1),
  updates: z
    .array(
      z.object({
        tab: tabEnum,
        fields: z.record(z.string(), z.string()),
      }),
    )
    .min(1),
});

const definitionLookup = new Map(extractionFieldDefinitions.map((definition) => [definition.id, definition]));

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const profile = await readActiveProfileSession();
  if (!profile) {
    return NextResponse.json({ error: 'Authentication required. Please select a profile before saving changes.' }, { status: 401 });
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    const body = await request.json();
    parsed = bodySchema.parse(body);
  } catch (error) {
    console.error('[extract/save] Validation error:', error);
    const message = error instanceof z.ZodError 
      ? `Validation failed: ${error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}` 
      : 'Invalid request body';
    return NextResponse.json({ error: message, details: error instanceof z.ZodError ? error.issues : undefined }, { status: 400 });
  }

  try {
    for (const update of parsed.updates) {
      const fields = Object.entries(update.fields).map(([fieldId, value]) => {
        const definition = definitionLookup.get(fieldId);
        return {
          fieldId,
          value,
          metric: definition?.metric ?? null,
        };
      });

      if (fields.length === 0) {
        console.warn(`[extract/save] No fields to save for tab ${update.tab} in paper ${parsed.paperId}`);
        continue;
      }

      await mockDb.saveExtractionFields(parsed.paperId, update.tab, fields, {
        updatedBy: profile.id,
      });
    }

    return NextResponse.json({ ok: true, savedUpdates: parsed.updates.length });
  } catch (error) {
    console.error(`[extract/save] Failed to save extraction fields for paper ${parsed.paperId}:`, error);
    const message = error instanceof Error 
      ? `Failed to save changes to paper ${parsed.paperId}: ${error.message}` 
      : 'An unknown error occurred while saving changes';
    return NextResponse.json({ 
      error: message, 
      paperId: parsed.paperId,
      context: 'extraction_save'
    }, { status: 500 });
  }
}
