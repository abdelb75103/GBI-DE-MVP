import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {BlueBackgroundShell} from './BlueBackgroundShell';
import {HeaderBrandLockup} from './HeaderBrandLockup';
import {problemFramingSlideData} from './generated/problemFramingSlideData';

const worldMapUrl = require('../assets/world-map.svg');

type ProblemMode = 'full' | 'surveillance' | 'literature';

const surveillancePaper = {
  citation: 'Wilke et al. 2026',
  ongoingProgrammes: 49,
  concentratedCountries: 20,
} as const;

const colors = {
  textPrimary: '#FFFFFF',
  textSecondary: '#A9C2D4',
  textTertiary: 'rgba(169, 194, 212, 0.5)',
  survAccent: '#1EA7F2',
  survGlow: 'rgba(30, 167, 242, 0.6)',
  litAccent: '#FF9500',
  litGlow: 'rgba(255, 149, 0, 0.35)',
  rule: 'rgba(255, 255, 255, 0.08)',
} as const;

const countryPinLayouts: Record<string, {x: number; y: number; align?: string}> = {
  'United States': {x: 22.74, y: 34.52, align: 'bottom'},
  Mexico: {x: 19.58, y: 40.65},
  Argentina: {x: 29.47, y: 70.65},
  Brazil: {x: 34.84, y: 60.48},
  England: {x: 47.37, y: 27.58, align: 'top-left'},
  Spain: {x: 47.58, y: 31.61, align: 'bottom-right'},
  France: {x: 49.26, y: 30.16},
  Germany: {x: 51.47, y: 29.03, align: 'right'},
  Netherlands: {x: 50.21, y: 28.55},
  Denmark: {x: 51.58, y: 26.94},
  Norway: {x: 50.95, y: 24.84},
  Sweden: {x: 52.32, y: 26.29, align: 'top-right'},
  Italy: {x: 51.47, y: 32.1},
  Qatar: {x: 60.32, y: 43.23},
  Iran: {x: 64.84, y: 39.35},
  Japan: {x: 86.42, y: 32.9},
  'South Korea': {x: 82.84, y: 33.23},
  Morocco: {x: 46.95, y: 39.35},
  Nigeria: {x: 48.84, y: 50.65},
  'South Africa': {x: 54.0, y: 66.8},
  Australia: {x: 85.2, y: 60.2},
};

const literaturePins = problemFramingSlideData.topCountries
  .map((item) => {
    const layout = countryPinLayouts[item.country];
    if (!layout) {
      return null;
    }

    return {
      id: item.country.toLowerCase().replace(/\s+/g, '-'),
      x: layout.x,
      y: layout.y,
      isLit: true,
      label: item.country,
      align: layout.align ?? 'right',
    };
  })
  .filter(Boolean) as Array<{
  id: string;
  x: number;
  y: number;
  isLit: boolean;
  label: string;
  align: string;
}>;

const surveillancePins = [
  'United States',
  'Mexico',
  'Brazil',
  'Argentina',
  'England',
  'Spain',
  'France',
  'Germany',
  'Netherlands',
  'Denmark',
  'Norway',
  'Sweden',
  'Italy',
  'Qatar',
  'Iran',
  'Japan',
  'South Korea',
  'Morocco',
  'Nigeria',
  'South Africa',
].map((country) => ({
  id: country.toLowerCase().replace(/\s+/g, '-'),
  x: countryPinLayouts[country].x,
  y: countryPinLayouts[country].y,
  isLit: false,
}));

const pins = [...literaturePins, ...surveillancePins];

const getLabelTransform = (align: string) => {
  switch (align) {
    case 'top':
      return '-50%, calc(-100% - 15px)';
    case 'bottom':
      return '-50%, 15px';
    case 'left':
      return 'calc(-100% - 15px), -50%';
    case 'right':
      return '15px, -50%';
    case 'top-left':
      return 'calc(-100% - 10px), calc(-100% - 8px)';
    case 'top-right':
      return '10px, calc(-100% - 8px)';
    case 'bottom-left':
      return 'calc(-100% - 10px), 8px';
    case 'bottom-right':
      return '10px, 8px';
    default:
      return '15px, -50%';
  }
};

