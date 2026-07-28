'use client';

import { ArrowRight, CaretDown } from '@phosphor-icons/react';
import { useState } from 'react';

import { Alert, Card, PageHead, PanelHead, Segmented, Table, TableWrap, Td, Th, Tr, t } from '@/components/ui';

const prerequisites = [
  'Read the Project Overview so you understand the goals, scope, and terminology before extracting.',
  'Review this instructions page end-to-end so the workflow is familiar when you open your first paper.',
  'Confirm API settings are configured: open any paper workspace, use the API Settings panel, and match the prompts from the first-login pop-up.',
];

const processSteps = [
  {
    title: 'Open the dashboard',
    details: [
      'Check the dashboard for overall progress, your workload, and the filtered paper queue.',
    ],
  },
  {
    title: 'Pick a paper',
    details: [
      'Go to Available Papers (or My Papers if already assigned).',
      'Click a paper to load its workspace and start extraction.',
    ],
  },
  {
    title: 'Assisted extraction (first four tabs)',
    details: [
      'Gemini can draft values, but every field must be manually reviewed and corrected before saving.',
      'For multiple populations, ages, or tournaments: enter one value per line. Each line becomes a separate export row.',
      'Keep related fields aligned by line number (if U19 Boys is line 3 in Population, use line 3 in every related input).',
    ],
  },
  {
    title: 'Manual entry: injury & illness',
    details: [
      'Complete each Injury and Illness tab manually; no AI suggestions are provided here.',
      'Leave fields blank when the paper does not report the data point.',
    ],
  },
  {
    title: 'Notes, flags, and status',
    details: [
      'Add Notes for context, uncertainties, or decisions you want reviewers to see.',
      'Use Flag when you cannot proceed and need help; include a short explanation.',
      'Set Status instead of extracting for excluded papers (UEFA ECIS, Aspetar ASPREV, NCAA, RIO, Mental Health) and save.',
    ],
  },
  {
    title: 'Save changes',
    details: [
      'Any update in the workspace must be saved to persist.',
      'Recommended: save after each tab or major edit to avoid data loss.',
    ],
  },
  {
    title: 'Download and archive',
    details: [
      'Export the CSV, sanity-check key columns, then copy it into the master spreadsheet and keep a local copy for audit trail.',
    ],
  },
];

const dos = [
  'Verify every AI-suggested value before saving.',
  'Enter one value per line for multi-group data and keep line order aligned across tabs.',
  'Leave fields blank when the paper does not report a data point.',
];

const donts = [
  'Do not extract excluded categories (UEFA ECIS, Aspetar ASPREV, NCAA, RIO, Mental Health); set the status instead.',
  'Do not rely on AI to make final decisions without human review.',
];

const checklist = [
  'AI-assisted tabs reviewed and corrected manually.',
  'Injury & Illness tabs completed where data exists; blanks left when not reported.',
  'Multi-value fields use one value per line with consistent row alignment.',
  'Status, Notes, and Flags updated appropriately; workspace saved.',
];

const severityBands = [
  { label: 'Minimal', days: '0 days' },
  { label: 'Mild', days: '1-3 days' },
  { label: 'Mild', days: '4-7 days' },
  { label: 'Moderate', days: '8-28 days' },
  { label: 'Severe', days: '29-90 days' },
  { label: 'Severe', days: '91-180 days' },
  { label: 'Very severe', days: '>180 days' },
];

type TabType = 'workflow' | 'codebook';

const TAB_HEAD: Record<TabType, { eyebrow: string; title: string; description: string }> = {
  workflow: {
    eyebrow: 'Extraction workflow',
    title: 'Extraction instructions',
    description:
      'The AI assistant offers draft values, but researchers remain accountable for every entry. Follow this human-in-the-loop flow to keep extractions accurate, auditable, and ready for reviewer sign-off.',
  },
  codebook: {
    eyebrow: 'Consensus definitions',
    title: 'Data extraction codebook',
    description:
      'Standardized definitions from consensus statements in football injury and illness surveillance. Use these as reference when extracting data to ensure consistency with international standards.',
  },
};

