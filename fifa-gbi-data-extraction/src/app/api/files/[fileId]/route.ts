import { NextRequest, NextResponse } from 'next/server';

import { Buffer } from 'node:buffer';

import { mockDb } from '@/lib/mock-db';
import { readActiveProfileSession } from '@/lib/session';
import { getAdminServiceClient } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    // Verify user is authenticated
    const profile = await readActiveProfileSession();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { fileId } = await params;
    const file = await mockDb.getFile(fileId);

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Verify user has access to the paper (by checking if paper exists and user can access it)
    const paper = await mockDb.getPaper(file.paperId);
    if (!paper) {
      return NextResponse.json({ error: 'Paper not found' }, { status: 404 });
    }

    // Any authenticated teammate can view/download PDFs.
    // The workspace already enforces edit permissions through sessions,
    // so gatekeeping here only leads to inconsistent previews.

    let fileBuffer: Buffer | null = null;

    // Priority 1: Load from Supabase Storage if available
    if (file.storageBucket && file.storageObjectPath) {
      const supabase = getAdminServiceClient();
      const { data, error } = await supabase.storage
        .from(file.storageBucket)
        .download(file.storageObjectPath);

      if (error) {
        console.error(`[GET /api/files/${fileId}] Failed to download from storage:`, error);
        // Fall through to base64 if storage fails
      } else if (data) {
        const arrayBuffer = await data.arrayBuffer();
        fileBuffer = Buffer.from(arrayBuffer);
      }
    }

    // Priority 2: Load from base64 (legacy files)
    if (!fileBuffer && file.dataBase64) {
      try {
        fileBuffer = Buffer.from(file.dataBase64, 'base64');
      } catch (error) {
        console.error(`[GET /api/files/${fileId}] Failed to decode base64:`, error);
        return NextResponse.json(
          { error: 'Failed to decode file data' },
          { status: 500 }
        );
      }
    }

    if (!fileBuffer) {
      return NextResponse.json(
        { error: 'File data not available' },
        { status: 404 }
      );
    }

    // Set appropriate headers
    const headers = new Headers();
    headers.set('Content-Type', file.mimeType || 'application/pdf');
    headers.set('Content-Length', fileBuffer.length.toString());
    headers.set(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(file.name)}"`
    );
    headers.set('Cache-Control', 'private, max-age=3600');

    return new NextResponse(fileBuffer as unknown as BodyInit, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('[GET /api/files/[fileId]] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
