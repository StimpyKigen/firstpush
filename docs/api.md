# API Reference Documentation

## 1. Overview

Mshindi Projo provides server-side REST API endpoints hosted on Express.js. All endpoints are rate-limited to ensure system stability and key security.

- **Base URL**: `http://localhost:3000` (Dev) / `https://<APP_URL>` (Prod)
- **Content-Type**: `application/json`

---

## 2. Endpoints Summary

| Method | Endpoint | Auth | Rate Limit | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | None | 120/min | Backend server health status |
| `GET` | `/api/jackpots/mirror` | None | 120/min | Live scraped jackpot fixtures (SportPesa & Betika) |
| `POST` | `/api/gemini/support-chat` | None | 20/min | Ava 24/7 AI Customer Support Chat Specialist |
| `POST` | `/api/gemini/advisor` | None | 20/min | Sports advisor, match analysis & trivia generator |
| `POST` | `/api/gemini/parse-jackpot-text` | Admin | 20/min | AI raw webpage jackpot fixture parser |

---

## 3. Endpoint Specifications

### 3.1 `GET /api/health`
Checks backend server status and timestamp.

- **Request**: None
- **Response `200 OK`**:
  ```json
  {
    "status": "ok",
    "name": "Mshindi Projo Backend",
    "timestamp": "2026-08-03T12:00:00.000Z"
  }
  ```

---

### 3.2 `GET /api/jackpots/mirror`
Fetches live mirrored jackpot data scraped from official Kenyan bookmaker feeds.

- **Request**: None
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "timestamp": "2026-08-03T12:00:00.000Z",
    "jackpots": {
      "sportpesaMega": {
        "id": "sportpesa-mega-17",
        "name": "SportPesa Mega Jackpot Pro (17 Games)",
        "poolAmount": 384500120,
        "deadline": "Sat 17:00 EAT",
        "matches": [ ... ]
      },
      "betikaMidweek": {
        "id": "betika-midweek-15",
        "name": "Betika Midweek Jackpot (15 Games)",
        "poolAmount": 15000000,
        "deadline": "Wed 19:30 EAT",
        "matches": [ ... ]
      }
    }
  }
  ```

---

### 3.3 `POST /api/gemini/support-chat`
Interacts with Ava, the AI Customer Support Specialist powered by Google Gemini 3.6 Flash.

- **Request Body**:
  ```json
  {
    "message": "How much does it cost to unlock a jackpot room?",
    "history": [
      { "sender": "user", "text": "Hi Ava!" },
      { "sender": "ava", "text": "Hello! I'm Ava, your MshindiRoom guide." }
    ]
  }
  ```

- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "text": "Unlocking any jackpot consensus room costs a flat fee of **KSh 10** via M-Pesa. Once unlocked, you gain lifetime access to live community pick percentages, slip generators, and discussion chat!"
  }
  ```

- **Error Responses**:
  - `400 Bad Request`: `{ "error": "Message text is required." }`
  - `400 Bad Request`: `{ "error": "GEMINI_API_KEY is missing. Please set it in secrets." }`
  - `429 Too Many Requests`: `{ "error": "Too many requests. Please wait a moment before trying again." }`

---

### 3.4 `POST /api/gemini/advisor`
Generates sports predictions, match trivia, or strategic betting advice.

- **Request Body**:
  ```json
  {
    "prompt": "Analyze Arsenal vs Chelsea kickoff match.",
    "mode": "prediction"
  }
  ```

- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "text": "Arsenal enters in peak form with 4 consecutive home wins..."
  }
  ```

---

### 3.5 `POST /api/gemini/parse-jackpot-text`
Extracts structured match fixtures from raw text copied from jackpot web pages.

- **Request Body**:
  ```json
  {
    "rawText": "1. Arsenal vs Chelsea - Sat 17:00 EAT...",
    "bookie": "SportPesa",
    "legCount": 17
  }
  ```

- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "bookie": "SportPesa",
    "legCount": 17,
    "matches": [
      {
        "home": "Arsenal",
        "away": "Chelsea",
        "competition": "English Premier League",
        "kickoff": "Sat 17:00 EAT",
        "homePct": 55,
        "drawPct": 25,
        "awayPct": 20
      }
    ]
  }
  ```
