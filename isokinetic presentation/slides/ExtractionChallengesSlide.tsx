import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {BlueBackgroundShell} from './BlueBackgroundShell';
import {HeaderBrandLockup} from './HeaderBrandLockup';

const c = {
  white: '#FFFFFF',
  text: 'rgba(255, 255, 255, 0.88)',
  muted: 'rgba(255, 255, 255, 0.46)',
  accent: '#1EA7F2',
  accentSoft: 'rgba(30, 167, 242, 0.18)',
  accentGlow: 'rgba(30, 167, 242, 0.35)',
  cardBg: 'rgba(255, 255, 255, 0.09)',
  cardBorder: 'rgba(255, 255, 255, 0.16)',
  lineBase: 'rgba(255, 255, 255, 0.08)',
  lineActive: 'rgba(30, 167, 242, 0.45)',
  pillBg: 'rgba(30, 167, 242, 0.14)',
  pillBorder: 'rgba(30, 167, 242, 0.34)',
};

const milestones = [
  {
    year: '2006',
    title: 'Shared Surveillance Language',
    body: 'Football gains a common framework for defining and recording injury.',
  },
  {
    year: '2020',
    title: 'Broader Reporting Framework',
    body: 'IOC guidance and STROBE-SIIS strengthened surveillance design and burden reporting.',
  },
  {
    year: 'Now',
    title: 'Still Not Frictionless',
    body: 'Concepts are clearer, but results are still reported in too many different forms.',
  },
] as const;

/* ── Inline SVG icons (each 64×64 viewBox) ── */

