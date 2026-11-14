/**
 * Phase 5 Security & Hardening Verification Suite
 * Covers MSH-014 (XSS/URL Sanitization & Iframe Sandbox Isolation),
 * MSH-015 (Media Static Fallthrough Protection),
 * MSH-016 (PDF Decompression Bomb & Malformed File Protection),
 * and MSH-027 / 5D (External Proxy Domain Allowlist & SSRF Protection).
 */

import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

import adminHandler from '../api/admin.js';
import {
  ADMIN_PHONE_NORMALIZED,
  verifyAdminPinCredentials,
} from '../src/lib/adminAuthService.js';
import {
  sanitizeExternalHttpUrl,
  hasDangerousUrlScheme,
  isPrivateOrReservedHost,
  isSafeSportsbookHost,
  stripSensitiveQueryParams,
  sanitizeSportScoreTrackerId,
} from '../src/lib/urlSecurity.js';
import {
  extractCleanUrl,
  validateAndNormalizeBetSlipUrl,
  fetchBetSlip,
} from '../src/lib/betSlipParser.js';
import {
  PdfParseSecurityError,
  extractPdfPagesServer,
  extractPdfTextServer,
  decodePdfBase64Payload,
  MAX_DECOMPRESSED_STREAM_BYTES,
} from '../src/lib/serverPdfParser.js';
import { extractTextFromPdfBuffer } from '../src/lib/fixturePdfParser.js';
import { normalizeCustomEmbedUrl } from '../src/lib/homepageFeedStore.js';

interface MockResponseResult {
  statusCode: number;
  headers: Record<string, string | string[]>;
  body: any;
}

async function invokeVercelHandler(
  handler: (req: any, res: any) => Promise<any>,
  opts: {
    method: string;
    url: string;
    query?: Record<string, any>;
    headers?: Record<string, string>;
    body?: any;
  }
): Promise<MockResponseResult> {
  const headersOut: Record<string, string | string[]> = {};
  let statusCode = 200;
  let jsonBody: any = null;

  const res: any = {
    setHeader(k: string, v: any) {
      headersOut[k.toLowerCase()] = v;
    },
    getHeader(k: string) {
      return headersOut[k.toLowerCase()];
    },
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(payload: any) {
      jsonBody = payload;
      return res;
    },
    end() {
      return res;
    },
  };

  await handler(
    {
      method: opts.method,
      url: opts.url,
      query: opts.query || {},
      headers: opts.headers || {},
      body: opts.body,
    },
    res
  );

  return { statusCode, headers: headersOut, body: jsonBody };
}

function buildMinimalFlatePdf(streams: Buffer[]): Buffer {
  const parts: Buffer[] = [Buffer.from('%PDF-1.4\n', 'latin1')];
  streams.forEach((streamData, idx) => {
    const compressed = zlib.deflateSync(streamData);
    parts.push(
      Buffer.from(
        `${idx + 1} 0 obj\n<< /Length ${compressed.length} /Filter /FlateDecode >>\nstream\n`,
        'latin1'
      ),
      compressed,
      Buffer.from('\nendstream\nendobj\n', 'latin1')
    );
  });
  parts.push(Buffer.from('%%EOF\n', 'latin1'));
  return Buffer.concat(parts);
}

