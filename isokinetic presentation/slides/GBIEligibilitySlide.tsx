import React from 'react';
import { useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { BlueBackgroundShell } from './BlueBackgroundShell';
import { HeaderBrandLockup } from './HeaderBrandLockup';

export const GBIEligibilitySlide: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Animation timing: sequential reveals
  const titleReveal = spring({ frame: frame - 15, fps, config: { damping: 14 } });
  const includePanelReveal = spring({ frame: frame - 30, fps, config: { damping: 14 } });
  const excludePanelReveal = spring({ frame: frame - 45, fps, config: { damping: 14 } });
  const includeItemsReveal = spring({ frame: frame - 60, fps, config: { damping: 14 } });
  const excludeItemsReveal = spring({ frame: frame - 90, fps, config: { damping: 14 } });
  const takeawayReveal = spring({ frame: frame - 130, fps, config: { damping: 14 } });
  const referenceReveal = spring({ frame: frame - 140, fps, config: { damping: 14 } });

  // Final beat: spotlight the two key exclusion reasons by dimming everything else
  const spotlightProgress = spring({ frame: frame - 185, fps, config: { damping: 16 } });
  const includePanelDim = interpolate(spotlightProgress, [0, 1], [1, 0.2]);
  const secondaryExcludeDim = interpolate(spotlightProgress, [0, 1], [1, 0.2]);
  const keyHighlightBg = interpolate(spotlightProgress, [0, 1], [0, 0.45]);
  const keyHighlightBorder = interpolate(spotlightProgress, [0, 1], [0, 0.7]);

  const colors = {
    fifaBlue: '#4DA3FF',
    fifaBlueDark: '#8BC4FF',
    includeAccent: '#0F8B4D',
    includeAccentLight: 'rgba(15, 139, 77, 0.12)',
    includeAccentBorder: 'rgba(15, 139, 77, 0.24)',
    excludeAccent: '#C23B3B',
    excludeAccentLight: 'rgba(194, 59, 59, 0.10)',
    excludeAccentBorder: 'rgba(194, 59, 59, 0.20)',
    textPrimary: '#FFFFFF',
    textSecondary: 'rgba(255, 255, 255, 0.78)',
    textMuted: 'rgba(255, 255, 255, 0.56)',
    divider: 'rgba(255, 255, 255, 0.10)',
    panelBg: 'rgba(255, 255, 255, 0.06)',
  };

  const commonPanelStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    borderRadius: '14px',
    padding: '38px 44px',
    border: '1px solid',
    boxShadow: '0 22px 42px rgba(0, 0, 0, 0.18)',
  };

  const panelHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    marginBottom: '28px',
    paddingBottom: '20px',
  };

  const iconStyle = (bg: string, color: string): React.CSSProperties => ({
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    backgroundColor: bg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color,
    fontSize: '20px',
    fontWeight: 700,
    lineHeight: 1,
  });

  const bulletItemStyle: React.CSSProperties = {
    fontSize: '28px',
    color: colors.textPrimary,
    lineHeight: 1.5,
    fontWeight: 400,
    paddingLeft: '22px',
    position: 'relative',
  };

  const bulletDotStyle = (accentColor: string): React.CSSProperties => ({
    position: 'absolute',
    left: 0,
    top: '15px',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: accentColor,
  });

  return (
    <BlueBackgroundShell centerOverlay={<HeaderBrandLockup theme="blue" />} pitchVariant="halfway">
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingTop: '72px' }}>

        {/* Header Section */}
        <div style={{
          opacity: titleReveal,
          transform: `translateY(${interpolate(titleReveal, [0, 1], [30, 0])}px)`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginBottom: '28px',
        }}>
          <h1 style={{
            fontSize: '52px',
            fontWeight: 700,
            color: colors.fifaBlue,
            margin: 0,
            letterSpacing: '-0.02em',
          }}>
            Inclusion &amp; Exclusion Criteria
          </h1>
          <h2 style={{
            fontSize: '28px',
            fontWeight: 400,
            color: colors.textMuted,
            margin: '8px 0 0 0',
          }}>
            Broad scope, strict eligibility
          </h2>
        </div>

        {/* Panels Container */}
        <div style={{
          display: 'flex',
          gap: '40px',
          flex: 1,
          padding: '0 48px',
        }}>

          {/* Include Panel */}
          <div style={{
            ...commonPanelStyle,
            background: `linear-gradient(180deg, ${colors.includeAccentLight} 0%, ${colors.panelBg} 100%)`,
            borderColor: colors.includeAccentBorder,
            borderLeft: `4px solid ${colors.includeAccent}`,
            opacity: includePanelReveal * includePanelDim,
            transform: `translateY(${interpolate(includePanelReveal, [0, 1], [40, 0])}px)`,
          }}>
            <div style={{
              ...panelHeaderStyle,
              borderBottom: `1px solid ${colors.includeAccentBorder}`,
            }}>
              <div style={iconStyle(colors.includeAccent, '#FFFFFF')}>✓</div>
              <h3 style={{ fontSize: '32px', fontWeight: 700, margin: 0, color: colors.textPrimary }}>Include</h3>
            </div>

            <div style={{
              display: 'flex', flexDirection: 'column', gap: '22px',
              opacity: includeItemsReveal,
              transform: `translateY(${interpolate(includeItemsReveal, [0, 1], [20, 0])}px)`,
            }}>
              <div style={bulletItemStyle}>
                <div style={bulletDotStyle(colors.includeAccent)} />
                Prospective surveillance studies
              </div>
              <div style={bulletItemStyle}>
                <div style={bulletDotStyle(colors.includeAccent)} />
                Competitive FIFA football disciplines: Association, Futsal, Beach, Para
              </div>
              <div style={bulletItemStyle}>
                <div style={bulletDotStyle(colors.includeAccent)} />
                All sexes, ages, levels, locations
              </div>
              <div style={bulletItemStyle}>
                <div style={bulletDotStyle(colors.includeAccent)} />
                Any language
              </div>
            </div>
          </div>

          {/* Exclude Panel */}
          <div style={{
            ...commonPanelStyle,
            background: `linear-gradient(180deg, ${colors.excludeAccentLight} 0%, ${colors.panelBg} 100%)`,
            borderColor: colors.excludeAccentBorder,
            borderLeft: `4px solid ${colors.excludeAccent}`,
            opacity: excludePanelReveal,
            transform: `translateY(${interpolate(excludePanelReveal, [0, 1], [40, 0])}px)`,
          }}>
            <div style={{
              ...panelHeaderStyle,
              borderBottom: `1px solid ${colors.excludeAccentBorder}`,
            }}>
              <div style={iconStyle(colors.excludeAccent, '#FFFFFF')}>✕</div>
              <h3 style={{ fontSize: '32px', fontWeight: 700, margin: 0, color: colors.textPrimary }}>Exclude</h3>
            </div>

            <div style={{
              display: 'flex', flexDirection: 'column', gap: '22px',
              opacity: excludeItemsReveal,
              transform: `translateY(${interpolate(excludeItemsReveal, [0, 1], [20, 0])}px)`,
            }}>
              {/* KEY: Retrospective  -  spotlighted */}
              <div style={{
                ...bulletItemStyle,
                backgroundColor: `rgba(255, 255, 0, ${keyHighlightBg})`,
                borderLeft: `3px solid rgba(255, 255, 0, ${keyHighlightBorder})`,
                borderRadius: '8px',
                padding: '8px 12px 8px 28px',
                margin: '-8px -12px',
              }}>
                <div style={{ ...bulletDotStyle(colors.excludeAccent), top: '22px' }} />
                Retrospective, cross-sectional, case-control
              </div>
              {/* Secondary  -  dims */}
              <div style={{ ...bulletItemStyle, opacity: secondaryExcludeDim }}>
                <div style={bulletDotStyle(colors.excludeAccent)} />
                Non-competitive or non-FIFA football
              </div>
              {/* KEY: No exposure reporting  -  spotlighted */}
              <div style={{
                ...bulletItemStyle,
                backgroundColor: `rgba(255, 255, 0, ${keyHighlightBg})`,
                borderLeft: `3px solid rgba(255, 255, 0, ${keyHighlightBorder})`,
                borderRadius: '8px',
                padding: '8px 12px 8px 28px',
                margin: '-8px -12px',
              }}>
                <div style={{ ...bulletDotStyle(colors.excludeAccent), top: '22px' }} />
                No exposure-based outcome reporting
              </div>
              {/* Secondary  -  dims */}
              <div style={{ ...bulletItemStyle, opacity: secondaryExcludeDim }}>
                <div style={bulletDotStyle(colors.excludeAccent)} />
                Registers, hospital records, public databases only
              </div>
            </div>
          </div>
        </div>

        {/* Takeaway line with reference framing */}
        <div style={{
          marginTop: '24px',
          display: 'flex',
          justifyContent: 'center',
          opacity: takeawayReveal,
          transform: `translateY(${interpolate(takeawayReveal, [0, 1], [10, 0])}px)`,
        }}>
          <div style={{
            fontSize: '24px',
            fontWeight: 500,
            color: colors.fifaBlue,
            letterSpacing: '0.01em',
            padding: '13px 34px',
            backgroundColor: 'rgba(77, 163, 255, 0.10)',
            border: '1px solid rgba(77, 163, 255, 0.18)',
            borderRadius: '100px',
          }}>
            Prioritising prospective, exposure-based evidence for comparable incidence and burden estimates
          </div>
        </div>

        {/* Footer citation */}
        <div style={{
          marginTop: '16px',
          paddingBottom: '4px',
          display: 'flex',
          justifyContent: 'center',
          opacity: referenceReveal * 0.7,
          transform: `translateY(${interpolate(referenceReveal, [0, 1], [6, 0])}px)`,
        }}>
          <div style={{
            fontSize: '16px',
            fontWeight: 400,
            color: colors.textMuted,
            letterSpacing: '0.01em',
            fontStyle: 'italic',
          }}>
            Fuller et al. 2006; Bahr et al. 2020
          </div>
        </div>

      </div>
    </BlueBackgroundShell>
  );
};
