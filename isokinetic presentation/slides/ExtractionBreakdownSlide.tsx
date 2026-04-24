import React from 'react';
import { spring, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { BlueBackgroundShell } from './BlueBackgroundShell';
import { HeaderBrandLockup } from './HeaderBrandLockup';
import { PreliminaryDataFooter } from './PreliminaryDataFooter';

const BreakdownCard: React.FC<{
  value: string;
  label: string;
  note?: string;
  reveal: number;
  excluded?: boolean;
  exclusionReveal?: number;
}> = ({ value, label, note, reveal, excluded = false, exclusionReveal = 0 }) => {
  const excludedOpacity = excluded ? interpolate(exclusionReveal, [0, 1], [1, 0.34]) : 1;
  const excludedBorder = excluded
    ? `1px solid rgba(${interpolate(exclusionReveal, [0, 1], [255, 139])}, ${interpolate(exclusionReveal, [0, 1], [255, 193])}, 109, ${interpolate(exclusionReveal, [0, 1], [0.12, 0.45])})`
    : '1px solid rgba(255, 255, 255, 0.12)';

  return (
    <div
      style={{
        backgroundColor: excluded
          ? `rgba(255, 196, 107, ${interpolate(exclusionReveal, [0, 1], [0.08, 0.13])})`
          : 'rgba(255, 255, 255, 0.08)',
        border: excludedBorder,
        borderRadius: '18px',
        padding: '28px 30px 26px',
        boxShadow: '0 18px 40px rgba(0, 0, 0, 0.18)',
        opacity: reveal * excludedOpacity,
        transform: `translateY(${interpolate(reveal, [0, 1], [22, 0])}px) scale(${excluded ? interpolate(exclusionReveal, [0, 1], [1, 0.98]) : 1})`,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        minHeight: '190px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {excluded ? (
        <>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(135deg, rgba(255, 196, 107, 0) 0%, rgba(255, 196, 107, ${interpolate(exclusionReveal, [0, 1], [0, 0.1])}) 100%)`,
              pointerEvents: 'none',
            }}
          />
        </>
      ) : null}
      <div
        style={{
          fontSize: '56px',
          lineHeight: 1,
          fontWeight: 700,
          color: excluded
            ? `rgba(255, 224, 168, ${interpolate(exclusionReveal, [0, 1], [1, 0.95])})`
            : '#4DA3FF',
          letterSpacing: '-0.03em',
          position: 'relative',
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: '26px',
          lineHeight: 1.28,
          fontWeight: 600,
          color: '#FFFFFF',
          letterSpacing: '-0.01em',
          position: 'relative',
        }}
      >
        {label}
      </div>
      {note ? (
        <div
          style={{
            fontSize: '18px',
            lineHeight: 1.35,
            fontWeight: 500,
            color: 'rgba(255, 255, 255, 0.58)',
            position: 'relative',
          }}
        >
          {note}
        </div>
      ) : null}
    </div>
  );
};

export const ExtractionBreakdownSlide: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleReveal = spring({ frame: frame - 12, fps, config: { damping: 16 } });
  const totalReveal = spring({ frame: frame - 32, fps, config: { damping: 16 } });
  const rowOneReveal = spring({ frame: frame - 62, fps, config: { damping: 16 } });
  const rowTwoReveal = spring({ frame: frame - 92, fps, config: { damping: 16 } });
  const exclusionReveal = spring({ frame: frame - 150, fps, config: { damping: 18 } });
  const totalCount = Math.round(interpolate(exclusionReveal, [0, 1], [559, 499]));

  return (
    <BlueBackgroundShell centerOverlay={<HeaderBrandLockup theme="blue" />} pitchVariant="halfway">
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          paddingTop: '34px',
          paddingBottom: '18px',
        }}
      >
        <div
          style={{
            opacity: titleReveal,
            transform: `translateY(${interpolate(titleReveal, [0, 1], [20, 0])}px)`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            textAlign: 'left',
            marginBottom: '28px',
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: '46px',
              lineHeight: 1.08,
              fontWeight: 700,
              color: '#FFFFFF',
              letterSpacing: '-0.03em',
            }}
          >
            Extraction Breakdown
          </h1>
        </div>

        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '26px',
            padding: '0 30px',
            marginTop: '12px',
          }}
        >
          <div
            style={{
              opacity: totalReveal,
              transform: `translateY(${interpolate(totalReveal, [0, 1], [24, 0])}px)`,
              display: 'flex',
              justifyContent: 'center',
              width: '100%',
            }}
          >
            <div
              style={{
                background: 'linear-gradient(180deg, rgba(77, 163, 255, 0.14) 0%, rgba(255, 255, 255, 0.06) 100%)',
                border: '1px solid rgba(255, 255, 255, 0.14)',
                borderRadius: '24px',
                padding: '26px 70px 22px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                minWidth: '520px',
              }}
            >
              <div
                style={{
                  fontSize: '122px',
                  lineHeight: 0.95,
                  fontWeight: 700,
                  color: '#8BC4FF',
                  letterSpacing: '-0.06em',
                  minWidth: '260px',
                  textAlign: 'center',
                }}
              >
                {totalCount}
              </div>
              <div
                style={{
                  fontSize: '30px',
                  fontWeight: 600,
                  color: '#FFFFFF',
                  letterSpacing: '-0.01em',
                }}
              >
                papers in full extraction
              </div>
              <div
                style={{
                  marginTop: '10px',
                  fontSize: '19px',
                  fontWeight: 600,
                  color: `rgba(255, 224, 168, ${interpolate(exclusionReveal, [0, 1], [0, 0.92])})`,
                  letterSpacing: '0.01em',
                  minHeight: '24px',
                }}
              >
                {exclusionReveal > 0.05 ? 'Systematic reviews reused for reference checking' : ''}
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: '22px',
              width: '100%',
              maxWidth: '1560px',
            }}
          >
            <BreakdownCard
              value="60"
              label="Systematic reviews"
              note={exclusionReveal > 0.05 ? 'Reused for reference checking' : undefined}
              reveal={rowOneReveal}
              excluded
              exclusionReveal={exclusionReveal}
            />
            <BreakdownCard value="38" label="UEFA ECIS papers" reveal={rowOneReveal} />
            <BreakdownCard value="84" label="American NCAA-ISP &amp; high-school RIO papers" reveal={rowOneReveal} />
            <BreakdownCard value="11" label="Referee papers" reveal={rowTwoReveal} />
            <BreakdownCard value="10" label="Mental health papers" reveal={rowTwoReveal} />
            <BreakdownCard value="18" label="Papers including illness" reveal={rowTwoReveal} />
          </div>

          <PreliminaryDataFooter />
        </div>
      </div>
    </BlueBackgroundShell>
  );
};
