'use client';

import { ArrowRight, Export, FileText, Flag, FloppyDisk, MagnifyingGlass, Plus, Trash } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { useState } from 'react';

import { SourceFamilyTag, StatePill } from '@/components/status-pill';
import type { SourceFamily, WorkflowStatus } from '@/components/status-pill';
import {
  Alert,
  Button,
  ButtonLink,
  Card,
  Checkbox,
  Chip,
  Decide,
  EmptyState,
  Field,
  Input,
  Meter,
  MeterStack,
  Modal,
  numericCell,
  PageHead,
  PanelHead,
  Pill,
  RecordRow,
  Segmented,
  Select,
  Skeleton,
  SkeletonRows,
  StatTile,
  Table,
  TableWrap,
  Tabs,
  Tag,
  Td,
  Textarea,
  Th,
  Toast,
  Tr,
  t,
} from '@/components/ui';
import type { DecisionKind } from '@/components/ui';

/**
 * The living style guide. Every block below renders the real primitive, not a
 * copy, so drift shows up here first. Add a component to `src/components/ui/`
 * and it belongs on this page.
 */

const WORKFLOW_STATUSES = ['uploaded', 'processing', 'extracted', 'flagged', 'qa_review', 'archived'] as const;

const SOURCE_FAMILY_STATUSES = [
  'mental_health',
  'uefa',
  'fifa_data',
  'american_data',
  'aspetar_asprev',
  'systematic_review',
  'referee',
  'no_exposure',
  'retrospective_substudy_analysis',
  'uefa_master_extraction',
] as const satisfies readonly SourceFamily[];

const SAMPLE_ROWS: Array<{
  id: string;
  title: string;
  family: SourceFamily;
  state: WorkflowStatus;
  fields: number;
}> = [
  { id: 'S042', title: 'Injury surveillance in elite youth football', family: 'uefa', state: 'extracted', fields: 218 },
  { id: 'S043', title: 'Illness burden across a competitive season', family: 'fifa_data', state: 'processing', fields: 96 },
  { id: 'S044', title: 'Match exposure and hamstring strain rates', family: 'american_data', state: 'flagged', fields: 12 },
];

