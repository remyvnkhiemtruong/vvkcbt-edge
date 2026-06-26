#!/usr/bin/env node
import bcrypt from 'bcrypt';

const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/hash-password.mjs <password>');
  process.exit(1);
}

bcrypt.hash(password, 10).then((hash) => {
  console.log(hash);
  console.log('\nSet in .env: ADMIN_PASSWORD_HASH=' + hash);
});
