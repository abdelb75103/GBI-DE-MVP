import React from 'react';
import { useCurrentFrame, useVideoConfig, spring } from 'remotion';
import { BlueBackgroundShell } from './BlueBackgroundShell';
import { HeaderBrandLockup } from './HeaderBrandLockup';

export const GBIBayesianSlide: React.FC = () => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const colors = {
		textPrimary: '#FFFFFF',
		textSecondary: '#A9C2D4',
		fifaBlue: '#4DA3FF',
		fifaBlueDeep: '#8BC4FF',
		fifaBlueTint: 'rgba(77, 163, 255, 0.12)',
		rule: 'rgba(255, 255, 255, 0.14)',
		cardBg: 'rgba(255, 255, 255, 0.08)',
		cardBorder: 'rgba(255, 255, 255, 0.12)',
		pipelineBg: 'rgba(255, 255, 255, 0.92)',
		pipelineText: '#0E2231',
	};

	// Animation Timings mapping to click/speech cues
	const tHeadline = spring({ frame: frame - 15, fps, config: { damping: 22, stiffness: 120 } });
	const tPipeline1 = spring({ frame: frame - 45, fps, config: { damping: 22, stiffness: 120 } });
	const tPipeline2 = spring({ frame: frame - 60, fps, config: { damping: 22, stiffness: 120 } });
	const tPipeline3 = spring({ frame: frame - 75, fps, config: { damping: 22, stiffness: 120 } });
	const tPipeline4 = spring({ frame: frame - 90, fps, config: { damping: 22, stiffness: 120 } });
	const tModelling = spring({ frame: frame - 130, fps, config: { damping: 22, stiffness: 120 } });
	
	const tPrior = spring({ frame: frame - 170, fps, config: { damping: 22, stiffness: 120 } });
	const tNewEvidence = spring({ frame: frame - 210, fps, config: { damping: 22, stiffness: 120 } });
	const tPosterior = spring({ frame: frame - 250, fps, config: { damping: 22, stiffness: 120 } });

	const tTakeaway1 = spring({ frame: frame - 300, fps, config: { damping: 22, stiffness: 120 } });
	const tTakeaway2 = spring({ frame: frame - 320, fps, config: { damping: 22, stiffness: 120 } });
	const tTakeaway3 = spring({ frame: frame - 340, fps, config: { damping: 22, stiffness: 120 } });
	
	const pipelineItemStyle = (animVal: number): React.CSSProperties => ({
		padding: '18px 28px',
		backgroundColor: colors.pipelineBg,
		border: `2px solid rgba(0,0,0,0.05)`,
		borderRadius: '14px',
		fontWeight: 600,
		fontSize: '24px',
		color: colors.pipelineText,
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		opacity: animVal,
		transform: `translateX(${(1 - animVal) * -20}px)`,
		boxShadow: '0 12px 24px -4px rgba(0, 0, 0, 0.15)',
		width: '200px',
	});

	const cardStyle = (animVal: number): React.CSSProperties => ({
		flex: 1,
		backgroundColor: colors.cardBg,
		border: `1px solid ${colors.cardBorder}`,
		borderTop: `5px solid ${colors.fifaBlueDeep}`,
		borderRadius: '14px',
		padding: '28px 32px',
		boxShadow: '0 18px 32px -16px rgba(0, 0, 0, 0.4)',
		opacity: animVal,
		transform: `translateY(${(1 - animVal) * 30}px)`,
		display: 'flex',
		flexDirection: 'column',
		gap: '12px'
	});

	return (
		<BlueBackgroundShell centerOverlay={<HeaderBrandLockup theme="blue" />} pitchVariant="box">
			<div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
				{/* Top Structure */}
				<div style={{ marginTop: '20px', opacity: tHeadline, transform: `translateY(${(1 - tHeadline) * 20}px)` }}>
					<h1 style={{
						fontSize: '56px',
						fontWeight: 700,
						color: colors.textPrimary,
						letterSpacing: '-0.02em',
						margin: '0 0 12px 0'
					}}>
						Why A Bayesian Approach?
					</h1>
					<div style={{
						fontSize: '28px',
						color: colors.fifaBlueDeep,
						fontWeight: 500,
					}}>
						A statistical framework for continuously updating football health evidence.
					</div>
				</div>

				<div style={{
					display: 'flex',
					flex: 1,
					marginTop: '20px',
					gap: '48px',
					alignItems: 'center'
				}}>
					
					{/* Left: Review Pipeline -> Modelling */}
					<div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '24px' }}>
						<div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
							<div style={pipelineItemStyle(tPipeline1)}>Search</div>
							<div style={pipelineItemStyle(tPipeline2)}>Screen</div>
							<div style={pipelineItemStyle(tPipeline3)}>Extract</div>
							<div style={pipelineItemStyle(tPipeline4)}>Validate</div>
						</div>
						
						{/* Arrow linking to modelling */}
						<div style={{ opacity: tModelling, transform: `translateX(${(1 - tModelling) * -10}px)` }}>
							<svg width="48" height="32" viewBox="0 0 48 32" fill="none">
								<path d="M0 16h44M28 2l16 14-16 14" stroke={colors.rule} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
							</svg>
						</div>

						{/* Modelling Node */}
						<div style={{
							...pipelineItemStyle(tModelling),
							backgroundColor: colors.fifaBlueTint,
							border: `3px solid ${colors.fifaBlue}`,
							color: colors.textPrimary,
							height: '300px',
							width: '240px',
							fontSize: '36px',
							fontWeight: 700,
							boxShadow: `0 24px 48px rgba(0, 0, 0, 0.25)`
						}}>
							Modelling
						</div>
					</div>

					{/* Center/Right Hero: Bayesian Visual */}
					<div style={{
						flex: 1,
						position: 'relative',
						height: '440px',
						borderLeft: `2px solid ${colors.rule}`,
						paddingLeft: '40px',
					}}>
						<svg width="100%" height="100%" viewBox="0 -50 1020 570" style={{ overflow: 'visible' }}>
							
							{/* X-axis base */}
							<line x1="10" y1="470" x2="1010" y2="470" stroke={colors.rule} strokeWidth="4" strokeLinecap="round" />
							
							{/* Prior Curve  -  broad, diffuse, right-skewed */}
							<g style={{ opacity: tPrior, transform: `translateY(${(1 - tPrior) * -10}px)` }}>
								<path
									d="M 10 470 C 60 470, 100 340, 160 270 C 200 225, 210 225, 230 240 C 280 280, 350 420, 460 470"
									fill="rgba(255, 255, 255, 0.04)"
									stroke={colors.textSecondary}
									strokeWidth="5"
									strokeDasharray="12 12"
								/>
								<line x1="205" y1="225" x2="205" y2="155" stroke={colors.textSecondary} strokeWidth="2.5" strokeDasharray="5 5" />
								<text x="205" y="125" fill={colors.textSecondary} fontSize="28" fontWeight="600" textAnchor="middle">Prior understanding</text>
							</g>

							{/* New Evidence Curve  -  narrower, slightly left-skewed */}
							<g style={{ opacity: tNewEvidence, transform: `translateY(${(1 - tNewEvidence) * -20}px)` }}>
								<path
									d="M 690 470 C 730 470, 770 340, 800 220 C 815 170, 830 165, 845 180 C 870 210, 900 370, 960 470"
									fill="rgba(77, 163, 255, 0.12)"
									stroke={colors.fifaBlue}
									strokeWidth="5"
								/>
								<line x1="835" y1="165" x2="835" y2="95" stroke={colors.fifaBlue} strokeWidth="2.5" strokeDasharray="5 5" />
								<text x="835" y="65" fill={colors.fifaBlue} fontSize="28" fontWeight="600" textAnchor="middle">New data</text>
							</g>

							{/* Updated Posterior Curve  -  between both, slightly right-skewed, not symmetric */}
							<g style={{ opacity: tPosterior, transform: `translateY(${(1 - tPosterior) * 20}px)` }}>
								<path
									d="M 400 470 C 440 470, 490 280, 540 110 C 560 55, 575 48, 590 60 C 620 90, 670 320, 750 470"
									fill="rgba(139, 196, 255, 0.22)"
									stroke={colors.textPrimary}
									strokeWidth="6"
								/>
								<line x1="580" y1="48" x2="580" y2="-22" stroke={colors.textPrimary} strokeWidth="2.5" strokeDasharray="5 5" />
								<text x="580" y="-50" fill={colors.textPrimary} fontSize="34" fontWeight="700" textAnchor="middle">Updated posterior</text>
							</g>
						</svg>
					</div>

				</div>

				{/* Bottom Area: 3 Cards */}
				<div style={{ display: 'flex', gap: '32px', marginTop: 'auto', paddingTop: '16px', marginBottom: '12px' }}>
					<div style={cardStyle(tTakeaway1)}>
						<div style={{ fontSize: '26px', fontWeight: 700, color: colors.fifaBlueDeep, letterSpacing: '-0.01em' }}>
							Updates as evidence grows
						</div>
						<div style={{ fontSize: '22px', color: colors.textSecondary, lineHeight: 1.45 }}>
							A living review that updates as new data enter the system.
						</div>
					</div>
					
					<div style={cardStyle(tTakeaway2)}>
						<div style={{ fontSize: '26px', fontWeight: 700, color: colors.fifaBlueDeep, letterSpacing: '-0.01em' }}>
							Useful for sparse groups
						</div>
						<div style={{ fontSize: '22px', color: colors.textSecondary, lineHeight: 1.45 }}>
							Borrows strength across related subgroups to improve stability.
						</div>
					</div>

					<div style={cardStyle(tTakeaway3)}>
						<div style={{ fontSize: '26px', fontWeight: 700, color: colors.fifaBlueDeep, letterSpacing: '-0.01em' }}>
							Explicit uncertainty
						</div>
						<div style={{ fontSize: '22px', color: colors.textSecondary, lineHeight: 1.45 }}>
							Makes uncertainty visible, especially where evidence is sparse.
						</div>
					</div>
				</div>

			</div>
		</BlueBackgroundShell>
	);
};