export default function ExtractionInstructionsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('workflow');
  const head = TAB_HEAD[activeTab];

  return (
    <div className="space-y-6">
      <PageHead eyebrow={head.eyebrow} title={head.title} description={head.description}>
        <Segmented
          label="Extraction instructions section"
          value={activeTab}
          onChange={setActiveTab}
          items={[
            { value: 'workflow', label: 'Extraction Workflow' },
            { value: 'codebook', label: 'Codebook' },
          ]}
        />
      </PageHead>

      {activeTab === 'workflow' && <WorkflowTab />}
      {activeTab === 'codebook' && <CodebookTab />}
    </div>
  );
}

function WorkflowTab() {
  return (
    <div className="space-y-6">
      <Card>
        <PanelHead
          title="Before you start"
          description="Complete these checks prior to opening a workspace so downstream work stays aligned to the request."
        />
        <ul className="space-y-2.5">
          {prerequisites.map((item) => (
            <BulletItem key={item}>{item}</BulletItem>
          ))}
        </ul>
      </Card>

      <Card>
        <PanelHead
          title="Workflow at a glance"
          description="This graphic shows the order of operations. Scroll horizontally if you are on a smaller screen."
        />
        <div className="overflow-x-auto pb-1">
          <div className="flex w-full min-w-[720px] gap-4">
            {processSteps.map((step, index) => (
              <div key={step.title} className="relative flex w-56 shrink-0 flex-col gap-2.5 rounded-card border border-line bg-surface-sunk p-4">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-navy-600 text-[13px] font-semibold text-white">
                  {index + 1}
                </span>
                <h3 className={t.label}>{step.title}</h3>
                <p className={t.caption}>{step.details[0]}</p>
                {index < processSteps.length - 1 ? (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -right-3.5 top-1/2 hidden h-7 w-7 -translate-y-1/2 items-center justify-center text-ink-soft md:flex"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <p className={`${t.label} mb-1.5`}>Deep dive</p>
        <PanelHead
          title="Step-by-step guidance"
          description="Walk each stage in detail once you enter the workspace. Treat this as your in-flight QA checklist."
        />
        <div className="space-y-4">
          {processSteps.map((step, index) => (
            <div key={step.title} className="rounded-card border border-line bg-surface-sunk p-4">
              <div className="flex items-start gap-3.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy-600 text-[13px] font-semibold text-white">
                  {index + 1}
                </span>
                <div className="flex-1 space-y-2">
                  <h3 className={t.section}>{step.title.charAt(0).toUpperCase() + step.title.slice(1)}</h3>
                  <ul className="space-y-2">
                    {step.details.map((detail) => (
                      <BulletItem key={detail}>{detail}</BulletItem>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <PanelHead title="Do and do not" />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <h3 className={t.section}>Do</h3>
            <Alert tone="positive">
              <ul className="space-y-2">
                {dos.map((item) => (
                  <BulletItem key={item}>{item}</BulletItem>
                ))}
              </ul>
            </Alert>
          </div>
          <div className="space-y-3">
            <h3 className={t.section}>Do not</h3>
            <Alert tone="negative">
              <ul className="space-y-2">
                {donts.map((item) => (
                  <BulletItem key={item}>{item}</BulletItem>
                ))}
              </ul>
            </Alert>
          </div>
        </div>
      </Card>

      <Card>
        <PanelHead
          title="Review checklist"
          description="Run this checklist before handing the paper to a reviewer or marking it complete."
        />
        <ul className="space-y-2.5">
          {checklist.map((item) => (
            <BulletItem key={item}>{item}</BulletItem>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function CodebookTab() {
  return (
    <div className="space-y-6">
      <Card>
        <PanelHead title="Injury &amp; illness definitions" />
        <p className={cnBody}>
          When completing the codebook fields, capture how the paper defines injury and illness, specifically whether
          it uses a medical-attention threshold, a time-loss threshold, or both. Use the summaries below to stay
          consistent.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <DefinitionPanel title="Injury definition">
            Physical complaint arising from football participation (training or match). Capture whether the paper only
            records injuries that remove the player (time-loss), those that trigger medical review, or both.
          </DefinitionPanel>
          <DefinitionPanel title="Illness definition">
            Non-traumatic health complaint (e.g., infections, environmental, chronic). Again, record whether the
            authors limited reporting to medical-attention cases, time-loss cases, or both.
          </DefinitionPanel>
          <DefinitionPanel title="Medical-attention vs time-loss">
            <ul className="space-y-1.5">
              <li>
                <strong className="text-ink">Medical-attention:</strong> Player is assessed/treated by qualified
                staff, regardless of time missed.
              </li>
              <li>
                <strong className="text-ink">Time-loss:</strong> Player cannot complete full training or match
                participation (current or future).
              </li>
              <li>
                <strong className="text-ink">Both:</strong> Study records a case if either threshold is met.
              </li>
            </ul>
          </DefinitionPanel>
        </div>
      </Card>

      <Card>
        <PanelHead
          title="Severity classification"
          description="Football-specific injury severity bands based on days until return to full training"
        />
        <TableWrap>
          <Table>
            <thead>
              <Tr>
                <Th>Severity</Th>
                <Th>Duration</Th>
              </Tr>
            </thead>
            <tbody>
              {severityBands.map((band, index) => (
                <Tr key={`${band.label}-${index}`}>
                  <Td>{band.label}</Td>
                  <Td>{band.days}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
        <p className={`${t.caption} mt-3 max-w-[70ch]`}>
          Note: Day of injury is counted as day zero. Return to football is the date when the player returns to
          full, unrestricted team training without modifications in duration or activities.
        </p>
      </Card>

      <Card>
        <PanelHead title="Recurrent injury definition" />
        <p className={cnBody}>
          Reference this wording when filling the codebook. We only capture whether the paper defines recurrence in
          this football consensus way, not the sub-categories.
        </p>
        <div className="mt-4 rounded-card border border-line bg-surface-sunk p-4">
          <p className={t.body}>
            <strong className="text-ink">Recurrent injury:</strong> the same injury type and anatomical site that
            occurs after the player has fully returned to unrestricted training or match play following a previous
            injury.
          </p>
        </div>
      </Card>

      <Card>
        <PanelHead
          title="Exposure types"
          description="Categories of player participation for exposure measurement"
        />
        <div className="space-y-3">
          <DefinitionPanel title="Match Exposure">
            Organized scheduled play between opposing teams from different clubs. Internal practice matches count as
            training exposure, not match exposure.
          </DefinitionPanel>
          <DefinitionPanel title="Training Exposure">
            Team-based or individual football activities under team staff guidance aimed at developing skills,
            tactics, or physical conditioning. Excludes rehabilitation sessions.
          </DefinitionPanel>
        </div>
      </Card>

      <Card>
        <PanelHead
          title="Mechanism categories"
          description="Classification of injury mode of onset and contact mechanisms"
        />
        <div className="space-y-5">
          <div className="space-y-3">
            <h3 className={t.label}>Mode of Onset</h3>
            <div className="grid gap-3 md:grid-cols-3">
              <MechanismItem title="Acute">Single, identifiable traumatic event</MechanismItem>
              <MechanismItem title="Repetitive">Gradual onset from repeated microtrauma</MechanismItem>
              <MechanismItem title="Mixed">Combination of acute and repetitive mechanisms</MechanismItem>
            </div>
          </div>
          <div className="space-y-3">
            <h3 className={t.label}>Contact classification</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <MechanismItem title="Contact">
                Impact with another player, the ball, equipment, or the environment that directly contributes to the
                injury. Includes tackles, collisions, and being struck.
              </MechanismItem>
              <MechanismItem title="Non-contact">
                No contact event triggered the injury. Typically linked to sprinting, cutting, or overuse actions. Use
                this category for every mechanism that lacks direct contact.
              </MechanismItem>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <PanelHead
          title="Field guide"
          description="Click any section to see what to enter and examples. Keep it simple: copy what you see in the paper."
        />
        <div className="space-y-3">
          <SimpleFieldGroup title="Study Details">
            <SimpleField
              name="Lead Author"
              example="Smith JA"
              paperExample="Smith JA, Jones B, et al."
              tip="Surname and initials"
            />
            <SimpleField name="Year of Publication" example="2023" paperExample="Published in 2023" />
            <SimpleField
              name="Study Design"
              example="prospective cohort"
              paperExample="This prospective cohort study followed players over 3 seasons"
              choices={['prospective cohort', 'retrospective cohort', 'cross-sectional', 'case series', 'case-control', 'other']}
              tip="Pick the match, not the full sentence"
            />
          </SimpleFieldGroup>

          <SimpleFieldGroup title="Participant Characteristics">
            <SimpleField
              name="FIFA Discipline"
              example="Futsal"
              paperExample="Data from the FIFA Futsal World Cup"
              choices={['Association football (11-a-side)', 'Futsal', 'Beach soccer', 'Para football']}
            />
            <SimpleField name="Country" example="England" paperExample="Study conducted in England" />
            <SimpleField
              name="Level of Play"
              example="professional"
              paperExample="Professional players from the Premier League"
              choices={['amateur', 'semi-professional', 'professional']}
              tip="Examples only - extract as reported in the paper"
            />
            <SimpleField
              name="Sex"
              example="male"
              paperExample="Study included 62 male players"
              choices={['male', 'female', 'mixed']}
            />
            <SimpleField
              name="Age Category"
              example="U19"
              paperExample="U19 and U21 age groups participated"
              tip="Examples: U19, U21, U16, Youth, Senior, etc."
            />
            <SimpleField
              name="Mean Age"
              example="20.5 ± 2.1"
              paperExample="Mean age was 20.5 ± 2.1 years"
              tip="Copy the numbers, skip 'years'"
            />
            <SimpleField
              name="Sample Size"
              example="62"
              paperExample="Study included 62 male players"
              tip="Just the number, no words"
            />
            <SimpleField
              name="Number of Teams"
              example="16"
              paperExample="16 teams participated in the tournament"
            />
            <SimpleField name="Study Period" example="3" paperExample="Data collected over 3 years" tip="In years" />
            <SimpleField
              name="Observation Duration"
              example="4 seasons"
              paperExample="Players were followed for 4 seasons"
            />
          </SimpleFieldGroup>

          <SimpleFieldGroup title="Definitions">
            <SimpleField
              name="Injury Definition"
              example="time-loss"
              paperExample="Injuries were defined as time-loss injuries preventing participation..."
              choices={['medical attention', 'time-loss', 'medical attention or time-loss']}
              tip="Pick the closest match, not the full sentence"
            />
            <SimpleField
              name="Illness Definition"
              example="medical attention"
              paperExample="Illnesses requiring medical attention were recorded"
              choices={['medical attention', 'time-loss', 'medical attention or time-loss']}
              tip="Pick the closest match"
            />
            <SimpleField
              name="Incidence Definition"
              example="per 1000 player-hours"
              paperExample="Injury incidence was calculated per 1000 player-hours"
            />
            <SimpleField
              name="Burden Definition"
              example="days lost per 1000 player-hours"
              paperExample="Burden was calculated as days lost per 1000 player-hours"
            />
            <SimpleField
              name="Severity Definition"
              example="Minimal (0 days), Mild (1-7 days), Moderate (8-28 days), Severe (>28 days)"
              paperExample="Severity was classified as minimal (0 days)..."
              tip="Copy how they categorize severity"
            />
            <SimpleField
              name="Recurrent Injury Definition"
              example="Same injury type and site after full return to participation"
              paperExample="A recurrent injury was defined as the same type and site after the player returned to full training/match availability"
              tip="Capture only the definition (e.g., same type & site post–return). Do not list early/late categories."
            />
            <SimpleField
              name="Mechanism Reporting"
              example="contact vs non-contact"
              paperExample="Mechanism was classified as either contact or non-contact"
            />
          </SimpleFieldGroup>

          <SimpleFieldGroup title="Exposure Data">
            <SimpleField name="Season Length" example="38" paperExample="The season lasted 38 weeks" tip="In weeks, just the number" />
            <SimpleField name="Number of Seasons" example="4" paperExample="Data from 4 consecutive seasons" />
            <SimpleField
              name="Exposure Unit"
              example="player-hours"
              paperExample="Total match exposure was 8,500 player-hours"
              choices={['hours', 'player-hours', 'athlete-exposures', 'match-exposures', 'sessions', 'other']}
            />
            <SimpleField
              name="Total Exposure"
              example="15000"
              paperExample="Total exposure was 15,000 player-hours"
              tip="Just the number, no unit"
            />
            <SimpleField
              name="Match Exposure"
              example="8500"
              paperExample="Total match exposure was 8,500 player-hours"
              tip="Just the number. Unit goes in field above."
            />
            <SimpleField
              name="Training Exposure"
              example="6500"
              paperExample="Training exposure was 6,500 player-hours"
              tip="Just the number, no 'hours'"
            />
          </SimpleFieldGroup>

          <SimpleFieldGroup title="Injury & Illness Data (Manual Tabs)">
            <SimpleField name="Injury Count" example="150" paperExample="A total of 150 injuries were recorded" tip="Just the number" />
            <SimpleField name="Injury Incidence" example="3.2" paperExample="Injury incidence was 3.2 per 1000 player-hours" />
            <SimpleField
              name="Match Injury Incidence"
              example="18.4"
              paperExample="Match incidence reached 18.4 injuries per 1000 match-hours"
            />
            <SimpleField
              name="Training Injury Incidence"
              example="2.4"
              paperExample="Training incidence was 2.4 per 1000 training-hours"
            />
            <SimpleField
              name="Time-loss Injury Incidence"
              example="2.1"
              paperExample="Time-loss incidence was 2.1 per 1000 player-hours"
              tip="ONLY fill this and the match/training time-loss boxes when the study uses a medical-attention definition but still reports time-loss incidence separately. If the study already uses a time-loss definition you can ignore these."
            />
            <SimpleField
              name="Time-loss Match Injury Incidence"
              example="9.7"
              paperExample="Time-loss match incidence was 9.7 per 1000 match-hours"
              tip="Use this only when a medical-attention study also provides the time-loss match rate."
            />
            <SimpleField
              name="Time-loss Training Injury Incidence"
              example="1.5"
              paperExample="Time-loss training incidence was 1.5 per 1000 training-hours"
              tip="Use this only when a medical-attention study also provides the time-loss training rate."
            />
            <SimpleField
              name="Recurrence Rate"
              example="15.2%"
              paperExample="Recurrence rate was 15.2%"
              tip="Keep the % symbol"
            />
          </SimpleFieldGroup>

          <div className="rounded-card border border-line bg-surface-sunk p-4">
            <h3 className={`${t.section} mb-3`}>When there are multiple groups</h3>
            <div className="space-y-3">
              <div className="rounded-ctl border border-line bg-surface p-3">
                <p className={`${t.caption} mb-1.5`}>Paper says:</p>
                <p className={t.body}>&ldquo;62 males with 150 injuries and 60 females with 120 injuries&rdquo;</p>
              </div>
              <div className="rounded-ctl border border-line bg-surface p-3">
                <p className={`${t.caption} mb-1.5`}>Enter each on a new line:</p>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    <span className={`${t.mono} w-32 text-ink-soft`}>Sample Size:</span>
                    <div className={`${t.mono} flex-1 rounded-tag bg-surface-sunk px-2 py-1 text-ink`}>
                      <div>62</div>
                      <div>60</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`${t.mono} w-32 text-ink-soft`}>Injury Count:</span>
                    <div className={`${t.mono} flex-1 rounded-tag bg-surface-sunk px-2 py-1 text-ink`}>
                      <div>150</div>
                      <div>120</div>
                    </div>
                  </div>
                </div>
              </div>
              <p className={`${t.caption} italic`}>Each line = one group. Keep same order across all fields.</p>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <PanelHead title="References" />
        <div className="space-y-3">
          <p className={cnBody}>
            <strong className="text-ink">Fuller CW et al.</strong> Consensus statement on injury definitions and data
            collection procedures in studies of football injuries.
            <em> Br J Sports Med.</em> 2006;40:193–201. doi:10.1136/bjsm.2005.025270.
          </p>
          <p className={cnBody}>
            <strong className="text-ink">Bahr R et al.</strong> International Olympic Committee consensus statement:
            methods for recording and reporting of epidemiological data on injury and illness in sport 2020.
            <em> Br J Sports Med.</em> 2020;54:372–389. doi:10.1136/bjsports-2019-101969.
          </p>
          <p className={cnBody}>
            <strong className="text-ink">Waldén M et al.</strong> Football-specific extension of the IOC consensus
            statement.
            <em> Br J Sports Med.</em> 2023;57:1341–1350. doi:10.1136/bjsports-2022-106405.
          </p>
        </div>
      </Card>
    </div>
  );
}

const cnBody = `${t.body} max-w-[70ch]`;

function BulletItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span aria-hidden className="mt-[7px] block h-1.5 w-1.5 shrink-0 rounded-full bg-ink-soft" />
      <span className={`${t.body} max-w-[70ch]`}>{children}</span>
    </li>
  );
}

function DefinitionPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5 rounded-card border border-line bg-surface-sunk p-4">
      <h3 className="text-[13px] font-semibold leading-[1.35] text-ink">{title}</h3>
      <div className={`${t.body} max-w-[70ch]`}>{children}</div>
    </div>
  );
}

function MechanismItem({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5 rounded-card border border-line bg-surface-sunk p-3.5">
      <h4 className="text-[13px] font-semibold leading-[1.35] text-ink">{title}</h4>
      <p className={`${t.body} max-w-[70ch]`}>{children}</p>
    </div>
  );
}

// Simple Field Group - Collapsible
function SimpleFieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      <h3 className={t.section}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          className="flex w-full items-center justify-between p-4 text-left transition-[background-color] duration-[160ms] ease-gbi hover:bg-surface-sunk"
        >
          <span>{title}</span>
          <CaretDown
            aria-hidden
            className={`h-4 w-4 shrink-0 text-ink-soft transition-transform duration-[160ms] ease-gbi ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>
      </h3>
      {isOpen ? <div className="space-y-3 border-t border-line bg-surface-sunk p-4">{children}</div> : null}
    </div>
  );
}

// Simple Field - Shows what to enter
type SimpleFieldProps = {
  name: string;
  example: string;
  paperExample?: string;
  choices?: string[];
  tip?: string;
};

function SimpleField({ name, example, paperExample, choices, tip }: SimpleFieldProps) {
  return (
    <div className={`rounded-ctl border border-line bg-surface p-3 ${t.body}`}>
      <div className="mb-2 font-medium text-ink">{name}</div>

      {paperExample ? (
        <div className="mb-2 rounded-tag bg-surface-sunk p-2 text-xs">
          <div className="mb-1 font-medium text-ink-muted">Paper says:</div>
          <div className="italic text-ink-body">&ldquo;{paperExample}&rdquo;</div>
        </div>
      ) : null}

      <div className="rounded-tag bg-surface-sunk p-2">
        <div className="mb-1 text-xs font-medium text-ink-muted">You enter:</div>
        <code className={`${t.mono} text-ink`}>{example}</code>
      </div>

      {choices ? (
        <div className="mt-2 border-t border-line pt-2">
          <div className="mb-1.5 text-xs text-ink-soft">Choose from:</div>
          <div className="flex flex-wrap gap-1">
            {choices.map((choice) => (
              <span key={choice} className="rounded-tag bg-surface-sunk px-2 py-0.5 text-xs text-ink-muted">
                {choice}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {tip ? <div className="mt-2 text-xs italic text-ink-soft">💡 {tip}</div> : null}
    </div>
  );
}
