import { NextResponse } from 'next/server';

import { mockDb } from '@/lib/mock-db';
import { readActiveProfileSession } from '@/lib/session';

export const runtime = 'nodejs';

type FinalizePayload = {
  approveIds: string[];
  rejectIds?: string[];
};

const parseIds = (values?: string[]): string[] => {
  if (!Array.isArray(values)) {
    return [];
  }
  return Array.from(new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)));
};

export async function POST(request: Request) {
  const profile = await readActiveProfileSession();
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  let payload: FinalizePayload;
  try {
    payload = (await request.json()) as FinalizePayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const approveIds = parseIds(payload.approveIds);
  const rejectIds = parseIds(payload.rejectIds);

  if (approveIds.length === 0 && rejectIds.length === 0) {
    return NextResponse.json({ error: 'Provide at least one upload id' }, { status: 400 });
  }

  const allIds = Array.from(new Set([...approveIds, ...rejectIds]));
  const entries = await mockDb.getUploadQueueEntries(allIds);
  const entryMap = new Map(entries.map((entry) => [entry.id, entry]));

  const approved: Array<{ uploadId: string; paperId: string }> = [];
  const errors: Array<{ uploadId: string; message: string }> = [];

  for (const uploadId of approveIds) {
    const entry = entryMap.get(uploadId);
    if (!entry) {
      errors.push({ uploadId, message: 'Upload not found' });
      continue;
    }
    if (entry.status !== 'pending') {
      errors.push({ uploadId, message: 'Upload already processed' });
      continue;
    }

    try {
      const paper = await mockDb.createPaper({
        title: entry.title,
        extractedTitle: entry.extractedTitle ?? entry.title,
        leadAuthor: entry.leadAuthor ?? undefined,
        year: entry.year ?? undefined,
        journal: entry.journal ?? undefined,
        doi: entry.doi ?? undefined,
        normalizedDoi: entry.normalizedDoi ?? undefined,
        duplicateKeyV2: entry.duplicateKeyV2 ?? undefined,
        titleFingerprint: entry.titleFingerprint ?? undefined,
        metadata: entry.metadata ?? {},
        primaryFileSha256: entry.fileSha256 ?? undefined,
        originalFileName: entry.originalFileName ?? entry.fileName,
        uploadedBy: entry.createdBy ?? null,
      });

      const storedFile = await mockDb.attachFile({
        paperId: paper.id,
        name: entry.fileName,
        originalFileName: entry.originalFileName ?? entry.fileName,
        size: entry.size,
        mimeType: entry.mimeType,
        dataBase64: entry.dataBase64,
        storageBucket: entry.storageBucket,
        storageObjectPath: entry.storageObjectPath,
        fileSha256: entry.fileSha256 ?? undefined,
      });

      await mockDb.updatePaper(paper.id, {
        primaryFileId: storedFile.id,
        storageBucket: storedFile.storageBucket,
        storageObjectPath: storedFile.storageObjectPath,
      });

      await mockDb.markUploadQueueApproved(uploadId, profile.id, paper.id);
      approved.push({ uploadId, paperId: paper.id });
    } catch (error) {
      console.error(`[POST /api/admin/uploads/queue/finalize] Failed to approve ${uploadId}`, error);
      errors.push({ uploadId, message: error instanceof Error ? error.message : 'Failed to approve upload' });
    }
  }

  const pendingRejectIds = rejectIds.filter((uploadId) => {
    const entry = entryMap.get(uploadId);
    return entry && entry.status === 'pending';
  });
  if (pendingRejectIds.length > 0) {
    try {
      await mockDb.markUploadQueueRejected(pendingRejectIds, profile.id);
    } catch (error) {
      console.error('[POST /api/admin/uploads/queue/finalize] Failed to reject uploads', error);
      pendingRejectIds.forEach((uploadId) => {
        errors.push({ uploadId, message: 'Failed to reject upload' });
      });
    }
  }

  return NextResponse.json({
    approved,
    rejected: pendingRejectIds,
    errors,
  });
}
