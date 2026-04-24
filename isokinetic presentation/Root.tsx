import React from 'react';
import { Composition } from 'remotion';
import { TitleSlide } from './slides/TitleSlide';
import { TeamSlide } from './slides/TeamSlide';
import { GBIIntroSlide } from './slides/GBIIntroSlide';
import { GBIMethodsSlide } from './slides/GBIMethodsSlide';
import { GBIBayesianSlide } from './slides/GBIBayesianSlide';
import { GBIEligibilitySlide } from './slides/GBIEligibilitySlide';
import { ProblemFramingSlide } from './slides/ProblemFramingSlide';
import {
	ProblemFramingLiteratureSlide,
	ProblemFramingSurveillanceSlide,
} from './slides/ProblemFramingSlide';
import { SearchFlowSlide } from './slides/SearchFlowSlide';
import { ExtractionBreakdownSlide } from './slides/ExtractionBreakdownSlide';
import { ExtractionChallengesSlide } from './slides/ExtractionChallengesSlide';
import { ExtractionFrameworkSlide } from './slides/ExtractionFrameworkSlide';
import { SexAgeConcentrationSlide } from './slides/SexAgeConcentrationSlide';
import {
	PapersTimelineExcludedOverlaySlide,
	PapersTimelineOverallSlide,
	PapersTimelineSlide,
} from './slides/PapersTimelineSlide';
import { WomenOverlayTimelineSlide } from './slides/WomenOverlayTimelineSlide';
import { WomenOverlayTimelineSlideV2 } from './slides/WomenOverlayTimelineSlideV2';
import { FifaDisciplineBreakdownSlide } from './slides/FifaDisciplineBreakdownSlide';
import { InjuryDefinitionUseSlide } from './slides/InjuryDefinitionUseSlide';
import {
	ClosingActionSlide,
	ClosingNextStepsSlide,
	ClosingWhatWeNeedSlide,
} from './slides/ClosingActionSlide';
import { AppendixSurveillanceProgrammeCountingSlide } from './slides/AppendixSurveillanceProgrammeCountingSlide';
import { ThankYouSlide } from './slides/ThankYouSlide';
import { Deck, DECK_DURATION } from './Deck';
import { BlueBackgroundShell } from './slides/BlueBackgroundShell';

import { WhiteBackgroundShell } from './slides/WhiteBackgroundShell';

