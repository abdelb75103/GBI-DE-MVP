import { ArrowLeft, LockSimple } from '@phosphor-icons/react/dist/ssr';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { FlagToggleButton } from '@/components/flag-toggle-button';
import { NoteComposer } from '@/components/note-composer';
import { NoteList } from '@/components/note-list';
import { StatusPill } from '@/components/status-pill';
import { StatusSelect } from '@/components/status-select';
import { extractionFieldDefinitions, extractionTabMeta, extractionTabs } from '@/lib/extraction/schema';
import { normalizeGlobalFieldValue } from '@/lib/extraction/normalize';
import { mockDb, PaperSessionConflictError } from '@/lib/mock-db';
import { formatDateTimeUTC } from '@/lib/format';
import { PaperWorkspaceShell } from '@/components/paper-workspace-shell';
import { readActiveProfileSession } from '@/lib/session';
import { WorkspaceSaveManager } from '@/components/workspace-save-manager';
import { WorkspaceSaveButton } from '@/components/workspace-save-button';
import { PaperActionButtons } from '@/components/paper-action-buttons';
import { MobileWorkspaceBlocker } from '@/components/mobile-workspace-blocker';
import { Alert, ButtonLink, Card, EmptyState, PageHead, PanelHead, Pill, Tag, t } from '@/components/ui';
import {
  getAnalysisPaperRoleLabel,
  parseAnalysisSourceTreatment,
} from '@/lib/analysis-source-policy';

export const dynamic = 'force-dynamic';

const firstSearchParam = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

const getDataExtractionBackHref = (returnTo?: string) =>
  returnTo === '/data-extraction' || returnTo?.startsWith('/data-extraction?')
    ? returnTo
    : '/data-extraction';

