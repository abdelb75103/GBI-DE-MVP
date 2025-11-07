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

  const paper = await mockDb.getPaper(paperId);
  if (!paper) {
    return NextResponse.json({ error: 'Paper not found' }, { status: 404 });
  }

  const file = paper.primaryFileId ? await mockDb.getFile(paper.primaryFileId) : undefined;
  if (!file) {
    return NextResponse.json({ error: 'Paper does not have an attached file' }, { status: 400 });
  }

  const previousStatus = paper.status;
  await mockDb.updatePaper(paper.id, { status: 'processing' });

  try {
    const buffer = await loadFileBuffer(file);
    const pdfBase64 = file.dataBase64 ?? bufferToBase64(buffer);

    const response = await extractTab({
      tab,
      documentText: 'Use the attached PDF document to extract the requested fields.',
      paperTitle: paper.title,
      doi: paper.doi ?? undefined,
      apiKey,
      fieldIds: fields,
      pdfBase64,
    });

    const fieldMap = new Map(response.fields.map((field) => [field.fieldId, field]));

    for (const fieldId of fields) {
      const field = fieldMap.get(fieldId);
      await mockDb.updateExtractionField(paper.id, tab, fieldId, {
        value: field?.value ?? null,
        confidence: field?.confidence ?? null,
        sourceQuote: field?.sourceQuote,
        pageHint: field?.pageHint,
        metric: field?.metric,
        model: response.model,
      });
    }

    // Restore previous status - don't auto-set to 'extracted'
    await mockDb.updatePaper(paper.id, { status: previousStatus });

    return NextResponse.json({
      paperId: paper.id,
      tab: response.tab,
      model: response.model,
      fields: response.fields,
    });
  } catch (error) {
    await mockDb.updatePaper(paper.id, { status: previousStatus });
    const message = error instanceof Error ? error.message : 'Extraction failed';
    console.error('[extract] Extraction error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function loadFileBuffer(file: StoredFile): Promise<Buffer> {
  console.log(`[loadFileBuffer] Loading file ${file.id} (${file.name})`);
  
  // Try loading from base64 data
  if (file.dataBase64) {
    console.log('[loadFileBuffer] Loading from dataBase64');
    try {
      return Buffer.from(file.dataBase64, 'base64');
    } catch (error) {
      console.error('[loadFileBuffer] Failed to decode dataBase64:', error);
      throw new Error(`Failed to decode file data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Try loading from publicUrl
  if (file.publicUrl) {
    // Data URL format
    if (file.publicUrl.startsWith('data:')) {
      console.log('[loadFileBuffer] Loading from data URL');
      const base64Part = file.publicUrl.split(',')[1];
      if (!base64Part) {
        throw new Error('Invalid data URL: missing base64 data after comma');
      }
      try {
        return Buffer.from(base64Part, 'base64');
      } catch (error) {
        console.error('[loadFileBuffer] Failed to decode data URL:', error);
        throw new Error(`Failed to decode data URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Local file path
    if (file.publicUrl.startsWith('/')) {
      const absolutePath = path.join(process.cwd(), 'public', path.basename(file.publicUrl));
      console.log(`[loadFileBuffer] Loading from local file: ${absolutePath}`);
      try {
        return await fs.readFile(absolutePath);
      } catch (error) {
        console.error(`[loadFileBuffer] Failed to read local file ${absolutePath}:`, error);
        throw new Error(`Failed to read file from disk (${absolutePath}): ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // HTTP(S) URL
    if (file.publicUrl.startsWith('http://') || file.publicUrl.startsWith('https://')) {
      console.log(`[loadFileBuffer] Loading from HTTP URL: ${file.publicUrl}`);
      try {
        const response = await fetch(file.publicUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
      } catch (error) {
        console.error(`[loadFileBuffer] Failed to fetch from URL ${file.publicUrl}:`, error);
        throw new Error(`Failed to download file from ${file.publicUrl}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Unsupported URL format
    console.error(`[loadFileBuffer] Unsupported publicUrl format: ${file.publicUrl}`);
    throw new Error(`Unsupported file URL format: "${file.publicUrl}". Expected data:, /, http://, or https://`);
  }

  // No data source available
  console.error(`[loadFileBuffer] File ${file.id} has no data source (no dataBase64 or publicUrl)`);
  throw new Error(`File "${file.name}" has no accessible data source. Please re-upload the file.`);
}

function bufferToBase64(buffer: Buffer) {
  return buffer.toString('base64');
}
