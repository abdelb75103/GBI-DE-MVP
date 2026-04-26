import Link from 'next/link';
import { redirect } from 'next/navigation';

import { mockDb } from '@/lib/mock-db';
import { readActiveProfileSession } from '@/lib/session';
import {
  getExtractionMetrics,
  getFullTextMetrics,
  getTitleAbstractMetrics,
  type WorkflowStageMetrics,
} from '@/lib/workflow-metrics';

export const dynamic = 'force-dynamic';

const extractFirstName = (fullName: string | undefined | null): string => {
  if (!fullName) return 'Researcher';

  const words = fullName.trim().split(/\s+/);
  if (words.length === 0) return 'Researcher';

  const titles = new Set([
    'dr',
    'dr.',
    'doctor',
    'prof',
    'prof.',
    'professor',
    'mr',
    'mr.',
    'mister',
    'mrs',
    'mrs.',
    'missus',
    'ms',
    'ms.',
    'miss',
  ]);

  const firstWord = words[0].toLowerCase().replace(/\.$/, '');
  if (titles.has(firstWord) && words.length > 1) {
    return words[1];
  }

  return words[0];
};

type StageTone = 'navy' | 'teal' | 'amber';

type StageCard = {
  title: string;
  href: string;
  action: string;
  metrics: WorkflowStageMetrics;
  tone: StageTone;
  icon: 'documentSearch' | 'documentCheck' | 'table';
  metricLabels: [string, string, string];
};

const toneClasses: Record<StageTone, {
  text: string;
  number: string;
  iconShell: string;
  iconText: string;
  progress: string;
  button: string;
  ring: string;
  blobA: string;
  blobB: string;
}> = {
  navy: {
    text: 'text-[#0b3a70]',
    number: 'bg-[#0b3a70] text-white shadow-[0_6px_18px_-6px_rgba(11,58,112,0.45)]',
    iconShell: 'bg-gradient-to-br from-[#e8eef7] via-white to-[#e8eef7]',
    iconText: 'text-[#0b3a70]',
    progress: 'bg-gradient-to-r from-[#0b3a70] via-[#1e4f8a] to-[#3b82f6]',
    button: 'bg-[#0b3a70] text-white hover:bg-[#082f5d] shadow-[0_10px_30px_-10px_rgba(11,58,112,0.55)]',
    ring: 'ring-[#0b3a70]/15 hover:ring-[#0b3a70]/30',
    blobA: 'bg-[#0b3a70]/15',
    blobB: 'bg-sky-300/30',
  },
  teal: {
    text: 'text-teal-800',
    number: 'bg-teal-700 text-white shadow-[0_6px_18px_-6px_rgba(15,118,110,0.45)]',
    iconShell: 'bg-gradient-to-br from-teal-50 via-white to-teal-50',
    iconText: 'text-teal-700',
    progress: 'bg-gradient-to-r from-teal-700 via-teal-500 to-emerald-400',
    button: 'bg-teal-700 text-white hover:bg-teal-800 shadow-[0_10px_30px_-10px_rgba(15,118,110,0.55)]',
    ring: 'ring-teal-500/15 hover:ring-teal-500/30',
    blobA: 'bg-teal-300/30',
    blobB: 'bg-emerald-200/40',
  },
  amber: {
    text: 'text-amber-700',
    number: 'bg-amber-500 text-slate-950 shadow-[0_6px_18px_-6px_rgba(245,158,11,0.55)]',
    iconShell: 'bg-gradient-to-br from-amber-50 via-white to-amber-50',
    iconText: 'text-amber-600',
    progress: 'bg-gradient-to-r from-amber-500 via-orange-400 to-amber-300',
    button: 'bg-amber-500 text-slate-950 hover:bg-amber-600 hover:text-white shadow-[0_10px_30px_-10px_rgba(245,158,11,0.55)]',
    ring: 'ring-amber-300/20 hover:ring-amber-400/40',
    blobA: 'bg-amber-300/35',
    blobB: 'bg-orange-200/40',
  },
};

