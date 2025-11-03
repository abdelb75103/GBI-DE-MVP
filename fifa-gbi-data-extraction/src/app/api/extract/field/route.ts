import { NextResponse } from 'next/server';
import { z } from 'zod';

import { extractionTabs } from '@/lib/extraction/schema';
import { mockDb } from '@/lib/mock-db';
import type { ExtractionFieldMetric, ExtractionFieldStatus } from '@/lib/types';

const tabEnum = z.enum(extractionTabs);
const statusOptions = ['reported', 'not_reported', 'uncertain'] as const;

const bodySchema = z.object({
  paperId: z.string().min(1),
  tab: tabEnum,
  fieldId: z.string().min(1),
  value: z.string().optional().nullable(),
  status: z.enum(statusOptions).optional(),
  confidence: z.number().min(0).max(100).optional().nullable(),
  sourceQuote: z.string().optional(),
  pageHint: z.string().optional(),
  metric: z.enum(['prevalence', 'incidence', 'burden', 'severityMeanDays', 'severityTotalDays']).optional(),
});

export const runtime = 'nodejs';

export async function PUT(request: Request) {
  let parsed: z.infer<typeof bodySchema>;
  try {
    const body = await request.json();
    parsed = bodySchema.parse(body);
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues.map((issue) => issue.message).join(', ') : 'Invalid body';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const paper = await mockDb.getPaper(parsed.paperId);
  if (!paper) {
    return NextResponse.json({ error: 'Paper not found' }, { status: 404 });
  }

  const normalizedStatus: ExtractionFieldStatus = parsed.status ?? (parsed.value ? 'reported' : 'not_reported');
  const normalizedValue =
    normalizedStatus === 'not_reported' ? null : parsed.value?.trim() ? parsed.value.trim() : null;
  const normalizedConfidence =
    typeof parsed.confidence === 'number' ? Math.min(Math.max(parsed.confidence / 100, 0), 1) : null;

  const extraction = await mockDb.updateExtractionField(parsed.paperId, parsed.tab, parsed.fieldId, {
    value: normalizedValue,
    status: normalizedStatus,
    confidence: normalizedConfidence,
    sourceQuote: parsed.sourceQuote?.trim() || undefined,
    pageHint: parsed.pageHint?.trim() || undefined,
    metric: (parsed.metric ?? undefined) as ExtractionFieldMetric | undefined,
  });

  const field = extraction.fields.find((item) => item.fieldId === parsed.fieldId);

  return NextResponse.json({
    paperId: extraction.paperId,
    tab: extraction.tab,
    field,
  });
}
