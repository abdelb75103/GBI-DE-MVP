import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { TitleSlide } from './slides/TitleSlide';
import { TeamSlide } from './slides/TeamSlide';
import {
  ProblemFramingLiteratureSlide,
  ProblemFramingSurveillanceSlide,
} from './slides/ProblemFramingSlide';
import { GBIIntroSlide } from './slides/GBIIntroSlide';
import { GBIMethodsSlide } from './slides/GBIMethodsSlide';
import { GBIBayesianSlide } from './slides/GBIBayesianSlide';
import { GBIEligibilitySlide } from './slides/GBIEligibilitySlide';
import { SearchFlowSlide } from './slides/SearchFlowSlide';
import { ExtractionBreakdownSlide } from './slides/ExtractionBreakdownSlide';
import { ExtractionChallengesSlide } from './slides/ExtractionChallengesSlide';
import { ExtractionFrameworkSlide } from './slides/ExtractionFrameworkSlide';
import { SexAgeConcentrationSlide } from './slides/SexAgeConcentrationSlide';
import {
  PapersTimelineExcludedOverlaySlide,
  PapersTimelineOverallSlide,
} from './slides/PapersTimelineSlide';
import { WomenOverlayTimelineSlide } from './slides/WomenOverlayTimelineSlide';
import { FifaDisciplineBreakdownSlide } from './slides/FifaDisciplineBreakdownSlide';
import { InjuryDefinitionUseSlide } from './slides/InjuryDefinitionUseSlide';
import {ClosingNextStepsSlide, ClosingWhatWeNeedSlide} from './slides/ClosingActionSlide';
import { AppendixSurveillanceProgrammeCountingSlide } from './slides/AppendixSurveillanceProgrammeCountingSlide';
import { ThankYouSlide } from './slides/ThankYouSlide';

type DeckEntry = {
  component: React.ComponentType;
  duration: number;
  id: string;
};

const DECK_SLIDES: DeckEntry[] = [
  {component: TitleSlide, duration: 150, id: 'TitleSlide'},
  {component: TeamSlide, duration: 150, id: 'TeamSlide'},
  {component: ProblemFramingSurveillanceSlide, duration: 150, id: 'ProblemFramingSurveillanceSlide'},
  {component: ProblemFramingLiteratureSlide, duration: 210, id: 'ProblemFramingLiteratureSlide'},
  {component: GBIIntroSlide, duration: 350, id: 'GBIIntroSlide'},
  {component: GBIMethodsSlide, duration: 400, id: 'GBIMethodsSlide'},
  {component: GBIBayesianSlide, duration: 400, id: 'GBIBayesianSlide'},
  {component: GBIEligibilitySlide, duration: 400, id: 'GBIEligibilitySlide'},
  {component: SearchFlowSlide, duration: 400, id: 'SearchFlowSlide'},
  {component: ExtractionBreakdownSlide, duration: 400, id: 'ExtractionBreakdownSlide'},
  {component: ExtractionFrameworkSlide, duration: 400, id: 'ExtractionFrameworkSlide'},
  {component: ExtractionChallengesSlide, duration: 400, id: 'ExtractionChallengesSlide'},
  {component: PapersTimelineOverallSlide, duration: 180, id: 'PapersTimelineOverallSlide'},
  {component: PapersTimelineExcludedOverlaySlide, duration: 240, id: 'PapersTimelineExcludedOverlaySlide'},
  {component: WomenOverlayTimelineSlide, duration: 400, id: 'WomenOverlayTimelineSlide'},
  {component: FifaDisciplineBreakdownSlide, duration: 400, id: 'FifaDisciplineBreakdownSlide'},
  {component: InjuryDefinitionUseSlide, duration: 400, id: 'InjuryDefinitionUseSlide'},
  {component: SexAgeConcentrationSlide, duration: 400, id: 'SexAgeConcentrationSlide'},
  {component: ClosingWhatWeNeedSlide, duration: 240, id: 'ClosingWhatWeNeedSlide'},
  {component: ClosingNextStepsSlide, duration: 220, id: 'ClosingNextStepsSlide'},
  {component: ThankYouSlide, duration: 180, id: 'ThankYouSlide'},
  {component: AppendixSurveillanceProgrammeCountingSlide, duration: 360, id: 'AppendixSurveillanceProgrammeCountingSlide'},
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
