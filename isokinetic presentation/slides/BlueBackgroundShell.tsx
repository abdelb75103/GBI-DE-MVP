import React from 'react';
import { AbsoluteFill } from 'remotion';

type BlueBackgroundShellProps = {
  centerOverlay?: React.ReactNode;
  children?: React.ReactNode;
  pitchVariant?: 'box' | 'halfway';
};

export const BlueBackgroundShell: React.FC<BlueBackgroundShellProps> = ({
  centerOverlay,
  children,
  pitchVariant = 'box',
}) => {
  const colors = {
    bgDeep: '#061B28',
    bgDark: '#0A2533',
    bgTeal: '#0E3447',
    bgMid: '#14445C',
    bgSoft: '#1A576F',
    textPrimary: 'rgba(255, 255, 255, 0.62)',
    textSecondary: 'rgba(255, 255, 255, 0.36)',
    rule: 'rgba(255, 255, 255, 0.13)',
    pitchLine: 'rgba(255, 255, 255, 0.055)',
  };

  const headerScale = 0.75;
  const headerHeight = 104 * headerScale;
  const paddingX = 96;
  const paddingTop = 72 * headerScale;
  const paddingBottom = 88;
  const headerTextScale = 1.5;
  const headerFontSize = 18 * headerScale * headerTextScale;
  const headerLineHeight = 1.22;
  const headerLineHeightPx = headerFontSize * headerLineHeight;
  const leftHeaderTop = (headerHeight - headerLineHeightPx * 2) / 2;
  const crestSlotWidth = 480 * headerScale;
  const crestSlotHeight = 80 * headerScale;

  const BoxAnchor: React.FC = () => {
    const strokeColor = colors.pitchLine;
    const strokeWidth = 6;

    return (
      <div style={{
        position: 'absolute',
        right: 36,
        top: 0,
        height: '100%',
        width: '55%',
        opacity: 0.5,
        maskImage: 'linear-gradient(to right, transparent 0%, black 50%)',
        WebkitMaskImage: '-webkit-linear-gradient(left, transparent 0%, black 50%)',
        zIndex: 2,
        pointerEvents: 'none'
      }}>
        <svg
          width="900"
          height="600"
          viewBox="0 0 900 600"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            position: 'absolute',
            bottom: -180,
            right: 12,
          }}
        >
          <rect
            x="50"
            y="120"
            width="800"
            height="550"
            rx="4"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <rect
            x="230"
            y="340"
            width="440"
            height="330"
            rx="4"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <path
            d="M 280 120 A 170 100 0 0 1 620 120"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <circle
            cx="450"
            cy="240"
            r="7"
            fill={strokeColor}
          />
        </svg>
      </div>
    );
  };

  const HalfwayAnchor: React.FC = () => {
    const strokeColor = 'rgba(255, 255, 255, 0.07)';
    const strokeWidth = 4;

    return (
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          height: '100%',
          width: '60%',
          opacity: 0.42,
          maskImage:
            'radial-gradient(ellipse 100% 100% at 100% 100%, black 15%, transparent 80%)',
          WebkitMaskImage:
            '-webkit-radial-gradient(100% 100%, ellipse, black 15%, transparent 80%)',
          zIndex: 2,
          pointerEvents: 'none',
        }}
      >
        <svg
          width="1000"
          height="600"
          viewBox="0 0 1000 600"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            position: 'absolute',
            bottom: -120,
            right: 0,
          }}
        >
          <path d="M 0 420 H 1000" stroke={strokeColor} strokeWidth={strokeWidth} fill="none" />
          <circle cx="940" cy="420" r="260" stroke={strokeColor} strokeWidth={strokeWidth} fill="none" />
          <circle cx="940" cy="420" r="10" fill={strokeColor} />
        </svg>
      </div>
    );
  };

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.bgDeep,
        fontFamily: 'Inter, "Source Sans 3", sans-serif',
      }}
    >
      <AbsoluteFill
        style={{
          background: [
            `radial-gradient(ellipse 130% 120% at 68% 42%, ${colors.bgSoft} 0%, ${colors.bgMid} 18%, ${colors.bgTeal} 38%, ${colors.bgDark} 62%, ${colors.bgDeep} 100%)`,
          ].join(', '),
        }}
      />

      <div
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          background: `radial-gradient(ellipse 80% 70% at 80% 30%, rgba(26, 87, 111, 0.25) 0%, transparent 70%)`,
        }}
      />

      <div
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          background: `radial-gradient(ellipse 100% 100% at 50% 50%, transparent 40%, rgba(6, 27, 40, 0.5) 100%)`,
        }}
      />

      <div
        style={{
          position: 'absolute',
          width: '100%',
          height: '260px',
          top: 0,
          background: `linear-gradient(180deg, rgba(6, 27, 40, 0.3) 0%, transparent 100%)`,
        }}
      />

      {pitchVariant === 'halfway' ? <HalfwayAnchor /> : <BoxAnchor />}

      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          padding: `${paddingTop}px ${paddingX}px ${paddingBottom}px ${paddingX}px`,
          zIndex: 10,
        }}
      >
        <div
          style={{
            height: `${headerHeight}px`,
            flexShrink: 0,
            position: 'relative',
            borderBottom: `1px solid ${colors.rule}`,
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: `${leftHeaderTop}px`,
              lineHeight: headerLineHeight,
              letterSpacing: '0.01em',
              zIndex: 1,
              opacity: 0.82,
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                fontSize: `${headerFontSize}px`,
                color: colors.textSecondary,
                fontWeight: 560,
              }}
            >
              <span style={{ color: colors.textPrimary }}>
                FIFA Global Burden of Injury &amp;
              </span>
              <span>Illness in Football Project</span>
            </div>
          </div>

          {centerOverlay ? (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: '50%',
                transform: 'translateY(-50%)',
                width: `${crestSlotWidth}px`,
                height: `${crestSlotHeight}px`,
                zIndex: 2,
              }}
            >
              {centerOverlay}
            </div>
          ) : null}
        </div>

        <div style={{ flex: 1, position: 'relative' }}>{children}</div>
      </div>
    </AbsoluteFill>
  );
};
