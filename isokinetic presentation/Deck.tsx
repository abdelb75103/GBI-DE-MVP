import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { TitleSlide } from './slides/TitleSlide';
import { TeamSlide } from './slides/TeamSlide';
import { ProblemFramingSlide } from './slides/ProblemFramingSlide';
import { GBIIntroSlide } from './slides/GBIIntroSlide';
import { GBIMethodsSlide } from './slides/GBIMethodsSlide';
import { GBIBayesianSlide } from './slides/GBIBayesianSlide';
import { GBIEligibilitySlide } from './slides/GBIEligibilitySlide';
import { SearchFlowSlide } from './slides/SearchFlowSlide';
import { ExtractionBreakdownSlide } from './slides/ExtractionBreakdownSlide';
import { ExtractionChallengesSlide } from './slides/ExtractionChallengesSlide';
import { ExtractionFrameworkSlide } from './slides/ExtractionFrameworkSlide';
import { SexAgeConcentrationSlide } from './slides/SexAgeConcentrationSlide';
import { PapersTimelineSlide } from './slides/PapersTimelineSlide';
import { InjuryDefinitionUseSlide } from './slides/InjuryDefinitionUseSlide';
import { ClosingSynthesisSlide } from './slides/ClosingSynthesisSlide';

type DeckEntry = {
  component: React.ComponentType;
  duration: number;
  id: string;
};

const DECK_SLIDES: DeckEntry[] = [
  {component: TitleSlide, duration: 150, id: 'TitleSlide'},
  {component: TeamSlide, duration: 150, id: 'TeamSlide'},
  {component: ProblemFramingSlide, duration: 600, id: 'ProblemFramingSlide'},
  {component: GBIIntroSlide, duration: 350, id: 'GBIIntroSlide'},
  {component: GBIMethodsSlide, duration: 400, id: 'GBIMethodsSlide'},
  {component: GBIBayesianSlide, duration: 400, id: 'GBIBayesianSlide'},
  {component: GBIEligibilitySlide, duration: 400, id: 'GBIEligibilitySlide'},
  {component: SearchFlowSlide, duration: 400, id: 'SearchFlowSlide'},
  {component: ExtractionBreakdownSlide, duration: 400, id: 'ExtractionBreakdownSlide'},
  {component: ExtractionFrameworkSlide, duration: 400, id: 'ExtractionFrameworkSlide'},
  {component: ExtractionChallengesSlide, duration: 400, id: 'ExtractionChallengesSlide'},
  {component: PapersTimelineSlide, duration: 400, id: 'PapersTimelineSlide'},
  {component: InjuryDefinitionUseSlide, duration: 400, id: 'InjuryDefinitionUseSlide'},
  {component: SexAgeConcentrationSlide, duration: 400, id: 'SexAgeConcentrationSlide'},
  {component: ClosingSynthesisSlide, duration: 450, id: 'ClosingSynthesisSlide'},
];

const DECK_SEQUENCES = DECK_SLIDES.reduce<
  Array<DeckEntry & {from: number}>
>((acc, slide) => {
  const previous = acc[acc.length - 1];
  const from = previous ? previous.from + previous.duration : 0;
  acc.push({...slide, from});
  return acc;
}, []);

export const DECK_DURATION = DECK_SEQUENCES.reduce((sum, slide) => sum + slide.duration, 0);

export const Deck: React.FC = () => {
  return (
    <AbsoluteFill>
      {DECK_SEQUENCES.map((slide) => {
        const Component = slide.component;

        return (
          <Sequence key={slide.id} from={slide.from} durationInFrames={slide.duration}>
            <Component />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
