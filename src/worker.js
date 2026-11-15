const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/create-checkout-session" && request.method === "POST") {
      if (!env.STRIPE_SECRET_KEY) {
        return json({ error: "Donation payments are not configured yet." }, 503);
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "Invalid request." }, 400);
      }

      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount < 1 || amount > 10000) {
        return json({ error: "Enter a donation between $1 and $10,000 USD." }, 400);
      }

      const params = new URLSearchParams();
      params.set("mode", "payment");
      params.set("success_url", `${url.origin}/?donation=success&session_id={CHECKOUT_SESSION_ID}#donate`);
      params.set("cancel_url", `${url.origin}/?donation=cancelled#donate`);
      params.set("line_items[0][price_data][currency]", "usd");
      params.set("line_items[0][price_data][unit_amount]", String(Math.round(amount * 100)));
      params.set("line_items[0][price_data][product_data][name]", "Donation to Global Development and Opportunity Foundation");
      params.set("line_items[0][quantity]", "1");
      params.set("submit_type", "donate");
      params.set("metadata[donation_type]", "one_time");
      params.set("metadata[organization]", "GDOF");

      try {
        const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
        });
        const session = await stripeResponse.json();
        if (!stripeResponse.ok) {
          return json({ error: "Stripe could not create the checkout session. Please try again." }, 502);
        }
        return json({ url: session.url });
      } catch {
        return json({ error: "Unable to reach the payment service. Please try again." }, 502);
      }
    }

    if (url.pathname === "/api/health") {
      return json({ ok: true, paymentsConfigured: Boolean(env.STRIPE_SECRET_KEY) });
    }

    return env.ASSETS.fetch(request);
  },
};
