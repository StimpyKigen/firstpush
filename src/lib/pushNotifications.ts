// Web Push Notification Helper Architecture
export async function isPushNotificationSupported(): Promise<boolean> {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function getNotificationPermissionState(): NotificationPermission {
  if (!('Notification' in window)) return 'denied';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    throw new Error('Notifications are not supported in this browser.');
  }

  const permission = await Notification.requestPermission();
  return permission;
}

export async function subscribeUserToPush(): Promise<PushSubscription | null> {
  if (!(await isPushNotificationSupported())) {
    console.warn('[Mshindi Push] Web Push not supported on this browser.');
    return null;
  }

  const permission = await requestNotificationPermission();
  if (permission !== 'granted') {
    console.warn('[Mshindi Push] Permission not granted for push notifications.');
    return null;
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    // VAPID public key placeholder for future FCM or custom WebPush backend integration
    // Replace dummy key with server VAPID key when backend push server is attached
    const dummyVapidKey = 'BEl62iUYgUivxIkv69yViEuiBIa-m9GYXiJ44eJ4F1V6vF4P7W53P7_v0J9V8W6m3I6W1E6e6R8v';
    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(dummyVapidKey)
      });
      console.log('[Mshindi Push] Subscribed to Web Push:', subscription);
    } catch (err) {
      console.warn('[Mshindi Push] Direct VAPID subscription notice (ready for production backend VAPID key):', err);
    }
  }

  return subscription;
}

export async function simulateLocalTestNotification(title: string, body: string) {
  if ('serviceWorker' in navigator && (await isPushNotificationSupported())) {
    const perm = await requestNotificationPermission();
    if (perm === 'granted') {
      const reg = await navigator.serviceWorker.ready;
      reg.showNotification(title, {
        body,
        icon: '/pwa-192.png',
        badge: '/favicon-32.png',
        vibrate: [100, 50, 100],
      } as any);
    }
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
