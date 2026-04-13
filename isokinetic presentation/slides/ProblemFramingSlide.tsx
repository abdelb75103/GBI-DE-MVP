import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig, AbsoluteFill } from 'remotion';
import { BlueBackgroundShell } from './BlueBackgroundShell';
import { HeaderBrandLockup } from './HeaderBrandLockup';

const worldMapUrl = require('../assets/world-map.svg');

export const ProblemFramingSlide: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const colors = {
    textPrimary: '#FFFFFF',
    textSecondary: '#A9C2D4',
    textTertiary: 'rgba(169, 194, 212, 0.5)',
    survAccent: '#1EA7F2',
    survGlow: 'rgba(30, 167, 242, 0.6)',
    litAccent: '#FF9500',
    litGlow: 'rgba(255, 149, 0, 0.35)',
    rule: 'rgba(255, 255, 255, 0.08)',
  };

  // ── Animation Timings ──
  // 1. Headline
  const headlineTime = 15;
  const headlineReveal = spring({ frame: frame - headlineTime, fps, config: { damping: 200 } });

  // 2. Emphatic surveillance statement (appears big in middle)
  const survEmphTime = 50;
  const survEmphIn = spring({ frame: frame - survEmphTime, fps, config: { damping: 200 } });
  // Surveillance recedes before bridge arrives
  const survEmphFade = interpolate(frame, [130, 160], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // 3. Surveillance map dots
  const survMapTime = 65;
  const survMapWave = interpolate(frame, [survMapTime, survMapTime + 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // 4. Bridge line
  const bridgeTime = 170;
  const bridgeReveal = spring({ frame: frame - bridgeTime, fps, config: { damping: 200 } });

  // 5. Literature figures (Stage 1)
  const litTime = 230;
  const litCueReveal = spring({ frame: frame - litTime, fps, config: { damping: 200 } });

  // 6. Literature map transition (Stage 1 overlays appear)
  const litMapTime = 250;
  const litMapActive = interpolate(frame, [litMapTime, litMapTime + 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // 7. Stage 2: regional overlays recede, country-only concentration sharpens
  const stage2Time = 340;
  const stage2Active = interpolate(frame, [stage2Time, stage2Time + 50], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const stage2MetricReveal = spring({ frame: frame - (stage2Time + 40), fps, config: { damping: 200 } });

  // Overlay opacity: fades in with lit layer, fades out in stage 2
  const overlayOpacity = litMapActive * (1 - stage2Active);

  // Top-5 dot scale: grows in Stage 1, boosts further in Stage 2
  const top5ScaleStage1 = interpolate(litMapActive, [0, 1], [1, 2.4]);
  const top5ScaleStage2 = interpolate(stage2Active, [0, 1], [0, 0.8]);
  const top5Scale = top5ScaleStage1 + top5ScaleStage2;

  // ── Map pin data ──
  const pins = [
    { id: 'us', x: 22, y: 34, isLit: true, label: 'United States', align: 'bottom' },
    { id: 'eng', x: 45.5, y: 24, isLit: true, label: 'England', align: 'top-left' },
    { id: 'se', x: 48, y: 19, isLit: true, label: 'Sweden', align: 'top-right' },
    { id: 'de', x: 48.5, y: 26, isLit: true, label: 'Germany', align: 'right' },
    { id: 'es', x: 46.5, y: 32, isLit: true, label: 'Spain', align: 'bottom-left' },
    { id: 'br', x: 31, y: 65, isLit: false },
    { id: 'qa', x: 57.5, y: 40, isLit: false },
    { id: 'za', x: 52, y: 73, isLit: false },
    { id: 'au', x: 82, y: 76, isLit: false },
    { id: 'mx', x: 19, y: 45, isLit: false },
    { id: 'jp', x: 82, y: 34, isLit: false },
    { id: 'ag', x: 28, y: 75, isLit: false },
    { id: 'ca', x: 20, y: 20, isLit: false },
    { id: 'fr', x: 47, y: 29, isLit: false },
    { id: 'nl', x: 47.5, y: 24, isLit: false },
    { id: 'no', x: 46, y: 17, isLit: false },
  ];

  const getLabelTransform = (align: string) => {
    switch (align) {
      case 'top': return '-50%, calc(-100% - 15px)';
      case 'bottom': return '-50%, 15px';
      case 'left': return 'calc(-100% - 15px), -50%';
      case 'right': return '15px, -50%';
      case 'top-left': return 'calc(-100% - 10px), calc(-100% - 8px)';
      case 'top-right': return '10px, calc(-100% - 8px)';
      case 'bottom-left': return 'calc(-100% - 10px), 8px';
      case 'bottom-right': return '10px, 8px';
      default: return '15px, -50%';
    }
  };

  return (
    <BlueBackgroundShell centerOverlay={<HeaderBrandLockup theme="blue" />} pitchVariant="halfway">
      <AbsoluteFill style={{ overflow: 'hidden' }}>

        {/* ═══════ LEFT COLUMN ═══════ */}
        <div style={{
          position: 'absolute',
          top: '110px',
          left: '96px',
          width: '44%',
          bottom: '56px',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 10,
        }}>

          {/* ── Headline ── */}
          <div style={{
            opacity: headlineReveal,
            transform: `translateY(${(1 - headlineReveal) * 20}px)`,
          }}>
            <h1 style={{
              fontSize: '76px',
              fontWeight: 700,
              color: colors.textPrimary,
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              margin: 0,
              textShadow: '0 8px 30px rgba(0,0,0,0.3)',
            }}>
              Football Is Global.<br />
              The Evidence Base<br />
              <span style={{ color: colors.survAccent }}>Is Not.</span>
            </h1>
          </div>

          {/* ── Emphatic Surveillance Statement (middle area) ── */}
          <div style={{
            marginTop: `${interpolate(survEmphFade, [0, 1], [0, 56], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}px`,
            maxHeight: `${interpolate(survEmphFade, [0, 1], [0, 200], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}px`,
            opacity: survEmphIn * survEmphFade,
            transform: `translateY(${(1 - survEmphIn) * 24}px)`,
            overflow: 'hidden',
          }}>
            <div style={{
              fontSize: '18px',
              color: colors.survAccent,
              textTransform: 'uppercase',
              letterSpacing: '0.18em',
              fontWeight: 700,
              marginBottom: '18px',
            }}>
              Global Surveillance Coverage
            </div>
            <div style={{
              fontSize: '68px',
              fontWeight: 700,
              color: colors.textPrimary,
              display: 'flex',
              alignItems: 'baseline',
              gap: '20px',
              lineHeight: 1,
            }}>
              <span>49</span>
              <span style={{ fontSize: '30px', fontWeight: 500, color: colors.textSecondary }}>programmes</span>
              <span style={{ opacity: 0.15, fontWeight: 200, fontSize: '56px' }}>|</span>
              <span>20</span>
              <span style={{ fontSize: '30px', fontWeight: 500, color: colors.textSecondary }}>countries</span>
            </div>
          </div>

          {/* ── Bridge Line (appears after surveillance recedes) ── */}
          <div style={{
            marginTop: '28px',
            fontSize: '34px',
            fontWeight: 500,
            color: colors.litAccent,
            opacity: bridgeReveal,
            transform: `translateX(${(1 - bridgeReveal) * -15}px)`,
          }}>
            The literature is more concentrated still.
          </div>

          {/* Spacer */}
          <div style={{ flex: 1, minHeight: '16px' }} />

          {/* ── Literature Figures ── */}
          <div style={{
            opacity: litCueReveal,
            transform: `translateY(${(1 - litCueReveal) * 15}px)`,
          }}>
            {/* Section label */}
            <div style={{
              fontSize: '18px',
              color: colors.litAccent,
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              fontWeight: 700,
              marginBottom: '20px',
            }}>
              Prospective Literature
            </div>

            {/* ── Stage 1: 46.0% broad concentration ── */}
            <div style={{
              opacity: interpolate(stage2Active, [0, 0.6], [1, 0.4], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
              transform: `translateY(${interpolate(stage2Active, [0, 1], [0, -4], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}px)`,
            }}>
              <div style={{
                fontSize: '72px',
                fontWeight: 700,
                color: colors.textPrimary,
                lineHeight: 1,
                letterSpacing: '-0.02em',
                marginBottom: '10px',
              }}>
                46.0%
                <span style={{ fontSize: '26px', fontWeight: 500, color: colors.textSecondary, marginLeft: '14px' }}>
                  of all studies
                </span>
              </div>
              <div style={{
                fontSize: '22px',
                color: colors.textSecondary,
                fontWeight: 400,
                marginBottom: '24px',
              }}>
                5 countries, American (NCAA &amp; RIO) &amp; UEFA ECIS
              </div>
            </div>

            {/* Divider  -  always visible once lit layer is in */}
            <div style={{ width: '100%', height: '1px', backgroundColor: colors.rule, marginBottom: '20px' }} />

            {/* 570 studies base count  -  stays throughout */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{
                fontSize: '48px',
                fontWeight: 700,
                color: colors.textPrimary,
                lineHeight: 1,
                marginBottom: '6px',
              }}>570</div>
              <div style={{ fontSize: '20px', color: colors.textSecondary, fontWeight: 500 }}>studies</div>
            </div>

            {/* ── Stage 2: additive country-only sharpening ── */}
            <div style={{
              opacity: stage2MetricReveal,
              transform: `translateY(${(1 - stage2MetricReveal) * 12}px)`,
            }}>
              {/* Stage 2 transition label */}
              <div style={{
                fontSize: '16px',
                color: colors.litAccent,
                textTransform: 'uppercase',
                letterSpacing: '0.14em',
                fontWeight: 700,
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}>
                <span style={{ display: 'inline-block', width: '20px', height: '2px', backgroundColor: colors.litAccent, opacity: 0.5 }} />
                Removing UEFA &amp; Americas
              </div>
              {/* 31.4% hero */}
              <div style={{
                fontSize: '60px',
                fontWeight: 700,
                color: colors.textPrimary,
                lineHeight: 1,
                letterSpacing: '-0.02em',
                marginBottom: '8px',
              }}>
                31.4%
                <span style={{ fontSize: '24px', fontWeight: 500, color: colors.litAccent, marginLeft: '14px' }}>
                  in just 5 countries
                </span>
              </div>
              <div style={{
                fontSize: '22px',
                color: colors.textSecondary,
                fontWeight: 400,
                marginBottom: '6px',
              }}>
                44.3% across the other 67
              </div>
              <div style={{
                fontSize: '18px',
                color: colors.textTertiary,
                fontWeight: 400,
              }}>
                24.3% not yet placed
              </div>
            </div>
          </div>
        </div>

        {/* ═══════ RIGHT ZONE: World map ═══════ */}
        <div style={{
          position: 'absolute',
          top: '6%',
          right: '-10%',
          width: '62%',
          height: '88%',
          opacity: 0.85,
          pointerEvents: 'none',
        }}>
          {/* SVG Outline Mask */}
          <div style={{
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
          }} />

          {/* ── Regional status (UEFA &amp; Americas) ── */}
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2,
            pointerEvents: 'none',
          }}>
            <div style={{ position: 'relative', width: '100%', aspectRatio: '950/620' }}>
              {/* Europe / UEFA status */}
              <div style={{
                position: 'absolute',
                left: '44%',
                top: '18%',
                width: '14%',
                height: '22%',
                borderRadius: '50%',
                background: `radial-gradient(ellipse at center, rgba(255, 149, 0, 0.22) 0%, rgba(255, 149, 0, 0.08) 50%, transparent 80%)`,
                opacity: overlayOpacity,
                transform: 'translate(-50%, -50%)',
                filter: 'blur(18px)',
              }} />
              {/* UEFA label */}
              <div style={{
                position: 'absolute',
                left: '42%',
                top: '-2%',
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
              }}>
                UEFA ECIS
              </div>

              {/* Americas / american_data status */}
              <div style={{
                position: 'absolute',
                left: '23%',
                top: '50%',
                width: '18%',
                height: '38%',
                borderRadius: '50%',
                background: `radial-gradient(ellipse at center, rgba(255, 149, 0, 0.22) 0%, rgba(255, 149, 0, 0.08) 50%, transparent 80%)`,
                opacity: overlayOpacity,
                transform: 'translate(-50%, -50%)',
                filter: 'blur(22px)',
              }} />
              {/* Americas label */}
              <div style={{
                position: 'absolute',
                left: '4%',
                top: '60%',
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
              }}>
                American (NCAA &amp; RIO)
              </div>
            </div>
          </div>

          {/* Map Overlay Points */}
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3,
          }}>
            <div style={{ position: 'relative', width: '100%', aspectRatio: '950/620' }}>
              {pins.map((pin) => {
                const waveT = Math.max(0, survMapWave - (pin.x * 0.003));
                const baseOpacity = Math.min(1, waveT * 1.5);

                const targetScale = pin.isLit
                  ? top5Scale
                  : interpolate(litMapActive, [0, 1], [1, 0.25]);
                const dominantColor = pin.isLit && litMapActive > 0.5 ? colors.litAccent : colors.survAccent;
                const dominantGlow = pin.isLit && litMapActive > 0.5 ? colors.litGlow : colors.survGlow;
                const finalOpacity = pin.isLit
                  ? interpolate(litMapActive, [0, 1], [baseOpacity, 1])
                  : interpolate(litMapActive, [0, 1], [baseOpacity, baseOpacity * 0.35]);
                // In stage 2, non-top-5 dots fade further to make concentration clearer
                const pinOpacity = (!pin.isLit)
                  ? finalOpacity * interpolate(stage2Active, [0, 1], [1, 0.2], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
                  : finalOpacity;

                return (
                  <div key={pin.id} style={{
                    position: 'absolute',
                    left: `${pin.x}%`,
                    top: `${pin.y}%`,
                    width: 0,
                    height: 0,
                    opacity: pinOpacity,
                    zIndex: pin.isLit ? 10 : 1,
                  }}>
                    {/* Dot */}
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: `${6 * targetScale}px`,
                      height: `${6 * targetScale}px`,
                      backgroundColor: dominantColor,
                      borderRadius: '50%',
                      boxShadow: `0 0 ${12 * targetScale}px ${dominantColor}, 0 0 ${24 * targetScale}px ${dominantGlow}`,
                    }} />

                    {/* Label */}
                    {pin.isLit && pin.label && (
                      <div style={{
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
                      }}>
                        {pin.label}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </AbsoluteFill>

      {/* Moved to the left side underneath the left column (31.4% metric), using negative bottom to hit true bottom */}
      <div style={{
        position: 'absolute',
        left: '96px',
        bottom: '-78px',
        zIndex: 12,
        pointerEvents: 'none',
      }}>
        <div style={{
          fontSize: '11px',
          lineHeight: 1.2,
          color: 'rgba(169, 194, 212, 0.35)',
          maxWidth: '600px',
          textAlign: 'left',
          fontWeight: 400,
          letterSpacing: '0.01em',
        }}>
          Franco Wilke C, McCall A, Serner A, et al. <i>Player health surveillance in football: a global map of programmes in national and international leagues and tournaments.</i> Science and Medicine in Football. 2026.
        </div>
      </div>
    </BlueBackgroundShell>
  );
};
