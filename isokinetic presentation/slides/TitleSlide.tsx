import React from 'react';
import {BlueBackgroundShell} from './BlueBackgroundShell';
import {HeaderBrandLockup} from './HeaderBrandLockup';

export const TitleSlide: React.FC = () => {
  const colors = {
    textPrimary: '#FFFFFF',
    textSecondary: '#A9C2D4',
    textAccent: '#1EA7F2',
    fifaBlue: '#0057B8',
  };

  return (
    <BlueBackgroundShell centerOverlay={<HeaderBrandLockup theme="blue" />} pitchVariant="box">
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          paddingBottom: '88px',
        }}
      >
        <div
          style={{
            width: '100px',
            height: '4px',
            background: `linear-gradient(90deg, ${colors.textAccent}, ${colors.fifaBlue})`,
            marginBottom: '40px',
          }}
        />

        <h1
          style={{
            fontSize: '84px',
            fontWeight: 700,
            color: colors.textPrimary,
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
            margin: '0 0 52px 0',
            maxWidth: '1300px',
            textShadow: '0 4px 24px rgba(0,0,0,0.3)',
          }}
        >
          Living Systematic Review of all Player Health Surveillance Studies in Football
        </h1>

        <div
          style={{
            fontSize: '36px',
            fontWeight: 500,
            color: colors.textSecondary,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <span style={{color: colors.textPrimary, fontWeight: 600}}>Abdel Rahman Babiker</span>
          <span>University College Dublin</span>
        </div>
      </div>
    </BlueBackgroundShell>
  );
};
