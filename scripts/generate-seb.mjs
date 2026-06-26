#!/usr/bin/env node
/**
 * Sinh file cấu hình SEB (.plist) cho VVKCBT.
 * Usage: node scripts/generate-seb.mjs [EDGE_IP] [output.seb.plist]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ip = process.argv[2] || '192.168.1.50';
const out = process.argv[3] || path.join(__dirname, 'seb', `VVKCBT-Student-${ip.replace(/\./g, '-')}.plist`);

const startUrl = `http://${ip}/student/`;

const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>startURL</key>
  <string>${startUrl}</string>
  <key>allowQuit</key>
  <false/>
  <key>quitURL</key>
  <string></string>
  <key>browserWindowAllowReload</key>
  <false/>
  <key>enableBrowserWindowToolbar</key>
  <false/>
  <key>allowSpellCheck</key>
  <false/>
  <key>allowDictionaryLookup</key>
  <false/>
  <key>allowFind</key>
  <false/>
  <key>allowPrint</key>
  <false/>
  <key>allowDownload</key>
  <false/>
  <key>allowUpload</key>
  <false/>
  <key>allowPreferencesWindow</key>
  <false/>
  <key>URLFilterEnable</key>
  <true/>
  <key>URLFilterEnableContentFilter</key>
  <true/>
  <key>URLFilterRules</key>
  <array>
    <dict>
      <key>action</key>
      <integer>1</integer>
      <key>active</key>
      <true/>
      <key>expression</key>
      <string>${ip}</string>
      <key>regex</key>
      <false/>
    </dict>
    <dict>
      <key>action</key>
      <integer>1</integer>
      <key>active</key>
      <true/>
      <key>expression</key>
      <string>127.0.0.1</string>
      <key>regex</key>
      <false/>
    </dict>
  </array>
</dict>
</plist>
`;

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, plist, 'utf8');
console.log(`Đã tạo: ${out}`);
console.log(`Start URL: ${startUrl}`);
console.log('Mở file bằng SEB Configuration Tool → Export .seb → phát cho thí sinh.');