export default function DesignSystemPage() {
  const [tab, setTab] = useState('studyDetails');
  const [view, setView] = useState('queue');
  const [filters, setFilters] = useState<string[]>(['assigned']);
  const [decision, setDecision] = useState<DecisionKind | null>('include');
  const [modalOpen, setModalOpen] = useState(false);
  const [checked, setChecked] = useState(true);

  const toggleFilter = (key: string) =>
    setFilters((current) => (current.includes(key) ? current.filter((value) => value !== key) : [...current, key]));

  return (
    <div className="mx-auto w-full max-w-[1180px] pb-16">
      <PageHead
        eyebrow="Design system"
        title="FIFA GBI component library"
        description="Colour means decision state, never category and never decoration. FIFA navy is the only accent. Every component on this page is the one the app renders."
        actions={
          <>
            <Button variant="secondary" icon={<Export />}>
              Export
            </Button>
            <Button variant="primary" icon={<Plus />}>
              New record
            </Button>
          </>
        }
      />

      <Section title="Colour" description="One accent ramp, five state meanings, ten category tints. Nothing else.">
        <SwatchGrid
          label="Accent"
          swatches={[
            ['navy-600', 'var(--navy-600)'],
            ['navy-500', 'var(--navy-500)'],
            ['navy-300', 'var(--navy-300)'],
            ['navy-100', 'var(--navy-100)'],
            ['navy-50', 'var(--navy-50)'],
          ]}
        />
        <SwatchGrid
          label="State"
          swatches={[
            ['positive', 'var(--state-positive)'],
            ['negative', 'var(--state-negative)'],
            ['attention', 'var(--state-attention)'],
            ['neutral', 'var(--state-neutral)'],
            ['info', 'var(--state-info)'],
          ]}
        />
        <SwatchGrid
          label="Surface and ink"
          swatches={[
            ['page', 'var(--page)'],
            ['surface', 'var(--surface)'],
            ['surface-sunk', 'var(--surface-sunk)'],
            ['line', 'var(--line)'],
            ['ink', 'var(--ink)'],
          ]}
        />
      </Section>

      <Section title="Type" description="Five sizes, one label treatment, one mono treatment. Numbers are tabular everywhere.">
        <Card className="space-y-3">
          <p className={t.display}>Display 32 / 1,284</p>
          <p className={t.title}>Title 22</p>
          <p className={t.section}>Section 16</p>
          <p className={t.body}>Body 14. The queue holds papers awaiting extraction, sorted by assignment date.</p>
          <p className={t.caption}>Caption 12. Last synced 4 minutes ago.</p>
          <p className={t.label}>Label 11 uppercase</p>
          <p className={t.mono}>S042 · 0.00 · 1,284</p>
        </Card>
      </Section>

      <Section title="Buttons" description="Four variants, four sizes. Primary is the only navy fill on a page.">
        <Card className="space-y-4">
          <Row>
            <Button variant="primary" icon={<FloppyDisk />}>
              Save changes
            </Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger" icon={<Trash />}>
              Delete
            </Button>
            <Button variant="dangerSoft" aria-pressed icon={<Flag weight="fill" />}>
              Clear flag
            </Button>
          </Row>
          <Row>
            <ButtonLink href="/design-system" variant="primary" icon={<ArrowRight />}>
              A link styled as a button
            </ButtonLink>
            <span className={t.caption}>
              Use <code className="font-mono text-[11px]">ButtonLink</code> for navigation so it stays middle-clickable.
            </span>
          </Row>
          <Row>
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
            <Button size="icon" aria-label="Search" icon={<MagnifyingGlass />} />
          </Row>
          <Row>
            <Button variant="primary" loading>
              Saving
            </Button>
            <Button variant="secondary" loading>
              Loading
            </Button>
            <Button variant="primary" disabled>
              Disabled
            </Button>
          </Row>
        </Card>
      </Section>

      <Section
        title="State pills"
        description="A decision or a pipeline state. Same colour, same meaning, on every screen. Each carries an icon and a word."
      >
        <Card className="space-y-4">
          <Row>
            <Pill tone="positive" dot>
              Included
            </Pill>
            <Pill tone="negative" dot>
              Excluded
            </Pill>
            <Pill tone="attention" dot>
              Conflict
            </Pill>
            <Pill tone="neutral" dot>
              Pending
            </Pill>
            <Pill tone="info" dot>
              AI suggested
            </Pill>
            <Pill tone="solid">Promoted</Pill>
          </Row>
          <div>
            <p className={`${t.label} mb-2`}>Workflow states</p>
            <Row>
              {WORKFLOW_STATUSES.map((status) => (
                <StatePill key={status} status={status} />
              ))}
            </Row>
          </div>
        </Card>
      </Section>

      <Section
        title="Category tags"
        description="Source families are categories, not decisions. They use a separate low-chroma tint set and never take a state colour or an icon."
      >
        <Card className="space-y-4">
          <Row>
            {SOURCE_FAMILY_STATUSES.map((status) => (
              <SourceFamilyTag key={status} status={status} />
            ))}
          </Row>
          <Row>
            <Tag mono>S042</Tag>
            <Tag>Neutral tag</Tag>
          </Row>
        </Card>
      </Section>

      <Section
        title="Stat tiles"
        description="One implementation. The tone comes from what the metric means, not from where the tile sits in the row. The value stays ink."
      >
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile tone="total" label="Total papers" value="1,284" progress={100} meta="Across all sources" />
          <StatTile tone="positive" label="Extracted" value="612" progress={48} meta="48% of queue" />
          <StatTile tone="attention" label="In progress" value="203" progress={16} meta="16% of queue" />
          <StatTile tone="negative" label="Flagged" value="37" progress={3} meta="Needs a decision" />
        </div>
      </Section>

      <Section title="Cards, panels and records" description="The state rail on a record row is the shared signal across all three workflows.">
        <div className="grid gap-3.5 lg:grid-cols-2">
          <Card>
            <PanelHead
              title="Extraction summary"
              description="Ten tabs, dual-written population data"
              actions={<Button size="sm">Open</Button>}
            />
            <p className={t.body}>Panels use one radius and one elevation. There is no second card style.</p>
          </Card>
          <div className="space-y-2.5">
            <RecordRow tone="positive">
              <RecordBody title="Injury surveillance in elite youth football" meta="S042 · Extracted" />
              <StatePill status="extracted" />
            </RecordRow>
            <RecordRow tone="attention">
              <RecordBody title="Illness burden across a competitive season" meta="S043 · Processing" />
              <StatePill status="processing" />
            </RecordRow>
            <RecordRow tone="negative" selected>
              <RecordBody title="Match exposure and hamstring strain rates" meta="S044 · Flagged" />
              <StatePill status="flagged" />
            </RecordRow>
          </div>
        </div>
      </Section>

      <Section title="Forms" description="Every control has a real label. Focus is one ring, everywhere.">
        <Card className="grid gap-4 sm:grid-cols-2">
          <Field label="Study title" help="As printed on the paper.">
            {({ id, describedBy }) => (
              <Input id={id} aria-describedby={describedBy} placeholder="Injury surveillance in elite youth football" />
            )}
          </Field>
          <Field label="Source family">
            {({ id, describedBy }) => (
              <Select id={id} aria-describedby={describedBy} defaultValue="uefa">
                <option value="uefa">UEFA</option>
                <option value="fifa_data">FIFA Data</option>
                <option value="american_data">American Data</option>
              </Select>
            )}
          </Field>
          <Field label="Search papers" hideLabel>
            {({ id }) => <Input id={id} type="search" placeholder="Search by title, author or study ID" />}
          </Field>
          <Field label="Assigned reviewer" error="Pick a reviewer before saving.">
            {({ id, describedBy, invalid }) => (
              <Input id={id} aria-describedby={describedBy} aria-invalid={invalid} defaultValue="" />
            )}
          </Field>
          <Field label="Extraction note" className="sm:col-span-2">
            {({ id, describedBy }) => (
              <Textarea id={id} aria-describedby={describedBy} placeholder="What did you change and why?" />
            )}
          </Field>
          <div className="flex flex-wrap items-center gap-5 sm:col-span-2">
            <Checkbox label="Only show papers assigned to me" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
            <Checkbox label="Some rows selected" indeterminate checked={false} onChange={() => undefined} />
          </div>
        </Card>
      </Section>

      <Section title="Navigation controls" description="Tabs for many views, segmented for two or three, chips for filters.">
        <Card className="space-y-5">
          <Tabs
            label="Extraction tabs"
            value={tab}
            onChange={setTab}
            items={[
              { value: 'studyDetails', label: 'Study details' },
              { value: 'participantCharacteristics', label: 'Participants' },
              { value: 'definitions', label: 'Definitions' },
              { value: 'exposure', label: 'Exposure' },
              { value: 'injuryOutcome', label: 'Injury outcome', count: 12 },
            ]}
          />
          <Row>
            <Segmented
              label="View"
              value={view}
              onChange={setView}
              items={[
                { value: 'queue', label: 'Queue' },
                { value: 'table', label: 'Table' },
              ]}
            />
          </Row>
          <Row>
            {[
              { key: 'assigned', label: 'Assigned to me', count: 42 },
              { key: 'flagged', label: 'Flagged', count: 7 },
              { key: 'unassigned', label: 'Unassigned', count: 118 },
            ].map((filter) => (
              <Chip
                key={filter.key}
                active={filters.includes(filter.key)}
                count={filter.count}
                onClick={() => toggleFilter(filter.key)}
              >
                {filter.label}
              </Chip>
            ))}
          </Row>
        </Card>
      </Section>

      <Section title="Decision control" description="Include, exclude, flag. One implementation across screening and extraction QA.">
        <Card>
          <Decide
            label="Screening decision"
            value={decision}
            onChange={setDecision}
            options={[
              { kind: 'include', label: 'Include' },
              { kind: 'exclude', label: 'Exclude' },
              { kind: 'flag', label: 'Flag' },
            ]}
          />
        </Card>
      </Section>

      <Section title="Table" description="Wide content scrolls inside its own container, never the page body.">
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Study</Th>
                <Th>Title</Th>
                <Th>Source</Th>
                <Th>State</Th>
                <Th className={numericCell}>Fields</Th>
              </tr>
            </thead>
            <tbody>
              {SAMPLE_ROWS.map((row) => (
                <Tr key={row.id}>
                  <Td>
                    <Tag mono>{row.id}</Tag>
                  </Td>
                  <Td className="max-w-[320px] truncate">{row.title}</Td>
                  <Td>
                    <SourceFamilyTag status={row.family} />
                  </Td>
                  <Td>
                    <StatePill status={row.state} />
                  </Td>
                  <Td className={numericCell}>{row.fields}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      </Section>

      <Section title="Meters" description="A single-tone meter for one metric, a stacked meter for a whole pipeline.">
        <Card className="space-y-5">
          <div className="flex items-center gap-3">
            <Meter value={68} tone="info" label="Extraction progress" className="flex-1" />
            <span className={`${t.caption} ${t.num}`}>68%</span>
          </div>
          <MeterStack
            segments={[
              { key: 'extracted', value: 612, tone: 'positive', label: 'Extracted' },
              { key: 'processing', value: 203, tone: 'attention', label: 'Processing' },
              { key: 'flagged', value: 37, tone: 'negative', label: 'Flagged' },
              { key: 'uploaded', value: 432, tone: 'neutral', label: 'Uploaded' },
            ]}
          />
        </Card>
      </Section>

      <Section title="Alerts and toasts" description="Same five meanings, same icons.">
        <div className="grid gap-3.5 lg:grid-cols-2">
          <div className="space-y-2.5">
            <Alert tone="info" title="AI recommendation available">
              Gemini suggested 14 field values. Review them before they are applied.
            </Alert>
            <Alert tone="attention" title="Conflict">
              Two reviewers disagreed on this record. A resolver decision is required.
            </Alert>
            <Alert tone="negative" title="Save failed">
              The extraction could not be written. Nothing was changed.
            </Alert>
            <Alert tone="positive" title="Saved">
              218 fields written to S042.
            </Alert>
          </div>
          <div className="space-y-2.5">
            <Toast tone="positive" onDismiss={() => {}}>
              Extraction saved.
            </Toast>
            <Toast tone="negative" onDismiss={() => {}}>
              Could not reach the server.
            </Toast>
            <Toast tone="attention" onDismiss={() => {}}>
              You have unsaved changes on the Exposure tab.
            </Toast>
          </div>
        </div>
      </Section>

      <Section title="Empty, loading and modal" description="Eleven of fifteen routes had no loading state before this system.">
        <div className="grid gap-3.5 lg:grid-cols-2">
          <Card flush>
            <EmptyState
              icon={<FileText />}
              title="Nothing in your queue"
              description="Papers appear here once an admin assigns them to you."
              action={
                <Button variant="primary" icon={<ArrowRight />}>
                  Browse all papers
                </Button>
              }
            />
          </Card>
          <div className="space-y-3.5">
            <SkeletonRows rows={4} />
            <Row>
              <Skeleton className="h-9 w-28 rounded-ctl" />
              <Skeleton className="h-9 w-40 rounded-ctl" />
            </Row>
            <Button variant="secondary" onClick={() => setModalOpen(true)}>
              Open modal
            </Button>
          </div>
        </div>
      </Section>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Discard unsaved changes?"
        description="You have edits on the Exposure tab that have not been written to the database."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Keep editing
            </Button>
            <Button variant="danger" onClick={() => setModalOpen(false)}>
              Discard changes
            </Button>
          </>
        }
      >
        <p>
          This dialog uses the native <code className="font-mono text-xs">dialog</code> element, so it has a real focus trap,
          closes on Escape and makes the page behind it inert.
        </p>
      </Modal>
    </div>
  );
}

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <header className="mb-4">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
        <p className="mt-1 max-w-[68ch] text-[13px] text-ink-soft">{description}</p>
        <div className="mt-2.5 h-px bg-line" />
      </header>
      <div className="space-y-3.5">{children}</div>
    </section>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2.5">{children}</div>;
}

function RecordBody({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="truncate text-[13px] font-semibold text-ink">{title}</p>
      <p className={`${t.caption} mt-0.5`}>{meta}</p>
    </div>
  );
}

function SwatchGrid({ label, swatches }: { label: string; swatches: [string, string][] }) {
  return (
    <div>
      <p className={`${t.label} mb-2`}>{label}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {swatches.map(([name, value]) => (
          <div key={name} className="overflow-hidden rounded-ctl shadow-e0">
            <div className="h-[52px]" style={{ background: value }} />
            <div className="bg-surface px-2.5 py-1.5">
              <b className="block text-xs font-semibold text-ink">{name}</b>
              <span className="font-mono text-[10.5px] text-ink-soft">{value}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
