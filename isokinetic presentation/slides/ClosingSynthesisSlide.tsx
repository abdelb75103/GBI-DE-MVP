import React from 'react';
import {AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {BlueBackgroundShell} from './BlueBackgroundShell';
import {HeaderBrandLockup} from './HeaderBrandLockup';

const worldMapUrl = require('../assets/world-map.svg');

const MAP_FRAME = {
  left: 360,
  top: 172,
  width: 1210,
  height: 620,
} as const;

const CENTRAL_NODE = {
  x: 1280,
  y: 498,
} as const;

const STUDY_POINTS = [
  {id: 'us', xPct: 22, yPct: 34, delay: 0},
  {id: 'eng', xPct: 45.5, yPct: 24, delay: 8},
  {id: 'se', xPct: 48, yPct: 19, delay: 14},
  {id: 'de', xPct: 48.5, yPct: 26, delay: 20},
  {id: 'es', xPct: 46.5, yPct: 32, delay: 26},
] as const;

const SYSTEM_LABELS = [
  {label: 'Women', x: 1080, y: 322, delay: 0},
  {label: 'Youth', x: 1000, y: 450, delay: 10},
  {label: 'Para', x: 1070, y: 616, delay: 20},
  {label: 'Futsal', x: 1524, y: 328, delay: 30},
  {label: 'Beach', x: 1592, y: 454, delay: 40},
  {label: 'Underrepresented regions', x: 1498, y: 628, delay: 50},
] as const;

const projectMapPoint = (xPct: number, yPct: number) => ({
  x: MAP_FRAME.left + (MAP_FRAME.width * xPct) / 100,
  y: MAP_FRAME.top + (MAP_FRAME.height * yPct) / 100,
});

const projectedStudyPoints = STUDY_POINTS.map((point) => ({
  ...point,
  ...projectMapPoint(point.xPct, point.yPct),
}));

export const ClosingSynthesisSlide: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const kickerReveal = spring({frame: frame - 10, fps, config: {damping: 18}});
  const headlineReveal = spring({frame: frame - 22, fps, config: {damping: 18}});
  const subheadReveal = spring({frame: frame - 36, fps, config: {damping: 18}});
  const mapReveal = spring({frame: frame - 48, fps, config: {damping: 18}});
  const footprintReveal = spring({frame: frame - 74, fps, config: {damping: 18}});
  const convergenceGlobal = interpolate(frame, [120, 205], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const nodeReveal = spring({frame: frame - 152, fps, config: {damping: 18}});
  const finalLineReveal = spring({frame: frame - 240, fps, config: {damping: 18}});

  return (
    <BlueBackgroundShell centerOverlay={<HeaderBrandLockup theme="blue" />} pitchVariant="halfway">
      <AbsoluteFill>
        <div
          style={{
            position: 'absolute',
            left: 96,
            top: 156,
            width: 620,
            zIndex: 20,
          }}
        >
          <div
            style={{
              opacity: kickerReveal,
              transform: `translateY(${interpolate(kickerReveal, [0, 1], [18, 0])}px)`,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 18px',
              borderRadius: 999,
              background: 'rgba(212, 168, 83, 0.12)',
              border: '1px solid rgba(212, 168, 83, 0.3)',
              color: '#E8CC8A',
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: '#D4A853',
                boxShadow: '0 0 16px rgba(212, 168, 83, 0.4)',
              }}
            />
            Closing Perspective
          </div>

          <h1
            style={{
              margin: '28px 0 0',
              opacity: headlineReveal,
              transform: `translateY(${interpolate(headlineReveal, [0, 1], [26, 0])}px)`,
              fontSize: 76,
              lineHeight: 1.04,
              fontWeight: 720,
              letterSpacing: '-0.04em',
              color: '#FFFFFF',
              textShadow: '0 12px 40px rgba(0, 0, 0, 0.3)',
            }}
          >
            Football is global.
            <br />
            The evidence can be too.
          </h1>

          <p
            style={{
              margin: '24px 0 0',
              opacity: subheadReveal,
              transform: `translateY(${interpolate(subheadReveal, [0, 1], [22, 0])}px)`,
              maxWidth: 560,
              fontSize: 29,
              lineHeight: 1.38,
              fontWeight: 430,
              letterSpacing: '-0.02em',
              color: 'rgba(255, 255, 255, 0.76)',
            }}
          >
            FIFA GBI turns fragmented surveillance into a living, standardised evidence system for
            the whole game.
          </p>
        </div>

        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: MAP_FRAME.left - 40,
              top: MAP_FRAME.top - 18,
              width: MAP_FRAME.width + 80,
              height: MAP_FRAME.height + 40,
              opacity: mapReveal,
              transform: `scale(${interpolate(mapReveal, [0, 1], [0.97, 1])})`,
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                background:
                  'radial-gradient(circle at 58% 50%, rgba(77, 163, 255, 0.18) 0%, rgba(77, 163, 255, 0.04) 36%, transparent 72%)',
                filter: 'blur(16px)',
              }}
            />
            <Img
              src={worldMapUrl}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                opacity: 0.16,
                filter:
                  'brightness(0) saturate(100%) invert(83%) sepia(8%) saturate(484%) hue-rotate(165deg) brightness(89%) contrast(88%)',
              }}
            />
          </div>

          <svg
            width="1920"
            height="1080"
            viewBox="0 0 1920 1080"
            style={{position: 'absolute', inset: 0}}
          >
            {projectedStudyPoints.map((point) => {
              const travelProgress = spring({
                frame: frame - (120 + point.delay),
                fps,
                config: {damping: 16, stiffness: 110},
              });
              const trailOpacity = interpolate(travelProgress, [0, 0.16, 0.82, 1], [0, 0.38, 0.26, 0], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });

              return (
                <line
                  key={`${point.id}-trail`}
                  x1={point.x}
                  y1={point.y}
                  x2={CENTRAL_NODE.x}
                  y2={CENTRAL_NODE.y}
                  stroke="rgba(212, 168, 83, 0.6)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray="8 11"
                  opacity={trailOpacity * footprintReveal}
                />
              );
            })}

            {SYSTEM_LABELS.map((item) => {
              const labelReveal = spring({
                frame: frame - (188 + item.delay),
                fps,
                config: {damping: 16},
              });

              return (
                <line
                  key={`${item.label}-connector`}
                  x1={CENTRAL_NODE.x}
                  y1={CENTRAL_NODE.y}
                  x2={interpolate(labelReveal, [0, 1], [CENTRAL_NODE.x, item.x])}
                  y2={interpolate(labelReveal, [0, 1], [CENTRAL_NODE.y, item.y])}
                  stroke="rgba(139, 196, 255, 0.34)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  opacity={labelReveal}
                />
              );
            })}
          </svg>

          {projectedStudyPoints.map((point, index) => {
            const pointReveal = spring({
              frame: frame - (74 + index * 6),
              fps,
              config: {damping: 18},
            });
            const travelProgress = spring({
              frame: frame - (120 + point.delay),
              fps,
              config: {damping: 16, stiffness: 110},
            });
            const movingX = interpolate(travelProgress, [0, 1], [point.x, CENTRAL_NODE.x]);
            const movingY = interpolate(travelProgress, [0, 1], [point.y, CENTRAL_NODE.y]);
            const travelOpacity = interpolate(travelProgress, [0, 0.08, 0.82, 1], [0, 1, 1, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });

            return (
              <React.Fragment key={point.id}>
                <div
                  style={{
                    position: 'absolute',
                    left: point.x,
                    top: point.y,
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    opacity:
                      pointReveal *
                      footprintReveal *
                      interpolate(convergenceGlobal, [0, 1], [0.95, 0.42]),
                    transform: 'translate(-50%, -50%)',
                    background: 'rgba(255, 196, 107, 0.92)',
                    boxShadow:
                      '0 0 0 5px rgba(255, 196, 107, 0.16), 0 0 20px rgba(255, 196, 107, 0.32)',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: movingX,
                    top: movingY,
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    opacity: travelOpacity,
                    transform: `translate(-50%, -50%) scale(${interpolate(
                      travelProgress,
                      [0, 1],
                      [1, 0.76],
                    )})`,
                    background: '#FFD493',
                    boxShadow:
                      '0 0 0 5px rgba(255, 212, 147, 0.14), 0 0 26px rgba(255, 212, 147, 0.55)',
                  }}
                />
              </React.Fragment>
            );
          })}

          <div
            style={{
              position: 'absolute',
              left: CENTRAL_NODE.x,
              top: CENTRAL_NODE.y,
              width: 210,
              height: 210,
              borderRadius: '50%',
              opacity: nodeReveal,
              transform: `translate(-50%, -50%) scale(${interpolate(nodeReveal, [0, 1], [0.72, 1])})`,
              background:
                'radial-gradient(circle at 35% 35%, rgba(255, 255, 255, 0.22) 0%, rgba(139, 196, 255, 0.28) 16%, rgba(77, 163, 255, 0.88) 44%, rgba(30, 97, 161, 0.96) 100%)',
              boxShadow:
                '0 0 0 10px rgba(139, 196, 255, 0.08), 0 0 48px rgba(77, 163, 255, 0.38), 0 28px 70px rgba(0, 0, 0, 0.28)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: -18,
                borderRadius: '50%',
                border: '1px solid rgba(139, 196, 255, 0.24)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: -36,
                borderRadius: '50%',
                border: '1px solid rgba(139, 196, 255, 0.12)',
              }}
            />
            <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: 'rgba(255, 255, 255, 0.72)',
                }}
              >
                FIFA
              </div>
              <div
                style={{
                  fontSize: 42,
                  lineHeight: 1,
                  fontWeight: 760,
                  letterSpacing: '-0.03em',
                  color: '#FFFFFF',
                }}
              >
                GBI
              </div>
              <div
                style={{
                  fontSize: 16,
                  lineHeight: 1.2,
                  fontWeight: 600,
                  color: 'rgba(255, 255, 255, 0.72)',
                }}
              >
                Living evidence
                <br />
                system
              </div>
            </div>
          </div>

          {SYSTEM_LABELS.map((item) => {
            const reveal = spring({
              frame: frame - (188 + item.delay),
              fps,
              config: {damping: 16},
            });

            return (
              <div
                key={item.label}
                style={{
                  position: 'absolute',
                  left: item.x,
                  top: item.y,
                  opacity: reveal,
                  transform: `translate(-50%, -50%) translateY(${interpolate(
                    reveal,
                    [0, 1],
                    [16, 0],
                  )}px)`,
                  padding: '14px 20px',
                  borderRadius: 999,
                  background: 'rgba(8, 31, 49, 0.86)',
                  border: '1px solid rgba(139, 196, 255, 0.26)',
                  boxShadow: '0 10px 28px rgba(0, 0, 0, 0.18)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    backgroundColor: '#8BC4FF',
                    boxShadow: '0 0 14px rgba(139, 196, 255, 0.4)',
                  }}
                />
                <div
                  style={{
                    fontSize: 22,
                    lineHeight: 1.1,
                    fontWeight: 650,
                    letterSpacing: '-0.02em',
                    color: '#FFFFFF',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.label}
                </div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            position: 'absolute',
            left: 96,
            right: 96,
            bottom: 72,
            display: 'flex',
            justifyContent: 'center',
            zIndex: 30,
          }}
        >
          <div
            style={{
              opacity: finalLineReveal,
              transform: `translateY(${interpolate(finalLineReveal, [0, 1], [22, 0])}px)`,
              maxWidth: 930,
              padding: '18px 34px',
              borderRadius: 30,
              border: '1px solid rgba(139, 196, 255, 0.22)',
              background:
                'linear-gradient(180deg, rgba(11, 37, 55, 0.88) 0%, rgba(8, 28, 43, 0.94) 100%)',
              boxShadow: '0 22px 56px rgba(0, 0, 0, 0.24)',
            }}
          >
            <div
              style={{
                fontSize: 34,
                lineHeight: 1.14,
                fontWeight: 650,
                letterSpacing: '-0.03em',
                color: '#FFFFFF',
                textAlign: 'center',
              }}
            >
              One game. One living evidence base.
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </BlueBackgroundShell>
  );
};
