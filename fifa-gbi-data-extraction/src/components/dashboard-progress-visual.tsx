'use client';

import { t } from '@/components/ui';

/**
 * The progress ring reads from the same palette as the stat tiles above it, so
 * a colour means one thing on this page: navy for the whole population, teal
 * for completed, amber for tagged, red for flagged. Single hue per ring, no
 * gradients, so a ring can never imply a state that contradicts a tile or a
 * status pill.
 */

type DashboardProgressVisualProps = {
  totalPapers: number;
  completedPapers: number;
  taggedCompletedPapers: number;
  flaggedPapers: number;
  userCompletedPapers: number;
};

type LegendRow = {
  key: string;
  label: string;
  value: number;
  swatch: string;
};

export function DashboardProgressVisual({
  totalPapers,
  completedPapers,
  taggedCompletedPapers,
  flaggedPapers,
  userCompletedPapers,
}: DashboardProgressVisualProps) {
  const size = 200;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const share = (value: number) => (totalPapers > 0 ? (value / totalPapers) * 100 : 0);
  const offsetFor = (value: number) => circumference - (share(value) / 100) * circumference;

  const completedOffset = offsetFor(completedPapers);
  const taggedOffset = offsetFor(taggedCompletedPapers);
  const flaggedOffset = offsetFor(flaggedPapers);
  const userOffset = offsetFor(userCompletedPapers);

  const completionRate = totalPapers > 0 ? Math.round((completedPapers / totalPapers) * 100) : 0;

  const legend: LegendRow[] = [
    { key: 'total', label: 'Total papers', value: totalPapers, swatch: 'var(--viz-total)' },
    {
      key: 'completed',
      label: 'Completed, including tagged and flagged',
      value: completedPapers,
      swatch: 'var(--viz-positive)',
    },
    { key: 'tagged', label: 'Tagged for completion', value: taggedCompletedPapers, swatch: 'var(--viz-attention)' },
    { key: 'flagged', label: 'Flagged', value: flaggedPapers, swatch: 'var(--viz-negative)' },
    { key: 'yours', label: 'Your completed', value: userCompletedPapers, swatch: 'var(--viz-user)' },
  ];

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
      <div
        className="relative flex-shrink-0"
        style={{ width: size, height: size }}
        role="img"
        aria-label={`${completionRate}% of ${totalPapers} papers complete. ${completedPapers} completed, ${taggedCompletedPapers} tagged, ${flaggedPapers} flagged, ${userCompletedPapers} completed by you.`}
      >
        <svg width={size} height={size} className="-rotate-90 transform" aria-hidden>
          {/* Track: the whole population. */}
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--navy-100)" strokeWidth={strokeWidth} />

          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--viz-positive)"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={completedOffset}
            strokeLinecap="round"
          />

          {/* The inner arcs are narrower bands sitting inside the completed one,
              so without this they butt straight up against it and each other,
              and two adjacent hues at the same lightness stop reading as two
              things. Each band is drawn twice: once in the surface colour, two
              pixels wider, which cuts a hairline gap into whatever is beneath
              it, then in its own colour. */}
          {[
            { stroke: 'var(--viz-attention)', width: strokeWidth - 6, offset: taggedOffset },
            { stroke: 'var(--viz-negative)', width: strokeWidth - 11, offset: flaggedOffset },
            { stroke: 'var(--viz-user)', width: strokeWidth - 16, offset: userOffset },
          ].map((band) => (
            <g key={band.stroke}>
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="var(--surface)"
                strokeWidth={band.width + 4}
                strokeDasharray={circumference}
                strokeDashoffset={band.offset}
                strokeLinecap="round"
              />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={band.stroke}
                strokeWidth={band.width}
                strokeDasharray={circumference}
                strokeDashoffset={band.offset}
                strokeLinecap="round"
              />
            </g>
          ))}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-[30px] font-semibold leading-none tracking-[-0.02em] text-ink [font-variant-numeric:tabular-nums]">
            {completionRate}%
          </div>
          <div className={`${t.caption} mt-1`}>Team progress</div>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {legend.map((row) => (
          <div
            key={row.key}
            className="flex items-center justify-between gap-3 rounded-ctl bg-surface-sunk px-3 py-2"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden
                className="h-2.5 w-2.5 flex-none rounded-full"
                style={{ background: row.swatch }}
              />
              <span className="truncate text-xs text-ink-body">{row.label}</span>
            </div>
            <span className="text-[13px] font-semibold text-ink [font-variant-numeric:tabular-nums]">{row.value}</span>
          </div>
        ))}

        <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">
          Tagged items (UEFA, FIFA data, Aspetar ASPREV, Mental health, American data, Systematic reviews) and flagged
          studies count toward overall progress but not toward individual completion.
        </p>
      </div>
    </div>
  );
}
