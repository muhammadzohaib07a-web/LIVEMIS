import webpush from "web-push";

type PushPayload = {
  title: string;
  body: string;
  url: string;
};

let vapidConfigured = false;

function ensureVapidConfigured() {
  if (vapidConfigured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

// Sends a real browser/OS push notification to every device the given user
// has subscribed on — delivered even if the tab or browser is closed.
export async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!ensureVapidConfigured()) {
    console.error("[push] VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT not configured; push skipped.");
    return;
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: subscriptions, error: subError } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth_key")
    .eq("user_id", userId);
  if (subError) {
    console.error(`[push] failed to look up subscriptions for user ${userId}:`, subError);
    return;
  }
  if (!subscriptions || subscriptions.length === 0) {
    console.log(`[push] no subscriptions on file for user ${userId} — nothing to send.`);
    return;
  }
  console.log(`[push] sending "${payload.title}" to user ${userId} (${subscriptions.length} device(s))`);

  const staleIds: string[] = [];
  let sent = 0;
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth_key },
          },
          JSON.stringify(payload),
        );
        sent += 1;
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        // 404/410 = the browser has revoked/expired this subscription — stop
        // trying to send to it instead of failing on every future notification.
        if (statusCode === 404 || statusCode === 410) {
          staleIds.push(sub.id);
          console.log(`[push] subscription ${sub.id} is stale (${statusCode}), dropping it.`);
        } else {
          console.error(`[push] send to subscription ${sub.id} failed:`, error);
        }
      }
    }),
  );
  console.log(`[push] done for user ${userId}: ${sent}/${subscriptions.length} sent, ${staleIds.length} stale`);

  if (staleIds.length > 0) {
    await supabaseAdmin.from("push_subscriptions").delete().in("id", staleIds);
  }
}
