import React from 'react';
import {Img} from 'remotion';

const isokineticLogo = require('/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/isokinetic presentation/assets/branding/isokinetic-logo.webp');

type HeaderEventMarkProps = {
  theme: 'blue' | 'white';
};

export const HeaderEventMark: React.FC<HeaderEventMarkProps> = ({theme}) => {
  const logoStyle =
    theme === 'blue'
      ? {
          opacity: 0.28,
          filter: 'brightness(0) invert(1) saturate(0) drop-shadow(0 0 14px rgba(255, 255, 255, 0.06))',
        }
      : {
          opacity: 0.76,
          filter:
            'brightness(0) invert(1) saturate(0) drop-shadow(0 1px 0 rgba(0, 87, 184, 0.1)) drop-shadow(0 0 18px rgba(0, 87, 184, 0.12))',
        };

  return (
    <div
      style={{
        width: 116,
        height: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
      }}
    >
      <Img
        src={isokineticLogo}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          objectPosition: 'center right',
          ...logoStyle,
        }}
      />
    </div>
  );
};
