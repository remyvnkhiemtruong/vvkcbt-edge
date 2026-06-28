#!/usr/bin/env node
/** Copy shared kit files from Edge → vvkcbt-composer (source of truth: Edge). */
import { copyFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { edgeRoot, resolveComposerRoot, exactPairs, extraSyncPairs } from './kit-sync-paths.mjs';

const composerRoot = resolveComposerRoot();

if (!existsSync(composerRoot)) {
  console.error(`Composer root not found: ${composerRoot}`);
  console.error('Clone vvkcbt-composer as sibling: git clone ... ../vvkcbt-composer');
  process.exit(1);
}

const allPairs = [...exactPairs, ...extraSyncPairs];
let copied = 0;

for (const [edgeRel, composerRel] of allPairs) {
  const src = path.join(edgeRoot, edgeRel);
  const dest = path.join(composerRoot, composerRel);
  if (!existsSync(src)) {
    console.error(`MISSING source: ${edgeRel}`);
    process.exit(1);
  }
  mkdirSync(path.dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  copied++;
  console.log(`OK ${edgeRel} → ${composerRel}`);
}

console.log(`\nSync complete: ${copied} file(s) copied to ${composerRoot}`);
