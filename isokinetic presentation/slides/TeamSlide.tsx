import React from 'react';
import {BlueBackgroundShell} from './BlueBackgroundShell';
import {HeaderBrandLockup} from './HeaderBrandLockup';

export const TeamSlide: React.FC = () => {
  const colors = {
    textPrimary: '#FFFFFF',
    textSecondary: 'rgba(255, 255, 255, 0.74)',
    textTertiary: 'rgba(255, 255, 255, 0.48)',
    fifaBlue: '#4DA3FF',
    fifaBlueDark: '#8BC4FF',
    fifaBlueSoft: 'rgba(77, 163, 255, 0.12)',
    blueRule: 'rgba(255, 255, 255, 0.12)',
    tealDark: '#D7ECFF',
    surfaceTint: 'rgba(255, 255, 255, 0.06)',
    accentCyan: '#1EA7F2',
    cardBg: 'rgba(255, 255, 255, 0.06)',
    cardBgStrong: 'rgba(255, 255, 255, 0.08)',
    cardBorderSoft: 'rgba(255, 255, 255, 0.10)',
  };

  const researchTeam = [
    {name: 'Okholm Kryger K', affil: 'UEFA / Loughborough Univ.'},
    {name: 'Weerasekara I', affil: 'Federation Univ., Australia'},
    {name: 'Mifsud D', affil: 'Malta FA / Mater Dei Hospital'},
    {name: 'Golden D', affil: 'NWSL / Univ. of Virginia'},
    {name: 'Sprouse B', affil: 'Nottingham Trent Univ.'},
    {name: 'Wagemans J', affil: 'Univ. of Antwerp'},
    {name: 'Chandran A', affil: 'Datalys Center, USA'},
    {name: 'Shafik A', affil: 'Chelsea FC'},
  ];

  return (
    <BlueBackgroundShell centerOverlay={<HeaderBrandLockup theme="blue" />} pitchVariant="halfway">
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            paddingTop: '40px',
            zIndex: 1,
          }}
        >
          
          {/* Main Title */}
          <div style={{display: 'flex', alignItems: 'center', marginBottom: '24px', gap: '20px'}}>
            <div
              style={{
                width: '5px',
                height: '42px',
                backgroundColor: colors.accentCyan,
                borderRadius: '3px',
              }}
            />
            <h2
              style={{
                fontSize: '50px',
                fontWeight: 700,
                color: colors.textPrimary,
                letterSpacing: '-0.03em',
                margin: 0,
              }}
            >
              Project Team
            </h2>
          </div>

          {/* Hierarchical Layout Container */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              flex: 1,
              paddingBottom: '16px',
            }}
          >
            
            {/* ROW 1: Project Lead Full Width Card */}
            <div
              style={{
                display: 'flex',
                backgroundColor: colors.cardBgStrong,
                borderRadius: '16px',
                padding: '28px 48px',
                border: `1px solid ${colors.cardBorderSoft}`,
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.18)',
                position: 'relative',
                overflow: 'hidden',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  bottom: 0,
                  width: '4px',
                  backgroundColor: colors.fifaBlue,
                }}
              />

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{
                  display: 'inline-flex',
                  backgroundColor: colors.fifaBlueSoft,
                  color: colors.accentCyan,
                  fontSize: '11px',
                  fontWeight: 800,
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  marginBottom: '12px',
                  alignSelf: 'flex-start'
                }}>
                  Project Lead
                </div>
                
                <div style={{
                  fontSize: '34px',
                  fontWeight: 700,
                  color: colors.textPrimary,
                  letterSpacing: '-0.02em',
                }}>
                  Abdel Rahman Babiker
                </div>
              </div>
              
              <div
                style={{
                  fontSize: '18px',
                  color: colors.textSecondary,
                  lineHeight: 1.5,
                  borderLeft: `2px solid rgba(255, 255, 255, 0.12)`,
                  paddingLeft: '32px',
                  maxWidth: '45%',
                }}
              >
                School of Public Health, Physiotherapy &amp; Sports Science
                <br />
                <strong style={{color: colors.textPrimary}}>University College Dublin, Ireland</strong>
              </div>
            </div>

            {/* ROW 2: FIFA and UCD Split Cards */}
            <div style={{ display: 'flex', gap: '24px' }}>
              {/* UCD Card: Slight Blue */}
              <div style={{
                backgroundColor: 'rgba(77, 163, 255, 0.12)',
                borderRadius: '16px',
                padding: '24px 40px',
                border: `1px solid rgba(77, 163, 255, 0.18)`,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: '16px',
                flex: 1, 
              }}>
                <div style={{ fontSize: '22px', fontWeight: 800, color: colors.fifaBlue, letterSpacing: '-0.01em' }}>
                  University College Dublin
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {['van Dyk N', 'Delahunt E', 'Holden S'].map((name, i) => (
                    <div key={i} style={{ 
                      padding: '10px 18px', 
                      backgroundColor: 'rgba(255, 255, 255, 0.10)', 
                      borderRadius: '8px', 
                      fontWeight: 700, 
                      color: colors.textPrimary, 
                      fontSize: '22px', 
                      border: `1px solid rgba(255, 255, 255, 0.10)`,
                      boxShadow: '0 12px 24px rgba(0, 0, 0, 0.12)' 
                    }}>
                      {name}
                    </div>
                  ))}
                </div>
              </div>

              {/* FIFA Card: White with blue accents */}
              <div style={{
                backgroundColor: colors.cardBgStrong,
                borderRadius: '16px',
                padding: '24px 40px',
                border: `1px solid ${colors.cardBorderSoft}`,
                boxShadow: '0 20px 36px rgba(0, 0, 0, 0.18)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: '16px',
                flex: 1, 
              }}>
                 <div style={{ fontSize: '22px', fontWeight: 800, color: colors.tealDark, letterSpacing: '-0.01em' }}>
                  FIFA Medical
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {['Clarsen B', 'Serner A', 'Massey A'].map((name, i) => (
                    <div key={i} style={{ 
                      padding: '10px 18px', 
                      backgroundColor: colors.surfaceTint, 
                      border: `1px solid ${colors.cardBorderSoft}`,
                      borderRadius: '8px', 
                      fontWeight: 700, 
                      color: colors.textPrimary, 
                      fontSize: '22px' 
                    }}>
                      {name}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ROW 3: Big Large Card containing the team */}
            <div style={{
              flex: 1,
              backgroundColor: colors.cardBgStrong,
              borderRadius: '16px',
              padding: '32px 48px',
              border: `1px solid ${colors.cardBorderSoft}`,
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.18)',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative'
            }}>
              
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                marginBottom: '32px',
                gap: '16px'
              }}>
                <div style={{
                  display: 'inline-flex',
                  backgroundColor: colors.surfaceTint,
                  border: `1px solid ${colors.cardBorderSoft}`,
                  color: colors.textPrimary,
                  fontSize: '12px',
                  fontWeight: 700,
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  padding: '6px 14px',
                  borderRadius: '20px',
                }}>
                  Project Team
                </div>
                <div style={{flex: 1, height: '1px', backgroundColor: colors.blueRule}} />
              </div>

              {/* 4x2 Horizontal Grid for Team Members */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '24px',
                flex: 1,
                alignContent: 'center',
              }}>
                {researchTeam.map((author, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    padding: '20px',
                    backgroundColor: colors.surfaceTint,
                    borderRadius: '12px',
                    border: `1px solid rgba(255, 255, 255, 0.08)`,
                  }}>
                    <div style={{
                      fontSize: '17px',
                      fontWeight: 600,
                      color: colors.textPrimary,
                      letterSpacing: '-0.01em',
                      marginBottom: '6px',
                    }}>
                      {author.name}
                    </div>
                    <div style={{
                      fontSize: '14px',
                      color: colors.textSecondary,
                      lineHeight: 1.4,
                    }}>
                      {author.affil}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* ── Footer ── */}
        <div
          style={{
            height: '40px',
            marginTop: 'auto',
            display: 'flex',
            alignItems: 'center',
            zIndex: 1,
          }}
        />
      </div>
    </BlueBackgroundShell>
  );
};
