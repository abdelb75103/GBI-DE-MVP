import React from 'react';
import { useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { BlueBackgroundShell } from './BlueBackgroundShell';
import { HeaderBrandLockup } from './HeaderBrandLockup';

/* ── Inline SVG icons ─────────────────────────────────────────── */

const DatabaseIcon = ({ size = 20, color = '#1EA7F2' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M21 12c0 1.66-4.03 3-9 3s-9-1.34-9-3" />
    <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
  </svg>
);

const FilterIcon = ({ size = 20, color = '#1EA7F2' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

const RefreshIcon = ({ size = 22, color = '#1EA7F2' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const CalendarIcon = ({ size = 20, color = '#1EA7F2' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const LayersIcon = ({ size = 20, color = '#1EA7F2' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </svg>
);

const CpuIcon = ({ size = 20, color = '#1EA7F2' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
    <rect x="9" y="9" width="6" height="6" />
    <line x1="9" y1="1" x2="9" y2="4" />
    <line x1="15" y1="1" x2="15" y2="4" />
    <line x1="9" y1="20" x2="9" y2="23" />
    <line x1="15" y1="20" x2="15" y2="23" />
    <line x1="20" y1="9" x2="23" y2="9" />
    <line x1="20" y1="14" x2="23" y2="14" />
    <line x1="1" y1="9" x2="4" y2="9" />
    <line x1="1" y1="14" x2="4" y2="14" />
  </svg>
);

/* ── Main slide ───────────────────────────────────────────────── */

export const SearchFlowSlide: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  /* Reveal 1  -  title + subtitle pill */
  const titleReveal = spring({ frame: frame - 15, fps, config: { damping: 14 } });
  /* Reveal 2  -  records identified + duplicates */
  const identifiedReveal = spring({ frame: frame - 50, fps, config: { damping: 14 } });
  /* Reveal 3  -  screened + full texts */
  const screenedReveal = spring({ frame: frame - 80, fps, config: { damping: 14 } });
  /* Reveal 4  -  living panel + endpoint */
  const livingReveal = spring({ frame: frame - 110, fps, config: { damping: 14 } });
  const endpointReveal = spring({ frame: frame - 125, fps, config: { damping: 14 } });

  const c = {
    white: '#FFFFFF',
    text: 'rgba(255,255,255,0.78)',
    muted: 'rgba(255,255,255,0.46)',
    accent: '#1EA7F2',
    accentGlow: 'rgba(30,167,242,0.14)',
    accentBorder: 'rgba(30,167,242,0.4)',
    accentSoft: 'rgba(30,167,242,0.08)',
    pillBg: 'rgba(30,167,242,0.10)',
    pillBorder: 'rgba(30,167,242,0.30)',
    card: 'rgba(255,255,255,0.045)',
    border: 'rgba(255,255,255,0.1)',
    connector: 'rgba(255,255,255,0.2)',
    badge: 'rgba(14,52,71,0.95)',
  };

  /* ── Sub-components ──────────────────────────────────────────── */

  const CountCard = ({
    label, count, reveal, isFinal = false, subtitle,
  }: {
    label: string; count?: string; reveal: number; isFinal?: boolean; subtitle?: string;
  }) => (
    <div style={{
      backgroundColor: isFinal ? c.accentGlow : c.card,
      border: `1.5px solid ${isFinal ? c.accentBorder : c.border}`,
      borderRadius: '16px',
      padding: count ? '20px 36px 24px' : '18px 36px',
      width: '100%',
      opacity: reveal,
      transform: `translateY(${interpolate(reveal, [0, 1], [14, 0])}px)`,
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      ...(isFinal ? { boxShadow: '0 0 32px rgba(30,167,242,0.1)' } : {}),
    }}>
      <div style={{
        fontSize: '22px',
        fontWeight: 500,
        color: c.muted,
        letterSpacing: '0.02em',
      }}>
        {label}
      </div>
      {count && (
        <div style={{
          fontSize: '58px',
          fontWeight: 700,
          color: c.white,
          lineHeight: 1.05,
          marginTop: '4px',
          letterSpacing: '-0.02em',
        }}>
          {count}
        </div>
      )}
      {subtitle && (
        <div style={{
          fontSize: '24px',
          fontWeight: 600,
          color: c.accent,
          marginTop: '6px',
        }}>
          {subtitle}
        </div>
      )}
    </div>
  );

  const Connector = ({ reveal, badge }: { reveal: number; badge?: string }) => (
    <div style={{
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      height: badge ? '52px' : '38px',
      opacity: reveal,
      position: 'relative' as const,
      width: '100%',
    }}>
      <div style={{ width: '2px', flex: 1, backgroundColor: c.connector }} />
      <div style={{
        width: 0, height: 0,
        borderLeft: '5px solid transparent',
        borderRight: '5px solid transparent',
        borderTop: `5px solid ${c.connector}`,
      }} />
      {badge && (
        <div style={{
          position: 'absolute' as const,
          left: '55%',
          top: '50%',
          transform: 'translateY(-50%)',
          backgroundColor: c.badge,
          border: `1px solid ${c.accentBorder}`,
          borderRadius: '20px',
          padding: '5px 20px',
          fontSize: '19px',
          fontWeight: 600,
          color: c.accent,
          whiteSpace: 'nowrap' as const,
        }}>
          {badge}
        </div>
      )}
    </div>
  );

  const LivingItem = ({ icon, text }: { icon: React.ReactNode; text: string }) => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '18px',
      fontSize: '27px',
      color: c.text,
      fontWeight: 400,
    }}>
      <div style={{
        width: '44px',
        height: '44px',
        borderRadius: '10px',
        backgroundColor: c.accentGlow,
        border: `1px solid ${c.accentSoft}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        {icon}
      </div>
      {text}
    </div>
  );

  /* ── Render ──────────────────────────────────────────────────── */

  return (
    <BlueBackgroundShell centerOverlay={<HeaderBrandLockup theme="blue" />} pitchVariant="box">
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        paddingTop: '42px',
        paddingBottom: '8px',
      }}>

        {/* ── Title area (Reveal 1) ──────────────────────────── */}
        <div style={{
          opacity: titleReveal,
          transform: `translateY(${interpolate(titleReveal, [0, 1], [18, 0])}px)`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          marginBottom: '20px',
        }}>
          <h1 style={{
            fontSize: '50px',
            fontWeight: 700,
            color: c.white,
            margin: '0 0 16px 0',
            letterSpacing: '-0.02em',
          }}>
            Systematic Search and Screening
          </h1>

          {/* Accent pill  -  single line, databases + notes */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '12px',
            backgroundColor: c.pillBg,
            border: `1px solid ${c.pillBorder}`,
            borderRadius: '28px',
            padding: '12px 34px',
          }}>
            <DatabaseIcon size={19} color={c.accent} />
            <span style={{ fontSize: '22px', fontWeight: 600, color: c.accent, letterSpacing: '0.01em' }}>
              MEDLINE
            </span>
            <span style={{ color: c.muted, fontSize: '18px' }}>&middot;</span>
            <span style={{ fontSize: '22px', fontWeight: 600, color: c.accent }}>
              PubMed
            </span>
            <span style={{ color: c.muted, fontSize: '18px' }}>&middot;</span>
            <span style={{ fontSize: '22px', fontWeight: 600, color: c.accent }}>
              Embase
            </span>
            <span style={{ color: c.muted, fontSize: '18px' }}>&middot;</span>
            <span style={{ fontSize: '22px', fontWeight: 600, color: c.accent }}>
              SPORTDiscus
            </span>
            <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '20px', margin: '0 6px' }}>|</span>
            <span style={{ fontSize: '19px', fontWeight: 400, color: c.text }}>
              Reference-list screening
            </span>
            <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '20px' }}>|</span>
            <span style={{ fontSize: '19px', fontWeight: 400, color: c.text }}>
              No language restrictions
            </span>
          </div>
        </div>

        {/* ── Two-column content ──────────────────────────────── */}
        <div style={{
          display: 'flex',
          gap: '64px',
          flex: 1,
          padding: '16px 72px 0',
        }}>

          {/* ── Left: Pipeline ────────────────────────────────── */}
          <div style={{
            flex: 1.1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            alignItems: 'center',
            paddingBottom: '4px',
          }}>
            <CountCard label="Records identified" count="48,043" reveal={identifiedReveal} />
            <Connector reveal={identifiedReveal} badge="Duplicates removed: 24,839" />
            <CountCard label="Title and abstract screened" count="23,204" reveal={screenedReveal} />
            <Connector reveal={screenedReveal} />
            <div style={{width: '100%', opacity: screenedReveal, transform: `translateY(${interpolate(screenedReveal, [0, 1], [14, 0])}px)`}}>
              <CountCard label="Full texts assessed for eligibility" count="882" reveal={1} />
              <div style={{
                marginTop: '10px',
                textAlign: 'center',
                fontSize: '16px',
                lineHeight: 1.35,
                color: c.muted,
                maxWidth: '90%',
                marginLeft: 'auto',
                marginRight: 'auto',
              }}>
                Note: 40 foreign-language papers are being translated and 33 requested full texts remain under follow-up before extraction.
              </div>
            </div>
            <Connector reveal={endpointReveal} />
            <CountCard
              label="Extraction set"
              count="559"
              reveal={endpointReveal}
              isFinal
            />
          </div>

          {/* ── Right: Living system panel (Reveal 4) ─────────── */}
          <div style={{
            flex: 0.85,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            paddingBottom: '4px',
            opacity: livingReveal,
            transform: `translateX(${interpolate(livingReveal, [0, 1], [28, 0])}px)`,
          }}>
            <div style={{
              alignSelf: 'flex-start',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '18px',
              padding: '10px 18px',
              borderRadius: '16px',
              backgroundColor: c.pillBg,
              border: `1px solid ${c.pillBorder}`,
            }}>
              <CalendarIcon size={18} color={c.accent} />
              <div style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: '10px',
                whiteSpace: 'nowrap',
              }}>
                <span style={{fontSize: '15px', fontWeight: 700, color: c.muted, letterSpacing: '0.08em', textTransform: 'uppercase'}}>
                  Search Date
                </span>
                <span style={{fontSize: '22px', fontWeight: 600, color: c.white, letterSpacing: '-0.01em'}}>
                  28 May 2024
                </span>
              </div>
            </div>
            <div style={{
              backgroundColor: c.card,
              border: `1.5px solid ${c.border}`,
              borderRadius: '20px',
              padding: '48px 44px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 44px rgba(0,0,0,0.18)',
            }}>
              {/* Panel heading */}
              <div style={{
                fontSize: '32px',
                fontWeight: 700,
                color: c.white,
                marginBottom: '36px',
              }}>
                Living Review Workflow
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                <LivingItem icon={<CalendarIcon size={20} color={c.accent} />} text="Annual update cycle" />
                <LivingItem icon={<DatabaseIcon size={20} color={c.accent} />} text="Recurring database searches" />
                <LivingItem icon={<FilterIcon size={20} color={c.accent} />} text="Structured screening and extraction" />
                <LivingItem icon={<LayersIcon size={20} color={c.accent} />} text="Incremental evidence integration" />
                <LivingItem icon={<CpuIcon size={20} color={c.accent} />} text="Future AI-assisted workflow support" />
              </div>
            </div>
          </div>

        </div>
      </div>
    </BlueBackgroundShell>
  );
};
