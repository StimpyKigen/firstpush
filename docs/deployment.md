# Deployment Specification

## 1. Production Architecture Overview

Mshindi Projo is packaged as a single production Cloud Run container running Node.js on **Port 3000**.

```
[ Incoming User Traffic ]
          │
          ▼
   [ Cloud Run Container ]
          │
          ├── NGINX Reverse Proxy (Port 3000)
          │
          └── Node.js Production Server (dist/server.cjs)
                │
                ├── Express API Endpoints (/api/*)
                └── Static Single Page App (dist/index.html & dist/assets/*)
```

---

## 2. Build Pipeline

The production build pipeline is defined in `package.json`:

```json
{
  "scripts": {
    "build": "vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs",
    "start": "node dist/server.cjs"
  }
}
```

### Build Steps:
1. **Frontend Compilation**: `vite build` compiles React TypeScript components, Tailwind CSS styling, and static assets into `dist/`.
2. **Backend Bundling**: `esbuild server.ts` bundles the Express server, Gemini SDK integration, and Jackpot Mirror scraper into a CommonJS production script `dist/server.cjs`.

---

## 3. Deployment Steps (GCP Cloud Run)

### Option A: Direct Deployment via AI Studio Build
In Google AI Studio Build environment, clicking **Deploy** automates the build and containerization flow:
1. Provisions Cloud Run container.
2. Injects runtime secrets (`GEMINI_API_KEY`, `APP_URL`).
3. Binds ingress traffic to Port 3000.

### Option B: Manual Docker Deployment

1. **Dockerfile**:
   ```dockerfile
   FROM node:20-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --only=production
   COPY . .
   RUN npm run build
   EXPOSE 3000
   ENV NODE_ENV=production
   CMD ["npm", "start"]
   ```

2. **Build Docker Image**:
   ```bash
   docker build -t gcr.io/YOUR_PROJECT_ID/mshindi-projo:latest .
   ```

3. **Deploy to Cloud Run**:
   ```bash
   gcloud run deploy mshindi-projo \
     --image gcr.io/YOUR_PROJECT_ID/mshindi-projo:latest \
     --platform managed \
     --region europe-west3 \
     --port 3000 \
     --set-env-vars NODE_ENV=production \
     --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest
   ```

---

## 4. Environment Variables Checklist

Ensure these variables are present in the target container environment:

| Variable | Scope | Description | Required |
| :--- | :--- | :--- | :--- |
| `GEMINI_API_KEY` | Server | Google Gemini API key for AI features | Yes |
| `APP_URL` | Server | Public host URL for CORS and self-links | Yes |
| `NODE_ENV` | Server | Must be set to `production` | Yes |
| `PORT` | Container | Hardcoded to `3000` | Yes |
