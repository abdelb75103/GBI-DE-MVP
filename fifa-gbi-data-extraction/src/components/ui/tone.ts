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
