// Reporting a bug (the tester build, after Milestone 23): F8 anywhere, or the button on the title
// screen. The tester says what happened and what they expected; the report adds the build, the
// browser, the screen, what the game was doing (seed, life, day, place), the last errors it
// logged and, if they leave the box ticked, the save, so the bug can be replayed exactly
// (driftforge.loadData(JSON.parse(save)) in the console). They copy it or save it as a file and
// send it to whoever shared the game with them.
import { VERSION, BUILD } from '../version.js';

const $ = (id) => document.getElementById(id);
const log = [];
const keep = (kind, text) => { log.push(`${new Date().toISOString().slice(11, 19)} ${kind}: ${String(text).slice(0, 400)}`); if (log.length > 30) log.shift(); };

// listen for trouble from the start
export function watchErrors() {
  addEventListener('error', (e) => keep('error', `${e.message} (${(e.filename || '').split('/').pop()}:${e.lineno})`));
  addEventListener('unhandledrejection', (e) => keep('rejection', e.reason && (e.reason.stack || e.reason.message) || e.reason));
  for (const k of ['error', 'warn']) {
    const orig = console[k].bind(console);
    console[k] = (...a) => { keep(k, a.map((x) => (x && x.stack) || (typeof x === 'object' ? safeJson(x) : x)).join(' ')); orig(...a); };
  }
}
function safeJson(x) { try { return JSON.stringify(x).slice(0, 300); } catch { return String(x); } }

// state(): a few words on what the game is doing; save(): the save, or null; gl: the renderer
export function initBugReport({ state, save, renderer }) {
  const open = () => {
    $('bugreport').hidden = false;
    $('br-what').focus();
    build();
  };
  const close = () => { $('bugreport').hidden = true; };
  let text = '';
  const build = () => {
    let gpu = '';
    try { const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info'); gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); } catch { gpu = 'unknown'; }
    let st = {};
    try { st = state() || {}; } catch (e) { st = { error: String(e) }; }
    let sv = '';
    if ($('br-save').checked) { try { const d = save(); sv = d ? JSON.stringify(d) : ''; } catch (e) { sv = `(could not read the save: ${e.message})`; } }
    text = [
      'DRIFTFORGE BUG REPORT',
      `Build: ${VERSION} ${BUILD}`,
      `When: ${new Date().toISOString()}`,
      `Browser: ${navigator.userAgent}`,
      `Screen: ${innerWidth} x ${innerHeight} at ${devicePixelRatio || 1}x; graphics: ${gpu}`,
      `Game: ${Object.entries(st).map(([k, v]) => `${k} ${v}`).join(', ') || 'title screen'}`,
      '',
      'WHAT HAPPENED',
      $('br-what').value.trim() || '(not filled in)',
      '',
      'WHAT I EXPECTED',
      $('br-expect').value.trim() || '(not filled in)',
      '',
      'RECENT ERRORS',
      log.length ? log.join('\n') : '(none)',
      '',
      'SAVE',
      sv || '(not included)',
    ].join('\n');
    $('br-text').value = text;
    $('br-size').textContent = `${Math.round(text.length / 1024)} KB`;
  };
  const say = (t) => { $('br-done').textContent = t; clearTimeout(say.t); say.t = setTimeout(() => { $('br-done').textContent = ''; }, 4000); };
  $('br-what').addEventListener('input', build);
  $('br-expect').addEventListener('input', build);
  $('br-save').addEventListener('change', build);
  $('br-copy').addEventListener('click', async () => {
    build();
    try { await navigator.clipboard.writeText(text); say('Copied. Paste it into a message to whoever gave you the game.'); }
    catch { $('br-text').select(); say('Your browser would not let the page copy it: the report is selected below, press Ctrl+C (Cmd+C on a Mac).'); }
  });
  $('br-download').addEventListener('click', () => {
    build();
    try {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
      a.download = `driftforge-bug-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.txt`;
      document.body.appendChild(a); a.click(); a.remove();
      say('Saved as a text file: send it to whoever gave you the game.');
    } catch { $('br-text').select(); say('Your browser would not save a file here: the report is selected below, press Ctrl+C to copy it.'); }
  });
  $('br-close').addEventListener('click', close);
  $('bugreport').addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  addEventListener('keydown', (e) => {
    if (e.key !== 'F8') return;
    e.preventDefault(); e.stopPropagation();
    if ($('bugreport').hidden) open(); else close();
  }, true);
  for (const b of document.querySelectorAll('[data-bugreport]')) b.addEventListener('click', open);
  for (const el of document.querySelectorAll('[data-build]')) el.textContent = `Build ${VERSION} ${BUILD}`;
  return { open, close };
}
