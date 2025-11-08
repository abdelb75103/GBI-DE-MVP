import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title:
    'The FIFA Global Burden of Injury and Illness in Football · Living Systematic Review | FIFA GBI Data Extraction Assistant',
  description:
    'Living review overview for the FIFA Global Burden of Injury & Illness evidence programme, outlining scope, update cadence, and synthesis workflow.',
};

const pillars = [
  {
    title: 'Scope',
    description:
      'All FIFA disciplines & levels (association, futsal, beach, para; men, women, youth to elite).',
  },
  {
    title: 'Living updates',
    description: 'New papers monitored, screened, extracted, standardised.',
  },
  {
    title: 'Bayesian synthesis',
    description: 'Burden estimates update as evidence grows.',
  },
];

const primaryObjectives = [
  'Identify global injury incidence and illness burden across every FIFA football discipline.',
  'Quantify incidence for priority diagnoses (OSIICS and SMDCS codes) including concussion and ACL rupture.',
  'Operate a living systematic review pipeline that absorbs new evidence without disrupting delivery cadence.',
  'Provide interactive outputs that help technical and non-technical stakeholders act on the insights.',
];

const researchQuestions = [
  'How do incidence and burden rates vary for injury, illness, and mental health across sex, age, and discipline?',
  'What patterns emerge for key diagnoses (e.g., concussion, ACL, hamstring) when coded using OSIICS/SMDCS?',
  'How do severity, competition format, and environment influence observed burden?',
  'Does a Bayesian living review framework surface trends sooner than traditional synthesis approaches?',
];

const backgroundPoints = [
  {
    title: 'Narrow evidence base',
    detail:
      "Historic reviews centre on elite male players, under-representing youth, amateur, and women's football contexts.",
  },
  {
    title: 'Limited disciplines',
    detail:
      'Futsal, beach, and para football are often excluded, leaving blind spots for programme design and resources.',
  },
  {
    title: 'Outdated signal',
    detail: 'Many systematic reviews stop at 2018, missing shifts in injury epidemiology and emerging illnesses.',
  },
];

const quickLinks = [
  {
    title: 'OSF Project Hub',
    description:
      'Open Science Framework hosts collaborative materials so the team works from a transparent, versioned evidence base.',
    href: 'https://osf.io/8ngqv/overview',
  },
  {
    title: 'PROSPERO Protocol',
    description:
      'Public preregistration to track planned methods, inclusion criteria, and living-review update cadence.',
    href: 'https://www.crd.york.ac.uk/PROSPERO/view/CRD420251034392',
  },
];

