// Unit pictograms from the Claude Design handoff (sw-core.jsx + the
// planeswalker / translocator glyphs from the styles exploration), plus
// UnitPic — the skin-aware wrapper that swaps in the pixel-art sprites.

import type { UnitType } from '../game/data';
import type { ReactElement } from 'react';
import { useSkin } from './skin';

const ICON: Record<UnitType, ReactElement> = {
  swordsman: (
    <>
      <path fill="currentColor" d="M12 2 L13.7 7 L13 13.5 H11 L10.3 7 Z" />
      <rect fill="currentColor" x="7.2" y="13" width="9.6" height="2.1" rx="1" />
      <rect fill="currentColor" x="11" y="15" width="2" height="4" />
      <circle fill="currentColor" cx="12" cy="20.3" r="1.7" />
    </>
  ),
  archer: (
    <>
      <path fill="none" strokeWidth="2.1" d="M6.5 2.6 C12.6 7 12.6 17 6.5 21.4" />
      <line strokeWidth="1.3" x1="6.5" y1="3.4" x2="6.5" y2="20.6" />
      <line strokeWidth="1.7" x1="5" y1="12" x2="20.4" y2="12" />
      <path fill="currentColor" stroke="none" d="M21.6 12 L17.4 9.9 L17.4 14.1 Z" />
      <path fill="none" strokeWidth="1.5" d="M5 12 L7 10.1 M5 12 L7 13.9" />
    </>
  ),
  barbarian: (
    <>
      <rect fill="currentColor" stroke="none" x="11.2" y="2.4" width="1.6" height="19" rx="0.8" />
      <path
        fill="currentColor"
        stroke="none"
        d="M3 4 Q8 7 12 6.5 Q16 7 21 4 Q22.7 7.5 21 11 Q16 8 12 8.5 Q8 8 3 11 Q1.3 7.5 3 4 Z"
      />
    </>
  ),
  mountedarcher: (
    <path
      fill="currentColor"
      stroke="none"
      d="M21 12 C21.4 12.8 21 13.8 20 14 L18 14.5 C16.5 14.2 15.5 13.4 15 12.4 C14 14 13 16 11 18 L8.5 21 L5 21 C5 17 6 12 9.5 8.5 C10 6 10.5 4.5 11.5 3.5 L12 1.8 L13.2 4 L14.8 2.2 L15.8 4.6 C16.5 5.5 17 6.5 17.5 8 C18.5 9.5 19.8 10.8 21 12 Z"
    />
  ),
  catapult: (
    <>
      <circle fill="none" strokeWidth="1.7" cx="6.8" cy="18" r="2.7" />
      <circle fill="none" strokeWidth="1.7" cx="15.8" cy="18" r="2.7" />
      <line strokeWidth="1.8" x1="5.2" y1="15.2" x2="17.4" y2="15.2" />
      <line strokeWidth="1.8" x1="8" y1="15.2" x2="11" y2="9.8" />
      <line strokeWidth="1.8" x1="14.6" y1="15.2" x2="11" y2="9.8" />
      <line strokeWidth="2" x1="11" y1="10.2" x2="21" y2="4.4" />
      <circle fill="currentColor" stroke="none" cx="21.2" cy="3.9" r="2.2" />
    </>
  ),
  defender: (
    <path
      fill="currentColor"
      d="M12 2.5 L19.3 5.3 V11 C19.3 16.2 15.8 19.8 12 21.5 C8.2 19.8 4.7 16.2 4.7 11 V5.3 Z"
    />
  ),
  healer: <path fill="currentColor" d="M10 4 H14 V10 H20 V14 H14 V20 H10 V14 H4 V10 H10 Z" />,
  planeswalker: (
    <>
      <ellipse fill="none" strokeWidth="2" cx="14" cy="12" rx="4.6" ry="7.4" />
      <path fill="none" strokeWidth="2" d="M3 12 H9.4 M6.4 9.2 L9.4 12 L6.4 14.8" />
    </>
  ),
  translocator: (
    <>
      <path fill="none" strokeWidth="2" d="M5 9 H16 M13 6 L16.5 9 L13 12" />
      <path fill="none" strokeWidth="2" d="M19 15 H8 M11 18 L7.5 15 L11 12" />
    </>
  ),
};

export function Icon({ type }: { type: UnitType }) {
  return (
    <svg className="ic" viewBox="0 0 24 24">
      {ICON[type]}
    </svg>
  );
}

/** Skin-aware unit picture: watercolor pictogram or pixel-art sprite. */
export function UnitPic({ type }: { type: UnitType }) {
  const skin = useSkin();
  if (skin === 'pix') {
    return (
      <img
        className="pix-ic"
        src={`${import.meta.env.BASE_URL}pix/units/${type}.png`}
        alt=""
        draggable={false}
      />
    );
  }
  return <Icon type={type} />;
}
