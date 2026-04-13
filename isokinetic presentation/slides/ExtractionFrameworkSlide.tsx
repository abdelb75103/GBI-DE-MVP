import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { BlueBackgroundShell } from './BlueBackgroundShell';
import { HeaderBrandLockup } from './HeaderBrandLockup';

const formatNumber = (value: number) =>
  new Intl.NumberFormat('en-IE').format(value);

const EXTRACTION_TABS = [
  { name: 'Study Details', width: '100%' },
  { name: 'Participants', width: '92%' },
  { name: 'Definitions', width: '84%' },
  { name: 'Exposure', width: '76%' },
  { name: 'Injury Outcome', width: '100%' },
  { name: 'Illness Outcome', width: '94%' },
  { name: 'Injury Tissue Type', width: '88%' },
  { name: 'Injury Location', width: '80%' },
  { name: 'Illness Region', width: '74%' },
  { name: 'Illness Etiology', width: '90%' },
];

const ACCENT_TILES = new Set([0, 3, 7, 12, 17]);

const PaperTile: React.FC<{ accent?: boolean; opacity?: number }> = ({
  accent = false,
  opacity = 1,
}) => (
  <div
    style={{
      width: '100%',
      aspectRatio: '4 / 5',
      borderRadius: '10px',
      background: accent
        ? 'linear-gradient(180deg, rgba(30, 167, 242, 0.24) 0%, rgba(30, 167, 242, 0.10) 100%)'
        : 'rgba(255, 255, 255, 0.06)',
      border: accent
        ? '1.5px solid rgba(30, 167, 242, 0.40)'
        : '1px solid rgba(255, 255, 255, 0.10)',
      boxShadow: accent
        ? '0 8px 20px rgba(0, 0, 0, 0.16)'
        : '0 4px 12px rgba(0, 0, 0, 0.08)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '16% 14%',
      opacity,
    }}
  >
    <div
      style={{
        width: '36%',
        height: '5%',
        borderRadius: 999,
        backgroundColor: accent
          ? 'rgba(30, 167, 242, 0.90)'
          : 'rgba(255, 255, 255, 0.28)',
      }}
    />
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10%' }}>
      {[0, 1, 2].map((line) => (
        <div
          key={line}
          style={{
            width: line === 1 ? '65%' : '100%',
            height: '5%',
            borderRadius: 999,
            backgroundColor: accent
              ? 'rgba(30, 167, 242, 0.26)'
              : 'rgba(255, 255, 255, 0.09)',
          }}
        />
      ))}
    </div>
  </div>
);

