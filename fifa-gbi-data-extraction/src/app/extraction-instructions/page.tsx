'use client';

import { useState } from 'react';

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
      'Set Status instead of extracting for excluded papers (UEFA ECIS, NCAA, RIO, Mental Health) and save.',
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
  'Do not extract excluded categories (UEFA ECIS, NCAA, RIO, Mental Health); set the status instead.',
  'Do not rely on AI to make final decisions without human review.',
];

const checklist = [
  'AI-assisted tabs reviewed and corrected manually.',
  'Injury & Illness tabs completed where data exists; blanks left when not reported.',
  'Multi-value fields use one value per line with consistent row alignment.',
  'Status, Notes, and Flags updated appropriately; workspace saved.',
];

const stepCardGradients = [
  'from-indigo-500/12 via-slate-50 to-white',
  'from-emerald-500/12 via-slate-50 to-white',
  'from-amber-500/12 via-slate-50 to-white',
];

const stepAccentColors = [
  { border: 'bg-indigo-500/80', circle: 'bg-indigo-500', bullet: 'bg-indigo-500' },
  { border: 'bg-emerald-500/80', circle: 'bg-emerald-500', bullet: 'bg-emerald-500' },
  { border: 'bg-amber-500/80', circle: 'bg-amber-500', bullet: 'bg-amber-500' },
  { border: 'bg-violet-500/80', circle: 'bg-violet-500', bullet: 'bg-violet-500' },
  { border: 'bg-teal-500/80', circle: 'bg-teal-500', bullet: 'bg-teal-500' },
  { border: 'bg-rose-500/80', circle: 'bg-rose-500', bullet: 'bg-rose-500' },
  { border: 'bg-cyan-500/80', circle: 'bg-cyan-500', bullet: 'bg-cyan-500' },
];

type TabType = 'workflow' | 'codebook';

export default function ExtractionInstructionsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('workflow');

  return (
    <div className="space-y-8">
      {/* Tab Navigation */}
      <div className="flex items-center justify-center border-b border-slate-200/70">
        <nav className="inline-flex gap-1 rounded-full bg-slate-100/60 p-1 shadow-inner">
          <button
            type="button"
            onClick={() => setActiveTab('workflow')}
            className={`rounded-full px-6 py-2.5 text-sm font-semibold transition ${
              activeTab === 'workflow'
                ? 'bg-white text-slate-900 shadow'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Extraction Workflow
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('codebook')}
            className={`rounded-full px-6 py-2.5 text-sm font-semibold transition ${
              activeTab === 'codebook'
                ? 'bg-white text-slate-900 shadow'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Codebook
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'workflow' && <WorkflowTab />}
      {activeTab === 'codebook' && <CodebookTab />}
    </div>
  );
}