export default async function DashboardPage() {
  const activeProfile = await readActiveProfileSession();
  if (!activeProfile) {
    redirect('/profiles/select');
  }

  const [titleAbstractRecords, fullTextRecords, papers] = await Promise.all([
    mockDb.listScreeningRecords('title_abstract'),
    mockDb.listScreeningRecords('full_text'),
    mockDb.listPapers(),
  ]);

  const firstName = extractFirstName(activeProfile.fullName);
  const stageCards: StageCard[] = [
    {
      title: 'Title & Abstract Screening',
      href: '/title-abstract-screening',
      action: 'Continue Screening',
      metrics: getTitleAbstractMetrics(titleAbstractRecords, activeProfile.id),
      tone: 'navy',
      icon: 'documentSearch',
      metricLabels: ['Total Records', 'Screened', 'Progress'],
    },
    {
      title: 'Full Text Screening',
      href: '/full-text-screening',
      action: 'Continue Screening',
      metrics: getFullTextMetrics(fullTextRecords, activeProfile.id),
      tone: 'teal',
      icon: 'documentCheck',
      metricLabels: ['Full Texts', 'Screened', 'Progress'],
    },
    {
      title: 'Data Extraction',
      href: '/data-extraction',
      action: 'Continue Extraction',
      metrics: getExtractionMetrics(papers),
      tone: 'amber',
      icon: 'table',
      metricLabels: ['Papers', 'Extracted', 'Progress'],
    },
  ];

  return (
    <div className="space-y-10 sm:space-y-12">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-xl ring-1 ring-slate-200/60 backdrop-blur sm:p-8 lg:p-10">
        <div className="absolute -left-10 -top-16 h-56 w-56 rounded-full bg-indigo-300/30 blur-3xl" aria-hidden />
        <div className="absolute -bottom-14 -right-6 h-64 w-64 rounded-full bg-emerald-200/40 blur-3xl" aria-hidden />
        <div className="relative z-10 flex flex-col gap-5">
          <span className="inline-flex w-fit items-center rounded-full bg-gradient-to-br from-indigo-100/90 via-sky-50/80 to-indigo-50/90 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#0b3a70] shadow-sm ring-1 ring-indigo-200/50 backdrop-blur-sm">
            Workflow dashboard
          </span>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl lg:text-[2.6rem]">
                Welcome back, {firstName}
              </h1>
              <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
                Three stages, one continuous review pipeline. Pick up where you left off.
              </p>
            </div>
            <div className="hidden items-center gap-3 lg:flex">
              <StageStep label="Title & Abstract" />
              <StageArrow />
              <StageStep label="Full Text" />
              <StageArrow />
              <StageStep label="Extraction" />
            </div>
          </div>
        </div>
      </section>

      <section className="grid min-w-0 gap-6 xl:grid-cols-3">
        {stageCards.map((card, index) => (
          <WorkflowCard key={card.href} card={card} index={index + 1} />
        ))}
      </section>
    </div>
  );
}

function StageStep({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-200/70 bg-white/70 px-3 py-1 text-[11px] font-semibold tracking-tight text-slate-600 shadow-sm ring-1 ring-slate-200/40 backdrop-blur">
      {label}
    </span>
  );
}

function StageArrow() {
  return (
    <span aria-hidden className="text-slate-300">
      ›
    </span>
  );
}

