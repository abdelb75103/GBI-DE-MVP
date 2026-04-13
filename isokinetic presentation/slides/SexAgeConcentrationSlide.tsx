import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { BlueBackgroundShell } from './BlueBackgroundShell';
import { HeaderBrandLockup } from './HeaderBrandLockup';
import { sexAgeSlideData, sexAgeSlideMeta } from './generated/sexAgeSlideData';

const COLORS = {
  primary: '#4DA3FF',
  secondary: '#7FBEF4',
  tertiary: '#B4D9F7',
  quaternary: '#D9ECFF',
  muted: 'rgba(255, 255, 255, 0.28)',
  mutedSoft: 'rgba(255, 255, 255, 0.10)',
  text: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.74)',
  textMuted: 'rgba(255, 255, 255, 0.56)',
  ringTrack: 'rgba(255, 255, 255, 0.08)',
};

const SEGMENT_COLORS = [COLORS.primary, COLORS.tertiary, COLORS.secondary, COLORS.quaternary];
const SEGMENTS = sexAgeSlideData.map((segment, index) => ({
  ...segment,
  color: SEGMENT_COLORS[index],
}));

const LegendRow: React.FC<{
  label: string;
  percent: number;
  color: string;
  reveal: number;
}> = ({ label, percent, color, reveal }) => (
  <div
    style={{
      opacity: reveal,
      transform: `translateY(${interpolate(reveal, [0, 1], [18, 0])}px)`,
      display: 'grid',
      gridTemplateColumns: '22px auto 148px',
      gap: '20px',
      alignItems: 'center',
      padding: '22px 0',
      borderBottom: `1px solid ${COLORS.mutedSoft}`,
    }}
  >
    <div
      style={{
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        backgroundColor: color,
        boxShadow: color === COLORS.muted ? 'none' : `0 0 16px ${color}44`,
      }}
    />
    <div
      style={{
        display: 'block',
        minWidth: 'max-content',
      }}
    >
      <div
        style={{
          fontSize: '31px',
          lineHeight: 1.08,
          fontWeight: 650,
          color: COLORS.text,
          letterSpacing: '-0.02em',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </div>
    </div>
    <div
      style={{
        fontSize: '54px',
        lineHeight: 1,
        fontWeight: 700,
        color,
        letterSpacing: '-0.04em',
        minWidth: '132px',
        textAlign: 'right',
        flexShrink: 0,
        whiteSpace: 'nowrap',
      }}
    >
      {percent}%
    </div>
  </div>
);

const DonutChart: React.FC<{
  segmentReveals: number[];
}> = ({ segmentReveals }) => {
  const size = 680;
  const strokeWidth = 58;
  const radius = 208;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: 'translate(56px, -12px) scale(1.04)',
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={COLORS.ringTrack}
          strokeWidth={strokeWidth}
          fill="none"
        />

        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {SEGMENTS.map((segment, index) => {
            const fullLength = circumference * (segment.percent / 100);
            const visibleLength = fullLength * segmentReveals[index];
            const arc = (
              <circle
                key={segment.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={segment.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${visibleLength} ${circumference}`}
                strokeDashoffset={-offset}
                strokeLinecap="round"
                fill="none"
              />
            );
            offset += fullLength;
            return arc;
          })}

          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={COLORS.mutedSoft}
            strokeWidth={strokeWidth}
            strokeDasharray={`${circumference * (sexAgeSlideMeta.hiddenRemainderPct / 100)} ${circumference}`}
            strokeDashoffset={-offset}
            strokeLinecap="round"
            fill="none"
          />
        </g>
      </svg>

      <div
        style={{
          position: 'absolute',
          inset: '0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            fontSize: '64px',
            lineHeight: 0.98,
            fontWeight: 700,
            color: COLORS.text,
            letterSpacing: '-0.04em',
            maxWidth: '280px',
          }}
        >
          499 studies
        </div>
      </div>
    </div>
  );
};

export const SexAgeConcentrationSlide: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleReveal = spring({ frame: frame - 12, fps, config: { damping: 16 } });
  const introReveal = spring({ frame: frame - 34, fps, config: { damping: 16 } });
  const segmentRevealOne = spring({ frame: frame - 54, fps, config: { damping: 16 } });
  const segmentRevealTwo = spring({ frame: frame - 76, fps, config: { damping: 16 } });
  const segmentRevealThree = spring({ frame: frame - 98, fps, config: { damping: 16 } });
  const segmentRevealFour = spring({ frame: frame - 120, fps, config: { damping: 16 } });
  const chartReveal = spring({ frame: frame - 144, fps, config: { damping: 16 } });
  const takeawayReveal = spring({ frame: frame - 170, fps, config: { damping: 16 } });
  const reveals = [segmentRevealOne, segmentRevealTwo, segmentRevealThree, segmentRevealFour];

  return (
    <BlueBackgroundShell centerOverlay={<HeaderBrandLockup theme="blue" />} pitchVariant="box">
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          paddingTop: '52px',
          paddingBottom: '72px',
        }}
      >
        <div
          style={{
            opacity: titleReveal,
            transform: `translateY(${interpolate(titleReveal, [0, 1], [20, 0])}px)`,
            textAlign: 'center',
            marginBottom: '18px',
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: '60px',
              lineHeight: 1.04,
              fontWeight: 700,
              color: COLORS.text,
              letterSpacing: '-0.03em',
            }}
          >
            Distribution Of The Evidence Base
          </h1>
        </div>

        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: '1.08fr 0.92fr',
            gap: '12px',
            alignItems: 'center',
            maxWidth: '1360px',
            margin: '0 auto',
            width: '100%',
            padding: '0 36px',
            transform: 'translateY(-12px)',
          }}
        >
          <div
            style={{
              opacity: introReveal,
              transform: `translateY(${interpolate(introReveal, [0, 1], [18, 0])}px)`,
              paddingRight: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                maxWidth: '720px',
                width: '100%',
              }}
            >
              {SEGMENTS.map((segment, index) => (
                <LegendRow
                  key={segment.label}
                  label={segment.label}
                  percent={segment.percent}
                  color={segment.color}
                  reveal={reveals[index]}
                />
              ))}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-start',
              alignItems: 'flex-start',
              opacity: interpolate(chartReveal, [0, 1], [0.3, 1]),
              transform: `scale(${interpolate(chartReveal, [0, 1], [0.92, 1])})`,
              paddingTop: '4px',
              paddingLeft: '8px',
            }}
          >
            <DonutChart segmentReveals={reveals} />
          </div>
        </div>

        <div
          style={{
            opacity: takeawayReveal,
            transform: `translateY(${interpolate(takeawayReveal, [0, 1], [20, 0])}px)`,
            margin: '0 auto',
            width: 'calc(100% - 64px)',
            maxWidth: '1320px',
            padding: '16px 24px',
            borderRadius: '22px',
            border: `1px solid ${COLORS.mutedSoft}`,
            background: 'rgba(255, 255, 255, 0.08)',
            boxShadow: '0 20px 48px rgba(7, 34, 66, 0.18)',
            textAlign: 'center',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontSize: '30px',
              lineHeight: 1.16,
              fontWeight: 600,
              color: COLORS.text,
              letterSpacing: '-0.02em',
            }}
          >
            Adult men&apos;s football continues to dominate the literature, underlining the need to expand surveillance across women&apos;s and youth cohorts to capture the full landscape of the game.
          </div>
        </div>
      </div>
    </BlueBackgroundShell>
  );
};