function WorkflowTab() {
  return (
    <div className="space-y-12">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-gradient-to-br from-white via-indigo-50/30 to-emerald-50/30 p-10 shadow-xl ring-1 ring-slate-200/60 backdrop-blur">
        <div className="absolute -left-12 -top-12 h-56 w-56 rounded-full bg-indigo-400/25 blur-3xl" aria-hidden />
        <div className="absolute -bottom-16 -right-12 h-64 w-64 rounded-full bg-emerald-300/30 blur-3xl" aria-hidden />
        <div className="absolute top-1/2 right-1/4 h-40 w-40 rounded-full bg-amber-200/20 blur-2xl" aria-hidden />
        <div className="relative z-10 space-y-8">
          <div className="space-y-4">
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-gradient-to-r from-emerald-100 to-indigo-100 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700 shadow-sm ring-1 ring-emerald-200/50">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden />
              Extraction workflow
            </span>
            <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">Extraction instructions</h1>
            <p className="max-w-2xl text-base leading-relaxed text-slate-600">
              The AI assistant offers draft values, but researchers remain accountable for every entry. Follow this
              human-in-the-loop flow to keep extractions accurate, auditable, and ready for reviewer sign-off.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 rounded-3xl border border-indigo-200/50 bg-gradient-to-br from-indigo-50/50 via-white to-white p-8 shadow-lg ring-1 ring-indigo-200/30 backdrop-blur lg:grid-cols-5">
        <div className="lg:col-span-2 lg:border-r lg:border-indigo-200/40 lg:pr-8">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-8 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-indigo-300" />
            <h2 className="text-2xl font-semibold text-slate-900">Before you start</h2>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Complete these checks prior to opening a workspace so downstream work stays aligned to the request.
          </p>
        </div>
        <div className="lg:col-span-3">
          <ul className="space-y-3.5 text-sm leading-relaxed text-slate-700">
            {prerequisites.map((item, index) => (
              <li key={item} className="flex gap-3 group">
                <span aria-hidden className="mt-1 block h-2 w-2 flex-shrink-0 rounded-full bg-indigo-500 shadow-sm ring-2 ring-indigo-100 group-hover:scale-110 transition-transform" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="space-y-8 rounded-3xl border border-slate-200/70 bg-gradient-to-br from-slate-50/50 via-white to-indigo-50/30 p-8 shadow-lg ring-1 ring-slate-200/60 backdrop-blur">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-1 rounded-full bg-gradient-to-b from-indigo-500 via-emerald-500 to-amber-500" />
            <h2 className="text-2xl font-semibold text-slate-900">Workflow at a glance</h2>
          </div>
          <p className="text-sm leading-relaxed text-slate-600">
            This graphic shows the order of operations. Scroll horizontally if you are on a smaller screen.
          </p>
        </div>
        <div className="overflow-x-auto pb-4">
          <div className="relative flex w-full min-w-[720px] gap-6">
            {processSteps.map((step, index) => {
              const colors = stepAccentColors[index % stepAccentColors.length];
              const bgGradient = index % 3 === 0 ? 'from-indigo-50/80 to-white' : index % 3 === 1 ? 'from-emerald-50/80 to-white' : 'from-amber-50/80 to-white';
              const borderColor = index % 3 === 0 ? 'border-indigo-200/70' : index % 3 === 1 ? 'border-emerald-200/70' : 'border-amber-200/70';
              return (
                <div key={step.title} className={`relative flex w-60 flex-shrink-0 flex-col gap-3 rounded-2xl border ${borderColor} bg-gradient-to-b ${bgGradient} p-5 shadow-md hover:shadow-lg transition-all duration-200`}>
                  <div className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${colors.circle} text-base font-semibold text-white shadow-md ring-4 ring-white/70`}>
                    {index + 1}
                  </div>
                  <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-800">{step.title}</h3>
                  <p className="text-xs leading-relaxed text-slate-600">
                    {step.details[0]}
                  </p>
                  {index < processSteps.length - 1 ? (
                    <span className="pointer-events-none absolute -right-4 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center md:flex" aria-hidden>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={`h-6 w-6 ${index % 3 === 0 ? 'text-indigo-400' : index % 3 === 1 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        <path d="M5 12h14m0 0-5-5m5 5-5 5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="space-y-6 rounded-3xl border border-slate-200/70 bg-gradient-to-br from-slate-900/5 via-white to-indigo-50/60 p-10 shadow-lg ring-1 ring-slate-200/60 backdrop-blur">
        <div className="space-y-3">
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-gradient-to-r from-indigo-100 to-violet-100 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-indigo-700 shadow-sm ring-1 ring-indigo-200/50">
            <span className="flex h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" aria-hidden />
            Deep dive
          </span>
          <div className="flex items-center gap-2">
            <div className="h-8 w-1 rounded-full bg-gradient-to-b from-indigo-500 via-violet-500 to-purple-500" />
            <h2 className="text-2xl font-semibold text-slate-900">Step-by-step guidance</h2>
          </div>
          <p className="text-sm leading-relaxed text-slate-600">
            Walk each stage in detail once you enter the workspace. Treat this as your in-flight QA checklist.
          </p>
        </div>
        <div className="space-y-6">
          {processSteps.map((step, index) => {
            const gradient = stepCardGradients[index % stepCardGradients.length];
            const colors = stepAccentColors[index % stepAccentColors.length];
            return (
              <div
                key={step.title}
                className={`relative overflow-hidden rounded-3xl border border-slate-200/70 bg-gradient-to-br ${gradient} p-6 shadow-md transition-all duration-200 hover:shadow-lg`}
              >
                <div className={`absolute inset-y-0 left-0 w-1 rounded-l-3xl ${colors.border}`} aria-hidden />
                <div className="flex items-start gap-4">
                  <span className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full ${colors.circle} text-base font-semibold text-white shadow-md ring-4 ring-white/50`}>
                    {index + 1}
                  </span>
                  <div className="space-y-3 flex-1">
                    <h3 className="text-lg font-semibold text-slate-900">
                      {step.title.charAt(0).toUpperCase() + step.title.slice(1)}
                    </h3>
                    <ul className="space-y-2.5 text-sm leading-relaxed text-slate-700">
                      {step.details.map((detail) => (
                        <li key={detail} className="flex gap-3">
                          <span aria-hidden className={`mt-1.5 block h-1.5 w-1.5 flex-shrink-0 rounded-full ${colors.bullet}`} />
                          <span>{detail}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 rounded-3xl border border-slate-200/70 bg-gradient-to-br from-white via-slate-50/30 to-white p-8 shadow-lg ring-1 ring-slate-200/60 backdrop-blur lg:grid-cols-2">
        <div className="space-y-5 rounded-2xl border border-emerald-300/60 bg-gradient-to-br from-emerald-50 to-white p-7 shadow-md hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 shadow-md ring-4 ring-emerald-100">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-emerald-900">Do</h2>
          </div>
          <ul className="space-y-3 text-sm leading-relaxed text-emerald-950">
            {dos.map((item) => (
              <li key={item} className="flex gap-3 group">
                <span aria-hidden className="mt-1 block h-2 w-2 flex-shrink-0 rounded-full bg-emerald-500 shadow-sm ring-2 ring-emerald-100 group-hover:scale-110 transition-transform" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-5 rounded-2xl border border-rose-300/60 bg-gradient-to-br from-rose-50 to-white p-7 shadow-md hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-500 shadow-md ring-4 ring-rose-100">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-rose-900">Do not</h2>
          </div>
          <ul className="space-y-3 text-sm leading-relaxed text-rose-950">
            {donts.map((item) => (
              <li key={item} className="flex gap-3 group">
                <span aria-hidden className="mt-1 block h-2 w-2 flex-shrink-0 rounded-full bg-rose-500 shadow-sm ring-2 ring-rose-100 group-hover:scale-110 transition-transform" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="grid gap-6 rounded-3xl border border-emerald-200/50 bg-gradient-to-br from-emerald-50/50 via-white to-white p-8 shadow-lg ring-1 ring-emerald-200/30 backdrop-blur lg:grid-cols-5">
        <div className="lg:col-span-2 lg:border-r lg:border-emerald-200/40 lg:pr-8">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-8 w-1 rounded-full bg-gradient-to-b from-emerald-500 to-emerald-300" />
            <h2 className="text-2xl font-semibold text-slate-900">Review checklist</h2>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Run this checklist before handing the paper to a reviewer or marking it complete.
          </p>
        </div>
        <div className="lg:col-span-3">
          <ul className="space-y-3.5 text-sm leading-relaxed text-slate-700">
            {checklist.map((item) => (
              <li key={item} className="flex gap-3 group">
                <span aria-hidden className="mt-1 block h-2 w-2 flex-shrink-0 rounded-full bg-emerald-500 shadow-sm ring-2 ring-emerald-100 group-hover:scale-110 transition-transform" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

function CodebookTab() {
  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-gradient-to-br from-white via-violet-50/30 to-indigo-50/30 p-10 shadow-xl ring-1 ring-slate-200/60 backdrop-blur">
        <div className="absolute -left-12 -top-12 h-56 w-56 rounded-full bg-violet-400/25 blur-3xl" aria-hidden />
        <div className="absolute -bottom-16 -right-12 h-64 w-64 rounded-full bg-indigo-300/30 blur-3xl" aria-hidden />
        <div className="relative z-10 space-y-4">
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-gradient-to-r from-violet-100 to-indigo-100 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-violet-700 shadow-sm ring-1 ring-violet-200/50">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-500 animate-pulse" aria-hidden />
            Consensus definitions
          </span>
          <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">Data extraction codebook</h1>
          <p className="max-w-3xl text-base leading-relaxed text-slate-600">
            Standardized definitions from consensus statements in football injury and illness surveillance. 
            Use these as reference when extracting data to ensure consistency with international standards.
          </p>
        </div>
      </section>

      {/* Injury & Illness Definitions */}
      <section className="space-y-6 rounded-3xl border border-slate-200/70 bg-gradient-to-br from-slate-50/50 via-white to-white p-8 shadow-lg ring-1 ring-slate-200/60">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-indigo-300" />
            <h2 className="text-2xl font-semibold text-slate-900">Injury &amp; illness definitions</h2>
          </div>
          <p className="text-sm text-slate-600">
            When completing the codebook fields, capture how the paper defines injury and illness, specifically whether
            it uses a medical-attention threshold, a time-loss threshold, or both. Use the summaries below to stay
            consistent.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          <div className="space-y-2 rounded-2xl border border-emerald-200/50 bg-gradient-to-br from-emerald-50/50 to-white p-5">
            <h3 className="font-semibold text-emerald-900">Injury definition</h3>
            <p className="text-sm leading-relaxed text-slate-700">
              Physical complaint arising from football participation (training or match). Capture whether the paper only
              records injuries that remove the player (time-loss), those that trigger medical review, or both.
            </p>
          </div>
          <div className="space-y-2 rounded-2xl border border-amber-200/50 bg-gradient-to-br from-amber-50/50 to-white p-5">
            <h3 className="font-semibold text-amber-900">Illness definition</h3>
            <p className="text-sm leading-relaxed text-slate-700">
              Non-traumatic health complaint (e.g., infections, environmental, chronic). Again, record whether the
              authors limited reporting to medical-attention cases, time-loss cases, or both.
            </p>
          </div>
          <div className="space-y-3 rounded-2xl border border-rose-200/50 bg-gradient-to-br from-rose-50/50 to-white p-5">
            <h3 className="font-semibold text-rose-900">Medical-attention vs time-loss</h3>
            <ul className="space-y-1 text-sm leading-relaxed text-slate-700">
              <li><strong>Medical-attention:</strong> Player is assessed/treated by qualified staff, regardless of time missed.</li>
              <li><strong>Time-loss:</strong> Player cannot complete full training or match participation (current or future).</li>
              <li><strong>Both:</strong> Study records a case if either threshold is met.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Severity Classification */}
      <section className="space-y-6 rounded-3xl border border-slate-200/70 bg-gradient-to-br from-slate-50/50 via-white to-violet-50/30 p-8 shadow-lg ring-1 ring-slate-200/60">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-1 rounded-full bg-gradient-to-b from-violet-500 to-violet-300" />
            <h2 className="text-2xl font-semibold text-slate-900">Severity classification</h2>
          </div>
          <p className="text-sm text-slate-600">Football-specific injury severity bands based on days until return to full training</p>
        </div>
        <div className="space-y-3">
          <div className="rounded-2xl border border-violet-200/50 bg-gradient-to-r from-violet-50/50 to-white p-5">
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1 rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Minimal</div>
                  <div className="text-lg font-bold text-slate-900">0 days</div>
                </div>
                <div className="space-y-1 rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mild</div>
                  <div className="text-lg font-bold text-slate-900">1-3 days</div>
                </div>
                <div className="space-y-1 rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mild</div>
                  <div className="text-lg font-bold text-slate-900">4-7 days</div>
                </div>
                <div className="space-y-1 rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Moderate</div>
                  <div className="text-lg font-bold text-slate-900">8-28 days</div>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1 rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Severe</div>
                  <div className="text-lg font-bold text-slate-900">29-90 days</div>
                </div>
                <div className="space-y-1 rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Severe</div>
                  <div className="text-lg font-bold text-slate-900">91-180 days</div>
                </div>
                <div className="space-y-1 rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Very severe</div>
                  <div className="text-lg font-bold text-slate-900">&gt;180 days</div>
                </div>
              </div>
              <p className="text-xs italic text-slate-600">
                Note: Day of injury is counted as day zero. Return to football is the date when the player returns 
                to full, unrestricted team training without modifications in duration or activities.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Recurrent Injury Definition */}
      <section className="space-y-4 rounded-3xl border border-slate-200/70 bg-gradient-to-br from-slate-50/40 via-white to-emerald-50/40 p-8 shadow-lg ring-1 ring-slate-200/60">
        <div className="flex items-center gap-2">
          <div className="h-8 w-1 rounded-full bg-gradient-to-b from-emerald-500 to-emerald-300" />
          <h2 className="text-2xl font-semibold text-slate-900">Recurrent injury definition</h2>
        </div>
        <p className="text-sm leading-relaxed text-slate-600">
          Reference this wording when filling the codebook. We only capture whether the paper defines recurrence in this
          football consensus way, not the sub-categories.
        </p>
        <div className="rounded-3xl border border-emerald-200/60 bg-white/90 p-6 shadow-inner">
          <p className="text-base leading-relaxed text-slate-800">
            <strong>Recurrent injury:</strong> the same injury type and anatomical site that occurs after the player has
            fully returned to unrestricted training or match play following a previous injury.
          </p>
        </div>
      </section>

      {/* Exposure Types */}
      <section className="space-y-6 rounded-3xl border border-slate-200/70 bg-gradient-to-br from-slate-50/50 via-white to-indigo-50/30 p-8 shadow-lg ring-1 ring-slate-200/60">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-indigo-300" />
            <h2 className="text-2xl font-semibold text-slate-900">Exposure types</h2>
          </div>
          <p className="text-sm text-slate-600">Categories of player participation for exposure measurement</p>
        </div>
        <div className="space-y-4">
          <div className="space-y-2 rounded-2xl border border-indigo-200/50 bg-gradient-to-br from-indigo-50/50 to-white p-5">
            <h3 className="font-semibold text-indigo-900">Match Exposure</h3>
            <p className="text-sm leading-relaxed text-slate-700">
              Organized scheduled play between opposing teams from different clubs. Internal practice matches 
              count as training exposure, not match exposure.
            </p>
          </div>
          <div className="space-y-2 rounded-2xl border border-teal-200/50 bg-gradient-to-br from-teal-50/50 to-white p-5">
            <h3 className="font-semibold text-teal-900">Training Exposure</h3>
            <p className="text-sm leading-relaxed text-slate-700">
              Team-based or individual football activities under team staff guidance aimed at developing skills, 
              tactics, or physical conditioning. Excludes rehabilitation sessions.
            </p>
          </div>
        </div>
      </section>

      {/* Mechanism Categories */}
      <section className="space-y-6 rounded-3xl border border-slate-200/70 bg-gradient-to-br from-slate-50/50 via-white to-amber-50/30 p-8 shadow-lg ring-1 ring-slate-200/60">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-1 rounded-full bg-gradient-to-b from-amber-500 to-amber-300" />
            <h2 className="text-2xl font-semibold text-slate-900">Mechanism categories</h2>
          </div>
          <p className="text-sm text-slate-600">Classification of injury mode of onset and contact mechanisms</p>
        </div>
        <div className="space-y-5">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Mode of Onset</h3>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-2 rounded-2xl border border-amber-200/50 bg-gradient-to-br from-amber-50/50 to-white p-4">
                <h4 className="font-semibold text-amber-900">Acute</h4>
                <p className="text-sm text-slate-700">Single, identifiable traumatic event</p>
              </div>
              <div className="space-y-2 rounded-2xl border border-orange-200/50 bg-gradient-to-br from-orange-50/50 to-white p-4">
                <h4 className="font-semibold text-orange-900">Repetitive</h4>
                <p className="text-sm text-slate-700">Gradual onset from repeated microtrauma</p>
              </div>
              <div className="space-y-2 rounded-2xl border border-rose-200/50 bg-gradient-to-br from-rose-50/50 to-white p-4">
                <h4 className="font-semibold text-rose-900">Mixed</h4>
                <p className="text-sm text-slate-700">Combination of acute and repetitive mechanisms</p>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Contact classification</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 rounded-2xl border border-slate-200 bg-white/90 p-4">
                <h4 className="text-base font-semibold text-slate-900">Contact</h4>
                <p className="text-sm text-slate-700">
                  Impact with another player, the ball, equipment, or the environment that directly contributes to the
                  injury. Includes tackles, collisions, and being struck.
                </p>
              </div>
              <div className="space-y-2 rounded-2xl border border-slate-200 bg-white/90 p-4">
                <h4 className="text-base font-semibold text-slate-900">Non-contact</h4>
                <p className="text-sm text-slate-700">
                  No contact event triggered the injury. Typically linked to sprinting, cutting, or overuse actions.
                  Use this category for every mechanism that lacks direct contact.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Field Guide - Simplified */}
      <section className="space-y-4 rounded-3xl border border-slate-200/70 bg-gradient-to-br from-slate-50/50 via-white to-cyan-50/30 p-8 shadow-lg ring-1 ring-slate-200/60">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-8 w-1 rounded-full bg-gradient-to-b from-cyan-500 to-cyan-300" />
            <h2 className="text-2xl font-semibold text-slate-900">Field guide</h2>
          </div>
          <p className="text-sm text-slate-600">
            Click any section to see what to enter and examples. Keep it simple: copy what you see in the paper.
          </p>
        </div>

        <SimpleFieldGroup title="Study Details">
          <SimpleField 
            name="Lead Author"
            example="Smith JA"
            paperExample="Smith JA, Jones B, et al."
            tip="Surname and initials"
          />
          <SimpleField 
            name="Year of Publication"
            example="2023"
            paperExample="Published in 2023"
          />
          <SimpleField 
            name="Study Design"
            example="prospective cohort"
            paperExample="This prospective cohort study followed players over 3 seasons"
            choices={["prospective cohort", "retrospective cohort", "cross-sectional", "case series", "case-control", "other"]}
            tip="Pick the match, not the full sentence"
          />
        </SimpleFieldGroup>

        <SimpleFieldGroup title="Participant Characteristics">
          <SimpleField 
            name="FIFA Discipline"
            example="futsal"
            paperExample="Data from the FIFA Futsal World Cup"
            choices={["11-a-side", "futsal", "beach soccer", "amputee", "other"]}
          />
          <SimpleField 
            name="Country"
            example="England"
            paperExample="Study conducted in England"
          />
          <SimpleField 
            name="Level of Play"
            example="professional"
            paperExample="Professional players from the Premier League"
            choices={["professional", "semi-professional", "amateur", "youth elite", "youth recreational", "mixed"]}
          />
          <SimpleField 
            name="Sex"
            example="male"
            paperExample="Study included 62 male players"
            choices={["male", "female", "mixed"]}
          />
          <SimpleField 
            name="Age Category"
            example="U19"
            paperExample="U19 and U21 age groups participated"
            tip="Use for specific age groups like U19, U21, senior"
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
          <SimpleField 
            name="Study Period"
            example="3"
            paperExample="Data collected over 3 years"
            tip="In years"
          />
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
            choices={["medical attention", "time-loss", "medical attention or time-loss"]}
            tip="Pick the closest match, not the full sentence"
          />
          <SimpleField 
            name="Illness Definition"
            example="medical attention"
            paperExample="Illnesses requiring medical attention were recorded"
            choices={["medical attention", "time-loss", "medical attention or time-loss"]}
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
          <SimpleField 
            name="Season Length"
            example="38"
            paperExample="The season lasted 38 weeks"
            tip="In weeks, just the number"
          />
          <SimpleField 
            name="Number of Seasons"
            example="4"
            paperExample="Data from 4 consecutive seasons"
          />
          <SimpleField 
            name="Exposure Unit"
            example="player-hours"
            paperExample="Total match exposure was 8,500 player-hours"
            choices={["hours", "player-hours", "athlete-exposures", "match-exposures", "sessions", "other"]}
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
          <SimpleField 
            name="Injury Count"
            example="150"
            paperExample="A total of 150 injuries were recorded"
            tip="Just the number"
          />
          <SimpleField 
            name="Injury Incidence"
            example="3.2"
            paperExample="Injury incidence was 3.2 per 1000 player-hours"
            tip="Just the number, no 'per 1000h'"
          />
          <SimpleField 
            name="Recurrence Rate"
            example="15.2%"
            paperExample="Recurrence rate was 15.2%"
            tip="Keep the % symbol"
          />
        </SimpleFieldGroup>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h3 className="font-semibold text-amber-900 mb-3">When there are multiple groups</h3>
          <div className="space-y-3 text-sm text-slate-700">
            <div className="bg-white rounded-lg p-3 border border-amber-100">
              <p className="text-xs text-slate-500 mb-2">Paper says:</p>
              <p className="text-slate-900">&ldquo;62 males with 150 injuries and 60 females with 120 injuries&rdquo;</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-amber-100">
              <p className="text-xs text-slate-500 mb-2">Enter each on a new line:</p>
              <div className="space-y-1.5 font-mono text-xs">
                <div className="flex items-center gap-3">
                  <span className="text-slate-500 w-32">Sample Size:</span>
                  <div className="flex-1 bg-slate-50 rounded px-2 py-1">
                    <div>62</div>
                    <div>60</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-500 w-32">Injury Count:</span>
                  <div className="flex-1 bg-slate-50 rounded px-2 py-1">
                    <div>150</div>
                    <div>120</div>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-xs text-amber-800 italic">Each line = one group. Keep same order across all fields.</p>
          </div>
        </div>
      </section>

      {/* Reference */}
      <section className="rounded-3xl border border-slate-200/70 bg-gradient-to-br from-slate-50/30 via-white to-slate-50/30 p-8 shadow-lg ring-1 ring-slate-200/60">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-1 rounded-full bg-gradient-to-b from-slate-500 to-slate-300" />
            <h2 className="text-xl font-semibold text-slate-900">References</h2>
          </div>
          <div className="space-y-3 text-sm leading-relaxed text-slate-700">
            <p>
              <strong>Fuller CW et al.</strong> Consensus statement on injury definitions and data collection procedures in studies of football injuries. 
              <em> Br J Sports Med.</em> 2006;40:193–201. doi:10.1136/bjsm.2005.025270.
            </p>
            <p>
              <strong>Bahr R et al.</strong> International Olympic Committee consensus statement: methods for recording and reporting of epidemiological data on injury and illness in sport 2020. 
              <em> Br J Sports Med.</em> 2020;54:372–389. doi:10.1136/bjsports-2019-101969.
            </p>
            <p>
              <strong>Waldén M et al.</strong> Football-specific extension of the IOC consensus statement. 
              <em> Br J Sports Med.</em> 2023;57:1341–1350. doi:10.1136/bjsports-2022-106405.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

// Simple Field Group - Collapsible
function SimpleFieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 transition"
      >
        <span className="font-medium text-slate-900">{title}</span>
        <svg 
          className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="border-t border-slate-100 p-4 space-y-4 bg-slate-50">
          {children}
        </div>
      )}
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
    <div className="bg-white rounded-lg border border-slate-200 p-3 text-sm">
      <div className="font-medium text-slate-900 mb-2">{name}</div>
      
      {paperExample && (
        <div className="mb-2 p-2 bg-blue-50 rounded text-xs">
          <div className="text-blue-600 font-medium mb-1">Paper says:</div>
          <div className="text-slate-700 italic">&ldquo;{paperExample}&rdquo;</div>
        </div>
      )}

      <div className="p-2 bg-emerald-50 rounded">
        <div className="text-emerald-700 font-medium text-xs mb-1">You enter:</div>
        <code className="text-slate-900">{example}</code>
      </div>

      {choices && (
        <div className="mt-2 pt-2 border-t border-slate-100">
          <div className="text-xs text-slate-500 mb-1.5">Choose from:</div>
          <div className="flex flex-wrap gap-1">
            {choices.map((choice) => (
              <span key={choice} className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                {choice}
              </span>
            ))}
          </div>
        </div>
      )}

      {tip && (
        <div className="mt-2 text-xs text-slate-500 italic">
          💡 {tip}
        </div>
      )}
    </div>
  );
}
