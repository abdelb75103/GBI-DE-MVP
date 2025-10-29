import fs from 'node:fs/promises';
import path from 'node:path';

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { extractTab } from '@/lib/extraction/service';
import { aiExtractionTabs, extractionTabs } from '@/lib/extraction/schema';
import { mockDb } from '@/lib/mock-db';
import type { StoredFile } from '@/lib/types';

export const runtime = 'nodejs';

const requestSchema = z.object({
  paperId: z.string().min(1),
  tab: z.enum(extractionTabs),
  fields: z.array(z.string().min(1)).min(1),
  apiKey: z.string().min(1, 'API key is required'),
});

export async function POST(request: Request) {
  let parsed;
  try {
    parsed = requestSchema.parse(await request.json());
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues.map((issue) => issue.message).join(', ') : 'Invalid body';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { paperId, tab, fields, apiKey } = parsed;
  if (!aiExtractionTabs.has(tab)) {
    return NextResponse.json({ error: 'AI extraction is only available for study details, participant characteristics, definitions, and exposure.' }, { status: 400 });
  }

  const paper = mockDb.getPaper(paperId);
  if (!paper) {
    return NextResponse.json({ error: 'Paper not found' }, { status: 404 });
  }

  const file = paper.fileId ? mockDb.getFile(paper.fileId) : undefined;
  if (!file) {
    return NextResponse.json({ error: 'Paper does not have an attached file' }, { status: 400 });
  }

  const previousStatus = paper.status;
  mockDb.updatePaper(paper.id, { status: 'processing' });

  try {
    const buffer = await loadFileBuffer(file);
    const pdfBase64 = file.dataBase64 ?? bufferToBase64(buffer);

    const response = await extractTab({
      tab,
      documentText: 'Use the attached PDF document to extract the requested fields.',
      paperTitle: paper.title,
      doi: paper.doi,
      apiKey,
      fieldIds: fields,
      pdfBase64,
    });

    const fieldMap = new Map(response.fields.map((field) => [field.fieldId, field]));

    fields.forEach((fieldId) => {
      const field = fieldMap.get(fieldId);
      mockDb.updateExtractionField(paper.id, tab, fieldId, {
        value: field?.value ?? null,
        confidence: field?.confidence ?? null,
        sourceQuote: field?.sourceQuote,
        pageHint: field?.pageHint,
        metric: field?.metric,
        updatedBy: 'ai',
        model: response.model,
      });
    });

    mockDb.updatePaper(paper.id, { status: 'extracted' });

    return NextResponse.json({
      paperId: paper.id,
      tab: response.tab,
      model: response.model,
      fields: response.fields,
    });
  } catch (error) {
    mockDb.updatePaper(paper.id, { status: previousStatus });
    const message = error instanceof Error ? error.message : 'Extraction failed';
    console.error('[extract] Extraction error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function loadFileBuffer(file: StoredFile) {
  if (file.dataBase64) {
    return Buffer.from(file.dataBase64, 'base64');
  }

  if (file.publicPath) {
    const absolutePath = path.join(process.cwd(), 'public', path.basename(file.publicPath));
    return fs.readFile(absolutePath);
  }

  throw new Error('No file data available for extraction');
}

function bufferToBase64(buffer: Buffer) {
  return buffer.toString('base64');
}
