# Deployment Specification

## 1. Dual Runtime Architecture (Vercel Serverless & Express Server)

MshindiRoom runs on either:
1. **Vercel Serverless (Primary Web Hosting)**:
   - Static SPA assets served from `dist/` (`vite build`).
   - Consolidated Vercel Functions under `api/*.ts`:
     - `api/admin.ts`
     - `api/ai.ts`
     - `api/homepage-feed.ts`
     - `api/moderation.ts`
     - `api/sports.ts`
     - `api/subscription.ts`
     - `api/tokens.ts`
   - Routed via rewrites in [`vercel.json`](../vercel.json).
   - Note: `vercel.json` currently sets `"git": { "deploymentEnabled": false }` so deployments are triggered manually/explicitly rather than firing on every git push.
2. **Express / Node.js Container (`dist/server.cjs`)**:
   - Single-process Express backend + Vite-built static SPA bundled via `esbuild`.
   - Delegates directly to the same authoritative service modules and consolidated HTTP controllers (`src/lib/*Controller.ts`) used by Vercel Serverless.

---

## 2. Build & Clean Pipeline

Defined in [`package.json`](../package.json):

```json
{
  "scripts": {
    "dev": "tsx server.ts",
    "build": "tsx scripts/generate-build-version.ts && vite build && tsx scripts/generate-build-version.ts && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs",
    "start": "node dist/server.cjs",
    "clean": "node -e \"const fs=require('fs');fs.rmSync('dist',{recursive:true,force:true});fs.rmSync('server.js',{force:true})\"",
    "lint": "tsc --noEmit"
  }
}
```

### Build Steps
1. **Pre-build Version Stamp**: `tsx scripts/generate-build-version.ts` stamps `public/version.json` and `public/sw.js` `BUILD_VERSION`.
2. **Frontend Compilation**: `vite build` bundles the React 19 SPA into split vendor/data/route chunks under `dist/`.
3. **Post-build Manifest Sync**: syncs `dist/version.json` and `dist/sw.js`.
4. **Node Server Bundling**: `esbuild server.ts` emits `dist/server.cjs`.

---

## 3. Firebase Deployment Prerequisites (Run on Schema / Rules Changes)

Whenever `firestore.rules`, `storage.rules`, or `firestore.indexes.json` change, deploy them explicitly to Firebase before enabling dependent queries/rules in production:

```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
firebase deploy --only storage
```

Required composite indexes (defined in `firestore.indexes.json`):
- `subscriptionHistory`: `userId` (`ASCENDING`), `createdAt` (`DESCENDING`).

---

## 4. Vercel Cron Jobs

Configured in `vercel.json` and authenticated exclusively via `Authorization: Bearer <CRON_SECRET>` (`x-vercel-cron` alone is rejected):
- `0 21 * * 0` -> `/api/sports/weekly-sync`
- `0 2 * * *` -> `/api/homepage-feed?action=cleanup`

---

## 5. Production Environment Variables Checklist

See [`.env.example`](../.env.example) for the complete template:

| Variable | Scope | Purpose | Required in Prod |
| :--- | :--- | :--- | :--- |
| `ADMIN_PIN` | Server | Admin PIN verification (fail-closed) | Yes |
| `ADMIN_TOKEN_SECRET` | Server | HMAC-SHA256 admin session secret | Yes |
| `USER_TOKEN_SECRET` | Server | HMAC-SHA256 user session secret | Yes |
| `CRON_SECRET` | Server | Bearer token authorizing Vercel Cron endpoints | Yes |
| `FIREBASE_SERVICE_ACCOUNT` | Server | Production Firebase Admin SDK JSON/Base64 credential | Yes |
| `FIREBASE_SERVICE_ACCOUNT_PREVIEW` | Preview | Isolated Firebase Admin credential for `VERCEL_ENV=preview` | Recommended |
| `ALLOWED_ORIGINS` | Server | Comma-separated origin allowlist (`httpSecurity.ts`) | Yes |
| `UPSTASH_REDIS_REST_URL` | Server | Upstash Redis REST URL for atomic rate limiting | Recommended |
| `UPSTASH_REDIS_REST_TOKEN` | Server | Upstash Redis REST auth token | Recommended |
| `GEMINI_API_KEY` | Server | Google Gemini API key | Yes |
| `GEMINI_MODEL` | Server | Optional model override (`gemini-2.5-flash`) | No |
| `API_BASE_URL` | Server | Canonical server base URL (optional) | No |
| `VITE_FIREBASE_*` | Client Build | Firebase Web SDK config baked into Vite build | Yes |
