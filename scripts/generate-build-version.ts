import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

export interface BuildVersionManifest {
  version: string;
  buildId: string;
  gitCommit: string;
  builtAt: string;
}

export function generateBuildVersionManifest(rootDir: string = process.cwd()): BuildVersionManifest {
  let gitCommit = 'local';
  try {
    gitCommit = execSync('git rev-parse --short HEAD', {
      cwd: rootDir,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    gitCommit = 'nogit';
  }

  const now = new Date();
  const builtAt = now.toISOString();
  const timestampCompact = builtAt.replace(/[-:T.Z]/g, '').slice(0, 14);
  const buildId = `${timestampCompact}-${gitCommit}`;
  const version = `2.4.0-${buildId}`;

  const manifest: BuildVersionManifest = {
    version,
    buildId,
    gitCommit,
    builtAt,
  };

  // 1. Write public/version.json
  const publicDir = path.join(rootDir, 'public');
  if (fs.existsSync(publicDir)) {
    const versionJsonPath = path.join(publicDir, 'version.json');
    fs.writeFileSync(versionJsonPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');

    // 2. Stamp BUILD_VERSION in public/sw.js so every build produces a byte-distinct Service Worker script
    const swPath = path.join(publicDir, 'sw.js');
    if (fs.existsSync(swPath)) {
      const swContent = fs.readFileSync(swPath, 'utf-8');
      const updatedSw = swContent.replace(
        /const BUILD_VERSION = ['"][^'"]*['"];/,
        `const BUILD_VERSION = '${version}';`
      );
      if (updatedSw !== swContent) {
        fs.writeFileSync(swPath, updatedSw, 'utf-8');
      }
    }
  }

  // 3. Also write to dist/ if dist already exists (post-build hook)
  const distDir = path.join(rootDir, 'dist');
  if (fs.existsSync(distDir)) {
    fs.writeFileSync(
      path.join(distDir, 'version.json'),
      JSON.stringify(manifest, null, 2) + '\n',
      'utf-8'
    );
    const distSwPath = path.join(distDir, 'sw.js');
    if (fs.existsSync(distSwPath)) {
      const swContent = fs.readFileSync(distSwPath, 'utf-8');
      const updatedSw = swContent.replace(
        /const BUILD_VERSION = ['"][^'"]*['"];/,
        `const BUILD_VERSION = '${version}';`
      );
      if (updatedSw !== swContent) {
        fs.writeFileSync(distSwPath, updatedSw, 'utf-8');
      }
    }
  }

  return manifest;
}

// Allow direct CLI execution via `tsx scripts/generate-build-version.ts`
const isDirectExecution =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1] &&
  process.argv[1].replace(/\\/g, '/').endsWith('scripts/generate-build-version.ts');

if (isDirectExecution) {
  const manifest = generateBuildVersionManifest();
  console.log(`[BuildVersion] Generated version manifest: ${manifest.version}`);
}

