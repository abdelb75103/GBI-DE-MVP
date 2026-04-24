import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { BlueBackgroundShell } from './BlueBackgroundShell';
import { HeaderBrandLockup } from './HeaderBrandLockup';

export const GBIIntroSlide: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const colors = {
    textPrimary: '#FFFFFF',
    textSecondary: 'rgba(255, 255, 255, 0.72)',
    textAccent: '#1EA7F2',
    fifaBlue: '#0057B8',
    boxBg: 'rgba(255, 255, 255, 0.03)',
    boxBorder: 'rgba(255, 255, 255, 0.08)',
    glow: 'rgba(30, 167, 242, 0.12)',
  };

  // Animation Timings (Click/Speech-cued simulate via sequence)
  const tHeadline = spring({ frame: frame - 15, fps, config: { damping: 22, stiffness: 120 } });
  const tDef = spring({ frame: frame - 30, fps, config: { damping: 22, stiffness: 120 } });
  
  // Left Fragments
  const tFrag1 = spring({ frame: frame - 60, fps, config: { damping: 22, stiffness: 120 } });
  const tFrag2 = spring({ frame: frame - 70, fps, config: { damping: 22, stiffness: 120 } });
  const tFrag3 = spring({ frame: frame - 80, fps, config: { damping: 22, stiffness: 120 } });
  
  // Center System
  const tSystem = spring({ frame: frame - 120, fps, config: { damping: 22, stiffness: 120 } });
  
  // Right Anchors
  const tVal1 = spring({ frame: frame - 160, fps, config: { damping: 22, stiffness: 120 } });
  const tVal2 = spring({ frame: frame - 170, fps, config: { damping: 22, stiffness: 120 } });
  const tVal3 = spring({ frame: frame - 180, fps, config: { damping: 22, stiffness: 120 } });
  const tVal4 = spring({ frame: frame - 190, fps, config: { damping: 22, stiffness: 120 } });
  const tVal5 = spring({ frame: frame - 200, fps, config: { damping: 22, stiffness: 120 } });
  
  // Final emphasis
  const tProp = spring({ frame: frame - 250, fps, config: { damping: 22, stiffness: 120 } });

  const inputStyle = (animVal: number): React.CSSProperties => ({
    padding: '24px 32px',
    backgroundColor: colors.boxBg,
    border: `1px solid ${colors.boxBorder}`,
    borderRadius: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    opacity: animVal,
    transform: `translateX(${(1 - animVal) * -20}px)`,
    backdropFilter: 'blur(10px)',
  });

  const anchorStyle = (animVal: number): React.CSSProperties => ({
    padding: '16px 24px',
    backgroundColor: colors.boxBg,
    border: `1px solid ${colors.boxBorder}`,
    borderRadius: '12px',
    fontWeight: 500,
    fontSize: '22px',
    color: colors.textPrimary,
    opacity: animVal,
    transform: `translateX(${(1 - animVal) * -20}px)`,
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    backdropFilter: 'blur(10px)',
  });

  return (
    <BlueBackgroundShell centerOverlay={<HeaderBrandLockup theme="blue" />} pitchVariant="box">
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        
        {/* Header Section */}
        <div style={{ marginTop: '20px', opacity: tHeadline, transform: `translateY(${(1 - tHeadline) * 20}px)` }}>
          <h1 style={{
            fontSize: '56px',
            fontWeight: 700,
            color: colors.textPrimary,
            letterSpacing: '-0.02em',
            margin: '0 0 16px 0'
          }}>
            A Living Evidence System For The Global Game
          </h1>
        </div>

        <div style={{ opacity: tDef, transform: `translateY(${(1 - tDef) * 20}px)` }}>
          <div style={{
            fontSize: '26px',
            color: colors.textSecondary,
            fontWeight: 400,
            maxWidth: '1200px',
            lineHeight: 1.4,
            marginBottom: '40px'
          }}>
            The biggest systematic review of its kind, built to address fragmented and unrepresentative evidence by establishing a central knowledge base.
          </div>
        </div>

        {/* Concept Flow */}
        <div style={{ 
          display: 'flex', 
          flex: 1, 
          alignItems: 'center', 
          gap: '64px',
          paddingBottom: '32px'
        }}>
          
          {/* Left: Scattered Fragments */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{
              fontSize: '14px',
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              color: colors.textAccent,
              fontWeight: 700,
              opacity: tFrag1,
              marginBottom: '4px'
            }}>
              Scattered Evidence
            </div>
            
            <div style={inputStyle(tFrag1)}>
              <span style={{ fontSize: '20px', fontWeight: 600, color: colors.textPrimary }}>Disciplines</span>
              <span style={{ fontSize: '18px', color: colors.textSecondary }}>Association / Futsal / Beach / Para</span>
            </div>
            <div style={inputStyle(tFrag2)}>
              <span style={{ fontSize: '20px', fontWeight: 600, color: colors.textPrimary }}>Populations</span>
              <span style={{ fontSize: '18px', color: colors.textSecondary }}>All Sexes / Ages / Levels / Regions</span>
            </div>
            <div style={inputStyle(tFrag3)}>
              <span style={{ fontSize: '20px', fontWeight: 600, color: colors.textPrimary }}>Outcomes</span>
              <span style={{ fontSize: '18px', color: colors.textSecondary }}>Injury / Illness / Mental Health</span>
            </div>
          </div>

          {/* Center: Converging System */}
          <div style={{ 
            width: '420px', 
            opacity: tSystem,
            transform: `scale(${interpolate(tSystem, [0, 1], [0.95, 1])})`,
            position: 'relative'
          }}>
            <div style={{
              padding: '56px 40px',
              background: `linear-gradient(145deg, rgba(30, 167, 242, 0.05) 0%, rgba(0,0,0,0.3) 100%)`,
              border: `1px solid ${colors.boxBorder}`,
              boxShadow: `0 0 80px ${colors.glow}, inset 0 0 40px rgba(30, 167, 242, 0.05)`,
              borderRadius: '24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: '24px',
              position: 'relative',
              backdropFilter: 'blur(20px)'
            }}>
              <div style={{
                color: colors.textPrimary,
                fontSize: '44px',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                lineHeight: 1.1
              }}>
                FIFA GBI
              </div>
              <div style={{ 
                width: '48px', 
                height: '4px', 
                background: `linear-gradient(90deg, ${colors.textAccent}, #FFFFFF)`, 
                borderRadius: '2px' 
              }} />
              <div style={{
                fontSize: '22px',
                color: colors.textSecondary,
                fontWeight: 400,
                lineHeight: 1.4
              }}>
                Living Systematic Review &amp;<br />Bayesian Meta-Analysis
              </div>
            </div>
          </div>

          {/* Right: Value Anchor Pillars */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={anchorStyle(tVal1)}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: colors.textAccent }} /> Living
            </div>
            <div style={anchorStyle(tVal2)}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: colors.textAccent }} /> Standardised
            </div>
            <div style={anchorStyle(tVal3)}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: colors.textAccent }} /> Comparable
            </div>
            <div style={anchorStyle(tVal4)}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: colors.textAccent }} /> Global
            </div>
            <div style={anchorStyle(tVal5)}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: colors.textAccent }} /> Centralised
            </div>
          </div>

        </div>

        {/* Final Main Proposition */}
        <div style={{ 
          marginTop: 'auto',
          opacity: tProp,
          transform: `translateY(${(1 - tProp) * 20}px)`
        }}>
          <div style={{
            fontSize: '32px',
            fontWeight: 500,
            color: colors.textPrimary,
            letterSpacing: '-0.01em',
            padding: '24px 32px',
            margin: '0 auto',
            borderLeft: `3px solid ${colors.textAccent}`,
            background: `linear-gradient(90deg, rgba(30, 167, 242, 0.08) 0%, transparent 100%)`,
          }}>
            FIFA GBI turns scattered football health evidence into standardised, comparable, continuously updating evidence.
          </div>
        </div>

      </div>
    </BlueBackgroundShell>
  );
};