export default function OverviewPage() {
  return (
    <div className="space-y-12">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-gradient-to-br from-white via-indigo-50/30 to-emerald-50/30 p-10 shadow-xl ring-1 ring-slate-200/60 backdrop-blur">
        <div className="absolute -left-10 -top-24 h-64 w-64 rounded-full bg-indigo-400/25 blur-3xl" aria-hidden />
        <div className="absolute -bottom-24 -right-10 h-72 w-72 rounded-full bg-emerald-300/30 blur-3xl" aria-hidden />
        <div className="absolute top-1/3 right-1/3 h-48 w-48 rounded-full bg-sky-200/20 blur-2xl" aria-hidden />
        <div className="relative z-10 space-y-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl space-y-5">
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-gradient-to-r from-indigo-100 to-sky-100 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-indigo-700 shadow-sm ring-1 ring-indigo-200/50">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" aria-hidden />
                Project overview
              </span>
              <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">
                The FIFA Global Burden of Injury and Illness in Football – Living Systematic Review
              </h1>
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {pillars.map((pillar, index) => {
              const colors = [
                { bg: 'from-indigo-500/15 via-sky-400/10 to-indigo-400/20', border: 'border-indigo-200/70', icon: 'text-indigo-500' },
                { bg: 'from-emerald-500/15 via-teal-400/10 to-emerald-400/20', border: 'border-emerald-200/70', icon: 'text-emerald-500' },
                { bg: 'from-amber-500/15 via-orange-400/10 to-amber-400/20', border: 'border-amber-200/70', icon: 'text-amber-500' }
              ];
              const color = colors[index % colors.length];
              return (
                <div
                  key={pillar.title}
                  className={`relative overflow-hidden rounded-2xl border ${color.border} bg-white/85 p-6 shadow-md ring-1 ring-slate-200/40 backdrop-blur hover:shadow-lg transition-all duration-200`}
                >
                  <div
                    className={`absolute inset-0 -z-10 bg-gradient-to-br ${color.bg} opacity-80`}
                    aria-hidden
                  />
                  <h2 className="text-lg font-bold text-slate-900">{pillar.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{pillar.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid gap-8 rounded-3xl border border-rose-200/50 bg-gradient-to-br from-rose-50/40 via-white to-white p-8 shadow-lg ring-1 ring-rose-200/30 backdrop-blur lg:grid-cols-5">
        <div className="lg:col-span-2 lg:border-r lg:border-rose-200/40 lg:pr-8">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-8 w-1 rounded-full bg-gradient-to-b from-rose-500 to-rose-300" />
            <h2 className="text-2xl font-semibold text-slate-900">Background &amp; rationale</h2>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Football is played worldwide, yet the true injury and illness burden is still fragmented. Earlier reviews
            offered valuable insights but left major population and discipline gaps that this living review now closes.
          </p>
        </div>
        <div className="lg:col-span-3">
          <ul className="space-y-4">
            {backgroundPoints.map((point, index) => {
              const colors = [
                { border: 'border-rose-200/60', bg: 'from-rose-50/60 to-white', icon: 'bg-rose-500' },
                { border: 'border-orange-200/60', bg: 'from-orange-50/60 to-white', icon: 'bg-orange-500' },
                { border: 'border-amber-200/60', bg: 'from-amber-50/60 to-white', icon: 'bg-amber-500' }
              ];
              const color = colors[index % colors.length];
              return (
                <li key={point.title} className={`rounded-2xl border ${color.border} bg-gradient-to-br ${color.bg} p-5 shadow-sm hover:shadow-md transition-shadow`}>
                  <div className="flex items-center gap-2">
                    <span className={`flex h-2 w-2 rounded-full ${color.icon} shadow-sm ring-2 ring-white`} aria-hidden />
                    <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-800">{point.title}</h3>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{point.detail}</p>
                </li>
              );
            })}
          </ul>
          <div className="mt-6 space-y-3 rounded-2xl border border-indigo-300/60 bg-gradient-to-br from-indigo-50 to-white p-6 text-sm leading-relaxed shadow-md">
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-indigo-500 shadow-sm">
                <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-indigo-900">
                The living systematic review keeps pace with new evidence by combining structured extraction, rigorous QA,
                and Bayesian updating so no critical signal is lost between publication cycles.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-8 rounded-3xl border border-slate-200/70 bg-gradient-to-br from-slate-50/50 via-white to-indigo-50/30 p-8 shadow-lg ring-1 ring-slate-200/60 backdrop-blur lg:grid-cols-2">
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <div className="h-8 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-indigo-300" />
            <h2 className="text-2xl font-semibold text-slate-900">Objectives</h2>
          </div>
          <p className="text-sm leading-relaxed text-slate-600">
            We keep Phase 1 running reliably so downstream modelling, forecasting, and implementation plans start from
            the strongest baseline evidence possible.
          </p>
          <ul className="space-y-3.5 text-sm leading-relaxed text-slate-700">
            {primaryObjectives.map((objective) => (
              <li key={objective} className="flex gap-3 group">
                <span aria-hidden className="mt-1 block h-2 w-2 flex-shrink-0 rounded-full bg-indigo-500 shadow-sm ring-2 ring-indigo-100 group-hover:scale-110 transition-transform" />
                <span>{objective}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <div className="h-8 w-1 rounded-full bg-gradient-to-b from-emerald-500 to-emerald-300" />
            <h2 className="text-2xl font-semibold text-slate-900">Research questions</h2>
          </div>
          <ol className="space-y-4 text-sm leading-relaxed text-slate-700">
            {researchQuestions.map((question, index) => (
              <li key={question} className="flex gap-3 group">
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500 text-sm font-bold text-white shadow-md ring-4 ring-emerald-100 group-hover:scale-105 transition-transform">
                  {index + 1}
                </span>
                <span className="pt-0.5">{question}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="space-y-6 rounded-3xl border border-teal-200/50 bg-gradient-to-br from-teal-50/40 via-white to-cyan-50/30 p-8 shadow-lg ring-1 ring-teal-200/30 backdrop-blur">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-1 rounded-full bg-gradient-to-b from-teal-500 to-cyan-400" />
            <h2 className="text-2xl font-semibold text-slate-900">Registered protocols</h2>
          </div>
          <p className="text-sm leading-relaxed text-slate-600">
            The living review is anchored by preregistered plans so evidence synthesis stays transparent and
            reproducible.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {quickLinks.map((link, index) => {
            const colors = [
              { border: 'border-indigo-300/60', bg: 'from-indigo-50 to-white', hover: 'hover:border-indigo-400 hover:shadow-lg', text: 'text-indigo-600 hover:text-indigo-700', icon: 'bg-indigo-500' },
              { border: 'border-emerald-300/60', bg: 'from-emerald-50 to-white', hover: 'hover:border-emerald-400 hover:shadow-lg', text: 'text-emerald-600 hover:text-emerald-700', icon: 'bg-emerald-500' }
            ];
            const color = colors[index % colors.length];
            return (
              <Link
                key={link.title}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`group flex flex-col gap-3 rounded-2xl border ${color.border} bg-gradient-to-br ${color.bg} px-5 py-5 shadow-md transition-all duration-200 ${color.hover}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${color.icon} shadow-sm`}>
                    <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </div>
                  <span className={`text-sm font-bold ${color.text}`}>{link.title}</span>
                </div>
                <p className="text-xs leading-relaxed text-slate-600">{link.description}</p>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