export const RemotionRoot: React.FC = () => {
	return (
		<>
			<Composition
				id="TitleSlide"
				component={TitleSlide}
				durationInFrames={150}
				fps={30}
				width={1920}
				height={1080}
			/>
			<Composition
				id="TeamSlide"
				component={TeamSlide}
				durationInFrames={150}
				fps={30}
				width={1920}
				height={1080}
			/>
			<Composition
				id="ProblemFramingSlide"
				component={ProblemFramingSlide}
				durationInFrames={600}
				fps={30}
				width={1920}
				height={1080}
			/>
			<Composition
				id="ProblemFramingSurveillanceSlide"
				component={ProblemFramingSurveillanceSlide}
				durationInFrames={150}
				fps={30}
				width={1920}
				height={1080}
			/>
			<Composition
				id="ProblemFramingLiteratureSlide"
				component={ProblemFramingLiteratureSlide}
				durationInFrames={210}
				fps={30}
				width={1920}
				height={1080}
			/>
			<Composition
				id="GBIIntroSlide"
				component={GBIIntroSlide}
				durationInFrames={350}
				fps={30}
				width={1920}
				height={1080}
			/>
			<Composition
				id="GBIMethodsSlide"
				component={GBIMethodsSlide}
				durationInFrames={400}
				fps={30}
				width={1920}
				height={1080}
			/>
			<Composition
				id="GBIBayesianSlide"
				component={GBIBayesianSlide}
				durationInFrames={400}
				fps={30}
				width={1920}
				height={1080}
			/>
			<Composition
				id="GBIEligibilitySlide"
				component={GBIEligibilitySlide}
				durationInFrames={400}
				fps={30}
				width={1920}
				height={1080}
			/>
			<Composition
				id="SearchFlowSlide"
				component={SearchFlowSlide}
				durationInFrames={400}
				fps={30}
				width={1920}
				height={1080}
			/>
			<Composition
				id="ExtractionBreakdownSlide"
				component={ExtractionBreakdownSlide}
				durationInFrames={400}
				fps={30}
				width={1920}
				height={1080}
			/>
			<Composition
				id="ExtractionFrameworkSlide"
				component={ExtractionFrameworkSlide}
				durationInFrames={400}
				fps={30}
				width={1920}
				height={1080}
			/>
			<Composition
				id="ExtractionChallengesSlide"
				component={ExtractionChallengesSlide}
				durationInFrames={400}
				fps={30}
				width={1920}
				height={1080}
			/>
			<Composition
				id="PapersTimelineSlide"
				component={PapersTimelineSlide}
				durationInFrames={400}
				fps={30}
				width={1920}
				height={1080}
			/>
			<Composition
				id="PapersTimelineOverallSlide"
				component={PapersTimelineOverallSlide}
				durationInFrames={180}
				fps={30}
				width={1920}
				height={1080}
			/>
			<Composition
				id="PapersTimelineExcludedOverlaySlide"
				component={PapersTimelineExcludedOverlaySlide}
				durationInFrames={240}
				fps={30}
				width={1920}
				height={1080}
			/>
			<Composition
				id="WomenOverlayTimelineSlide"
				component={WomenOverlayTimelineSlide}
				durationInFrames={400}
				fps={30}
				width={1920}
				height={1080}
			/>
			<Composition
				id="WomenOverlayTimelineSlideV2"
				component={WomenOverlayTimelineSlideV2}
				durationInFrames={400}
				fps={30}
				width={1920}
				height={1080}
			/>
			<Composition
				id="FifaDisciplineBreakdownSlide"
				component={FifaDisciplineBreakdownSlide}
				durationInFrames={400}
				fps={30}
				width={1920}
				height={1080}
			/>
			<Composition
				id="SexAgeConcentrationSlide"
				component={SexAgeConcentrationSlide}
				durationInFrames={400}
				fps={30}
				width={1920}
				height={1080}
			/>
			<Composition
				id="InjuryDefinitionUseSlide"
				component={InjuryDefinitionUseSlide}
				durationInFrames={400}
				fps={30}
				width={1920}
				height={1080}
			/>
			<Composition
				id="ClosingActionSlide"
				component={ClosingActionSlide}
				durationInFrames={500}
				fps={30}
				width={1920}
				height={1080}
			/>
			<Composition
				id="ClosingWhatWeNeedSlide"
				component={ClosingWhatWeNeedSlide}
				durationInFrames={240}
				fps={30}
				width={1920}
				height={1080}
			/>
			<Composition
				id="ClosingNextStepsSlide"
				component={ClosingNextStepsSlide}
				durationInFrames={220}
				fps={30}
				width={1920}
				height={1080}
			/>
			<Composition
				id="ThankYouSlide"
				component={ThankYouSlide}
				durationInFrames={180}
				fps={30}
				width={1920}
				height={1080}
			/>
			<Composition
				id="AppendixSurveillanceProgrammeCountingSlide"
				component={AppendixSurveillanceProgrammeCountingSlide}
				durationInFrames={360}
				fps={30}
				width={1920}
				height={1080}
			/>
			<Composition
				id="Deck"
				component={Deck}
				durationInFrames={DECK_DURATION}
				fps={30}
				width={1920}
				height={1080}
			/>
			<Composition
				id="BlueBackgroundShell"
				component={BlueBackgroundShell}
				durationInFrames={1}
				fps={30}
				width={1920}
				height={1080}
			/>
			<Composition
				id="WhiteBackgroundShell"
				component={WhiteBackgroundShell}
				durationInFrames={1}
				fps={30}
				width={1920}
				height={1080}
			/>
		</>
	);
};