const ProblemFramingBase: React.FC<{mode: ProblemMode}> = ({mode}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const headlineReveal = 1;

  const survEmphIn =
    mode === 'literature'
      ? 0
      : spring({
          frame: frame - (mode === 'surveillance' ? 18 : 50),
          fps,
          config: {damping: 24, stiffness: 90},
        });
  const survEmphFade =
    mode === 'full'
      ? interpolate(frame, [130, 160], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})
      : mode === 'surveillance'
        ? 1
        : 0;
  const survMapWave =
    mode === 'literature'
      ? 0
      : interpolate(frame, [mode === 'surveillance' ? 24 : 65, mode === 'surveillance' ? 66 : 105], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

  const bridgeReveal =
    mode === 'literature'
      ? 1
      : mode === 'surveillance'
        ? 0
        : spring({frame: frame - 170, fps, config: {damping: 22, stiffness: 120}});

  const litCueReveal =
    mode === 'surveillance'
      ? 0
      : spring({frame: frame - (mode === 'literature' ? 24 : 230), fps, config: {damping: 22, stiffness: 120}});
  const litMapActive =
    mode === 'surveillance'
      ? 0
      : interpolate(frame, [mode === 'literature' ? 34 : 250, mode === 'literature' ? 74 : 290], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
  const stage2Active =
    mode === 'surveillance'
      ? 0
      : interpolate(frame, [mode === 'literature' ? 118 : 340, mode === 'literature' ? 168 : 390], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
  const stage2MetricReveal =
    mode === 'surveillance'
      ? 0
      : spring({frame: frame - (mode === 'literature' ? 154 : 380), fps, config: {damping: 22, stiffness: 120}});

  const overlayOpacity = litMapActive * (1 - stage2Active);
  const top5ScaleStage1 = interpolate(litMapActive, [0, 1], [1, 2.4]);
  const top5ScaleStage2 = interpolate(stage2Active, [0, 1], [0, 0.8]);
  const top5Scale = top5ScaleStage1 + top5ScaleStage2;

  return (
    <BlueBackgroundShell centerOverlay={<HeaderBrandLockup theme="blue" />} pitchVariant="halfway">
      <AbsoluteFill style={{overflow: 'hidden'}}>
        <div
          style={{
            position: 'absolute',
            top: '110px',
            left: '96px',
            width: '44%',
            bottom: '56px',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 10,
          }}
        >
          <div
            style={{
              opacity: headlineReveal,
              transform: `translateY(${(1 - headlineReveal) * 20}px)`,
            }}
          >
            <h1
              style={{
                fontSize: '76px',
                fontWeight: 700,
                color: colors.textPrimary,
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
                margin: 0,
                textShadow: '0 8px 30px rgba(0,0,0,0.3)',
              }}
            >
              Football Is Global.
              <br />
              The Evidence Base
              <br />
              <span style={{color: colors.survAccent}}>Is Not.</span>
            </h1>
          </div>

          <div
            style={{
              position: 'absolute',
              top: `${interpolate(survEmphFade, [0, 1], [320, 376], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              })}px`,
              left: 0,
              width: '100%',
              maxHeight: `${interpolate(survEmphFade, [0, 1], [0, 220], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              })}px`,
              opacity: survEmphIn * survEmphFade,
              transform: `translateY(${(1 - survEmphIn) * 24}px)`,
              overflow: 'hidden',
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                fontSize: '16px',
                color: colors.survAccent,
                textTransform: 'uppercase',
                letterSpacing: '0.18em',
                fontWeight: 700,
                marginBottom: '8px',
              }}
            >
              Recent Surveillance Paper
            </div>
            <div
              style={{
                fontSize: '16px',
                color: colors.textSecondary,
                fontWeight: 500,
                marginBottom: '18px',
                letterSpacing: '0.04em',
              }}
            >
              {surveillancePaper.citation}
            </div>
            <div
              style={{
                fontSize: '56px',
                fontWeight: 700,
                color: colors.textPrimary,
                lineHeight: 1,
                letterSpacing: '-0.02em',
                marginBottom: '12px',
              }}
            >
              {surveillancePaper.ongoingProgrammes} ongoing programmes
            </div>
            <div
              style={{
                fontSize: '28px',
                color: colors.textSecondary,
                fontWeight: 500,
                lineHeight: 1.2,
                maxWidth: '560px',
              }}
            >
              {surveillancePaper.concentratedCountries} countries
            </div>
          </div>

          <div
            style={{
              marginTop: '28px',
              fontSize: '34px',
              fontWeight: 500,
              color: colors.litAccent,
              opacity: bridgeReveal,
              transform: `translateX(${(1 - bridgeReveal) * -15}px)`,
            }}
          >
            The literature is more concentrated still.
          </div>

          <div style={{flex: 1, minHeight: '16px'}} />

          <div
            style={{
              opacity: litCueReveal,
              transform: `translateY(${(1 - litCueReveal) * 15}px)`,
            }}
          >
            <div
              style={{
                opacity: interpolate(stage2Active, [0, 0.6], [1, 0.32], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                }),
                transform: `translateY(${interpolate(stage2Active, [0, 1], [0, -4], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                })}px)`,
              }}
            >
              <div
                style={{
                  fontSize: '72px',
                  fontWeight: 700,
                  color: colors.textPrimary,
                  lineHeight: 1,
                  letterSpacing: '-0.02em',
                  marginBottom: '10px',
                }}
              >
                {problemFramingSlideData.stage1.pct.toFixed(1)}%
                <span
                  style={{
                    fontSize: '26px',
                    fontWeight: 500,
                    color: colors.textSecondary,
                    marginLeft: '14px',
                  }}
                >
                  of current studies
                </span>
              </div>
              <div
                style={{
                  fontSize: '24px',
                  color: colors.textSecondary,
                  fontWeight: 500,
                  marginBottom: '16px',
                }}
              >
                5 countries + American / UEFA buckets
              </div>
            </div>

            <div
              style={{
                width: '100%',
                height: '1px',
                backgroundColor: colors.rule,
                marginBottom: '20px',
              }}
            />

            <div
              style={{
                opacity: stage2MetricReveal,
                transform: `translateY(${(1 - stage2MetricReveal) * 12}px)`,
              }}
            >
              <div
                style={{
                  fontSize: '16px',
                  color: colors.litAccent,
                  textTransform: 'uppercase',
                  letterSpacing: '0.14em',
                  fontWeight: 700,
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: '20px',
                    height: '2px',
                    backgroundColor: colors.litAccent,
                    opacity: 0.5,
                  }}
                />
                Without UEFA &amp; American buckets
              </div>
              <div
                style={{
                  fontSize: '54px',
                  fontWeight: 700,
                  color: colors.textPrimary,
                  lineHeight: 1,
                  letterSpacing: '-0.02em',
                  marginBottom: '8px',
                }}
              >
                {problemFramingSlideData.stage2.topCountriesPct.toFixed(1)}%
                <span
                  style={{
                    fontSize: '24px',
                    fontWeight: 500,
                    color: colors.litAccent,
                    marginLeft: '14px',
                  }}
                >
                  in just {problemFramingSlideData.topCountryCount} countries
                </span>
              </div>
              <div
                style={{
                  marginTop: '14px',
                  fontSize: '27px',
                  fontWeight: 560,
                  color: colors.textSecondary,
                  lineHeight: 1.35,
                }}
              >
                {problemFramingSlideData.stage2.otherCountriesPct.toFixed(1)}% across{' '}
                {problemFramingSlideData.otherCountryLabelCount} other countries
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            top: '6%',
            right: '-10%',
            width: '62%',
            height: '88%',
            opacity: 0.85,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: colors.textSecondary,
              opacity: 0.12,
              maskImage: `url(${worldMapUrl})`,
              WebkitMaskImage: `url(${worldMapUrl})`,
              maskSize: 'contain',
              WebkitMaskSize: 'contain',
              maskPosition: 'center',
              WebkitMaskPosition: 'center',
              maskRepeat: 'no-repeat',
              WebkitMaskRepeat: 'no-repeat',
            }}
          />

          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2,
              pointerEvents: 'none',
            }}
          >
            <div style={{position: 'relative', width: '100%', aspectRatio: '950/620'}}>
              <div
                style={{
                  position: 'absolute',
                  left: '51%',
                  top: '23%',
                  width: '14%',
                  height: '22%',
                  borderRadius: '50%',
                  background:
                    'radial-gradient(ellipse at center, rgba(255, 149, 0, 0.22) 0%, rgba(255, 149, 0, 0.08) 50%, transparent 80%)',
                  opacity: overlayOpacity,
                  transform: 'translate(-50%, -50%)',
                  filter: 'blur(18px)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: '49%',
                  top: '6%',
                  opacity: overlayOpacity * 0.85,
                  color: colors.litAccent,
                  fontSize: '16px',
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  backgroundColor: 'rgba(255, 149, 0, 0.08)',
                  padding: '6px 14px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 149, 0, 0.2)',
                  whiteSpace: 'nowrap',
                }}
              >
                UEFA ECIS
              </div>

              <div
                style={{
                  position: 'absolute',
                  left: '22%',
                  top: '43%',
                  width: '18%',
                  height: '38%',
                  borderRadius: '50%',
                  background:
                    'radial-gradient(ellipse at center, rgba(255, 149, 0, 0.22) 0%, rgba(255, 149, 0, 0.08) 50%, transparent 80%)',
                  opacity: overlayOpacity,
                  transform: 'translate(-50%, -50%)',
                  filter: 'blur(22px)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: '5%',
                  top: '53%',
                  opacity: overlayOpacity * 0.85,
                  color: colors.litAccent,
                  fontSize: '16px',
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  backgroundColor: 'rgba(255, 149, 0, 0.08)',
                  padding: '6px 14px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 149, 0, 0.2)',
                  whiteSpace: 'nowrap',
                }}
              >
                American (NCAA &amp; RIO)
              </div>
            </div>
          </div>

          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 3,
            }}
          >
            <div style={{position: 'relative', width: '100%', aspectRatio: '950/620'}}>
              {pins.map((pin) => {
                const waveT = Math.max(0, survMapWave - pin.x * 0.003);
                const baseOpacity = Math.min(1, waveT * 1.5);
                const targetScale = pin.isLit ? top5Scale : interpolate(litMapActive, [0, 1], [1, 0.25]);
                const dominantColor = pin.isLit && litMapActive > 0.5 ? colors.litAccent : colors.survAccent;
                const dominantGlow = pin.isLit && litMapActive > 0.5 ? colors.litGlow : colors.survGlow;
                const finalOpacity = pin.isLit
                  ? interpolate(litMapActive, [0, 1], [baseOpacity, 1])
                  : interpolate(litMapActive, [0, 1], [baseOpacity, baseOpacity * 0.35]);
                const pinOpacity = pin.isLit
                  ? finalOpacity
                  : finalOpacity *
                    interpolate(stage2Active, [0, 1], [1, 0.2], {
                      extrapolateLeft: 'clamp',
                      extrapolateRight: 'clamp',
                    });

                return (
                  <div
                    key={pin.id}
                    style={{
                      position: 'absolute',
                      left: `${pin.x}%`,
                      top: `${pin.y}%`,
                      width: 0,
                      height: 0,
                      opacity: pinOpacity,
                      zIndex: pin.isLit ? 10 : 1,
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: `${6 * targetScale}px`,
                        height: `${6 * targetScale}px`,
                        backgroundColor: dominantColor,
                        borderRadius: '50%',
                        boxShadow: `0 0 ${12 * targetScale}px ${dominantColor}, 0 0 ${24 * targetScale}px ${dominantGlow}`,
                      }}
                    />

                    {pin.isLit && 'label' in pin && pin.label ? (
                      <div
                        style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: `translate(${getLabelTransform(pin.align || 'right')})`,
                          color: '#FFFFFF',
                          fontSize: '22px',
                          fontWeight: 600,
                          letterSpacing: '0.04em',
                          opacity: litMapActive,
                          whiteSpace: 'nowrap',
                          textShadow: '0 4px 16px rgba(0,0,0,0.9), 0 1px 4px rgba(0,0,0,0.7)',
                          pointerEvents: 'none',
                        }}
                      >
                        {pin.label}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </AbsoluteFill>

      <div
        style={{
          position: 'absolute',
          left: '96px',
          bottom: '18px',
          zIndex: 12,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            fontSize: '11px',
            lineHeight: 1.2,
            color: 'rgba(169, 194, 212, 0.35)',
            maxWidth: '600px',
            textAlign: 'left',
            fontWeight: 400,
            letterSpacing: '0.01em',
          }}
        >
          Franco Wilke C, McCall A, Serner A, et al. <i>Player health surveillance in football: a global map of programmes in national and international leagues and tournaments.</i> Science and Medicine in Football. 2026.
        </div>
      </div>
    </BlueBackgroundShell>
  );
};

export const ProblemFramingSlide: React.FC = () => {
  return <ProblemFramingBase mode="full" />;
};

export const ProblemFramingSurveillanceSlide: React.FC = () => {
  return <ProblemFramingBase mode="surveillance" />;
};

export const ProblemFramingLiteratureSlide: React.FC = () => {
  return <ProblemFramingBase mode="literature" />;
};