export const ExtractionFrameworkSlide: React.FC = () => {
  const bodyOffset = 96;
  const mainContentLift = 57;
  const takeawayDrop = 57;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleReveal = spring({ frame: frame - 10, fps, config: { damping: 18 } });
  const leftReveal = spring({ frame: frame - 28, fps, config: { damping: 16 } });
  const arrow1Reveal = spring({ frame: frame - 50, fps, config: { damping: 18 } });
  const centerReveal = spring({ frame: frame - 54, fps, config: { damping: 16 } });
  const arrow2Reveal = spring({ frame: frame - 76, fps, config: { damping: 18 } });
  const rightReveal = spring({ frame: frame - 80, fps, config: { damping: 16 } });
  const takeawayReveal = spring({ frame: frame - 118, fps, config: { damping: 18 } });

  const fieldsCount = Math.max(
    1,
    Math.floor(
      interpolate(frame, [54, 88], [1, 448], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      }),
    ),
  );

  const totalPoints = Math.max(
    0,
    Math.floor(
      interpolate(frame, [80, 118], [0, 223552], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      }),
    ),
  );

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
          paddingTop: '14px',
          paddingBottom: '0px',
        }}
      >
        {/* Title */}
        <h1
          style={{
            margin: 0,
            fontSize: '50px',
            lineHeight: 1.08,
            fontWeight: 700,
            color: '#FFFFFF',
            letterSpacing: '-0.03em',
            textAlign: 'center',
            opacity: titleReveal,
            transform: `translateY(${interpolate(titleReveal, [0, 1], [14, 0])}px)`,
            flexShrink: 0,
            marginBottom: `${10 + bodyOffset}px`,
          }}
        >
          499 Papers, One Common Language
        </h1>

        {/* ─── Main composition — three columns stretching full height ─── */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'stretch',
            minHeight: 0,
            marginTop: `-${mainContentLift}px`,
          }}
        >
          {/* ── Column 1: Papers ── */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              opacity: leftReveal,
              transform: `translateY(${interpolate(leftReveal, [0, 1], [20, 0])}px)`,
            }}
          >
            <div
              style={{
                fontSize: '15px',
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'rgba(255, 255, 255, 0.45)',
                marginBottom: '8px',
              }}
            >
              Across The Dataset
            </div>
            <div
              style={{
                fontSize: '120px',
                lineHeight: 0.88,
                fontWeight: 700,
                color: '#FFFFFF',
                letterSpacing: '-0.05em',
              }}
            >
              499
            </div>
            <div
              style={{
                fontSize: '22px',
                fontWeight: 600,
                color: 'rgba(255, 255, 255, 0.58)',
                marginTop: '6px',
                marginBottom: '18px',
              }}
            >
              papers in full extraction
            </div>

            {/* Paper tile grid — fills remaining height */}
            <div
              style={{
                flex: 1,
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '8px',
                alignContent: 'center',
                width: '100%',
                maxWidth: '320px',
                padding: '0 8px',
              }}
            >
              {Array.from({ length: 20 }).map((_, i) => {
                const row = Math.floor(i / 4);
                const rowReveal = spring({
                  frame: frame - (32 + row * 5),
                  fps,
                  config: { damping: 16 },
                });
                return (
                  <div
                    key={i}
                    style={{
                      opacity: rowReveal,
                      transform: `translateY(${interpolate(rowReveal, [0, 1], [8, 0])}px)`,
                    }}
                  >
                    <PaperTile
                      accent={ACCENT_TILES.has(i)}
                      opacity={row < 2 ? 0.95 : row < 4 ? 0.72 : 0.50}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Flow: multiply ── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0 16px',
              marginTop: '60px',
              alignSelf: 'flex-start',
              height: '140px',
              opacity: arrow1Reveal,
              transform: `scale(${interpolate(arrow1Reveal, [0, 1], [0.4, 1])})`,
            }}
          >
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                backgroundColor: 'rgba(30, 167, 242, 0.08)',
                border: '1.5px solid rgba(30, 167, 242, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '26px',
                fontWeight: 700,
                color: 'rgba(30, 167, 242, 0.60)',
              }}
            >
              x
            </div>
          </div>

          {/* ── Column 2: Framework ── */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              opacity: centerReveal,
              transform: `translateY(${interpolate(centerReveal, [0, 1], [20, 0])}px)`,
            }}
          >
            <div
              style={{
                fontSize: '15px',
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'rgba(30, 167, 242, 0.55)',
                marginBottom: '8px',
              }}
            >
              Per Paper
            </div>
            <div
              style={{
                fontSize: '120px',
                lineHeight: 0.88,
                fontWeight: 700,
                color: '#1EA7F2',
                letterSpacing: '-0.05em',
              }}
            >
              {fieldsCount}
            </div>
            <div
              style={{
                fontSize: '22px',
                fontWeight: 600,
                color: 'rgba(255, 255, 255, 0.58)',
                marginTop: '6px',
                marginBottom: '18px',
              }}
            >
              extraction fields
            </div>

            {/* Tab bars — fills remaining height */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: '7px',
                width: '100%',
                maxWidth: '300px',
              }}
            >
              {EXTRACTION_TABS.map((tab, i) => {
                const tabReveal = spring({
                  frame: frame - (58 + i * 3),
                  fps,
                  config: { damping: 16 },
                });
                return (
                  <div
                    key={tab.name}
                    style={{
                      width: tab.width,
                      height: '38px',
                      borderRadius: '8px',
                      background: `linear-gradient(90deg, rgba(30, 167, 242, ${0.12 + i * 0.006}) 0%, rgba(30, 167, 242, 0.04) 100%)`,
                      border: '1px solid rgba(30, 167, 242, 0.14)',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0 14px',
                      fontSize: '13px',
                      fontWeight: 600,
                      color:
                        i === 0 || i === 4 || i === 5
                          ? 'rgba(255, 255, 255, 0.65)'
                          : 'rgba(255, 255, 255, 0.48)',
                      letterSpacing: '0.01em',
                      opacity: tabReveal,
                      transform: `translateX(${interpolate(tabReveal, [0, 1], [-12, 0])}px)`,
                    }}
                  >
                    {tab.name}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Flow: equals ── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0 16px',
              marginTop: '60px',
              alignSelf: 'flex-start',
              height: '140px',
              opacity: arrow2Reveal,
              transform: `scale(${interpolate(arrow2Reveal, [0, 1], [0.4, 1])})`,
            }}
          >
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                backgroundColor: 'rgba(139, 196, 255, 0.08)',
                border: '1.5px solid rgba(139, 196, 255, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '26px',
                fontWeight: 700,
                color: 'rgba(139, 196, 255, 0.60)',
              }}
            >
              =
            </div>
          </div>

          {/* ── Column 3: Data output ── */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              opacity: rightReveal,
              transform: `translateY(${interpolate(rightReveal, [0, 1], [20, 0])}px)`,
            }}
          >
            <div
              style={{
                fontSize: '15px',
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'rgba(139, 196, 255, 0.55)',
                marginBottom: '8px',
              }}
            >
              Potential Structure
            </div>
            <div
              style={{
                fontSize: '100px',
                lineHeight: 0.88,
                fontWeight: 700,
                color: '#8BC4FF',
                letterSpacing: '-0.04em',
              }}
            >
              {formatNumber(totalPoints)}
            </div>
            <div
              style={{
                fontSize: '22px',
                fontWeight: 600,
                color: 'rgba(255, 255, 255, 0.58)',
                marginTop: '6px',
                marginBottom: '18px',
              }}
            >
              possible data points
            </div>

            {/* Data dot grid — fills remaining height */}
            <div
              style={{
                flex: 1,
                display: 'grid',
                gridTemplateColumns: 'repeat(10, 18px)',
                gap: '6px',
                alignContent: 'center',
                justifyContent: 'center',
              }}
            >
              {Array.from({ length: 100 }).map((_, i) => {
                const row = Math.floor(i / 10);
                const dotReveal = spring({
                  frame: frame - (84 + row * 2),
                  fps,
                  config: { damping: 16 },
                });
                const isAccent = i % 7 === 0 || i % 13 === 0;
                const dotOpacity =
                  0.18 + (((i * 31 + 5) % 11) / 11) * 0.42;
                return (
                  <div
                    key={i}
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '3.5px',
                      backgroundColor: isAccent
                        ? `rgba(30, 167, 242, ${dotOpacity + 0.28})`
                        : `rgba(139, 196, 255, ${dotOpacity})`,
                      opacity: dotReveal,
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* ─── Takeaway + citation ─── */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            flexShrink: 0,
            marginTop: `${10 + takeawayDrop}px`,
            opacity: takeawayReveal,
            transform: `translateY(${interpolate(takeawayReveal, [0, 1], [8, 0])}px)`,
          }}
        >
          <div
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.09)',
              borderRadius: '16px',
              padding: '14px 28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '20px',
            }}
          >
            <div
              style={{
                fontSize: '21px',
                lineHeight: 1.28,
                fontWeight: 600,
                color: '#FFFFFF',
                letterSpacing: '-0.01em',
              }}
            >
              One shared framework for aligned extraction and comparison
            </div>
            <div
              style={{
                flexShrink: 0,
                padding: '9px 16px',
                borderRadius: '999px',
                backgroundColor: 'rgba(30, 167, 242, 0.12)',
                border: '1px solid rgba(30, 167, 242, 0.25)',
                fontSize: '13px',
                fontWeight: 700,
                color: '#1EA7F2',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              Standardised Extraction
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', opacity: 0.55 }}>
            <div
              style={{
                fontSize: '13px',
                fontWeight: 400,
                color: 'rgba(255, 255, 255, 0.48)',
                fontStyle: 'italic',
              }}
            >
              Fuller et al. 2006; Bahr et al. 2020; Walden et al. 2023
            </div>
          </div>
        </div>
      </div>
    </BlueBackgroundShell>
  );
};
