const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers } });
const enc = new TextEncoder();
const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const fromB64 = value => Uint8Array.from(atob(value.replace(/-/g,"+").replace(/_/g,"/")), c => c.charCodeAt(0));
const db = env => { if (!env.GDOF_DB) throw new Error("Admin database is not configured. Create the GDOF D1 database and add the GDOF_DB binding."); return env.GDOF_DB; };
async function passwordHash(password, salt) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name:"PBKDF2", salt:enc.encode(salt), iterations:210000, hash:"SHA-256" }, key, 256);
  return b64(bits);
}
async function sign(value, secret) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), {name:"HMAC",hash:"SHA-256"}, false, ["sign"]);
  return b64(await crypto.subtle.sign("HMAC", key, enc.encode(value)));
}
async function makeSession(email, secret) {
  const payload = b64(enc.encode(JSON.stringify({ email, exp: Date.now()+12*60*60*1000 })));
  return payload + "." + await sign(payload, secret);
}
async function sessionEmail(request, env) {
  if (!env.ADMIN_SESSION_SECRET) return null;
  const cookie = request.headers.get("Cookie") || "";
  const token = cookie.split(";").map(x=>x.trim()).find(x=>x.startsWith("gdof_admin="))?.slice(11);
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || (await sign(payload, env.ADMIN_SESSION_SECRET)) !== signature) return null;
  try { const data=JSON.parse(new TextDecoder().decode(fromB64(payload))); return data.exp>Date.now()?data.email:null; } catch { return null; }
}
const cookie = value => ({ "Set-Cookie": `gdof_admin=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=43200` });
const clearCookie = { "Set-Cookie":"gdof_admin=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0" };
async function bootstrap(env) {
  const D = db(env);
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) return;
  const existing = await D.prepare("SELECT id FROM admins WHERE email = ?").bind(env.ADMIN_EMAIL.toLowerCase()).first();
  if (!existing) {
    const salt=b64(crypto.getRandomValues(new Uint8Array(16)));
    const hash=await passwordHash(env.ADMIN_PASSWORD,salt);
    await D.prepare("INSERT INTO admins (id,email,password_hash,password_salt,active) VALUES (?,?,?,?,1)").bind(crypto.randomUUID(),env.ADMIN_EMAIL.toLowerCase(),hash,salt).run();
  }
}
async function requireAdmin(request, env) {
  const email=await sessionEmail(request,env);
  if (!email) return null;
  const user=await db(env).prepare("SELECT id,email,active FROM admins WHERE email=?").bind(email).first();
  return user?.active ? user : null;
}
async function adminApi(request, env, url) {
  const path=url.pathname, method=request.method;
  if (path==="/api/admin/login" && method==="POST") {
    await bootstrap(env);
    if (!env.ADMIN_SESSION_SECRET) return json({error:"Admin session secret is not configured."},503);
    const body=await request.json().catch(()=>({}));
    const email=String(body.email||"").trim().toLowerCase(), password=String(body.password||"");
    const user=await db(env).prepare("SELECT id,email,password_hash,password_salt,active FROM admins WHERE email=?").bind(email).first();
    if (!user || !user.active || (await passwordHash(password,user.password_salt))!==user.password_hash) return json({error:"Invalid email or password."},401);
    const token=await makeSession(user.email,env.ADMIN_SESSION_SECRET);
    return json({user:{email:user.email}},200,cookie(token));
  }
  const user=await requireAdmin(request,env);
  if (path==="/api/admin/logout" && method==="POST") return json({ok:true},200,clearCookie);
  if (!user) return json({error:"Please sign in to continue."},401);
  const D=db(env);
  if (path==="/api/admin/me" && method==="GET") return json({user:{email:user.email}});
  if (path==="/api/admin/data" && method==="GET") {
    const [enquiries,donations,admins,rows]=await Promise.all([
      D.prepare("SELECT * FROM enquiries ORDER BY created_at DESC LIMIT 300").all(),
      D.prepare("SELECT * FROM donations ORDER BY created_at DESC LIMIT 300").all(),
      D.prepare("SELECT id,email,active,created_at FROM admins ORDER BY created_at ASC").all(),
      D.prepare("SELECT content_key,content_value FROM site_content").all()
    ]);
    const content={}; for (const row of rows.results||[]) content[row.content_key]=row.content_value;
    return json({enquiries:enquiries.results||[],donations:donations.results||[],admins:admins.results||[],content});
  }
  if (path==="/api/admin/content" && method==="PUT") {
    const body=await request.json().catch(()=>({}));
    const allowed=["tagline","about","mission","contactEmail"];
    for (const key of allowed) if (typeof body[key]==="string") await D.prepare("INSERT INTO site_content(content_key,content_value,updated_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(content_key) DO UPDATE SET content_value=excluded.content_value,updated_at=CURRENT_TIMESTAMP").bind(key,body[key].slice(0,5000)).run();
    return json({ok:true});
  }
  const enquiryMatch=path.match(/^\/api\/admin\/enquiries\/([^/]+)$/);
  if (enquiryMatch && method==="PATCH") {
    const body=await request.json().catch(()=>({}));
    if (!["new","in_progress","resolved"].includes(body.status)) return json({error:"Invalid enquiry status."},400);
    await D.prepare("UPDATE enquiries SET status=? WHERE id=?").bind(body.status,enquiryMatch[1]).run();
    return json({ok:true});
  }
  if (path==="/api/admin/admins" && method==="POST") {
    const body=await request.json().catch(()=>({}));
    const email=String(body.email||"").trim().toLowerCase(), password=String(body.password||"");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length<12) return json({error:"Enter a valid email and a password of at least 12 characters."},400);
    const salt=b64(crypto.getRandomValues(new Uint8Array(16))), hash=await passwordHash(password,salt);
    try { await D.prepare("INSERT INTO admins(id,email,password_hash,password_salt,active) VALUES(?,?,?,?,1)").bind(crypto.randomUUID(),email,hash,salt).run(); }
    catch { return json({error:"That administrator email may already exist."},409); }
    return json({ok:true});
  }
  const adminMatch=path.match(/^\/api\/admin\/admins\/([^/]+)$/);
  if (adminMatch && method==="PATCH") {
    const body=await request.json().catch(()=>({}));
    if (typeof body.active!=="boolean") return json({error:"Invalid account status."},400);
    if (adminMatch[1]===user.id && !body.active) return json({error:"You cannot disable your own account."},400);
    await D.prepare("UPDATE admins SET active=? WHERE id=?").bind(body.active?1:0,adminMatch[1]).run();
    return json({ok:true});
  }
  return json({error:"Admin endpoint not found."},404);
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/admin/")) {
      try { return await adminApi(request,env,url); }
      catch (error) { return json({error:error.message||"Admin service unavailable."},503); }
    }
    if (url.pathname === "/api/public-content" && request.method === "GET") {
      if (!env.GDOF_DB) return json({});
      try {
        const rows=await env.GDOF_DB.prepare("SELECT content_key,content_value FROM site_content").all();
        const content={}; for (const row of rows.results||[]) content[row.content_key]=row.content_value;
        return json(content);
      } catch { return json({}); }
    }
    if (url.pathname === "/api/contact" && request.method === "POST") {
      try {
        const D=db(env), body=await request.json();
        const name=String(body.name||"").trim(), email=String(body.email||"").trim(), subject=String(body.subject||"").trim(), message=String(body.message||"").trim();
        if (!name || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email) || !subject || !message) return json({error:"Please complete all fields with a valid email."},400);
        if (name.length>160 || email.length>254 || subject.length>200 || message.length>10000) return json({error:"One or more fields are too long."},400);
        await D.prepare("INSERT INTO enquiries(id,name,email,subject,message) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(),name,email,subject,message).run();
        return json({ok:true});
      } catch(error) { return json({error:error.message||"Unable to submit enquiry."},503); }
    }
    if (url.pathname === "/api/stripe/webhook" && request.method === "POST") {
      if (!env.STRIPE_WEBHOOK_SECRET || !env.GDOF_DB) return json({error:"Webhook is not configured."},503);
      const raw=await request.text(), header=request.headers.get("Stripe-Signature")||"";
      const parts=Object.fromEntries(header.split(",").map(x=>x.split("=",2)));
      const timestamp=Number(parts.t);
      if (!timestamp || Math.abs(Date.now()/1000-timestamp)>300 || !parts.v1) return json({error:"Invalid webhook signature."},400);
      const key=await crypto.subtle.importKey("raw",enc.encode(env.STRIPE_WEBHOOK_SECRET),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
      const signature=await crypto.subtle.sign("HMAC",key,enc.encode(parts.t+"."+raw));
      const expected=Array.from(new Uint8Array(signature),b=>b.toString(16).padStart(2,"0")).join("");
      if (expected!==parts.v1) return json({error:"Invalid webhook signature."},400);
      let event; try { event=JSON.parse(raw); } catch { return json({error:"Invalid event body."},400); }
      if (event.type==="checkout.session.completed") {
        const session=event.data?.object;
        if (session?.id && session.payment_status==="paid") {
          await env.GDOF_DB.prepare("INSERT OR IGNORE INTO donations(id,stripe_session_id,donor_email,amount_cents,currency,payment_status) VALUES(?,?,?,?,?,?)")
            .bind(crypto.randomUUID(),session.id,session.customer_details?.email||session.customer_email||null,Number(session.amount_total||0),String(session.currency||"usd"),session.payment_status).run();
        }
      }
      return json({received:true});
    }
    if (url.pathname === "/api/create-checkout-session" && request.method === "POST") {
      if (!env.STRIPE_SECRET_KEY) return json({ error: "Donation payments are not configured yet." }, 503);
      let body; try { body = await request.json(); } catch { return json({ error: "Invalid request." }, 400); }
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount < 1 || amount > 10000) return json({ error: "Enter a donation between $1 and $10,000 USD." }, 400);
      const params = new URLSearchParams();
      params.set("mode", "payment"); params.set("success_url", `${url.origin}/?donation=success&session_id={CHECKOUT_SESSION_ID}#donate`);
      params.set("cancel_url", `${url.origin}/?donation=cancelled#donate`); params.set("line_items[0][price_data][currency]", "usd");
      params.set("line_items[0][price_data][unit_amount]", String(Math.round(amount * 100)));
      params.set("line_items[0][price_data][product_data][name]", "Donation to Global Development and Opportunity Foundation");
      params.set("line_items[0][quantity]", "1"); params.set("submit_type", "donate");
      params.set("metadata[donation_type]", "one_time"); params.set("metadata[organization]", "GDOF");
      try {
        const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", { method:"POST", headers:{Authorization:`Bearer ${env.STRIPE_SECRET_KEY}`,"Content-Type":"application/x-www-form-urlencoded"}, body:params.toString() });
        const session=await stripeResponse.json();
        if (!stripeResponse.ok) return json({error:"Stripe could not create the checkout session. Please try again."},502);
        return json({url:session.url});
      } catch { return json({error:"Unable to reach the payment service. Please try again."},502); }
    }
    if (url.pathname === "/api/health") return json({ok:true,paymentsConfigured:Boolean(env.STRIPE_SECRET_KEY),adminDatabaseConfigured:Boolean(env.GDOF_DB)});
    return env.ASSETS.fetch(request);
  },
};
