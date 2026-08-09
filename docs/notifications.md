# Notifications Architecture

## 1. Overview

Mshindi Projo features an in-app and Progressive Web App (PWA) notification system for jackpot deadline reminders, consensus shift alerts, P2P wager challenges, and M-Pesa transaction updates.

---

## 2. Notification Data Model (`src/lib/notificationStore.ts`)

```typescript
export interface AppNotification {
  id: string;               // Notification ID
  type: 'jackpot_lockout' | 'p2p_challenge' | 'p2p_result' | 'deposit' | 'crown_win' | 'system';
  title: string;            // Headline text
  message: string;          // Detailed alert message
  timestamp: string;        // ISO timestamp
  read: boolean;            // Read status boolean
  actionUrl?: string;       // Optional route redirect link
}
```

---

## 3. Web Push & Service Worker Integration (`src/lib/pushNotifications.ts`)

For PWA users installed on iOS or Android home screens:

1. **Permission Request**: Prompt user for browser Notification permissions via the Profile page or PWA Install Prompt.
2. **Service Worker Subscription**: Registers a Web Push subscription through `swRegister.ts`.
3. **Trigger Events**:
   - **Jackpot Lockout Warning**: 1 Hour before SportPesa or Betika jackpot deadline.
   - **Consensus Shift Alert**: Triggered when community agreement on a match changes by > 20%.
   - **P2P Wager Accepted**: Notifies wager creator when an opponent joins their 1v1 bet.
