import React from 'react';
import { AbsoluteFill } from 'remotion';

type WhiteBackgroundShellProps = {
  centerOverlay?: React.ReactNode;
  children?: React.ReactNode;
};

export const WhiteBackgroundShell: React.FC<WhiteBackgroundShellProps> = ({ centerOverlay, children }) => {
  const colors = {
    // White/near-white theme with pale FIFA blue accents
    bgDeep: '#FFFFFF',
    bgDark: '#F5F9FC',
    bgTeal: '#EEF5FA',
    bgMid: '#E9F1F8',
    bgSoft: '#DFEEF6',
    textPrimary: 'rgba(0, 87, 184, 0.52)',
    textSecondary: 'rgba(0, 87, 184, 0.3)',
    rule: 'rgba(0, 87, 184, 0.15)',
    pitchLine: 'rgba(0, 87, 184, 0.25)', // Clearer light blue outline
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
  const lockedHeaderZoneHeight = paddingTop + headerHeight + 28;

  const RightAnchorContainer: React.FC = () => {
    const strokeColor = 'rgba(0, 87, 184, 0.45)'; // Strong enough to retain pigment but not overpowering
    const strokeWidth = 4; // Finer, more architectural line weight for a premium feel

    return (
      <div style={{
        position: 'absolute',
        right: 0,
        top: 0,
        height: '100%',
        width: '60%',
        opacity: 0.35, // Balanced opacity
        // Smooth radial fade out from the bottom right corner
        maskImage: 'radial-gradient(ellipse 100% 100% at 100% 100%, black 15%, transparent 80%)',
        WebkitMaskImage: '-webkit-radial-gradient(100% 100%, ellipse, black 15%, transparent 80%)',
        zIndex: 2,
        pointerEvents: 'none'
      }}>
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
          <path
            d="M 0 420 H 1000"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <circle
            cx="940"
            cy="420"
            r="260"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <circle
            cx="940"
            cy="420"
            r="10"
            fill={strokeColor}
          />
        </svg>
      </div>
    );
  };

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.bgDeep, // #FFFFFF
        fontFamily: 'Inter, "Source Sans 3", sans-serif',
      }}
    >
      {/* 1. Base slide background structure, mirroring the blue shell's radial geometry */}
      <AbsoluteFill
        style={{
          background: [
            `radial-gradient(ellipse 130% 120% at 68% 42%, #FFFFFF 0%, #FFFFFF 18%, #FAFCFF 38%, #F5F9FC 62%, #E9F1F8 100%)`,
          ].join(', '),
        }}
      />

      {/* 2. The requested blue center glow, preserved and anchored to match the shell's core light source */}
      <div
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          background: `radial-gradient(ellipse 75% 65% at 68% 42%, rgba(110, 175, 235, 0.42) 0%, rgba(150, 205, 245, 0.22) 30%, rgba(255, 255, 255, 0) 68%)`,
        }}
      />

      {/* 3. The gloss/bright spot matching the blue shell exactly (80% 30%) */}
      <div
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          background: `radial-gradient(ellipse 80% 70% at 80% 30%, rgba(255, 255, 255, 0.8) 0%, transparent 70%)`,
        }}
      />

      {/* 4. Vignette shading matching the blue shell exactly (50% 50%) */}
      <div
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          background: `radial-gradient(ellipse 100% 100% at 50% 50%, transparent 40%, rgba(0, 40, 100, 0.035) 100%)`,
        }}
      />

      {/* 5. Top header shadow matching the blue shell exactly (180deg) */}
      <div
        style={{
          position: 'absolute',
          width: '100%',
          height: '260px',
          top: 0,
          background: `linear-gradient(180deg, rgba(0, 87, 184, 0.04) 0%, transparent 100%)`,
        }}
      />

      {/* Keep all background atmosphere subordinate to the fixed header treatment. */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: `${lockedHeaderZoneHeight}px`,
          background: `
            linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(255, 255, 255, 0.95) 68%, rgba(255, 255, 255, 0) 100%),
            radial-gradient(ellipse 120% 90% at 50% 0%, rgba(255, 255, 255, 0.88) 0%, rgba(255, 255, 255, 0.45) 62%, rgba(255, 255, 255, 0) 100%)
          `,
          zIndex: 4,
          pointerEvents: 'none',
        }}
      />

      <RightAnchorContainer />

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
          {/* Locked header structure. Do not move, resize, restyle, or reinterpret without explicit user approval. */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: `${leftHeaderTop}px`,
              lineHeight: headerLineHeight,
              letterSpacing: '0.01em',
              zIndex: 1,
              opacity: 0.84,
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
