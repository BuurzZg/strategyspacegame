// The Forge's instruments (Milestone 23; the approved style guide, PLAN.md section 9): round
// brass gauges with cream dials and a red zone, enamel mood medallions with faces, stamped cause
// icons (the Skein's glass pressure tube is plain CSS in index.html). Each returns an SVG
// string, for innerHTML.
const esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
let uid = 0;

// A gauge: label on the dial, needle at frac (0 to 1), a counter beneath. low: the counter warns.
export function gauge(label, frac, counter, { low = false, title = '' } = {}) {
  const id = `g${++uid}`, f = Math.max(0, Math.min(1, frac)), a = -135 + 270 * f;
  const p = (deg, r) => [60 + r * Math.sin((deg * Math.PI) / 180), 60 - r * Math.cos((deg * Math.PI) / 180)];
  const [x0, y0] = p(-135, 41), [x1, y1] = p(-135 + 270 * 0.15, 41);
  let ticks = '';
  for (let i = 0; i <= 10; i++) { const [ax, ay] = p(-135 + 27 * i, i % 5 ? 40 : 36), [bx, by] = p(-135 + 27 * i, 45); ticks += `<line x1="${ax.toFixed(1)}" y1="${ay.toFixed(1)}" x2="${bx.toFixed(1)}" y2="${by.toFixed(1)}" stroke="#3b2a1a" stroke-width="${i % 5 ? 1 : 2}"/>`; }
  return `<div class="gauge${low ? ' low' : ''}" title="${esc(title)}"><svg viewBox="0 0 120 120" role="img" aria-label="${esc(`${label}: ${counter}`)}"><defs><radialGradient id="${id}" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#f1d58e"/><stop offset="0.55" stop-color="#c9a04e"/><stop offset="1" stop-color="#6b4f1e"/></radialGradient></defs>`
    + `<circle cx="60" cy="60" r="57" fill="url(#${id})"/><circle cx="60" cy="60" r="48" fill="#efe6cf" stroke="#5d4519" stroke-width="1.5"/>`
    + `<path d="M${x0.toFixed(1)} ${y0.toFixed(1)} A41 41 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}" stroke="#c2402f" stroke-width="6" fill="none"/>${ticks}`
    + `<text x="60" y="84" text-anchor="middle" font-family="'IM Fell English SC', Georgia, serif" font-size="14" fill="#3b2a1a">${esc(label)}</text>`
    + `<path d="M58.4 62 L60 16 L61.6 62 Z" fill="#1b140c" transform="rotate(${a.toFixed(1)} 60 60)"/><circle cx="60" cy="60" r="5" fill="#8c6a2c" stroke="#3b2a1a"/></svg>`
    + `<span class="odo">${esc(counter)}</span></div>`;
}

// An enamel mood medallion with a face: content (green, smiling), uneasy (amber, flat, a bead of
// sweat), angry (red, frowning, brows down)
export function medal(kind, size = 40) {
  const C = { content: ['#5e9e4f', '#2f5a26', 'M40 60 Q50 70 60 60'], uneasy: ['#e3a33b', '#7b5414', 'M40 64 L60 64'], angry: ['#c2402f', '#6a1b12', 'M40 68 Q50 58 60 68'] }[kind] || ['#5e9e4f', '#2f5a26', 'M40 60 Q50 70 60 60'];
  const id = `m${++uid}`;
  let notches = '';
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; notches += `<circle cx="${(50 + 45 * Math.cos(a)).toFixed(1)}" cy="${(50 + 45 * Math.sin(a)).toFixed(1)}" r="4" fill="url(#${id}b)"/>`; }
  return `<svg class="medal-face" width="${size}" height="${size}" viewBox="0 0 100 100" role="img" aria-label="${esc(kind)} crew"><defs><radialGradient id="${id}" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#fff" stop-opacity="0.35"/><stop offset="0.4" stop-color="${C[0]}"/><stop offset="1" stop-color="${C[1]}"/></radialGradient><radialGradient id="${id}b" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#f1d58e"/><stop offset="0.6" stop-color="#c9a04e"/><stop offset="1" stop-color="#6b4f1e"/></radialGradient></defs>`
    + `${notches}<circle cx="50" cy="50" r="44" fill="url(#${id}b)"/><circle cx="50" cy="50" r="36" fill="url(#${id})" stroke="#3b2a1a" stroke-width="1.5"/>`
    + `<circle cx="40" cy="44" r="3.5" fill="#1b140c"/><circle cx="60" cy="44" r="3.5" fill="#1b140c"/>`
    + (kind === 'angry' ? '<path d="M34 36 L45 40 M66 36 L55 40" stroke="#1b140c" stroke-width="3" stroke-linecap="round"/>' : '')
    + (kind === 'uneasy' ? '<path d="M67 30 q4 6 0 9 q-4 -3 0 -9 Z" fill="#cfe8f2" stroke="#1b140c" stroke-width="1"/>' : '')
    + `<path d="${C[2]}" stroke="#1b140c" stroke-width="3.5" fill="none" stroke-linecap="round"/></svg>`;
}

