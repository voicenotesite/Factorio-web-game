import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

interface CheckoutPayload {
  priceId: string;
  userId: string;
  username?: string;
  successUrl?: string;
  cancelUrl?: string;
}

console.info("stripe-checkout started");

export default {
  fetch: withSupabase({ auth: ["publishable", "secret"] }, async (req, ctx) => {
    try {
      const { priceId, userId, username, successUrl, cancelUrl }: CheckoutPayload = await req.json();

      if (!priceId || !userId) {
        return new Response(JSON.stringify({ error: "Missing priceId or userId" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card", "blik", "p24"],
        line_items: [{ price: priceId, quantity: 1 }],
        client_reference_id: userId,
        customer_email: `${username?.toLowerCase() ?? "user"}@novactorio.io`,
        metadata: {
          user_id: userId,
          username: username ?? "unknown",
        },
        subscription_data: {
          metadata: {
            user_id: userId,
            username: username ?? "unknown",
          },
        },
        success_url: successUrl ?? "https://factoryworld.mmc29213.workers.dev/?checkout=success",
        cancel_url: cancelUrl ?? "https://factoryworld.mmc29213.workers.dev/?checkout=cancel",
      });

      return new Response(JSON.stringify({ url: session.url, sessionId: session.id }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("Stripe checkout error:", err);
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
};
