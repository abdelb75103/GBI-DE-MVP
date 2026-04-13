import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { BlueBackgroundShell } from './BlueBackgroundShell';
import { HeaderBrandLockup } from './HeaderBrandLockup';

export const GBIMethodsSlide: React.FC = () => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const colors = {
		textPrimary: '#FFFFFF',
		textDark: '#FFFFFF',
		textMuted: 'rgba(255, 255, 255, 0.72)',
		accentBlue: '#4DA3FF',
		accentLight: 'rgba(77, 163, 255, 0.18)',
		nodeInactive: 'rgba(255, 255, 255, 0.12)',
		nodeActive: '#4DA3FF',
		bayesianTeal: '#8BC4FF',
		cardBg: 'rgba(255, 255, 255, 0.06)',
		cardBorder: 'rgba(255, 255, 255, 0.12)',
	};

	// Animation timings
	const headlineReveal = spring({ frame: frame - 15, fps, config: { damping: 200 } });

	const pipelineStartFrame = 45;
	const delayPerNode = 20;

	const nodes = [
		{ label: 'Search' },
		{ label: 'Screen' },
		{ label: 'Extract' },
		{ label: 'Validate' },
		{ label: 'Model' },
		{ label: 'Update' },
	];

	const bayesianStartFrame = pipelineStartFrame + nodes.length * delayPerNode + 20;

	return (
		<BlueBackgroundShell centerOverlay={<HeaderBrandLockup theme="blue" />} pitchVariant="halfway">
			<AbsoluteFill style={{ padding: '60px 100px', display: 'flex', flexDirection: 'column' }}>
				{/* Headline */}
				<div style={{ 
					marginTop: '20px', 
					opacity: headlineReveal, 
					transform: `translateY(${interpolate(headlineReveal, [0, 1], [30, 0])}px)` 
				}}>
					<h1 style={{ 
						fontSize: '72px', 
						fontWeight: 600, 
						color: colors.textDark, 
						margin: 0, 
						letterSpacing: '-0.02em',
						lineHeight: 1.1
					}}>
						A Living Review, Built As A System
					</h1>
					<p style={{ 
						fontSize: '36px', 
						color: colors.textMuted, 
						marginTop: '24px', 
						fontWeight: 400, 
						maxWidth: '1300px', 
						lineHeight: 1.4 
					}}>
						Structured review methods, centralised data, and Bayesian modelling for a living evidence system.
					</p>
				</div>

				{/* Pipeline Graphic */}
				<div style={{ marginTop: '140px', position: 'relative', width: '100%', display: 'flex', justifyContent: 'space-between' }}>
					{/* Connecting Line (Base) */}
					<div style={{ 
						position: 'absolute', 
						top: '50px', 
						left: '4%', 
						right: '4%', 
						height: '4px', 
						backgroundColor: colors.nodeInactive, 
						zIndex: 0 
					}} />
					
					{/* Active Connecting Line Wipe */}
					<div style={{ 
						position: 'absolute', 
						top: '50px', 
						left: '4%', 
						width: '92%', 
						height: '4px', 
						backgroundColor: colors.nodeActive, 
						zIndex: 0,
						transformOrigin: 'left center',
						transform: `scaleX(${interpolate(frame - pipelineStartFrame, [0, (nodes.length - 1) * delayPerNode], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' })})`
					}} />

					{nodes.map((node, i) => {
						const animDelay = pipelineStartFrame + i * delayPerNode;
						const nodeReveal = spring({ frame: frame - animDelay, fps, config: { damping: 200 } });
						const isModelNode = node.label === 'Model';

						return (
							<div key={node.label} style={{ 
								display: 'flex', 
								flexDirection: 'column', 
								alignItems: 'center', 
								zIndex: 1, 
								opacity: nodeReveal, 
								transform: `scale(${interpolate(nodeReveal, [0, 1], [0.8, 1])})`,
								width: '180px'
							}}>
								<div style={{
									width: '104px', height: '104px', borderRadius: '50%', backgroundColor: 'rgba(255, 255, 255, 0.08)', 
									border: `6px solid ${isModelNode ? colors.bayesianTeal : colors.nodeActive}`, 
									display: 'flex', alignItems: 'center', justifyContent: 'center', 
									boxShadow: '0 14px 32px rgba(0,0,0,0.20)'
								}}>
									<div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: isModelNode ? colors.bayesianTeal : colors.accentLight }} />
								</div>
								<div style={{ 
									marginTop: '32px', 
									fontSize: '32px', 
									fontWeight: 600, 
									color: isModelNode ? colors.bayesianTeal : colors.accentBlue,
									letterSpacing: '-0.01em'
								}}>
									{node.label}
								</div>
							</div>
						);
					})}
				</div>

				{/* Bayesian Enhancements */}
				<div style={{ marginTop: '120px', display: 'flex', justifyContent: 'center' }}>
					<div style={{ 
						display: 'flex', 
						gap: '60px', 
						justifyContent: 'center', 
						width: '100%',
						maxWidth: '1400px'
					}}>
						{[
							{ title: 'Borrowing Strength', text: 'Across sparse subgroups' },
							{ title: 'Subgroup Estimation', text: 'Comparable, updateable evidence' },
							{ title: 'Explicit Uncertainty', text: 'Nuanced statistical interpretation' }
						].map((item, i) => {
							const itemAnim = spring({ frame: frame - (bayesianStartFrame + i * 20), fps, config: { damping: 200 } });
							return (
								<div key={item.title} style={{ 
									flex: 1,
									background: colors.cardBg,
									borderRadius: '16px',
									padding: '40px 36px',
									border: `1px solid ${colors.cardBorder}`,
									borderLeft: `4px solid ${colors.bayesianTeal}`,
									opacity: itemAnim,
									transform: `translateY(${interpolate(itemAnim, [0, 1], [25, 0])}px)`,
									display: 'flex',
									flexDirection: 'column',
									alignItems: 'flex-start'
								}}>
									<div style={{ fontSize: '28px', fontWeight: 700, color: colors.bayesianTeal, marginBottom: '16px', letterSpacing: '-0.01em' }}>
										{item.title}
									</div>
									<div style={{ fontSize: '24px', color: colors.textMuted, lineHeight: 1.5 }}>
										{item.text}
									</div>
								</div>
							);
						})}
					</div>
				</div>
			</AbsoluteFill>
		</BlueBackgroundShell>
	);
};
