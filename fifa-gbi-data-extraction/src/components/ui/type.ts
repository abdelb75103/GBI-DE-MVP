/**
 * The type scale. Five sizes plus a label and a mono treatment; the audit found
 * seventeen font sizes and twelve uppercase tracking values in use. Import these
 * rather than inventing another size.
 */
export const t = {
  display: 'text-[32px] font-semibold leading-[1.15] tracking-[-0.02em] text-ink [font-variant-numeric:tabular-nums]',
  title: 'text-[22px] font-semibold leading-[1.25] tracking-[-0.015em] text-ink',
  section: 'text-[16px] font-semibold leading-[1.35] tracking-[-0.01em] text-ink',
  body: 'text-[13px] leading-[1.55] text-ink-body',
  caption: 'text-xs leading-[1.45] text-ink-soft',
  label: 'text-[11px] font-semibold uppercase leading-[1.3] tracking-[0.06em] text-ink-soft',
  mono: 'font-mono text-xs tracking-[0.01em] [font-variant-numeric:tabular-nums]',
  num: '[font-variant-numeric:tabular-nums]',
} as const;
