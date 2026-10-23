import { getVapidPublicKey, savePushSubscription, deletePushSubscription } from "@/lib/push-notifications";

export function isPushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

export async function getPushSubscriptionState(): Promise<"subscribed" | "unsubscribed" | "denied"> {
  if (!isPushSupported()) return "unsubscribed";
  if (Notification.permission === "denied") return "denied";
  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  const subscription = await registration?.pushManager.getSubscription();
  return subscription ? "subscribed" : "unsubscribed";
}

// Registers the service worker, asks browser permission, subscribes with the
// server's VAPID key, and saves the subscription so the server can push to it.
export async function enablePushNotifications() {
  if (!isPushSupported()) throw new Error("Push notifications aren't supported on this device/browser.");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was not granted.");

  const { publicKey } = await getVapidPublicKey();
  if (!publicKey) throw new Error("Push isn't configured on the server yet.");

  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    } catch (error) {
      // The browser has already said permission is granted by this point, so a
      // refusal here is not the page's prompt -- it is Windows or the browser
      // itself blocking push for this app. Chromium words that as
      // "Registration failed - permission denied", which tells nobody what to
      // change, so say where the switch actually is.
      const message = error instanceof Error ? error.message : String(error);
      if (/permission denied|NotAllowedError/i.test(message)) {
        throw new Error(
          "Windows or your browser is blocking notifications for this site. " +
            "Open Windows Settings > System > Notifications and switch your browser on, " +
            "then click the padlock next to the web address and set Notifications to Allow.",
        );
      }
      if (/applicationServerKey|InvalidAccessError|InvalidStateError/i.test(message)) {
        throw new Error(
          "This browser still holds an older notification registration for the site. " +
            "Clear this site's data in your browser settings, reload, and try again.",
        );
      }
      throw new Error(`The browser refused the notification registration: ${message}`);
    }
  }

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error("Browser returned an incomplete push subscription.");
  }
  await savePushSubscription({
    data: { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } },
  });
}

export async function disablePushNotifications() {
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await deletePushSubscription({ data: { endpoint } });
}
