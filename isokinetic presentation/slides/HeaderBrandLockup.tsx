import React from 'react';
import {Img} from 'remotion';

const ucdLogo = require('/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/isokinetic presentation/assets/branding/ucd-logo.png');
const fifaLogo = require('/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/isokinetic presentation/assets/branding/fifa-logo.png');
const isokineticLogo = require('/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/isokinetic presentation/assets/branding/isokinetic-logo.webp');

type HeaderBrandLockupProps = {
  theme: 'blue' | 'white';
};

export const HeaderBrandLockup: React.FC<HeaderBrandLockupProps> = ({theme}) => {
  const ucdImageStyle =
    theme === 'blue'
      ? {
          opacity: 0.56,
          filter: 'saturate(0.5) brightness(1.14) contrast(0.96)',
        }
      : {
          opacity: 0.72,
          filter: 'saturate(0.8) brightness(0.98) contrast(0.97)',
        };

  const fifaWordmarkStyle =
    theme === 'blue'
      ? {
          opacity: 0.24,
          filter: 'brightness(11) saturate(0)',
        }
      : {
          opacity: 0.34,
          filter:
            'invert(24%) sepia(91%) saturate(2372%) hue-rotate(200deg) brightness(97%) contrast(106%)',
        };

  const isokineticImageStyle =
    theme === 'blue'
      ? {
          opacity: 0.3,
          filter:
            'brightness(0) invert(1) saturate(0) drop-shadow(0 0 14px rgba(255, 255, 255, 0.05))',
        }
      : {
          opacity: 0.96,
          filter:
            'invert(24%) sepia(91%) saturate(2372%) hue-rotate(200deg) brightness(97%) contrast(106%) drop-shadow(0 0 8px rgba(0, 87, 184, 0.14)) drop-shadow(0 0 18px rgba(0, 87, 184, 0.1))',
        };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 20,
        transform: 'translateY(-6px)',
      }}
    >
      <div
        style={{
          width: 124,
          height: 56,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: 'absolute',
            width: 124,
            height: 44,
            overflow: 'hidden',
            ...fifaWordmarkStyle,
          }}
        >
          <Img
            src={fifaLogo}
            style={{
              position: 'absolute',
              left: -27,
              top: -49,
              width: 184,
              height: 129,
              objectFit: 'contain',
            }}
          />
        </div>
      </div>

      <div
        style={{
          width: 81,
          height: 81,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transform: 'translateX(10px)',
        }}
      >
        <Img
          src={ucdLogo}
          style={{
            width: 81,
            height: 81,
            objectFit: 'contain',
            ...ucdImageStyle,
          }}
        />
      </div>

      <div
        style={{
          width: 122,
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Img
          src={isokineticLogo}
          style={{
            width: 122,
            height: 52,
            objectFit: 'contain',
            objectPosition: 'center right',
            ...isokineticImageStyle,
          }}
        />
      </div>
    </div>
  );
};
