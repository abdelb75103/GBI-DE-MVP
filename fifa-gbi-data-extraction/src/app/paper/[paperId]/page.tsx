import { notFound } from 'next/navigation';

import { PaperWorkspaceClient } from '@/components/paper-workspace-client';
import { extractionFieldDefinitions, extractionTabMeta, extractionTabs } from '@/lib/extraction/schema';
import { mockDb } from '@/lib/mock-db';

export const dynamic = 'force-dynamic';

export default async function PaperWorkspace({
  params,
}: {
  params: Promise<{ paperId: string }>;
}) {
  const { paperId } = await params;
  const paper = await mockDb.getPaper(paperId);

  if (!paper) {
    notFound();
  }

  const file = paper.primaryFileId ? await mockDb.getFile(paper.primaryFileId) : undefined;
  const notes = await mockDb.listNotes(paper.id);
  const extractions = await mockDb.listExtractions(paper.id);
  const extractionMap = new Map(extractions.map((extraction) => [extraction.tab, extraction] as const));
  const tabPayload = extractionTabs.map((tab) => ({
    tab,
    label: extractionTabMeta[tab].title,
    fields: extractionFieldDefinitions.filter((field) => field.tab === tab),
    results: extractionMap.get(tab)?.fields ?? [],
  }));
  const viewerUrl = file?.publicUrl
    ? file.publicUrl
    : file?.dataBase64
      ? `data:${file.mimeType};base64,${file.dataBase64}`
      : null;

  return (
    <PaperWorkspaceClient
      paper={paper}
      file={file ?? null}
      notes={notes}
      tabs={tabPayload}
      viewerUrl={viewerUrl}
    />
  );
}
