import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const endpointSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

console.info("trade-webhook started");

export default {
  fetch: async (req: Request) => {
    try {
      const signature = req.headers.get("stripe-signature");
      if (!signature) {
        return new Response("Missing stripe-signature", { status: 400 });
      }

      const body = await req.text();
      let event: Stripe.Event;

      try {
        event = stripe.webhooks.constructEvent(body, signature, endpointSecret);
      } catch (err) {
        console.error("Webhook signature verification failed:", err.message);
        return new Response(`Webhook Error: ${err.message}`, { status: 400 });
      }

      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          const metadata = session.metadata ?? {};

          if (metadata.type === "trade_fee") {
            // Trade fee payment
            const feeId = metadata.fee_id;
            const agreementId = metadata.agreement_id;

            if (!feeId) {
              console.error("No fee_id in trade fee session metadata");
              break;
            }

            // Update fee status
            await supabase.from("trade_fees").update({
              status: "paid",
              stripe_payment_intent_id: session.payment_intent as string,
              paid_at: new Date().toISOString(),
            }).eq("id", feeId);

            // Update agreement status
            if (agreementId) {
              await supabase.from("trade_agreements").update({
                status: "fee_paid",
              }).eq("id", agreementId);
            }

            console.log(`Trade fee paid: ${feeId} (agreement: ${agreementId ?? "none"})`);
          } else {
            // Regular payment (pass through to existing logic)
            console.log("Non-trade payment received, type:", metadata.type);
          }
          break;
        }
      }

      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("Trade webhook error:", err);
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};
