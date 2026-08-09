# Installation & Local Setup Guide

## 1. System Requirements

Ensure your machine meets the following prerequisites:

- **Operating System**: macOS, Linux, or Windows 10/11 (WSL2 recommended)
- **Node.js**: `v18.0.0` or higher (LTS recommended)
- **npm**: `v9.0.0` or higher (or **bun** `v1.0+`)
- **Git**: `v2.20+`

---

## 2. Step-by-Step Local Setup

### Step 1: Clone the Repository
```bash
git clone https://github.com/mshindi/mshindi-projo.git
cd mshindi-projo
```

### Step 2: Install NPM Dependencies
```bash
npm install
```

### Step 3: Configure Environment Variables
Copy the template `.env.example` file to `.env`:
```bash
cp .env.example .env
```

Open `.env` and configure your local settings:

```env
# GEMINI_API_KEY: Obtain from Google AI Studio (https://aistudio.google.com/)
GEMINI_API_KEY="your-gemini-api-key-here"

# APP_URL: Local server root
APP_URL="http://localhost:3000"

# NODE_ENV
NODE_ENV="development"
```

### Step 4: Run the Development Server
```bash
npm run dev
```

The application will start on **port 3000**. Open your browser to:
`http://localhost:3000`

---

## 3. Verification

To verify that the local installation is working correctly:

1. **Health Check Endpoint**:
   Visit `http://localhost:3000/api/health`. You should receive:
   ```json
   {
     "status": "ok",
     "name": "Mshindi Projo Backend",
     "timestamp": "2026-08-03T12:00:00.000Z"
   }
   ```

2. **Ava AI Support**:
   Click on the floating Ava chat button in the bottom right corner of the web UI and send a test message. Ava should respond using the Gemini 3.6 Flash API.

3. **Jackpot Mirror Test**:
   Visit `http://localhost:3000/api/jackpots/mirror` to verify live jackpot data mirroring.
