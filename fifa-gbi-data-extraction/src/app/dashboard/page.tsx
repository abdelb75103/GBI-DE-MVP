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
  eyebrow: string;
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
  border: string;
  shadow: string;
}> = {
  navy: {
    text: 'text-[#062b56]',
    number: 'bg-[#062b56] text-white',
    iconShell: 'bg-[#e8eef7]',
    iconText: 'text-[#062b56]',
    progress: 'bg-[#062b56]',
    button: 'bg-[#062b56] text-white hover:bg-[#0b3a70]',
    border: 'border-[#c9d5e8] hover:border-[#0b3a70]/45',
    shadow: 'hover:shadow-[#0b3a70]/15',
  },
  teal: {
    text: 'text-teal-800',
    number: 'bg-teal-700 text-white',
    iconShell: 'bg-teal-50',
    iconText: 'text-teal-700',
    progress: 'bg-teal-700',
    button: 'bg-teal-700 text-white hover:bg-teal-800',
    border: 'border-teal-200 hover:border-teal-400',
    shadow: 'hover:shadow-teal-700/15',
  },
  amber: {
    text: 'text-amber-700',
    number: 'bg-amber-600 text-white',
    iconShell: 'bg-amber-50',
    iconText: 'text-amber-600',
    progress: 'bg-amber-500',
    button: 'bg-amber-500 text-slate-950 hover:bg-amber-600 hover:text-white',
    border: 'border-amber-200 hover:border-amber-400',
    shadow: 'hover:shadow-amber-600/15',
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
      eyebrow: 'First pass',
      href: '/title-abstract-screening',
      action: 'Continue Screening',
      metrics: getTitleAbstractMetrics(titleAbstractRecords, activeProfile.id),
      tone: 'navy',
      icon: 'documentSearch',
      metricLabels: ['Total Records', 'Screened', 'Progress'],
    },
    {
      title: 'Full Text Screening',
      eyebrow: 'Eligibility review',
      href: '/full-text-screening',
      action: 'Continue Screening',
      metrics: getFullTextMetrics(fullTextRecords, activeProfile.id),
      tone: 'teal',
      icon: 'documentCheck',
      metricLabels: ['Full Texts', 'Screened', 'Progress'],
    },
    {
      title: 'Data Extraction',
      eyebrow: 'Final capture',
      href: '/data-extraction',
      action: 'Continue Extraction',
      metrics: getExtractionMetrics(papers),
      tone: 'amber',
      icon: 'table',
      metricLabels: ['Papers', 'Extracted', 'Progress'],
    },
  ];

  return (
    <div className="space-y-7">
      <section className="border-b border-slate-200/70 pb-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
            Welcome back, {firstName}
          </h1>
          <p className="text-lg text-slate-600">FIFA GBI workflow dashboard</p>
        </div>
      </section>

      <section className="grid min-w-0 gap-6 2xl:grid-cols-3">
        {stageCards.map((card, index) => (
          <WorkflowCard key={card.href} card={card} index={index + 1} />
        ))}
      </section>

    </div>
  );
}

function WorkflowCard({ card, index }: { card: StageCard; index: number }) {
  const tone = toneClasses[card.tone];

  return (
    <Link
      href={card.href}
      className={`group flex min-w-0 flex-col justify-between rounded-2xl border ${tone.border} bg-white/95 p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-2xl sm:min-h-[430px] sm:p-6 ${tone.shadow}`}
    >
      <div className="space-y-6">
        <div className="flex items-start gap-4 sm:gap-5">
          <div className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-full sm:h-24 sm:w-24 ${tone.iconShell} ${tone.iconText}`}>
            <StageIcon icon={card.icon} />
          </div>
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-3">
              <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${tone.number}`}>
                {index}
              </span>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">{card.eyebrow}</p>
            </div>
            <h2 className="text-xl font-bold leading-tight tracking-tight text-slate-950 sm:text-2xl">{card.title}</h2>
          </div>
        </div>

        <div className="h-px bg-slate-200/80" />

        <div className="grid grid-cols-3 divide-x divide-slate-200">
          <MetricColumn label={card.metricLabels[0]} value={card.metrics.total} tone={tone.text} />
          <MetricColumn label={card.metricLabels[1]} value={card.metrics.completed} tone={tone.text} />
          <MetricColumn label={card.metricLabels[2]} value={`${card.metrics.progress}%`} tone={tone.text} />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-slate-800">Overall Progress</p>
            <p className={`text-sm font-bold ${tone.text}`}>
              {card.metrics.completed} / {card.metrics.total}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-200/80">
              <div className={`h-full rounded-full ${tone.progress}`} style={{ width: `${card.metrics.progress}%` }} />
            </div>
            <span className={`w-10 text-right text-sm font-bold ${tone.text}`}>{card.metrics.progress}%</span>
          </div>
        </div>

        <div className="grid gap-2 border-t border-slate-200/80 pt-4 text-sm">
          <StageStat label={card.metrics.primaryLabel} value={card.metrics.primaryCount} />
          <StageStat label={card.metrics.secondaryLabel} value={card.metrics.secondaryCount} />
          <StageStat label={card.metrics.tertiaryLabel} value={card.metrics.tertiaryCount} />
        </div>
      </div>

      <div className="mt-6">
        <span className={`inline-flex w-full items-center justify-center gap-3 rounded-lg px-5 py-3 text-sm font-bold shadow-sm transition ${tone.button}`}>
          {card.action}
          <span className="text-lg transition group-hover:translate-x-1" aria-hidden>
            →
          </span>
        </span>
      </div>
    </Link>
  );
}

function MetricColumn({ label, value, tone }: { label: string; value: number | string; tone: string }) {
  return (
    <div className="px-3 first:pl-0 last:pr-0">
      <p className={`text-3xl font-bold tracking-tight ${tone}`}>{value}</p>
      <p className="mt-2 text-sm font-medium leading-5 text-slate-600">{label}</p>
    </div>
  );
}

function StageStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="font-bold text-slate-900">{value}</span>
    </div>
  );
}

function StageIcon({ icon }: { icon: StageCard['icon'] }) {
  if (icon === 'documentSearch') {
    return (
      <svg viewBox="0 0 48 48" fill="none" className="h-12 w-12" aria-hidden>
        <path d="M14 6h14l8 8v24H14V6Z" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
        <path d="M28 6v9h8M19 22h11M19 28h8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <circle cx="32" cy="32" r="6" stroke="currentColor" strokeWidth="3" />
        <path d="m37 37 5 5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }

  if (icon === 'documentCheck') {
    return (
      <svg viewBox="0 0 48 48" fill="none" className="h-12 w-12" aria-hidden>
        <path d="M14 6h14l8 8v28H14V6Z" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
        <path d="M28 6v9h8M19 24h11M19 31h7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path d="m28 34 4 4 8-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 48 48" fill="none" className="h-12 w-12" aria-hidden>
      <rect x="8" y="10" width="32" height="28" rx="2" stroke="currentColor" strokeWidth="3" />
      <path d="M8 19h32M8 28h32M18 10v28M29 10v28" stroke="currentColor" strokeWidth="3" />
    </svg>
  );
}
