/**
 * The five meanings colour is allowed to carry. Colour means decision state,
 * never category and never decoration. Categories use `Tag` instead.
 */
export type Tone = 'positive' | 'negative' | 'attention' | 'neutral' | 'info';

/** The ten source families. These are categories, so they never take a Tone. */
export type Category =
  | 'mental'
  | 'uefa'
  | 'fifa'
  | 'american'
  | 'aspetar'
  | 'system'
  | 'referee'
  | 'noexp'
  | 'retro'
  | 'master';

/**
 * A panel that takes the tone of the thing it is reporting: the AI
 * recommendation cards. The tint releases to the surface before the far corner,
 * as on `StatTile`, so a full-strength pill sitting on top of it still reads as a
 * separate object rather than dissolving into a flat block of the same colour.
 */
export const TONE_PANEL: Record<Tone, string> = {
  positive:
    'border border-positive-line bg-[linear-gradient(125deg,var(--state-positive-tint)_0%,var(--surface)_88%)]',
  negative:
    'border border-negative-line bg-[linear-gradient(125deg,var(--state-negative-tint)_0%,var(--surface)_88%)]',
  attention:
    'border border-attention-line bg-[linear-gradient(125deg,var(--state-attention-tint)_0%,var(--surface)_88%)]',
  info:
    'border border-info-line bg-[linear-gradient(125deg,var(--state-info-tint)_0%,var(--surface)_88%)]',
  neutral: 'border border-line bg-surface-sunk',
};
