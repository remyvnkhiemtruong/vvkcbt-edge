#!/usr/bin/env node
/** Copy LogoVVK.png (repo root) → student, proctor, composer public/branding/logo.png */
import { copyFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { edgeRoot, resolveComposerRoot } from './kit-sync-paths.mjs';

const root = edgeRoot;
const composerRoot = resolveComposerRoot(root);

const pngSrc = path.join(root, 'LogoVVK.png');
const archive = path.join(root, 'apps/web/shared/assets/branding/logo-vvk.png');
const targets = [
  path.join(root, 'apps/web/student/public/branding'),
  path.join(root, 'apps/web/proctor/public/branding'),
  composerRoot ? path.join(composerRoot, 'apps/web/public/branding') : null,
].filter(Boolean);

if (!existsSync(pngSrc)) {
  console.error('Missing LogoVVK.png at repo root:', pngSrc);
  process.exit(1);
}

mkdirSync(path.dirname(archive), { recursive: true });
copyFileSync(pngSrc, archive);

for (const dir of targets) {
  mkdirSync(dir, { recursive: true });
  copyFileSync(pngSrc, path.join(dir, 'logo.png'));
  console.log('OK', path.relative(root, dir), '← LogoVVK.png');
}

console.log('Logo sync complete.');
