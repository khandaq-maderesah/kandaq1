#!/usr/bin/env node

/**
 * Single-pass verification script for KMMS
 * Enforces Thermal Guard (max 60s execution budget) and outputs green/red lines.
 */

import { execSync } from 'child_process';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

const checks = [
  {
    name: 'TypeScript Typecheck',
    command: 'npx tsc --noEmit',
    timeout: 60000
  },
  {
    name: 'ESLint Static Analysis',
    command: 'npm run lint',
    timeout: 60000
  },
  {
    name: 'Unit & Logic Tests (Node Test Runner)',
    command: 'npx tsx --test tests/attendanceReminder.test.mjs tests/ethiopianDate.test.mjs tests/pushNotification.test.mjs tests/authRoleGuard.test.mjs tests/i18nTerminology.test.mjs tests/backupRestore.test.mjs tests/photoStorage.test.mjs',
    timeout: 60000
  }
];

console.log(`${colors.bold}${colors.cyan}========================================${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}KMMS SINGLE-PASS VERIFICATION RUNNER${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}========================================${colors.reset}\n`);

let hasFailure = false;

for (const check of checks) {
  process.stdout.write(`Checking ${check.name}... `);
  const start = Date.now();
  try {
    execSync(check.command, {
      stdio: 'pipe',
      timeout: check.timeout,
      encoding: 'utf-8'
    });
    const duration = ((Date.now() - start) / 1000).toFixed(2);
    console.log(`${colors.green}[PASS]${colors.reset} (${duration}s)`);
  } catch (error) {
    const duration = ((Date.now() - start) / 1000).toFixed(2);
    console.log(`${colors.red}[FAIL]${colors.reset} (${duration}s)`);
    if (error.stdout) console.log(error.stdout.toString());
    if (error.stderr) console.error(error.stderr.toString());
    hasFailure = true;
    break;
  }
}

console.log(`\n${colors.bold}${colors.cyan}========================================${colors.reset}`);
if (hasFailure) {
  console.log(`${colors.bold}${colors.red}STATUS: VERIFICATION FAILED${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}========================================${colors.reset}`);
  process.exit(1);
} else {
  console.log(`${colors.bold}${colors.green}STATUS: ALL VERIFICATION CHECKS PASSED${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}========================================${colors.reset}`);
  process.exit(0);
}
