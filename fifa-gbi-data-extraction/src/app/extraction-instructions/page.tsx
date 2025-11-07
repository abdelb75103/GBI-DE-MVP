import type { Metadata } from 'next';

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

const scenarios = [
  'Multiple populations/ages/tournaments: list each on its own line and maintain consistent ordering.',
  'Ambiguous or missing data: leave blank and add a Note describing what you checked.',
  'Poor scans or OCR issues: Flag with a short explanation if you cannot reliably extract data.',
];

const checklist = [
  'AI-assisted tabs reviewed and corrected manually.',
  'Injury & Illness tabs completed where data exists; blanks left when not reported.',
  'Multi-value fields use one value per line with consistent row alignment.',
  'Status, Notes, and Flags updated appropriately; workspace saved.',
];

const appendixPlaceholders = [
  'Exact names of the first four AI-assisted tabs.',
  'Full list of available status values and their definitions.',
  'Location and label of the Save action in each layout (Accordion, Focus, Full Screen).',
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

export const metadata: Metadata = {
  title: 'Extraction Instructions | FIFA GBI Data Extraction Assistant',
  description:
    'Step-by-step instructions for researchers performing manual extractions with AI assistance in the FIFA GBI MVP app.',
};

export default function ExtractionInstructionsPage() {
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

      <section className="space-y-6 rounded-3xl border border-amber-200/50 bg-gradient-to-br from-amber-50/50 via-white to-white p-8 shadow-lg ring-1 ring-amber-200/30 backdrop-blur">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-1 rounded-full bg-gradient-to-b from-amber-500 to-amber-300" />
            <h2 className="text-2xl font-semibold text-slate-900">Common scenarios</h2>
          </div>
          <p className="text-sm leading-relaxed text-slate-600">
            Reference these quick notes for the situations researchers encounter most often during extraction.
          </p>
        </div>
        <ul className="space-y-3.5 text-sm leading-relaxed text-slate-700">
          {scenarios.map((item, index) => (
            <li key={item} className="flex gap-3 group">
              <span aria-hidden className="mt-1 block h-2 w-2 flex-shrink-0 rounded-full bg-amber-500 shadow-sm ring-2 ring-amber-100 group-hover:scale-110 transition-transform" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
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

      <section className="space-y-5 rounded-3xl border border-dashed border-slate-300/70 bg-gradient-to-br from-slate-50/40 via-white to-slate-50/30 p-8 text-sm leading-relaxed text-slate-600 shadow-md">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-200/70 text-slate-600">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-slate-900">Appendix: to be confirmed</h2>
        </div>
        <p className="text-slate-600">
          Capture these details once the UI labels and status values are finalised so this page stays fully accurate.
        </p>
        <ul className="space-y-3">
          {appendixPlaceholders.map((item) => (
            <li key={item} className="flex gap-3">
              <span aria-hidden className="mt-1 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-400 shadow-sm ring-2 ring-slate-200" />
              <span className="text-slate-600">{item}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