// A stamped cause icon beside the medallion: a loaf, a drop, lungs, a cold boiler, a grave...
const ICON = {
  hunger: '<path d="M8 26 Q8 12 20 12 Q32 12 32 26 Z" fill="#c9a04e" stroke="#3b2a1a" stroke-width="1.5"/><path d="M14 20 l3 -3 M20 20 l3 -3 M26 20 l-2 -2" stroke="#3b2a1a" stroke-width="1.5"/>',
  thirst: '<path d="M20 6 Q30 20 30 25 A10 10 0 0 1 10 25 Q10 20 20 6 Z" fill="#7fb6c9" stroke="#3b2a1a" stroke-width="1.5"/>',
  air: '<path d="M20 8 L20 18 M20 18 Q10 16 9 28 Q14 32 19 26 Z M20 18 Q30 16 31 28 Q26 32 21 26 Z" fill="#d9a59a" stroke="#3b2a1a" stroke-width="1.5"/>',
  cold: '<rect x="9" y="12" width="22" height="20" rx="3" fill="#5a5148" stroke="#3b2a1a" stroke-width="1.5"/><rect x="14" y="20" width="12" height="7" fill="#1b140c"/><path d="M15 9 l3 -4 M22 9 l3 -4" stroke="#9ad2e8" stroke-width="1.5"/>',
  grief: '<path d="M12 32 L12 16 Q12 8 20 8 Q28 8 28 16 L28 32 Z" fill="#8a8070" stroke="#3b2a1a" stroke-width="1.5"/><path d="M20 13 L20 24 M16 17 L24 17" stroke="#3b2a1a" stroke-width="2"/>',
  crowded: '<circle cx="14" cy="15" r="4" fill="#b8693d" stroke="#3b2a1a"/><circle cx="26" cy="15" r="4" fill="#b8693d" stroke="#3b2a1a"/><circle cx="20" cy="22" r="4" fill="#b8693d" stroke="#3b2a1a"/><path d="M8 32 Q14 24 20 30 Q26 24 32 32" stroke="#3b2a1a" stroke-width="1.5" fill="none"/>',
  strike: '<path d="M10 30 L30 10 M13 13 L27 27" stroke="#3b2a1a" stroke-width="3" stroke-linecap="round"/><circle cx="20" cy="20" r="12" fill="none" stroke="#c2402f" stroke-width="2"/>',
};
const KIND = { thirst: 'thirst', hunger: 'hunger', air: 'air', cold: 'cold', grief: 'grief', crowded: 'crowded', strike: 'strike' };
export function causeIcon(id, text) {
  const k = KIND[id] || 'strike';
  return `<svg class="cause-icon" width="22" height="22" viewBox="0 0 40 40" role="img" aria-label="${esc(text)}"><title>${esc(text)}</title><circle cx="20" cy="20" r="19" fill="#efe6cf" stroke="#8c6a2c" stroke-width="1.5"/>${ICON[k]}</svg>`;
}
