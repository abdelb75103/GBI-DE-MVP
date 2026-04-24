import React from 'react';
import {Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {BlueBackgroundShell} from './BlueBackgroundShell';
import {HeaderBrandLockup} from './HeaderBrandLockup';
import {PreliminaryDataFooter} from './PreliminaryDataFooter';
import {injuryDefinitionAnalysis} from './generated/injuryDefinitionAnalysis';

const COLORS = {
  primary: '#4DA3FF',
  secondary: '#7FBEF4',
  tertiary: '#B4D9F7',
  quaternary: '#D9ECFF',
  text: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.74)',
  textMuted: 'rgba(255, 255, 255, 0.56)',
  mutedSoft: 'rgba(255, 255, 255, 0.10)',
  barTrack: 'rgba(255, 255, 255, 0.08)',
  pillBg: 'rgba(77, 163, 255, 0.12)',
  pillBorder: 'rgba(77, 163, 255, 0.32)',
};

const SEGMENTS = [
  {
    label: 'Time-loss',
    percent: injuryDefinitionAnalysis.keyFigures.timeLoss.pctAllPapers,
    color: COLORS.primary,
  },
  {
    label: 'Medical attention',
    percent: injuryDefinitionAnalysis.keyFigures.medicalAttention.pctAllPapers,
    color: COLORS.secondary,
  },
  {
    label: 'Physical complaint',
    percent: injuryDefinitionAnalysis.keyFigures.physicalComplaint.pctAllPapers,
    color: COLORS.tertiary,
  },
] as const;

const SegmentRow: React.FC<{
  label: string;
  percent: number;
  color: string;
  reveal: number;
  barReveal: number;
}> = ({label, percent, color, reveal, barReveal}) => {
  const barHeight = 72;

  return (
    <div
      style={{
        opacity: reveal,
        transform: `translateY(${interpolate(reveal, [0, 1], [18, 0])}px)`,
        display: 'grid',
        gridTemplateColumns: '540px minmax(0, 1fr)',
        gap: 42,
        alignItems: 'center',
        minHeight: 154,
        padding: '8px 0 14px',
        borderBottom: `1px solid ${COLORS.mutedSoft}`,
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '24px minmax(0, 1fr) 170px',
          gap: 22,
          alignItems: 'center',
          paddingRight: 20,
        }}
      >
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            backgroundColor: color,
            boxShadow: `0 0 16px ${color}44`,
          }}
        />
        <div
          style={{
            fontSize: 30,
            lineHeight: 1.08,
            fontWeight: 650,
            color: COLORS.text,
            letterSpacing: '-0.02em',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 58,
            lineHeight: 1,
            fontWeight: 700,
            color,
            letterSpacing: '-0.04em',
            minWidth: 170,
            textAlign: 'right',
            whiteSpace: 'nowrap',
          }}
        >
          {percent}%
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 14,
          minWidth: 0,
        }}
      >
        <div
          style={{
            fontSize: 24,
            lineHeight: 1,
            fontWeight: 650,
            color,
            letterSpacing: '-0.02em',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </div>
        <div
          style={{
            position: 'relative',
            height: barHeight,
            borderRadius: 999,
            background: COLORS.barTrack,
            overflow: 'hidden',
            width: '100%',
          }}
        >
          <div
            style={{
              width: `${percent * barReveal}%`,
              height: '100%',
              borderRadius: 999,
              background: color,
              boxShadow: `0 0 28px ${color}44`,
            }}
          />
        </div>
      </div>
    </div>
  );
};

const TakeawayPanel: React.FC<{
  reveal: number;
}> = ({reveal}) => (
  <div
    style={{
      opacity: reveal,
      transform: `translateY(${interpolate(reveal, [0, 1], [42, 0])}px)`,
      display: 'flex',
      justifyContent: 'center',
      width: '100%',
      paddingTop: 132,
    }}
  >
    <div
      style={{
        padding: '18px 60px',
        borderRadius: 999,
        background: COLORS.pillBg,
        border: `1px solid ${COLORS.pillBorder}`,
        boxShadow: '0 8px 28px rgba(0, 0, 0, 0.16), 0 0 26px rgba(77, 163, 255, 0.22)',
      }}
    >
      <div
        style={{
          fontSize: 30,
          lineHeight: 1.22,
          fontWeight: 650,
          color: COLORS.text,
          letterSpacing: '-0.01em',
          textAlign: 'center',
        }}
      >
        Time-loss definitions account for more than two-thirds of extracted studies.
      </div>
    </div>
  </div>
);

export const InjuryDefinitionUseSlide: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const titleReveal = spring({frame: frame - 14, fps, config: {damping: 16}});
  const revealOne = spring({frame: frame - 48, fps, config: {damping: 16}});
  const revealTwo = spring({frame: frame - 68, fps, config: {damping: 16}});
  const revealThree = spring({frame: frame - 88, fps, config: {damping: 16}});
  const reveals = [revealOne, revealTwo, revealThree];

  const barOne = interpolate(frame, [58, 100], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.2, 0.9, 0.2, 1),
  });
  const barTwo = interpolate(frame, [78, 120], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.2, 0.9, 0.2, 1),
  });
  const barThree = interpolate(frame, [98, 140], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.2, 0.9, 0.2, 1),
  });
  const barReveals = [barOne, barTwo, barThree];

  const keyPointReveal = spring({frame: frame - 108, fps, config: {damping: 16}});

  return (
    <BlueBackgroundShell centerOverlay={<HeaderBrandLockup theme="blue" />} pitchVariant="halfway">
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          paddingTop: 62,
          paddingBottom: 18,
        }}
      >
        <div
          style={{
            opacity: titleReveal,
            transform: `translateY(${interpolate(titleReveal, [0, 1], [20, 0])}px)`,
            textAlign: 'center',
            marginBottom: 34,
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: 60,
              lineHeight: 1.04,
              fontWeight: 700,
              color: COLORS.text,
              letterSpacing: '-0.03em',
            }}
          >
            Injury Definition Use Across The Dataset
          </h1>
          <p
            style={{
              margin: '14px auto 0',
              fontSize: 22,
              lineHeight: 1.35,
              fontWeight: 500,
              color: COLORS.textSecondary,
              maxWidth: 1100,
            }}
          >
            Classification of {injuryDefinitionAnalysis.paperCount} papers by primary injury definition
          </p>
        </div>

        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            gap: 0,
            maxWidth: 1480,
            margin: '0 auto',
            width: '100%',
            padding: '34px 32px 0',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              width: '100%',
              flex: 1,
            }}
          >
            <div
              style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}
            >
              {SEGMENTS.map((segment, index) => (
                <SegmentRow
                  key={segment.label}
                  label={segment.label}
                  percent={segment.percent}
                  color={segment.color}
                  reveal={reveals[index]}
                  barReveal={barReveals[index]}
                />
              ))}
            </div>
          </div>

          <TakeawayPanel reveal={keyPointReveal} />
        </div>
        <PreliminaryDataFooter />
      </div>
    </BlueBackgroundShell>
  );
};
