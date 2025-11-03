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
      <section className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white/80 p-10 shadow-xl ring-1 ring-slate-200/60 backdrop-blur">
        <div className="absolute -left-10 -top-24 h-64 w-64 rounded-full bg-indigo-300/30 blur-3xl" aria-hidden />
        <div className="absolute -bottom-24 -right-10 h-72 w-72 rounded-full bg-emerald-200/40 blur-3xl" aria-hidden />
        <div className="relative z-10 space-y-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl space-y-5">
              <span className="inline-flex w-fit items-center rounded-full bg-indigo-100/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-indigo-600">
                Project overview
              </span>
              <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
                The FIFA Global Burden of Injury and Illness in Football – Living Systematic Review
              </h1>
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {pillars.map((pillar) => (
              <div
                key={pillar.title}
                className="relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white/85 p-6 shadow-md ring-1 ring-slate-200/60 backdrop-blur"
              >
                <div
                  className="absolute inset-0 -z-10 bg-gradient-to-br from-indigo-500/15 via-sky-400/10 to-indigo-400/20 opacity-80"
                  aria-hidden
                />
                <h2 className="text-lg font-semibold text-slate-900">{pillar.title}</h2>
                <p className="mt-2 text-sm text-slate-600">{pillar.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-8 rounded-3xl border border-slate-200/70 bg-white/80 p-8 shadow-lg ring-1 ring-slate-200/60 backdrop-blur lg:grid-cols-5">
        <div className="lg:col-span-2 lg:border-r lg:border-slate-200/60 lg:pr-8">
          <h2 className="text-2xl font-semibold text-slate-900">Background &amp; rationale</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Football is played worldwide, yet the true injury and illness burden is still fragmented. Earlier reviews
            offered valuable insights but left major population and discipline gaps that this living review now closes.
          </p>
        </div>
        <div className="lg:col-span-3">
          <ul className="space-y-4">
            {backgroundPoints.map((point) => (
              <li key={point.title} className="rounded-2xl border border-slate-200/70 bg-white/85 p-5 shadow-sm">
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-700">{point.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{point.detail}</p>
              </li>
            ))}
          </ul>
          <div className="mt-6 space-y-3 rounded-2xl border border-indigo-200/60 bg-indigo-50/70 p-5 text-sm leading-relaxed text-indigo-900">
            <p>
              The living systematic review keeps pace with new evidence by combining structured extraction, rigorous QA,
              and Bayesian updating so no critical signal is lost between publication cycles.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-8 rounded-3xl border border-slate-200/70 bg-white/80 p-8 shadow-lg ring-1 ring-slate-200/60 backdrop-blur lg:grid-cols-2">
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-900">Objectives</h2>
          <p className="text-sm leading-relaxed text-slate-600">
            We keep Phase 1 running reliably so downstream modelling, forecasting, and implementation plans start from
            the strongest baseline evidence possible.
          </p>
          <ul className="space-y-3 text-sm leading-relaxed text-slate-600">
            {primaryObjectives.map((objective) => (
              <li key={objective} className="flex gap-2">
                <span aria-hidden className="mt-1 block h-2 w-2 rounded-full bg-indigo-500" />
                <span>{objective}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-900">Research questions</h2>
          <ol className="space-y-3 text-sm leading-relaxed text-slate-600">
            {researchQuestions.map((question, index) => (
              <li key={question} className="flex gap-3">
                <span className="font-semibold text-indigo-600">{index + 1}.</span>
                <span>{question}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="space-y-6 rounded-3xl border border-slate-200/70 bg-white/80 p-8 shadow-lg ring-1 ring-slate-200/60 backdrop-blur">
        <div className="space-y-3">
          <h2 className="text-2xl font-semibold text-slate-900">Registered protocols</h2>
          <p className="text-sm leading-relaxed text-slate-600">
            The living review is anchored by preregistered plans so evidence synthesis stays transparent and
            reproducible.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {quickLinks.map((link) => (
            <Link
              key={link.title}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col rounded-2xl border border-indigo-200 bg-white px-4 py-4 text-sm font-semibold text-indigo-600 transition hover:border-indigo-300 hover:text-indigo-700"
            >
              <span>{link.title}</span>
              <span className="mt-1 text-xs font-normal text-slate-500">{link.description}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
