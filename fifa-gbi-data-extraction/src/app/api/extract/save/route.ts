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
    return NextResponse.json({ error: 'Select a profile before saving changes.' }, { status: 401 });
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    const body = await request.json();
    parsed = bodySchema.parse(body);
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues.map((issue) => issue.message).join(', ') : 'Invalid body';
    return NextResponse.json({ error: message }, { status: 400 });
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
        continue;
      }

      await mockDb.saveExtractionFields(parsed.paperId, update.tab, fields, {
        updatedBy: profile.id,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[extract/save] failed', error);
    const message = error instanceof Error ? error.message : 'Failed to save changes';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
