import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0?target=deno";

/**
 * Paddle Webhook – aktualizuje profiles.premium_tier po udanej płatności.
 *
 * Wymagane zmienne środowiskowe:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PADDLE_WEBHOOK_SECRET
 *
 * Konfiguracja w dashboardzie Paddle:
 *   Settings → Notifications → Webhooks → dodaj URL tego endpointu
 */

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const webhookSecret = Deno.env.get("PADDLE_WEBHOOK_SECRET") ?? "";

/**
 * Weryfikuje sygnaturę webhooka Paddle (HMAC-SHA256).
 */
async function verifySignature(body: string, signature: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(webhookSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const expectedSigBuf = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body),
  );
  const expectedSig = Array.from(new Uint8Array(expectedSigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return expectedSig === signature;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

console.info("paddle-webhook started");

export default {
  fetch: async (req: Request) => {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    try {
      const body = await req.text();
      const signature = req.headers.get("paddle-signature") ?? "";

      if (!(await verifySignature(body, signature))) {
        console.error("Invalid Paddle webhook signature");
        return new Response("Invalid signature", { status: 401, headers: corsHeaders });
      }

      const event = JSON.parse(body);

      switch (event.event_type) {
        case "transaction.completed": {
          const txn = event.data;
          const customData = txn.custom_data ?? {};
          const userId = customData.userId as string | undefined;
          const username = customData.username as string | undefined;

          if (!userId) {
            console.error("No userId in transaction custom_data");
            break;
          }

          // Zapisz transakcję
          await supabase.from("payments").insert({
            user_id: userId,
            username: username ?? "unknown",
            stripe_session_id: txn.id, // Paddle transaction ID
            amount: (txn.details?.totals?.total ?? 0) / 100,
            currency: txn.currency ?? "pln",
            tier: "premium",
            status: "completed",
          });

          // Dla subskrypcji lub zakupu premium – podnieś tier
          const priceId = txn.items?.[0]?.price?.id ?? "";
          let tier = "premium";
          if (priceId.includes("starter")) tier = "starter";

          await supabase.from("profiles").upsert({
            id: userId,
            username: username ?? "unknown",
            premium_tier: tier,
            premium_updated_at: new Date().toISOString(),
          });

          console.log(`Transaction completed for ${username ?? userId}: ${tier}`);
          break;
        }

        case "subscription.created": {
          const sub = event.data;
          const customData = sub.custom_data ?? {};
          const userId = customData.userId as string | undefined;
          const username = customData.username as string | undefined;

          if (!userId) {
            console.error("No userId in subscription custom_data");
            break;
          }

          const priceId = sub.items?.[0]?.price?.id ?? "";
          let tier = "premium";
          if (priceId.includes("starter")) tier = "starter";

          // Rezerwuj payment record
          await supabase.from("payments").insert({
            user_id: userId,
            username: username ?? "unknown",
            stripe_session_id: sub.id,
            amount: 0,
            currency: "pln",
            tier,
            status: "completed",
          });

          await supabase.from("profiles").upsert({
            id: userId,
            username: username ?? "unknown",
            premium_tier: tier,
            premium_updated_at: new Date().toISOString(),
          });

          console.log(`Subscription created for ${username ?? userId}: ${tier}`);
          break;
        }

        case "subscription.cancelled": {
          const cancelledSub = event.data;
          const cancelData = cancelledSub.custom_data ?? {};
          const cancelUserId = cancelData.userId as string | undefined;

          if (cancelUserId) {
            await supabase.from("profiles").update({
              premium_tier: "free",
              premium_updated_at: new Date().toISOString(),
            }).eq("id", cancelUserId);

            console.log(`Subscription cancelled for user ${cancelUserId}`);
          }
          break;
        }
      }

      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("Paddle webhook error:", err);
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  },
};
