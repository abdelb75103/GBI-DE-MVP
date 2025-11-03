import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Project Overview | FIFA GBI Data Extraction Assistant',
  description:
    'Phase 1 overview for the FIFA Global Burden of Injury & Illness data extraction systematic review.',
};

const sections = [
  {
    title: 'Phase 1 focus',
    description:
      "We are conducting a comprehensive systematic review to map the global burden of injury and illness in football. This first phase concentrates on identifying, screening, and extracting data from peer-reviewed studies aligned with FIFA's injury surveillance framework.",
  },
  {
    title: 'Core objectives',
    description:
      'Standardise study selection, ensure reproducible data extraction, and generate a harmonised evidence base that can feed quantitative synthesis and future implementation work.',
  },
  {
    title: 'Team workflow',
    description:
      'Screening and extraction are coordinated through predefined roles. Each paper progresses from upload, through dual extraction, to quality review and resolution of any flagged issues.',
  },
];

export default function OverviewPage() {
  return (
    <div className="space-y-12">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white/80 p-10 shadow-xl ring-1 ring-slate-200/60 backdrop-blur">
        <div className="absolute -left-10 -top-24 h-64 w-64 rounded-full bg-indigo-300/30 blur-3xl" aria-hidden />
        <div className="absolute -bottom-24 -right-10 h-72 w-72 rounded-full bg-emerald-200/40 blur-3xl" aria-hidden />
        <div className="relative z-10 space-y-10">
          <div className="max-w-3xl space-y-5">
            <span className="inline-flex w-fit items-center rounded-full bg-indigo-100/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-indigo-600">
              Project overview
            </span>
            <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
              FIFA Global Burden of Injury &amp; Illness – Systematic Review (Phase 1)
            </h1>
            <p className="text-base leading-relaxed text-slate-600">
              Phase 1 establishes the evidence foundation for the wider FIFA GBI programme. The team is synthesising
              global research on injury and illness in football to understand incidence, severity, and contextual
              factors. Insights from this phase feed later modelling, prevention planning, and implementation guidance.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {sections.map((section) => (
              <div
                key={section.title}
                className="relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white/85 p-6 shadow-md ring-1 ring-slate-200/60 backdrop-blur"
              >
                <div
                  className="absolute inset-0 -z-10 bg-gradient-to-br from-indigo-500/15 via-sky-400/10 to-indigo-400/20 opacity-80"
                  aria-hidden
                />
                <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-700">{section.title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{section.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="space-y-8 rounded-3xl border border-slate-200/70 bg-white/80 p-8 shadow-lg ring-1 ring-slate-200/60 backdrop-blur">
        <div className="space-y-3">
          <h2 className="text-2xl font-semibold text-slate-900">Registered protocols</h2>
          <p className="text-sm leading-relaxed text-slate-600">
            The systematic review is pre-registered to ensure transparency and reproducibility. Both registrations
            outline the scope, eligibility criteria, and planned analyses for the phase 1 evidence synthesis.
          </p>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-6 shadow-inner">
            <h3 className="text-base font-semibold text-slate-900">OSF Registration</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Open Science Framework project registration detailing the study rationale, staged workflow, and planned
              outputs for the FIFA Global Burden of Injury &amp; Illness review.
            </p>
            <Link
              href="https://osf.io/8ngqv/overview"
              className="mt-4 inline-flex items-center rounded-full border border-indigo-200 bg-white px-4 py-2 text-sm font-semibold text-indigo-600 transition hover:border-indigo-300 hover:text-indigo-700"
            >
              View OSF record
            </Link>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-6 shadow-inner">
            <h3 className="text-base font-semibold text-slate-900">PROSPERO Registration</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              International prospective register of systematic reviews entry (CRD42025103439) covering objectives,
              eligibility, and analysis plan for the injury and illness evidence synthesis.
            </p>
            <Link
              href="https://www.crd.york.ac.uk/PROSPERO/view/CRD42025103439"
              className="mt-4 inline-flex items-center rounded-full border border-indigo-200 bg-white px-4 py-2 text-sm font-semibold text-indigo-600 transition hover:border-indigo-300 hover:text-indigo-700"
            >
              View PROSPERO record
            </Link>
          </div>
        </div>
      </section>
      <section className="space-y-6 rounded-3xl border border-slate-200/70 bg-white/80 p-8 shadow-lg ring-1 ring-slate-200/60 backdrop-blur">
        <div className="space-y-3">
          <h2 className="text-2xl font-semibold text-slate-900">What the team should know</h2>
          <p className="text-sm leading-relaxed text-slate-600">
            To keep phase 1 on track, align your daily tasks with the shared methodology and documentation below. Each
            resource captures the latest decisions and ensures consistent extraction across the team.
          </p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2">
          <li className="rounded-2xl border border-slate-200/70 bg-white/90 p-6 shadow-md ring-1 ring-slate-200/60">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-700">Eligibility &amp; screening</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Follow the pre-defined inclusion and exclusion rules when reviewing abstracts and full texts. Document edge
              cases and escalate uncertainties for adjudication.
            </p>
          </li>
          <li className="rounded-2xl border border-slate-200/70 bg-white/90 p-6 shadow-md ring-1 ring-slate-200/60">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-700">Extraction standards</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Capture incidence measures, population descriptors, exposure definitions, and outcome details using the
              structured fields in this workspace.
            </p>
          </li>
          <li className="rounded-2xl border border-slate-200/70 bg-white/90 p-6 shadow-md ring-1 ring-slate-200/60">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-700">Quality assurance</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Dual extractions and reviewer checks ensure fidelity. Flag discrepancies promptly so the core team can
              resolve them before synthesis.
            </p>
          </li>
          <li className="rounded-2xl border border-slate-200/70 bg-white/90 p-6 shadow-md ring-1 ring-slate-200/60">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-700">Next steps</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Outputs from this phase will flow into evidence gap mapping and injury burden modelling, informing phase 2
              implementation planning with FIFA stakeholders.
            </p>
          </li>
        </ul>
      </section>
    </div>
  );
}
