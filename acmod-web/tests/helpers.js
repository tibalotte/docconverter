import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { MemoryDir } from '../js/fs-access.js';

export const FIXTURES = fileURLToPath(new URL('../fixtures/', import.meta.url));
export const CARS = readdirSync(FIXTURES, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);

export function fixtureBytes(car, file) {
  return new Uint8Array(readFileSync(join(FIXTURES, car, file)));
}

export function allFixtureFiles() {
  const out = [];
  for (const car of CARS) {
    for (const f of readdirSync(join(FIXTURES, car))) if (f.endsWith('.ini')) out.push([car, f]);
  }
  return out;
}

export function carDir(car) {
  const entries = {};
  for (const f of readdirSync(join(FIXTURES, car))) entries[f] = fixtureBytes(car, f);
  return MemoryDir.fromEntries(entries, 'data');
}
