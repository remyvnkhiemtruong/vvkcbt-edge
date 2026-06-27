#!/usr/bin/env node
/**
 * In huong dan setup native theo he dieu hanh.
 */
import { platform } from 'os';

const p = platform();
console.log('VVKCBT — Native setup\n');

if (p === 'win32') {
  console.log('Windows: double-click hoac chay');
  console.log('  scripts\\setup-windows.bat');
  console.log('  scripts\\setup-windows.bat --dev   (chi dev, khong build/nginx)');
} else if (p === 'linux') {
  console.log('Ubuntu/Linux:');
  console.log('  sudo bash scripts/setup-linux.sh');
  console.log('  sudo bash scripts/setup-linux.sh --dev');
} else {
  console.log('Cai Postgres 16 + Redis (hoac EDGE_LIGHTWEIGHT=true), roi:');
  console.log('  cp .env.example .env');
  console.log('  npm install && npm run migration:run');
  console.log('  npm run dev');
}

console.log('\nTai lieu: docs/NATIVE-DEPLOY.md');
