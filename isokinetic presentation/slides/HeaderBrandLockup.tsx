import React from 'react';
import {Img} from 'remotion';

const ucdLogo = require('/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/isokinetic presentation/assets/branding/ucd-logo.png');
const fifaLogo = require('/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/isokinetic presentation/assets/branding/fifa-logo.png');

type HeaderBrandLockupProps = {
  theme: 'blue' | 'white';
};

export const HeaderBrandLockup: React.FC<HeaderBrandLockupProps> = ({theme}) => {
  const ucdImageStyle =
    theme === 'blue'
      ? {
          opacity: 0.62,
          filter: 'saturate(0.88) brightness(0.94)',
        }
      : {
          opacity: 0.68,
          filter: 'saturate(0.9) brightness(0.95)',
        };

  const fifaWordmarkStyle =
    theme === 'blue'
      ? {
          opacity: 0.14,
          filter: 'brightness(10)',
        }
      : {
          opacity: 0.15,
          filter:
            'invert(24%) sepia(91%) saturate(2372%) hue-rotate(200deg) brightness(97%) contrast(106%)',
        };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 30,
        transform: 'translateY(-10px)',
      }}
    >
      <Img
        src={ucdLogo}
        style={{
          height: 92.8,
          width: 'auto',
          objectFit: 'contain',
          ...ucdImageStyle,
        }}
      />

      <div
        style={{
          position: 'relative',
          width: 151.5,
          height: 52.5,
          overflow: 'hidden',
          flexShrink: 0,
          ...fifaWordmarkStyle,
        }}
      >
        <Img
          src={fifaLogo}
          style={{
            position: 'absolute',
            left: -34.5,
            top: -63.75,
            width: 240,
            height: 168,
            objectFit: 'contain',
          }}
        />
      </div>
    </div>
  );
};
