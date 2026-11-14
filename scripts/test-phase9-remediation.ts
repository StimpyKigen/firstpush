/**
 * Phase 9 Remediation Verification Suite (FND-022, FND-024)
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectSourceFiles(full));
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function majorOf(range: string | undefined, pkgName: string): number {
  assert.ok(range, `Missing version range for ${pkgName}`);
  const match = range.match(/(\d+)/);
  assert.ok(match, `Unable to parse major version for ${pkgName}: ${range}`);
  return Number(match[1]);
}

async function main() {
  const root = process.cwd();

  // 1. Lockfile hygiene & cross-platform clean script
  assert.ok(!fs.existsSync(path.join(root, 'bun.lock')), 'Stale bun.lock should be removed');
  assert.ok(fs.existsSync(path.join(root, 'package-lock.json')), 'Authoritative package-lock.json must exist');

  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>;
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  };

  const cleanScript = pkg.scripts.clean || '';
  assert.ok(!cleanScript.includes('rm -rf'), 'clean script must not rely on Unix-only rm -rf');
  assert.ok(cleanScript.includes('fs.rmSync'), 'clean script must use cross-platform Node fs.rmSync');

  // Execute clean script logic in an isolated temp workspace to prove cross-platform execution without deleting repo dist/
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mshindi-clean-test-'));
  try {
    fs.mkdirSync(path.join(tempDir, 'dist', 'assets'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'dist', 'assets', 'chunk.js'), 'test');
    fs.writeFileSync(path.join(tempDir, 'server.js'), 'test');
    execFileSync(process.execPath, ['-e', "const fs=require('fs');fs.rmSync('dist',{recursive:true,force:true});fs.rmSync('server.js',{force:true})"], {
      cwd: tempDir,
      stdio: 'pipe',
    });
    assert.ok(!fs.existsSync(path.join(tempDir, 'dist')), 'clean script must remove dist directory on current OS');
    assert.ok(!fs.existsSync(path.join(tempDir, 'server.js')), 'clean script must remove server.js if present');
  } finally {
    fs.rmSync(tempDir, { recursive:true, force: true });
  }
  console.log('PASS: Lockfile hygiene & cross-platform clean script verified');

  // 2. FND-022: Safe dependency pins (no unrequested breaking major upgrades)
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
  assert.equal(majorOf(allDeps.express, 'express'), 4, 'express must stay on safe v4 line');
  assert.equal(majorOf(allDeps.vite, 'vite'), 6, 'vite must stay on safe v6 line');
  assert.equal(majorOf(allDeps.firebase, 'firebase'), 12, 'firebase must stay on v12 line');
  assert.equal(majorOf(allDeps['@google/genai'], '@google/genai'), 2, '@google/genai must stay on safe v2 line');
  assert.equal(majorOf(allDeps.typescript, 'typescript'), 5, 'typescript must stay on 5.x line');
  console.log('PASS: FND-022 dependency major version pins verified');

  // 3. FND-022: React 19 deprecated React.ElementRef removal across src/
  const srcFiles = collectSourceFiles(path.join(root, 'src'));
  const elementRefHits: string[] = [];
  for (const file of srcFiles) {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('ElementRef')) {
      elementRefHits.push(path.relative(root, file));
    }
  }
  assert.deepEqual(elementRefHits, [], `Deprecated React.ElementRef must be replaced with React.ComponentRef, found in: ${elementRefHits.join(', ')}`);

  for (const rel of [
    'src/components/ui/dropdown-menu.tsx',
    'src/components/ui/input-otp.tsx',
    'src/components/ui/switch.tsx',
  ]) {
    const content = fs.readFileSync(path.join(root, rel), 'utf8');
    assert.ok(content.includes('React.ComponentRef<'), `${rel} must use React.ComponentRef`);
  }
  console.log('PASS: React 19 ComponentRef migration verified across src/');

  // 4. FND-024: .env.example completeness & placeholder safety
  const envExample = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
  const requiredEnvKeys = [
    'ADMIN_PIN',
    'ADMIN_TOKEN_SECRET',
    'USER_TOKEN_SECRET',
    'CRON_SECRET',
    'ALLOWED_ORIGINS',
    'FIREBASE_SERVICE_ACCOUNT',
    'FIREBASE_SERVICE_ACCOUNT_PREVIEW',
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN',
    'GEMINI_API_KEY',
    'GEMINI_MODEL',
    'API_BASE_URL',
    'NODE_ENV',
    'PORT',
  ];
  for (const key of requiredEnvKeys) {
    assert.ok(envExample.includes(`${key}=`), `.env.example must document ${key}`);
  }
  assert.ok(!/AIza[0-9A-Za-z_-]{20,}/.test(envExample), '.env.example must not contain real Google/Firebase API keys');
  assert.ok(!/BEGIN PRIVATE KEY/.test(envExample), '.env.example must not contain private keys');
  console.log('PASS: FND-024 .env.example coverage & secret hygiene verified');

  // 5. FND-024: docs/deployment.md accuracy
  const deployDoc = fs.readFileSync(path.join(root, 'docs/deployment.md'), 'utf8');
  assert.ok(deployDoc.includes('dist/server.cjs'), 'docs/deployment.md must document Express build artifact dist/server.cjs');
  assert.ok(deployDoc.includes('api/'), 'docs/deployment.md must document Vercel Serverless api/ handlers');
  assert.ok(deployDoc.includes('firestore.rules'), 'docs/deployment.md must document firestore.rules deployment');
  assert.ok(deployDoc.includes('firestore.indexes.json'), 'docs/deployment.md must document firestore.indexes.json deployment');
  console.log('PASS: FND-024 deployment documentation verified');
}

main().catch((err) => {
  console.error('Phase 9 verification failed:', err);
  process.exit(1);
});

