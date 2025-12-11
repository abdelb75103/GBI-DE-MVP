import { NextResponse } from 'next/server';
import { z } from 'zod';

import { extractTab } from '@/lib/extraction/service';
import { aiExtractionTabs, extractionTabs } from '@/lib/extraction/schema';
import { mockDb } from '@/lib/mock-db';
import { readActiveProfileSession } from '@/lib/session';
import type { StoredFile } from '@/lib/types';

export const runtime = 'nodejs';

const requestSchema = z.object({
  paperId: z.string().min(1),
  tab: z.enum(extractionTabs),
  fields: z.array(z.string().min(1)).min(1),
});

export async function POST(request: Request) {
  let parsed;
  try {
    parsed = requestSchema.parse(await request.json());
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues.map((issue) => issue.message).join(', ') : 'Invalid body';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { paperId, tab, fields } = parsed;
  const profile = await readActiveProfileSession();
  if (!profile) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const apiKey = await mockDb.getProfileGeminiKey(profile.id);
  if (!apiKey) {
    return NextResponse.json({ error: 'Add your Gemini API key in Settings > API before running extraction.' }, { status: 400 });
  }
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
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'AI extraction failed. Please try again.';
    console.error('[extract] Extraction error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function loadFileBuffer(file: StoredFile): Promise<Buffer> {
  console.log(`[loadFileBuffer] Loading file ${file.id} (${file.name})`);
  
  // Priority 1: Load from Supabase Storage if available
  if (file.storageBucket && file.storageObjectPath) {
    console.log(`[loadFileBuffer] Loading from Supabase Storage: ${file.storageBucket}/${file.storageObjectPath}`);
    try {
      const { getAdminServiceClient } = await import('@/lib/supabase');
      const supabase = getAdminServiceClient();
      const { data, error } = await supabase.storage
        .from(file.storageBucket)
        .download(file.storageObjectPath);

      if (error) {
        console.error(`[loadFileBuffer] Failed to download from storage:`, error);
        throw new Error(`Failed to download file from storage: ${error.message}`);
      }

      if (!data) {
        throw new Error('Storage download returned no data');
      }

      const arrayBuffer = await data.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      console.error('[loadFileBuffer] Storage download failed, falling back to base64:', error);
      // Fall through to base64 if storage fails
    }
  }

  // Priority 2: Try loading from base64 data (legacy files)
  if (file.dataBase64) {
    console.log('[loadFileBuffer] Loading from dataBase64');
    try {
      return Buffer.from(file.dataBase64, 'base64');
    } catch (error) {
      console.error('[loadFileBuffer] Failed to decode dataBase64:', error);
      throw new Error(`Failed to decode file data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Priority 3: Try loading from publicUrl
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
