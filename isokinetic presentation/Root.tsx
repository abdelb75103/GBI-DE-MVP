import React from 'react';
import { Composition } from 'remotion';
import { TitleSlide } from './slides/TitleSlide';
import { TeamSlide } from './slides/TeamSlide';
import { GBIIntroSlide } from './slides/GBIIntroSlide';
import { GBIMethodsSlide } from './slides/GBIMethodsSlide';
import { GBIBayesianSlide } from './slides/GBIBayesianSlide';
import { GBIEligibilitySlide } from './slides/GBIEligibilitySlide';
import { ProblemFramingSlide } from './slides/ProblemFramingSlide';
import { SearchFlowSlide } from './slides/SearchFlowSlide';
import { ExtractionBreakdownSlide } from './slides/ExtractionBreakdownSlide';
import { ExtractionChallengesSlide } from './slides/ExtractionChallengesSlide';
import { ExtractionFrameworkSlide } from './slides/ExtractionFrameworkSlide';
import { SexAgeConcentrationSlide } from './slides/SexAgeConcentrationSlide';
import { PapersTimelineSlide } from './slides/PapersTimelineSlide';
import { InjuryDefinitionUseSlide } from './slides/InjuryDefinitionUseSlide';
import { ClosingSynthesisSlide } from './slides/ClosingSynthesisSlide';
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
				id="ClosingSynthesisSlide"
				component={ClosingSynthesisSlide}
				durationInFrames={450}
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
