import { remembers } from './life.js';

// The ending narration (Milestone 22; content/core/narration.yaml). When the game ends, old Jacob
// tells the whole story, scene by scene. A scene whose memories were not found plays blacked
// out, with his gap lines ("...I don't remember this part."); the last scene's lines follow the
// ending. Every line has its own id (narr.<scene>.<k>, narr.<scene>.gap.<k>,
// narr.<scene>.<ending>.<k>), so a recorded voice can be added with no code change.
const list = (v) => String(v || '').split(',').map((x) => x.trim()).filter(Boolean);
export const ENDINGS = ['escape', 'pay', 'part', 'keep'];
const cap = (k) => k[0].toUpperCase() + k.slice(1);
const linesOf = (block, prefix, key) => Object.entries(block || {}).filter(([k]) => k.startsWith(`${key}@`)).map(([k, v]) => ({ id: `${prefix}.${k.slice(key.length + 1)}`, text: String(v) }));

// How this voyage ended: escape (out without the whole truth), or the true ending's choice.
export function endingOf(s) {
  if (!s.over || s.over.ending !== 'true') return 'escape';
  const f = s.flags || [];
  return f.includes('ending-pay') ? 'pay' : f.includes('ending-part') ? 'part' : f.includes('ending-keep') ? 'keep' : 'escape';
}

// The scenes as this voyage will see them: [{ id, roman, title, still, camera, sound, shown, lines }]
export function narrationFor(rules, s) {
  const N = rules.content.narration || { scenes: [] }, end = endingOf(s);
  return N.scenes.map((sc) => {
    const shown = list(sc.Needs).every((id) => remembers(s, id));
    const split = ENDINGS.some((e) => sc[cap(e)]);
    let lines;
    if (split) { const e = sc[cap(end)] ? end : 'escape'; lines = linesOf(sc[cap(e)], `narr.${sc.id}.${e}`, 'Line'); }
    else lines = shown ? linesOf(sc, `narr.${sc.id}`, 'Line') : linesOf(sc, `narr.${sc.id}.gap`, 'Gap');
    return { id: sc.id, roman: sc.id.toUpperCase(), title: sc.Title || '', still: sc.Still || '', camera: sc.Camera || 'drift', sound: sc.Sound || '', shown: split || shown, needs: list(sc.Needs), lines };
  });
}

// Every line the narration can say, with its id (for the content lint and the tests).
export function allLines(rules) {
  const out = [];
  for (const sc of (rules.content.narration || { scenes: [] }).scenes) {
    if (ENDINGS.some((e) => sc[cap(e)])) { for (const e of ENDINGS) out.push(...linesOf(sc[cap(e)], `narr.${sc.id}.${e}`, 'Line')); continue; }
    out.push(...linesOf(sc, `narr.${sc.id}`, 'Line'), ...linesOf(sc, `narr.${sc.id}.gap`, 'Gap'));
  }
  return out;
}
export const voiceOf = (rules) => String(((rules.content.narration || {}).settings || {}).Voice || '').trim();