export default async function PaperWorkspace({
  params,
  searchParams,
}: {
  params: Promise<{ paperId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { paperId } = await params;
  const rawSearchParams = await searchParams;
  const conflict = firstSearchParam(rawSearchParams.conflict);
  const backHref = getDataExtractionBackHref(firstSearchParam(rawSearchParams.returnTo));

  const profile = await readActiveProfileSession();
  if (!profile) {
    redirect('/profiles/select?returnTo=' + encodeURIComponent(`/paper/${paperId}`));
  }

  const paper = await mockDb.getPaper(paperId);

  if (!paper) {
    notFound();
  }

  const isAdmin = profile.role === 'admin';
  const isAssignedToOther = Boolean(paper.assignedTo && paper.assignedTo !== profile.id);
  const isReadOnly = isAdmin && isAssignedToOther;

  // If redirected here due to a conflict, show error page immediately
  // This prevents infinite redirect loops and unnecessary re-checks
  // But allow admins to proceed even with conflict
  if (conflict === 'true' && !isAdmin) {
    const assigneeName = paper.assigneeName || 'another user';
    return (
      <div className="mx-auto max-w-xl">
        <Card>
          <EmptyState
            icon={<LockSimple weight="fill" />}
            title="Access restricted"
            description={
              <>
                This paper is currently assigned to <strong>{assigneeName}</strong>. To prevent conflicts and data
                loss, only one person can work on a paper at a time. Choose a different paper from data extraction or
                wait until this paper becomes available.
              </>
            }
            action={
              <ButtonLink variant="secondary" href={backHref} icon={<ArrowLeft />}>
                Back to data extraction
              </ButtonLink>
            }
          />
        </Card>
      </div>
    );
  }

  // Check if paper is assigned to someone else before attempting to start session
  // Admins can proceed in read-only mode
  if (isAssignedToOther && !isAdmin) {
    // Paper is already assigned to someone else
    const assigneeName = paper.assigneeName || 'another user';
    return (
      <div className="mx-auto max-w-xl">
        <Card>
          <EmptyState
            icon={<LockSimple weight="fill" />}
            title="Access restricted"
            description={
              <>
                This paper is currently assigned to <strong>{assigneeName}</strong>. To prevent conflicts and data
                loss, only one person can work on a paper at a time. Choose a different paper from data extraction or
                wait until this paper becomes available.
              </>
            }
            action={
              <ButtonLink variant="secondary" href={backHref} icon={<ArrowLeft />}>
                Back to data extraction
              </ButtonLink>
            }
          />
        </Card>
      </div>
    );
  }

  // Try to start the session (this will auto-assign the paper, or allow admin read-only access)
  try {
    await mockDb.startPaperSession(paperId, {
      profileId: profile.id,
      fullName: profile.fullName,
      isAdmin,
    });
  } catch (error) {
    if (error instanceof PaperSessionConflictError && !isAdmin) {
      // If we get a conflict, redirect with error message
      // On reload, the conflict parameter will be checked first to show error immediately
      const conflictParams = new URLSearchParams({ conflict: 'true' });
      if (backHref !== '/data-extraction') {
        conflictParams.set('returnTo', backHref);
      }
      redirect(`/paper/${paperId}?${conflictParams}`);
    }
    // For other errors, log and continue (the UI will handle it)
    console.error('[PaperWorkspace] Failed to start session:', error);
  }

  const file = paper.primaryFileId ? await mockDb.getFile(paper.primaryFileId) : undefined;
  const notes = await mockDb.listNotes(paper.id);
  const analysisSourceLinks = await mockDb.listAnalysisSourceLinks(
    paper.id,
    paper.assignedStudyId,
    paper.metadata,
  );
  const analysisSourceTreatment = parseAnalysisSourceTreatment(paper.metadata);
  const analysisPopulationExclusions = analysisSourceTreatment.populationExclusions;
  const analysisPopulationTreatments = analysisSourceTreatment.populationTreatments;
  const isTemporaryExtraction = paper.metadata?.temporaryExtractionPromotion === true;
  const eligibilityStatus = paper.flagReason
    ? 'Flagged'
    : isTemporaryExtraction
      ? 'Pending second reviewer'
      : 'Existing extraction record';
  const eligibilityTone = paper.flagReason ? 'negative' : isTemporaryExtraction ? 'attention' : 'info';
  const extractions = await mockDb.listExtractions(paper.id);
  const extractionMap = new Map(extractions.map((extraction) => [extraction.tab, extraction] as const));
  const tabPayload = extractionTabs.map((tab) => {
    const extraction = extractionMap.get(tab);
    return {
      tab,
      label: extractionTabMeta[tab].title,
      fields: extractionFieldDefinitions.filter((field) => field.tab === tab),
      results:
        extraction?.fields.map((field) => ({
          ...field,
          value: normalizeGlobalFieldValue(field.fieldId, field.value),
        })) ?? [],
      extractionModel: extraction?.model ?? 'human-input',
    };
  });
  // Priority 1: Use API endpoint for secure file serving (works for both storage and base64 files)
  // Priority 2: Use publicUrl if available (for external URLs)
  // Priority 3: Fallback to data URL for legacy files (temporary backward compatibility)
  const viewerUrl = file
    ? file.publicUrl && !file.publicUrl.startsWith('data:')
      ? file.publicUrl
      : `/api/files/${file.id}`
    : null;

  return (
    <MobileWorkspaceBlocker backHref={backHref}>
      <WorkspaceSaveManager paperId={paper.id} currentStatus={paper.status} readOnly={isReadOnly}>
        <div className="space-y-10">
          {isReadOnly && (
            <Alert tone="attention" title="Read-only mode">
              Viewing <strong>{(paper.assigneeName || 'another user')}&rsquo;s</strong> paper in read-only mode. You
              cannot edit or save changes.
            </Alert>
          )}
          <PageHead
            eyebrow="Paper workspace"
            title={
              <span className="inline-flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center rounded-tag border border-white/25 bg-white/10 px-2 py-0.5 font-mono text-[11px] font-semibold tracking-normal text-white">
                  {paper.assignedStudyId}
                </span>
                {paper.title}
                <StatusPill status={paper.status} />
              </span>
            }
            description={paper.leadAuthor}
            actions={
              <>
                <ButtonLink variant="secondary" href={backHref} icon={<ArrowLeft />}>
                  Back to data extraction
                </ButtonLink>
                {!isReadOnly && <WorkspaceSaveButton />}
              </>
            }
          />

          <div className="flex flex-col gap-8">
            <PaperWorkspaceShell
              paperId={paper.id}
              assignedStudyId={paper.assignedStudyId}
              tabs={tabPayload}
              viewerUrl={viewerUrl}
              readOnly={isReadOnly}
            />

            <div className="grid gap-6 xl:grid-cols-2">
              <Card>
                <PanelHead title="Workspace details" />
                <div className="space-y-5">
                  {!isReadOnly && (
                    <div className="rounded-ctl border border-line bg-surface-sunk p-4">
                      <StatusSelect paperId={paper.id} status={paper.status} />
                    </div>
                  )}
                  <div>
                    <p className={t.label}>File details</p>
                    {file ? (
                      <ul className={`mt-3 space-y-2 ${t.body}`}>
                        <li>
                          <span className="font-medium text-ink">Name:</span> {file.name}
                        </li>
                        <li>
                          <span className="font-medium text-ink">Size:</span> {formatBytes(file.size)}
                        </li>
                        <li>
                          <span className="font-medium text-ink">Uploaded:</span>{' '}
                          <time dateTime={file.uploadedAt}>{formatDateTimeUTC(file.uploadedAt)}</time>
                        </li>
                      </ul>
                    ) : (
                      <p className={`mt-3 ${t.caption}`}>File metadata will be available after upload.</p>
                    )}
                  </div>
                  <div>
                    <p className={t.label}>Analysis treatment</p>
                    <div className="mt-3 rounded-ctl border border-line bg-surface-sunk p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Tag>{getAnalysisPaperRoleLabel(paper.analysisRole)}</Tag>
                        <Pill tone={paper.includeInAnalysisExport ? 'positive' : 'attention'} dot>
                          {paper.includeInAnalysisExport
                            ? 'Included in analysis export'
                            : 'Source only, excluded from analysis export'}
                        </Pill>
                      </div>
                      {analysisSourceLinks.length > 0 ? (
                        <ul className={`mt-3 space-y-2 ${t.caption}`}>
                          {analysisSourceLinks.map((link) => {
                            const currentIsSource = link.sourcePaperId === paper.id;
                            const linkedPaperId = currentIsSource ? link.anchorPaperId : link.sourcePaperId;
                            const linkedStudyId = currentIsSource ? link.anchorStudyId : link.sourceStudyId;
                            const direction = currentIsSource ? 'Handled in' : 'Uses source';
                            return (
                              <li key={link.id}>
                                {direction}{' '}
                                <Link
                                  href={`/paper/${linkedPaperId}?returnTo=${encodeURIComponent(backHref)}`}
                                  className="font-semibold text-navy-600 underline underline-offset-2"
                                >
                                  {linkedStudyId}
                                </Link>
                                {link.tournamentKey ? ` for ${link.tournamentKey}` : ''}
                                {` (${link.relationship.replaceAll('_', ' ')})`}
                                {link.notes ? `: ${link.notes}` : ''}
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className={`mt-2 ${t.caption}`}>
                          No companion-source links are recorded for this paper.
                        </p>
                      )}
                      {analysisPopulationTreatments.length > 0 ? (
                        <div className="mt-3 border-t border-line pt-3">
                          <p className="font-semibold text-ink">Tournament row map</p>
                          <ul className={`mt-2 space-y-1 ${t.caption}`}>
                            {analysisPopulationTreatments.map((row) => (
                              <li key={`${row.populationPosition}-${row.tournamentKey}`}>
                                {row.expectedLabel}: {row.tournamentKey}
                                {row.includeInAnalysisExport ? '' : ' (source only)'}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {analysisPopulationExclusions.length > 0 ? (
                        <div className="mt-3 border-t border-line pt-3">
                          <p className="font-semibold text-ink">Rows excluded from analysis export</p>
                          <ul className={`mt-2 space-y-1 ${t.caption}`}>
                            {analysisPopulationExclusions.map((exclusion) => (
                              <li key={`${exclusion.populationPosition}-${exclusion.tournamentKey}`}>
                                {exclusion.expectedLabel}
                                {exclusion.tournamentKey ? `, ${exclusion.tournamentKey}` : ''}
                                {exclusion.anchorStudyId ? `, counted in ${exclusion.anchorStudyId}` : ''}
                                {`: ${exclusion.notes}`}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div>
                    <p className={t.label}>Eligibility check</p>
                    <Alert tone={eligibilityTone} title={eligibilityStatus} className="mt-3">
                      {paper.flagReason
                        ? paper.flagReason
                        : isTemporaryExtraction
                          ? 'AI and one human reviewer include. Confirm eligibility before extracting; flag criteria failures first.'
                          : 'No temporary screening bridge is attached to this record.'}
                    </Alert>
                  </div>
                  <div>
                    <p className={t.label}>Flags</p>
                    <p className={`mt-1 ${t.caption}`}>
                      Use flags to mark issues that need reviewer attention.
                    </p>
                    {!isReadOnly && (
                      <div className="mt-4 rounded-ctl border border-line bg-surface-sunk p-4">
                        <FlagToggleButton paperId={paper.id} isFlagged={Boolean(paper.flagReason)} />
                      </div>
                    )}
                    {isReadOnly && (
                      <div className="mt-4 rounded-ctl border border-line bg-surface-sunk p-4">
                        <p className={t.caption}>
                          {paper.flagReason ? `Flagged: ${paper.flagReason}` : 'Not flagged'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              <Card>
                <PanelHead
                  title="Notes"
                  description="Capture extraction decisions, definitions, or follow-up questions."
                />
                <div className="space-y-5">
                  <NoteComposer paperId={paper.id} />
                  <NoteList initialNotes={notes} paperId={paper.id} />
                </div>
              </Card>
            </div>

            <PaperActionButtons readOnly={isReadOnly} backHref={backHref} />
          </div>
        </div>
      </WorkspaceSaveManager>
    </MobileWorkspaceBlocker>
  );
}

function formatBytes(bytes: number) {
  if (!bytes) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}
