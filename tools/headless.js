// Run the simulation without a browser (tests, tools).
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import '../src/traits/index.js';
import { loadRules } from '../src/engine/rules.js';
import { World } from '../src/engine/world.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const readText = (f) => readFile(path.join(root, f), 'utf8');
let rulesCache = null;
export async function rules() { return (rulesCache ||= await loadRules(readText)); }
export async function makeWorld(settings) { return new World(await rules(), { seed: 1, space: { w: 192, d: 192, h: 64 }, spawns: [[96, 96, 0]], ...settings }); }
