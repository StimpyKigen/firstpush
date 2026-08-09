# Security Specification

## 1. Overview

Mshindi Projo implements multi-layered security measures across the frontend client, Express API server, and Firebase database layer to protect user balances, API secrets, and privacy.

---

## 2. API Key Concealment & Backend Proxying

All third-party secrets, specifically `GEMINI_API_KEY`, are restricted strictly to the server-side Node.js environment (`server.ts`).

- **Rule**: Client-side React code MUST NEVER bundle or reference secret API keys.
- **Proxy**: All AI requests (`/api/gemini/support-chat`, `/api/gemini/advisor`) are proxied through server endpoints.

---

## 3. Express Server Security Headers

Configured in `server.ts`:

```typescript
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});
```

---

## 4. API Rate Limiting

In-memory sliding-window rate limiters protect the API against denial-of-service (DoS) attacks and excessive AI API consumption:

- **General API Limiter**: 120 requests per minute per IP address.
- **Gemini AI Limiter**: 20 requests per minute per IP address.

---

## 5. Input Sanitization & XSS Mitigation

1. **Content Moderation**: All user commentary passes through `moderateText()` filtering out malicious script injections and off-platform phishing links.
2. **React Auto-Escaping**: JSX automatically escapes user strings prior to rendering.
3. **Payload Size Constraints**: Express JSON body parser strictly limits request payloads to `1mb`.