function WorkflowCard({ card, index }: { card: StageCard; index: number }) {
  const tone = toneClasses[card.tone];

  return (
    <Link
      href={card.href}
      className={`group relative flex min-w-0 flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-xl ring-1 ${tone.ring} backdrop-blur transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-2xl sm:min-h-[460px] sm:p-7`}
    >
      <div aria-hidden className={`pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full blur-3xl ${tone.blobA}`} />
      <div aria-hidden className={`pointer-events-none absolute -bottom-16 -left-10 h-48 w-48 rounded-full blur-3xl ${tone.blobB}`} />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-white/10" />

      <div className="relative space-y-6">
        <div className="flex items-start gap-4 sm:gap-5">
          <div className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl shadow-inner ring-1 ring-white/60 sm:h-24 sm:w-24 ${tone.iconShell} ${tone.iconText}`}>
            <StageIcon icon={card.icon} />
          </div>
          <div className="min-w-0 space-y-2.5 pt-1">
            <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${tone.number}`}>
              {index}
            </span>
            <h2 className="text-xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-[1.45rem]">{card.title}</h2>
          </div>
        </div>

        <div className="grid grid-cols-3 divide-x divide-slate-200/70 rounded-2xl border border-slate-200/60 bg-white/60 p-3 backdrop-blur">
          <MetricColumn label={card.metricLabels[0]} value={card.metrics.total} tone={tone.text} />
          <MetricColumn label={card.metricLabels[1]} value={card.metrics.completed} tone={tone.text} />
          <MetricColumn label={card.metricLabels[2]} value={`${card.metrics.progress}%`} tone={tone.text} />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Overall progress</p>
            <p className={`text-xs font-semibold ${tone.text}`}>
              {card.metrics.completed} / {card.metrics.total}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-200/70">
              <div className={`h-full rounded-full ${tone.progress} transition-[width] duration-700 ease-out`} style={{ width: `${card.metrics.progress}%` }} />
            </div>
            <span className={`w-10 text-right text-sm font-semibold tabular-nums ${tone.text}`}>{card.metrics.progress}%</span>
          </div>
        </div>

        <div className="grid gap-2 border-t border-slate-200/70 pt-4 text-sm">
          <StageStat label={card.metrics.primaryLabel} value={card.metrics.primaryCount} />
          <StageStat label={card.metrics.secondaryLabel} value={card.metrics.secondaryCount} />
          <StageStat label={card.metrics.tertiaryLabel} value={card.metrics.tertiaryCount} />
        </div>
      </div>

      <div className="relative mt-6">
        <span className={`inline-flex w-full items-center justify-center gap-3 rounded-xl px-5 py-3 text-sm font-semibold transition-all duration-300 ease-out ${tone.button}`}>
          {card.action}
          <span className="text-base transition-transform duration-300 ease-out group-hover:translate-x-1" aria-hidden>
            →
          </span>
        </span>
      </div>
    </Link>
  );
}

function MetricColumn({ label, value, tone }: { label: string; value: number | string; tone: string }) {
  return (
    <div className="px-3 first:pl-1 last:pr-1">
      <p className={`text-2xl font-semibold tracking-tight tabular-nums ${tone}`}>{value}</p>
      <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.14em] leading-4 text-slate-500">{label}</p>
    </div>
  );
}

function StageStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900 tabular-nums">{value}</span>
    </div>
  );
}

function StageIcon({ icon }: { icon: StageCard['icon'] }) {
  if (icon === 'documentSearch') {
    return (
      <svg viewBox="0 0 48 48" fill="none" className="h-11 w-11" aria-hidden>
        <path d="M14 6h14l8 8v24H14V6Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M28 6v9h8M19 22h11M19 28h8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="32" cy="32" r="6" stroke="currentColor" strokeWidth="2.5" />
        <path d="m37 37 5 5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    );
  }

  if (icon === 'documentCheck') {
    return (
      <svg viewBox="0 0 48 48" fill="none" className="h-11 w-11" aria-hidden>
        <path d="M14 6h14l8 8v28H14V6Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M28 6v9h8M19 24h11M19 31h7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <path d="m28 34 4 4 8-10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 48 48" fill="none" className="h-11 w-11" aria-hidden>
      <rect x="8" y="10" width="32" height="28" rx="2" stroke="currentColor" strokeWidth="2.5" />
      <path d="M8 19h32M8 28h32M18 10v28M29 10v28" stroke="currentColor" strokeWidth="2.5" />
    </svg>
  );
}
