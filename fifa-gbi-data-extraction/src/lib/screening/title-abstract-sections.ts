export type StructuredAbstractSection = {
  heading: string | null;
  body: string;
};

const HEADING_LABELS: Record<string, string> = {
  aim: 'Aim',
  aims: 'Aims',
  objective: 'Objective',
  objectives: 'Objectives',
  background: 'Background',
  purpose: 'Purpose',
  method: 'Methods',
  methods: 'Methods',
  result: 'Results',
  results: 'Results',
  conclusion: 'Conclusion',
  conclusions: 'Conclusions',
};

const HEADING_PATTERN = /\b(aims?|objectives?|background|purpose|methods?|results?|conclusions?)\s*[:.]\s*/gi;

const compactWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

export const splitStructuredAbstract = (abstract: string | null | undefined): StructuredAbstractSection[] => {
  const text = abstract?.trim();
  if (!text) return [];

  const matches = Array.from(text.matchAll(HEADING_PATTERN));
  if (matches.length === 0) {
    return [{ heading: null, body: compactWhitespace(text) }];
  }

  const sections: StructuredAbstractSection[] = [];
  if ((matches[0].index ?? 0) > 0) {
    const leadingBody = compactWhitespace(text.slice(0, matches[0].index));
    if (leadingBody) sections.push({ heading: null, body: leadingBody });
  }

  matches.forEach((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? text.length;
    const body = compactWhitespace(text.slice(start, end));
    if (!body) return;
    const heading = HEADING_LABELS[match[1].toLowerCase()] ?? match[1];
    sections.push({ heading, body });
  });

  return sections.length > 0 ? sections : [{ heading: null, body: compactWhitespace(text) }];
};