const IconConsensus: React.FC<{color: string}> = ({color}) => (
  <svg viewBox="0 0 64 64" width="72" height="72" fill="none">
    <rect x="14" y="6" width="36" height="46" rx="5" stroke={color} strokeWidth="2.5" />
    <line x1="22" y1="18" x2="42" y2="18" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <line x1="22" y1="26" x2="38" y2="26" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <line x1="22" y1="34" x2="35" y2="34" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <circle cx="44" cy="46" r="12" fill="rgba(30, 167, 242, 0.15)" stroke={color} strokeWidth="2.5" />
    <polyline points="38,46 42,50 50,42" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconFramework: React.FC<{color: string}> = ({color}) => (
  <svg viewBox="0 0 64 64" width="72" height="72" fill="none">
    <circle cx="32" cy="32" r="24" stroke={color} strokeWidth="2.5" />
    <ellipse cx="32" cy="32" rx="12" ry="24" stroke={color} strokeWidth="1.5" />
    <line x1="8" y1="32" x2="56" y2="32" stroke={color} strokeWidth="1.5" />
    <path d="M12 20 Q32 16 52 20" stroke={color} strokeWidth="1.5" fill="none" />
    <path d="M12 44 Q32 48 52 44" stroke={color} strokeWidth="1.5" fill="none" />
    <circle cx="50" cy="14" r="9" fill="rgba(30, 167, 242, 0.15)" stroke={color} strokeWidth="2" />
    <line x1="50" y1="10" x2="50" y2="18" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <line x1="46" y1="14" x2="54" y2="14" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const IconFriction: React.FC<{color: string}> = ({color}) => (
  <svg viewBox="0 0 64 64" width="72" height="72" fill="none">
    <circle cx="32" cy="32" r="24" stroke={color} strokeWidth="2.5" />
    <circle cx="32" cy="32" r="4" fill={color} opacity="0.35" />
    <line x1="32" y1="28" x2="32" y2="14" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    <polyline points="28,18 32,14 36,18" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="28.5" y1="30" x2="17" y2="42" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    <polyline points="17,37 17,42 22,42" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="35.5" y1="30" x2="47" y2="42" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    <polyline points="42,42 47,42 47,37" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const icons = [IconConsensus, IconFramework, IconFriction];

export const ExtractionChallengesSlide: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const seconds = (value: number) => value * fps;
  /* ── Staggered reveals ── */
  const ms0 = spring({frame: frame - seconds(0.65), fps, config: {damping: 18}});
  const ms1 = spring({frame: frame - seconds(1.05), fps, config: {damping: 18}});
  const ms2 = spring({frame: frame - seconds(1.45), fps, config: {damping: 18}});
  const msReveals = [ms0, ms1, ms2];

  /* Line segments between nodes */
  const line1 = interpolate(frame, [seconds(0.65), seconds(1.3)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const line2 = interpolate(frame, [seconds(1.3), seconds(1.95)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  /* Title heading */
  const titleReveal = spring({frame: frame - seconds(0.25), fps, config: {damping: 18}});

  /* Pill fades in last */
  const pillReveal = spring({frame: frame - seconds(2.2), fps, config: {damping: 18}});

  const circleSize = 132;
  const dotSize = 20;
  const lineGlowStrength = 0.3;
  const pillGlowStrength = 0.25;
  const getHaloScale = (_index: number) => 1;
  const getDotScale = (_index: number) => 1;

  return (
    <BlueBackgroundShell
      centerOverlay={<HeaderBrandLockup theme="blue" />}
      pitchVariant="halfway"
    >
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: '28px 52px 36px',
        }}
      >
        {/* ── Heading ── */}
        <div
          style={{
            opacity: titleReveal,
            transform: `translateY(${interpolate(titleReveal, [0, 1], [18, 0])}px)`,
            paddingTop: 14,
            paddingBottom: 16,
            textAlign: 'center',
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: '46px',
              lineHeight: 1.1,
              fontWeight: 700,
              color: c.white,
              letterSpacing: '-0.03em',
            }}
          >
            Consensus Improved Direction.
            <br />
            Comparable Reporting Still Lags Behind.
          </h1>
        </div>

        {/* ── Timeline section — vertically centered in remaining space ── */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            paddingTop: 56,
            gap: 30,
          }}
        >
          {/* Icon row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '62px',
            }}
          >
            {milestones.map((ms, i) => {
              const reveal = msReveals[i];
              const Icon = icons[i];
              const haloScale = getHaloScale(i);

              return (
                <div
                  key={ms.year}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    opacity: reveal,
                    transform: `translateY(${interpolate(reveal, [0, 1], [40, 0])}px) scale(${interpolate(
                      reveal,
                      [0, 1],
                      [0.92, 1],
                    )})`,
                  }}
                >
                  <div
                    style={{
                      position: 'relative',
                      width: circleSize,
                      height: circleSize,
                      borderRadius: '50%',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      border: `3px solid ${c.accent}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: `0 0 0 10px ${c.accentSoft}, 0 20px 48px rgba(0, 0, 0, 0.3)`,
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        inset: -12,
                        borderRadius: '50%',
                        border: `1px solid rgba(30, 167, 242, 0.35)`,
                        opacity: interpolate(reveal, [0, 1], [0, 0.55]),
                        transform: `scale(${haloScale})`,
                      }}
                    />
                    <Icon color={c.accent} />
                  </div>

                  <div
                    style={{
                      marginTop: 20,
                      fontSize: '18px',
                      fontWeight: 800,
                      color: c.accent,
                      letterSpacing: '0.16em',
                      textTransform: 'uppercase',
                      textShadow: '0 0 18px rgba(30, 167, 242, 0.35)',
                    }}
                  >
                    {ms.year}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Connecting timeline bar with dots */}
          <div
            style={{
              position: 'relative',
              height: 56,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {/* Base line */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: 'calc(100% / 6)',
                right: 'calc(100% / 6)',
                height: 4,
                backgroundColor: c.lineBase,
                transform: 'translateY(-50%)',
              }}
            />

            {/* Active line segment 1 */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: 'calc(100% / 6)',
                width: 'calc(100% / 3)',
                height: 4,
                transform: 'translateY(-50%)',
                transformOrigin: 'left center',
                backgroundColor: c.lineActive,
                clipPath: `inset(0 ${(1 - line1) * 100}% 0 0)`,
                boxShadow: `0 0 18px rgba(30, 167, 242, ${lineGlowStrength})`,
              }}
            />

            {/* Active line segment 2 */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: 'calc(100% / 6 + 100% / 3)',
                width: 'calc(100% / 3)',
                height: 4,
                transform: 'translateY(-50%)',
                transformOrigin: 'left center',
                backgroundColor: c.lineActive,
                clipPath: `inset(0 ${(1 - line2) * 100}% 0 0)`,
                boxShadow: `0 0 18px rgba(30, 167, 242, ${lineGlowStrength})`,
              }}
            />

            {/* Dots */}
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: `calc(100% / 6 + ${i} * 100% / 3)`,
                  transform: `translate(-50%, -50%) scale(${getDotScale(i)})`,
                  width: dotSize,
                  height: dotSize,
                  borderRadius: '50%',
                  backgroundColor: c.accent,
                  boxShadow: `0 0 0 5px ${c.accentSoft}, 0 0 16px ${c.accentGlow}`,
                  opacity: msReveals[i],
                }}
              />
            ))}

            {/* Arrow chevrons */}
            {[0, 1].map((i) => {
              const chevronReveal = i === 0 ? line1 : line2;
              return (
                <div
                  key={`chevron-${i}`}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: `calc(100% / 6 + ${i} * 100% / 3 + 100% / 6)`,
                    transform: 'translate(-50%, -50%)',
                    opacity: chevronReveal * 0.5,
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <polyline
                      points="6,4 14,10 6,16"
                      stroke={c.accent}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              );
            })}
          </div>

          {/* Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '52px',
            }}
          >
            {milestones.map((ms, i) => {
              const reveal = msReveals[i];

              return (
                <div
                  key={`card-${ms.year}`}
                  style={{
                    opacity: reveal,
                    transform: `translateY(${interpolate(reveal, [0, 1], [24, 0])}px)`,
                    background: c.cardBg,
                    border: `1px solid ${c.cardBorder}`,
                    borderRadius: '22px',
                    padding: '34px 32px 38px',
                    minHeight: 174,
                    textAlign: 'center',
                    boxShadow: '0 14px 34px rgba(0, 0, 0, 0.22)',
                  }}
                >
                  <div
                    style={{
                      fontSize: '28px',
                      lineHeight: 1.16,
                      fontWeight: 750,
                      letterSpacing: '-0.02em',
                      color: c.white,
                      marginBottom: 16,
                    }}
                  >
                    {ms.title}
                  </div>
                  <div
                    style={{
                      fontSize: '20px',
                      lineHeight: 1.38,
                      fontWeight: 600,
                      color: c.text,
                    }}
                  >
                    {ms.body}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Takeaway pill ── */}
          <div
            style={{
              opacity: pillReveal,
              transform: `translateY(${interpolate(
                pillReveal,
                [0, 1],
                [18, 0],
              )}px)`,
              display: 'flex',
              justifyContent: 'center',
              paddingTop: 12,
            }}
          >
            <div
              style={{
                background: c.pillBg,
                border: `1px solid ${c.pillBorder}`,
                borderRadius: '999px',
                padding: '18px 54px',
                boxShadow: `0 8px 28px rgba(0, 0, 0, 0.16), 0 0 26px rgba(30, 167, 242, ${pillGlowStrength})`,
              }}
            >
              <div
                style={{
                  fontSize: '28px',
                  lineHeight: 1.22,
                  fontWeight: 650,
                  color: c.white,
                  letterSpacing: '-0.01em',
                  textAlign: 'center',
                }}
              >
                Building a global picture still depends on post hoc harmonisation of how studies report results.
              </div>
            </div>
          </div>
        </div>
      </div>
    </BlueBackgroundShell>
  );
};