async function main() {
  let passed = 0;
  const pass = (msg: string) => {
    passed += 1;
    console.log(`PASS [${passed}]: ${msg}`);
  };

  // Isolate admin test secrets
  process.env.USER_TOKEN_SECRET = 'phase5-test-user-token-secret-xyz';
  process.env.ADMIN_TOKEN_SECRET = 'phase5-test-admin-token-secret-xyz';
  process.env.ADMIN_PIN = '7410';

  const adminPinResult = verifyAdminPinCredentials(ADMIN_PHONE_NORMALIZED, '7410');
  assert.ok(adminPinResult.valid && adminPinResult.token, 'Admin PIN auth must issue token');
  const adminToken = adminPinResult.token!;

  // =========================================================================
  // 1. MSH-014: Bet-slip URL sanitization & XSS scheme blocking
  // =========================================================================
  const maliciousUrls = [
    'javascript:alert(1)',
    '  JaVaScRiPt:alert(document.cookie)',
    'java\tscript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'blob:https://mshindi.ke/1234',
    '//evil.example.com/phish',
    'https://user:pass@betika.com/s/1',
    `https://betika.com/${'a'.repeat(2100)}`,
    '',
    null,
  ];
  for (const bad of maliciousUrls) {
    assert.equal(
      sanitizeExternalHttpUrl(bad as any, { bareDomainToHttps: true }),
      null,
      `Must reject unsafe URL: ${String(bad)}`
    );
  }
  assert.equal(hasDangerousUrlScheme('  jAvAsCrIpT:alert(1)'), true);
  assert.equal(
    sanitizeExternalHttpUrl('https://www.betika.com/s/12345'),
    'https://www.betika.com/s/12345'
  );
  assert.equal(
    sanitizeExternalHttpUrl('betika.com/s/abc', { bareDomainToHttps: true }),
    'https://betika.com/s/abc'
  );
  pass('MSH-014 urlSecurity rejects javascript:/data:/vbscript:/credentials/control chars & accepts valid HTTP(S)');

  // =========================================================================
  // 2. MSH-014: Custom Embed & Tracker ID Sanitization + UI Sandbox Check
  // =========================================================================
  assert.equal(normalizeCustomEmbedUrl('<iframe src="javascript:alert(1)"></iframe>'), null);
  assert.equal(normalizeCustomEmbedUrl('data:text/html,<script>alert(1)</script>'), null);
  assert.equal(normalizeCustomEmbedUrl('https://admin:secret@streamable.com/e/123'), null);
  assert.equal(
    normalizeCustomEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
    'https://www.youtube.com/embed/dQw4w9WgXcQ'
  );
  assert.equal(
    normalizeCustomEmbedUrl('<iframe src="//streamable.com/e/xyz123"></iframe>'),
    'https://streamable.com/e/xyz123'
  );

  assert.equal(sanitizeSportScoreTrackerId('12345&admin=1'), null);
  assert.equal(sanitizeSportScoreTrackerId('../etc/passwd'), null);
  assert.equal(sanitizeSportScoreTrackerId('<script>'), null);
  assert.equal(sanitizeSportScoreTrackerId('match_9988-A'), 'match_9988-A');

  // Verify MiniBrowserModal.tsx sandbox does NOT combine allow-scripts + allow-same-origin
  const modalSource = fs.readFileSync(
    path.join(process.cwd(), 'src', 'components', 'MiniBrowserModal.tsx'),
    'utf-8'
  );
  const sandboxMatch = modalSource.match(/sandbox="([^"]+)"/);
  assert.ok(sandboxMatch, 'MiniBrowserModal iframe must have an explicit sandbox attribute');
  assert.ok(
    !sandboxMatch[1].includes('allow-same-origin'),
    'MiniBrowserModal iframe sandbox must omit allow-same-origin'
  );
  assert.ok(modalSource.includes('sanitizeExternalHttpUrl'), 'MiniBrowserModal must enforce sanitizeExternalHttpUrl');
  assert.ok(modalSource.includes('rel="noopener noreferrer"'), 'MiniBrowserModal links must include noopener noreferrer');

  // Verify BetSlipCard, SlipReelCard, Home, SportScoreMatchCenter all wire URL guards
  for (const relPath of [
    'src/components/BetSlipCard.tsx',
    'src/components/SlipReelCard.tsx',
    'src/lib/betSlipStore.ts',
    'src/lib/useBetBuilder.ts',
    'src/pages/Home.tsx',
    'src/components/SportScoreMatchCenter.tsx',
  ]) {
    const content = fs.readFileSync(path.join(process.cwd(), relPath), 'utf-8');
    assert.ok(
      content.includes('urlSecurity'),
      `${relPath} must import urlSecurity sanitization helpers`
    );
  }
  pass('MSH-014 embeds, tracker IDs, MiniBrowserModal sandbox, and card/store URL guards verified');

  // =========================================================================
  // 3. MSH-016: PDF Decompression Bomb & Malformed File Protection
  // =========================================================================
  // 3a. Single-stream > 2MB decompression bomb
  const bigStreamPayload = Buffer.alloc(MAX_DECOMPRESSED_STREAM_BYTES + 128 * 1024, 'A');
  const singleBombPdf = buildMinimalFlatePdf([bigStreamPayload]);
  const t0 = Date.now();
  assert.throws(
    () => extractPdfTextServer(singleBombPdf),
    (err: any) => err instanceof PdfParseSecurityError && err.statusCode === 400
  );
  const elapsedBombMs = Date.now() - t0;
  assert.ok(elapsedBombMs < 1000, `Bomb rejection should abort fast (took ${elapsedBombMs}ms)`);

  // 3b. Multi-stream cumulative > 10MB decompression bomb (6 x 1.9MB = 11.4MB)
  const nearLimitChunk = Buffer.alloc(Math.floor(MAX_DECOMPRESSED_STREAM_BYTES * 0.95), 'B');
  const multiBombPdf = buildMinimalFlatePdf(Array.from({ length: 6 }, () => nearLimitChunk));
  assert.throws(
    () => extractPdfTextServer(multiBombPdf),
    (err: any) => err instanceof PdfParseSecurityError && err.statusCode === 400
  );

  // 3c. Non-PDF header & oversized base64 check
  assert.throws(
    () => extractPdfTextServer(Buffer.from('<html><script>alert(1)</script></html>', 'utf8')),
    (err: any) => err instanceof PdfParseSecurityError && err.statusCode === 400
  );
  assert.throws(
    () => decodePdfBase64Payload(''),
    (err: any) => err instanceof PdfParseSecurityError && err.statusCode === 400
  );

  // 3d. Legitimate multi-page PDF regression check
  const page1Content = Buffer.from(
    'BT 100 700 Td (Arsenal vs Chelsea) Tj ET BT 300 700 Td (Home Win 1.85) Tj ET',
    'latin1'
  );
  const page2Content = Buffer.from(
    'BT 100 680 Td (Gor Mahia vs AFC Leopards) Tj ET BT 300 680 Td (Over 2.5) Tj ET',
    'latin1'
  );
  const legitimatePdf = buildMinimalFlatePdf([page1Content, page2Content]);
  const extractedPages = extractPdfPagesServer(legitimatePdf);
  assert.equal(extractedPages.length, 2, 'Must extract both legitimate pages');
  const combinedText = extractPdfTextServer(legitimatePdf);
  assert.ok(combinedText.includes('Arsenal vs Chelsea'));
  assert.ok(combinedText.includes('--- PAGE BREAK ---'));
  assert.ok(combinedText.includes('Gor Mahia vs AFC Leopards'));

  // 3e. Vercel api/admin.ts /api/admin/parse-pdf returns 400 on bomb and 200 on valid PDF
  const vercelBombRes = await invokeVercelHandler(adminHandler, {
    method: 'POST',
    url: '/api/admin/parse-pdf',
    query: { endpoint: 'parse-pdf' },
    headers: { 'x-admin-token': adminToken },
    body: { base64: singleBombPdf.toString('base64') },
  });
  assert.equal(vercelBombRes.statusCode, 400);
  assert.equal(vercelBombRes.body?.success, false);

  const vercelOkRes = await invokeVercelHandler(adminHandler, {
    method: 'POST',
    url: '/api/admin/parse-pdf',
    query: { endpoint: 'parse-pdf' },
    headers: { 'x-admin-token': adminToken },
    body: { base64: legitimatePdf.toString('base64') },
  });
  assert.equal(vercelOkRes.statusCode, 200);
  assert.ok(String(vercelOkRes.body?.text || '').includes('Arsenal vs Chelsea'));

  // 3f. Client-side fixturePdfParser fallback also blocks bombs & extracts valid PDFs
  const singleBombAb = singleBombPdf.buffer.slice(
    singleBombPdf.byteOffset,
    singleBombPdf.byteOffset + singleBombPdf.byteLength
  );
  await assert.rejects(() => extractTextFromPdfBuffer(singleBombAb));
  const legitAb = legitimatePdf.buffer.slice(
    legitimatePdf.byteOffset,
    legitimatePdf.byteOffset + legitimatePdf.byteLength
  );
  const clientText = await extractTextFromPdfBuffer(legitAb);
  assert.ok(clientText.includes('Arsenal vs Chelsea'));
  pass('MSH-016 server & client PDF parsers block zlib bombs while parsing valid multi-page PDFs');

  // =========================================================================
  // 4. MSH-027 / 5D: External Proxy URL Security & Allowlist
  // =========================================================================
  assert.equal(isPrivateOrReservedHost('127.0.0.1'), true);
  assert.equal(isPrivateOrReservedHost('169.254.169.254'), true);
  assert.equal(isPrivateOrReservedHost('192.168.1.10'), true);
  assert.equal(isPrivateOrReservedHost('::1'), true);
  assert.equal(isPrivateOrReservedHost('2130706433'), true);
  assert.equal(isSafeSportsbookHost('www.betika.com'), true);
  assert.equal(isSafeSportsbookHost('ke.sportpesa.com'), true);
  assert.equal(isSafeSportsbookHost('evil.example.com'), false);
  assert.equal(
    stripSensitiveQueryParams('https://www.betika.com/s/123?slip=42&token=secret&auth=abc#hash'),
    'https://www.betika.com/s/123?slip=42'
  );

  for (const blockedUrl of [
    'http://127.0.0.1/admin',
    'http://169.254.169.254/latest/meta-data',
    'http://localhost:3000/api/health',
    'http://[::1]/',
    'https://attacker.example.com/exfiltrate',
    'javascript:alert(1)',
  ]) {
    assert.throws(() => validateAndNormalizeBetSlipUrl(blockedUrl));
  }

  assert.equal(extractCleanUrl('javascript:alert(1)').isUrlMatch, false);
  const normalizedSlipUrl = validateAndNormalizeBetSlipUrl(
    'https://www.betika.com/s/98765?code=XYZ&token=leak#secret'
  );
  assert.equal(normalizedSlipUrl, 'https://www.betika.com/s/98765?code=XYZ');

  // Mock fetch to verify fetchBetSlip enforces response size cap & strips query token before proxy call
  const originalFetch = globalThis.fetch;
  try {
    let seenProxyTarget = '';
    globalThis.fetch = (async (input: any) => {
      seenProxyTarget = String(input);
      return new Response('<html><title>Betika Slip</title><div>Arsenal vs Chelsea - Home</div></html>', {
        status: 200,
        headers: { 'content-type': 'text/html', 'content-length': '64' },
      });
    }) as any;
    const slip = await fetchBetSlip('https://www.betika.com/s/555?token=private123&slip=555');
    assert.equal(seenProxyTarget, 'https://r.jina.ai/https://www.betika.com/s/555?slip=555');
    assert.equal(slip.bookmaker, 'Betika');

    // Oversized response must be rejected cleanly
    globalThis.fetch = (async () => {
      return new Response('x', {
        status: 200,
        headers: { 'content-length': String(2 * 1024 * 1024) },
      });
    }) as any;
    await assert.rejects(() => fetchBetSlip('https://www.betika.com/s/555'));
  } finally {
    globalThis.fetch = originalFetch;
  }
  pass('MSH-027 external slip proxy enforces Kenyan bookie allowlist, blocks SSRF targets, strips tokens, and caps size');

  // =========================================================================
  // 5. Live Express Bundle (dist/server.cjs) Verification for Phase 5
  // =========================================================================
  const serverProcess: ChildProcess = spawn(process.execPath, [path.join(process.cwd(), 'dist', 'server.cjs')], {
    env: {
      ...process.env,
      PORT: '3000',
      NODE_ENV: 'production',
      USER_TOKEN_SECRET: 'phase5-test-user-token-secret-xyz',
      ADMIN_TOKEN_SECRET: 'phase5-test-admin-token-secret-xyz',
      ADMIN_PIN: '7410',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    let healthy = false;
    for (let i = 0; i < 40; i++) {
      try {
        const probe = await fetch('http://127.0.0.1:3000/api/health');
        if (probe.ok) {
          healthy = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 150));
    }
    assert.ok(healthy, 'Express dist/server.cjs must respond on /api/health');

    // 5a. Express /api/admin/parse-pdf rejects decompression bomb with 400 and parses valid PDF with 200
    const expBomb = await fetch('http://127.0.0.1:3000/api/admin/parse-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': adminToken,
      },
      body: JSON.stringify({ base64: singleBombPdf.toString('base64') }),
    });
    assert.equal(expBomb.status, 400, 'Express parse-pdf must reject decompression bomb with 400');

    const expValidPdf = await fetch('http://127.0.0.1:3000/api/admin/parse-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': adminToken,
      },
      body: JSON.stringify({ base64: legitimatePdf.toString('base64') }),
    });
    assert.equal(expValidPdf.status, 200);
    const expValidJson: any = await expValidPdf.json();
    assert.ok(String(expValidJson?.text || '').includes('Arsenal vs Chelsea'));

    // 5b. Express /images/uploads/* must NEVER fall through to static HTML / index.html
    const missingUpload = await fetch('http://127.0.0.1:3000/images/uploads/feed/evil.html');
    assert.equal(missingUpload.status, 404);
    const nestedMissing = await fetch('http://127.0.0.1:3000/images/uploads/a/b/c/evil.svg');
    assert.equal(nestedMissing.status, 404);
    pass('Live Express dist/server.cjs rejects PDF bombs (400), parses valid PDF (200), and blocks /images/uploads/* static fallthrough (404)');
  } finally {
    serverProcess.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 250));
  }

  console.log(`\nALL PHASE 5 TESTS PASSED (${passed}/${passed})`);
}

main().catch((err) => {
  console.error('\nPHASE 5 SECURITY TEST FAILED:', err);
  process.exit(1);
});

