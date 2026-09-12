'use strict';
/**
 * Hand-drawn inline SVG icon set. No external icon font/library, no network
 * fetch — every icon is a plain string embedded directly into the page, so
 * nothing about which categories exist is ever visible to a third party.
 *
 * Style: 24x24 viewBox, stroke=currentColor, stroke-width 2, round caps —
 * matches the back-arrow chevrons already used in the template.
 */

const S = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

const ICONS = {
  hotel: `<svg viewBox="0 0 24 24" ${S}><path d="M3 21V8l7-4 7 4v13"/><path d="M3 21h18"/><path d="M9 21v-6h6v6"/><path d="M9 10h.01M15 10h.01"/></svg>`,

  flight: `<svg viewBox="0 0 24 24" ${S}><path d="M2.5 19.5L21 12 2.5 4.5 4 11l9 1-9 1z"/></svg>`,

  itinerary: `<svg viewBox="0 0 24 24" ${S}><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/><path d="M7 13h4M7 17h7"/></svg>`,

  menu: `<svg viewBox="0 0 24 24" ${S}><path d="M6 2v7a2 2 0 0 0 2 2v11M6 2a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2M6 2a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2M18 2c-2 0-3 2-3 5v3c0 1 1 2 2 2v10"/></svg>`,

  drink: `<svg viewBox="0 0 24 24" ${S}><path d="M5 3h14l-1.5 9a5.5 5.5 0 0 1-11 0z"/><path d="M12 15v6M8 21h8"/></svg>`,

  video: `<svg viewBox="0 0 24 24" ${S}><rect x="2" y="5" width="14" height="14" rx="2"/><path d="M16 10l6-4v12l-6-4z"/></svg>`,

  ticket: `<svg viewBox="0 0 24 24" ${S}><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z"/><path d="M13 6v2M13 11v2M13 16v2"/></svg>`,

  map: `<svg viewBox="0 0 24 24" ${S}><path d="M9 4l-6 2v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/></svg>`,

  calendar: `<svg viewBox="0 0 24 24" ${S}><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/></svg>`,

  'id-card': `<svg viewBox="0 0 24 24" ${S}><rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8" cy="11" r="2"/><path d="M5 16c0-1.7 1.3-3 3-3s3 1.3 3 3M14 9h6M14 13h6M14 17h4"/></svg>`,

  passport: `<svg viewBox="0 0 24 24" ${S}><rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="9" r="3"/><path d="M8 16c0-1.7 1.8-3 4-3s4 1.3 4 3"/></svg>`,

  insurance: `<svg viewBox="0 0 24 24" ${S}><path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5z"/><path d="M9 12l2 2 4-4"/></svg>`,

  licence: `<svg viewBox="0 0 24 24" ${S}><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="8" cy="12" r="2"/><path d="M14 10h5M14 14h3"/></svg>`,

  certificate: `<svg viewBox="0 0 24 24" ${S}><circle cx="12" cy="9" r="6"/><path d="M9 14.5L7 22l5-3 5 3-2-7.5"/></svg>`,

  degree: `<svg viewBox="0 0 24 24" ${S}><path d="M2 9l10-5 10 5-10 5-10-5z"/><path d="M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5M22 9v6"/></svg>`,

  receipt: `<svg viewBox="0 0 24 24" ${S}><path d="M6 2h12v19l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5-2 1.5z"/><path d="M9 7h6M9 11h6M9 15h4"/></svg>`,

  bank: `<svg viewBox="0 0 24 24" ${S}><path d="M3 10l9-6 9 6"/><path d="M4 10v10M9 10v10M15 10v10M20 10v10M2 20h20"/></svg>`,

  home: `<svg viewBox="0 0 24 24" ${S}><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg>`,

  photo: `<svg viewBox="0 0 24 24" ${S}><rect x="2" y="4" width="20" height="16" rx="2"/><circle cx="8" cy="10" r="2"/><path d="M2 17l5-5 4 4 3-3 6 6"/></svg>`,

  generic: `<svg viewBox="0 0 24 24" ${S}><path d="M6 2h9l5 5v15H6z"/><path d="M15 2v5h5"/></svg>`,

  lock: `<svg viewBox="0 0 24 24" ${S}><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M7 10V7a5 5 0 0 1 10 0v3"/></svg>`,

  download: `<svg viewBox="0 0 24 24" ${S}><path d="M12 3v13M7 11l5 5 5-5"/><path d="M4 20h16"/></svg>`,

  play: `<svg viewBox="0 0 24 24" ${S}><circle cx="12" cy="12" r="10"/><path d="M10 8l6 4-6 4z"/></svg>`,

  plus: `<svg viewBox="0 0 24 24" ${S}><path d="M12 5v14M5 12h14"/></svg>`,

  trash: `<svg viewBox="0 0 24 24" ${S}><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/></svg>`,

  edit: `<svg viewBox="0 0 24 24" ${S}><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>`,
};

// Fallback for an unrecognised icon key — used for older config entries
// that still use an emoji string; caller decides whether to render this
// SVG or the raw emoji text directly.
function hasIcon(name) {
  return Object.prototype.hasOwnProperty.call(ICONS, name);
}

function getIcon(name) {
  return ICONS[name] || ICONS.generic;
}

module.exports = { ICONS, hasIcon, getIcon };
