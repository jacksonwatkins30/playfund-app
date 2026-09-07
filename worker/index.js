var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// index.js
var CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS }
  });
}
__name(json, "json");
function err(message, status = 400) {
  return json({ error: message }, status);
}
__name(err, "err");
async function supabase(env, method, path, body) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: {
      "apikey": env.SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": method === "POST" ? "return=representation" : "return=minimal"
    },
    body: body ? JSON.stringify(body) : void 0
  });
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, data: JSON.parse(text) };
  } catch {
    return { ok: res.ok, status: res.status, data: text };
  }
}
__name(supabase, "supabase");
function randomClubCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  const bytes = crypto.getRandomValues(new Uint8Array(7));
  for (let i = 0; i < 7; i++) code += alphabet[bytes[i] % alphabet.length];
  return code;
}
__name(randomClubCode, "randomClubCode");
function toStripeFormParams(obj, prefix) {
  const params = [];
  for (const [key, value] of Object.entries(obj)) {
    const paramKey = prefix ? `${prefix}[${key}]` : key;
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        const itemKey = `${paramKey}[${i}]`;
        if (item !== null && typeof item === "object") {
          params.push(...toStripeFormParams(item, itemKey));
        } else {
          params.push([itemKey, String(item)]);
        }
      });
    } else if (typeof value === "object") {
      params.push(...toStripeFormParams(value, paramKey));
    } else {
      params.push([paramKey, String(value)]);
    }
  }
  return params;
}
__name(toStripeFormParams, "toStripeFormParams");
async function stripe(env, method, path, params) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      "Authorization": `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params ? new URLSearchParams(toStripeFormParams(params)).toString() : void 0
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}
__name(stripe, "stripe");
async function stripeV2(env, method, path, body) {
  const res = await fetch(`https://api.stripe.com/v2${path}`, {
    method,
    headers: {
      "Authorization": `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Stripe-Version": "2026-07-29.dahlia",
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : void 0
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}
__name(stripeV2, "stripeV2");
async function supabaseSignIn(env, email, password) {
  const res = await fetch(
    `${env.SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        "apikey": env.SUPABASE_ANON_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    }
  );
  return { ok: res.ok, data: await res.json() };
}
__name(supabaseSignIn, "supabaseSignIn");
async function verifyStripeSignature(body, sigHeader, secret) {
  const encoder = new TextEncoder();
  const parts = sigHeader.split(",");
  const timestamp = parts.find((p) => p.startsWith("t=")).slice(2);
  const signature = parts.find((p) => p.startsWith("v1=")).slice(3);
  const payload = `${timestamp}.${body}`;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const computed = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return computed === signature;
}
__name(verifyStripeSignature, "verifyStripeSignature");
async function sendReminderEmail(env, club, team, athlete) {
  const RESEND_API_KEY = env.RESEND_API_KEY;
  if (!RESEND_API_KEY) return { ok: false, error: "RESEND_API_KEY not configured" };
  if (!athlete.parent_email) return { ok: false, skipped: true };
  const APP_URL = env.APP_URL || "https://jacksonwatkins30.github.io/playfund-app";
  const dues = (team.dues_cents || 0) / 100;
  const payUrl = `${APP_URL}?code=${club.code}&athlete=${athlete.id}`;
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;margin:0;padding:0;background:#F4F7F6;}
  </style></head><body style="margin:0;padding:0;background:#F4F7F6;">
  <table cellpadding="0" cellspacing="0" width="100%" style="background:#F4F7F6;"><tr><td align="center" style="padding:32px 16px;">
  <table cellpadding="0" cellspacing="0" width="520" style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <tr><td style="background:#004643;padding:18px 28px;">
      <span style="font-size:20px;font-weight:800;color:#fff;">Play</span><span style="font-size:20px;font-weight:800;color:#5BA888;">Fund</span>
      <span style="float:right;font-size:12px;color:rgba(255,255,255,0.6);">${club.name}</span>
    </td></tr>
    <tr><td style="padding:28px;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#5BA888;">Action needed</p>
      <h2 style="margin:0 0 12px;font-size:22px;font-weight:800;color:#004643;">${athlete.name}'s registration is still open.</h2>
      <p style="margin:0 0 20px;font-size:15px;color:#6B7280;line-height:1.6;">
        ${club.name} is waiting for ${athlete.name}'s registration to be completed.
        The season is coming up, take a moment to register and choose how you'd like to pay.
      </p>
      <table cellpadding="0" cellspacing="0" width="100%" style="background:#F4F7F6;border-radius:10px;margin-bottom:20px;">
        <tr><td style="padding:16px;">
          <table cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="font-size:13px;color:#6B7280;">Season dues</td>
              <td align="right" style="font-size:16px;font-weight:800;color:#004643;">$${dues.toLocaleString()}</td>
            </tr>
            <tr>
              <td style="font-size:13px;color:#6B7280;padding-top:6px;">Team</td>
              <td align="right" style="font-size:13px;font-weight:700;color:#004643;padding-top:6px;">${team.name}</td>
            </tr>
          </table>
        </td></tr>
      </table>
      <table cellpadding="0" cellspacing="0" width="100%"><tr>
        <td width="48%" style="padding:14px;background:#004643;border-radius:10px;text-align:center;">
          <p style="margin:0 0 4px;font-size:11px;color:#5BA888;font-weight:700;text-transform:uppercase;">Pay in full</p>
          <p style="margin:0 0 10px;font-size:20px;font-weight:800;color:#fff;">$${dues.toLocaleString()}</p>
          <a href="${payUrl}&method=full" style="display:inline-block;background:#5BA888;color:#fff;text-decoration:none;font-size:12px;font-weight:700;padding:8px 16px;border-radius:6px;">Pay now</a>
        </td>
        <td width="4%"></td>
        <td width="48%" style="padding:14px;background:#F4F7F6;border-radius:10px;text-align:center;">
          <p style="margin:0 0 4px;font-size:11px;color:#9CA3AF;font-weight:700;text-transform:uppercase;">Installments</p>
          <p style="margin:0 0 10px;font-size:20px;font-weight:800;color:#004643;">$${Math.round(dues / 4)}<span style="font-size:13px;font-weight:500;color:#9CA3AF;">/mo</span></p>
          <a href="${payUrl}&method=bnpl" style="display:inline-block;background:#004643;color:#fff;text-decoration:none;font-size:12px;font-weight:700;padding:8px 16px;border-radius:6px;">Set up plan</a>
        </td>
      </tr></table>
      <p style="margin:20px 0 0;font-size:12px;color:#9CA3AF;text-align:center;">
        Questions? Reply to this email, contact ${club.name} directly, or reach <a href="mailto:admin@playfundai.com" style="color:#5BA888;text-decoration:none;">admin@playfundai.com</a>.
      </p>
    </td></tr>
  </table>
  </td></tr></table>
  </body></html>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `${club.name} via PlayFund <admin@playfundai.com>`,
      to: [athlete.parent_email],
      subject: `Reminder: ${athlete.name}'s registration for ${club.name}`,
      html
    })
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error("Resend failed for", athlete.parent_email, errText);
    return { ok: false, error: errText, status: res.status };
  }
  await supabase(env, "PATCH", `/athletes?id=eq.${athlete.id}`, { last_reminder_sent_at: (/* @__PURE__ */ new Date()).toISOString() });
  return { ok: true };
}
__name(sendReminderEmail, "sendReminderEmail");
async function sendApprovalEmail(env, club, team, athlete) {
  const RESEND_API_KEY = env.RESEND_API_KEY;
  if (!RESEND_API_KEY || !athlete.parent_email) return;
  const APP_URL = env.APP_URL || "https://jacksonwatkins30.github.io/playfund-app";
  const dues = (team.dues_cents || 0) / 100;
  const payUrl = `${APP_URL}?code=${club.code}&athlete=${athlete.id}`;
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;margin:0;padding:0;background:#F4F7F6;}
  </style></head><body style="margin:0;padding:0;background:#F4F7F6;">
  <table cellpadding="0" cellspacing="0" width="100%" style="background:#F4F7F6;"><tr><td align="center" style="padding:32px 16px;">
  <table cellpadding="0" cellspacing="0" width="520" style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <tr><td style="background:#004643;padding:18px 28px;">
      <span style="font-size:20px;font-weight:800;color:#fff;">Play</span><span style="font-size:20px;font-weight:800;color:#5BA888;">Fund</span>
      <span style="float:right;font-size:12px;color:rgba(255,255,255,0.6);">${club.name}</span>
    </td></tr>
    <tr><td style="padding:28px;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#5BA888;">You're confirmed</p>
      <h2 style="margin:0 0 12px;font-size:22px;font-weight:800;color:#004643;">${athlete.name} is confirmed on the roster.</h2>
      <p style="margin:0 0 20px;font-size:15px;color:#6B7280;line-height:1.6;">
        ${club.name} has confirmed ${athlete.name} is on the team. You can now complete payment for the season.
      </p>
      <table cellpadding="0" cellspacing="0" width="100%" style="background:#F4F7F6;border-radius:10px;margin-bottom:20px;">
        <tr><td style="padding:16px;">
          <table cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="font-size:13px;color:#6B7280;">Season dues</td>
              <td align="right" style="font-size:16px;font-weight:800;color:#004643;">$${dues.toLocaleString()}</td>
            </tr>
            <tr>
              <td style="font-size:13px;color:#6B7280;padding-top:6px;">Team</td>
              <td align="right" style="font-size:13px;font-weight:700;color:#004643;padding-top:6px;">${team.name}</td>
            </tr>
          </table>
        </td></tr>
      </table>
      <table cellpadding="0" cellspacing="0" width="100%"><tr>
        <td width="48%" style="padding:14px;background:#004643;border-radius:10px;text-align:center;">
          <p style="margin:0 0 4px;font-size:11px;color:#5BA888;font-weight:700;text-transform:uppercase;">Pay in full</p>
          <p style="margin:0 0 10px;font-size:20px;font-weight:800;color:#fff;">$${dues.toLocaleString()}</p>
          <a href="${payUrl}&method=full" style="display:inline-block;background:#5BA888;color:#fff;text-decoration:none;font-size:12px;font-weight:700;padding:8px 16px;border-radius:6px;">Pay now</a>
        </td>
        <td width="4%"></td>
        <td width="48%" style="padding:14px;background:#F4F7F6;border-radius:10px;text-align:center;">
          <p style="margin:0 0 4px;font-size:11px;color:#9CA3AF;font-weight:700;text-transform:uppercase;">Installments</p>
          <p style="margin:0 0 10px;font-size:20px;font-weight:800;color:#004643;">$${Math.round(dues / 4)}<span style="font-size:13px;font-weight:500;color:#9CA3AF;">/mo</span></p>
          <a href="${payUrl}&method=bnpl" style="display:inline-block;background:#004643;color:#fff;text-decoration:none;font-size:12px;font-weight:700;padding:8px 16px;border-radius:6px;">Set up plan</a>
        </td>
      </tr></table>
      <p style="margin:20px 0 0;font-size:12px;color:#9CA3AF;text-align:center;">
        Questions? Reply to this email, contact ${club.name} directly, or reach <a href="mailto:admin@playfundai.com" style="color:#5BA888;text-decoration:none;">admin@playfundai.com</a>.
      </p>
    </td></tr>
  </table>
  </td></tr></table>
  </body></html>`;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${club.name} via PlayFund <admin@playfundai.com>`,
        to: [athlete.parent_email],
        subject: `${athlete.name} is confirmed, you can now pay for ${club.name}`,
        html
      })
    });
  } catch (e) {
    console.error("Approval email failed for", athlete.parent_email, e);
  }
}
__name(sendApprovalEmail, "sendApprovalEmail");
async function sendReceiptEmail(env, club, athlete, amountCents, paymentMethod, newStatus) {
  const RESEND_API_KEY = env.RESEND_API_KEY;
  if (!RESEND_API_KEY || !athlete.parent_email) return;
  const amount = (amountCents / 100).toLocaleString();
  const isKlarna = paymentMethod === "klarna";
  const statusLine = isKlarna
    ? (newStatus === "bnpl_complete" ? "Your Klarna installment plan is now fully paid off." : "This payment is part of your Klarna installment plan. Klarna will continue billing your remaining installments directly.")
    : "This covers the full season dues. Nothing else is due.";
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;margin:0;padding:0;background:#F4F7F6;}
  </style></head><body style="margin:0;padding:0;background:#F4F7F6;">
  <table cellpadding="0" cellspacing="0" width="100%" style="background:#F4F7F6;"><tr><td align="center" style="padding:32px 16px;">
  <table cellpadding="0" cellspacing="0" width="520" style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <tr><td style="background:#004643;padding:18px 28px;">
      <span style="font-size:20px;font-weight:800;color:#fff;">Play</span><span style="font-size:20px;font-weight:800;color:#5BA888;">Fund</span>
      <span style="float:right;font-size:12px;color:rgba(255,255,255,0.6);">${club.name}</span>
    </td></tr>
    <tr><td style="padding:28px;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#5BA888;">Payment received</p>
      <h2 style="margin:0 0 12px;font-size:22px;font-weight:800;color:#004643;">$${amount} received for ${athlete.name}</h2>
      <p style="margin:0 0 20px;font-size:15px;color:#6B7280;line-height:1.6;">${statusLine}</p>
      <table cellpadding="0" cellspacing="0" width="100%" style="background:#F4F7F6;border-radius:10px;">
        <tr><td style="padding:16px;">
          <table cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="font-size:13px;color:#6B7280;">Amount paid</td>
              <td align="right" style="font-size:16px;font-weight:800;color:#004643;">$${amount}</td>
            </tr>
            <tr>
              <td style="font-size:13px;color:#6B7280;padding-top:6px;">Payment method</td>
              <td align="right" style="font-size:13px;font-weight:700;color:#004643;padding-top:6px;">${isKlarna ? "Klarna" : paymentMethod === "us_bank_account" ? "Bank transfer" : "Card"}</td>
            </tr>
            <tr>
              <td style="font-size:13px;color:#6B7280;padding-top:6px;">Club</td>
              <td align="right" style="font-size:13px;font-weight:700;color:#004643;padding-top:6px;">${club.name}</td>
            </tr>
          </table>
        </td></tr>
      </table>
      <p style="margin:20px 0 0;font-size:12px;color:#9CA3AF;text-align:center;">
        Questions about this payment? Reply to this email, contact ${club.name} directly, or reach <a href="mailto:admin@playfundai.com" style="color:#5BA888;text-decoration:none;">admin@playfundai.com</a>.
      </p>
    </td></tr>
  </table>
  </td></tr></table>
  </body></html>`;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${club.name} via PlayFund <admin@playfundai.com>`,
        to: [athlete.parent_email],
        subject: `Receipt: $${amount} for ${athlete.name} — ${club.name}`,
        html
      })
    });
  } catch (e) {
    console.error("Receipt email failed for", athlete.parent_email, e);
  }
}
__name(sendReceiptEmail, "sendReceiptEmail");
async function sendPendingApprovalEmail(env, club, team, athlete) {
  const RESEND_API_KEY = env.RESEND_API_KEY;
  if (!RESEND_API_KEY || !club.admin_email) return;
  const dues = ((team && team.dues_cents) || 0) / 100;
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;margin:0;padding:0;background:#F4F7F6;}
  </style></head><body style="margin:0;padding:0;background:#F4F7F6;">
  <table cellpadding="0" cellspacing="0" width="100%" style="background:#F4F7F6;"><tr><td align="center" style="padding:32px 16px;">
  <table cellpadding="0" cellspacing="0" width="520" style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <tr><td style="background:#004643;padding:18px 28px;">
      <span style="font-size:20px;font-weight:800;color:#fff;">Play</span><span style="font-size:20px;font-weight:800;color:#5BA888;">Fund</span>
      <span style="float:right;font-size:12px;color:rgba(255,255,255,0.6);">${club.name}</span>
    </td></tr>
    <tr><td style="padding:28px;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#5BA888;">New pending athlete</p>
      <h2 style="margin:0 0 12px;font-size:22px;font-weight:800;color:#004643;">${athlete.name} was added by a parent</h2>
      <p style="margin:0 0 20px;font-size:15px;color:#6B7280;line-height:1.6;">
        This athlete was added directly by a parent, not through your team's registration link, so PlayFund can't confirm they're actually on the roster. No payment can be collected for them until you approve or remove them.
      </p>
      <table cellpadding="0" cellspacing="0" width="100%" style="background:#F4F7F6;border-radius:10px;margin-bottom:20px;">
        <tr><td style="padding:16px;">
          <table cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="font-size:13px;color:#6B7280;">Athlete</td>
              <td align="right" style="font-size:13px;font-weight:700;color:#004643;">${athlete.name}</td>
            </tr>
            ${team ? `<tr><td style="font-size:13px;color:#6B7280;padding-top:6px;">Team</td><td align="right" style="font-size:13px;font-weight:700;color:#004643;padding-top:6px;">${team.name}</td></tr>` : ""}
            <tr>
              <td style="font-size:13px;color:#6B7280;padding-top:6px;">Season dues</td>
              <td align="right" style="font-size:16px;font-weight:800;color:#004643;padding-top:6px;">$${dues.toLocaleString()}</td>
            </tr>
            <tr>
              <td style="font-size:13px;color:#6B7280;padding-top:6px;">Parent email</td>
              <td align="right" style="font-size:13px;font-weight:700;color:#004643;padding-top:6px;">${athlete.parent_email}</td>
            </tr>
          </table>
        </td></tr>
      </table>
      <p style="margin:0;font-size:12px;color:#9CA3AF;text-align:center;">
        Sign in to PlayFund and open this team's roster to approve or remove them. Questions? Reach <a href="mailto:admin@playfundai.com" style="color:#5BA888;text-decoration:none;">admin@playfundai.com</a>.
      </p>
    </td></tr>
  </table>
  </td></tr></table>
  </body></html>`;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "PlayFund <admin@playfundai.com>",
        to: [club.admin_email],
        reply_to: athlete.parent_email || void 0,
        subject: `${athlete.name} needs your approval before they can pay`,
        html
      })
    });
  } catch (e) {
    console.error("Pending approval email failed for", club.admin_email, e);
  }
}
__name(sendPendingApprovalEmail, "sendPendingApprovalEmail");
async function sendClubWelcomeEmail(env, club, setupUrl) {
  const RESEND_API_KEY = env.RESEND_API_KEY;
  if (!RESEND_API_KEY || !club.admin_email) return;
  const fmt = (iso) => {
    if (!iso) return null;
    return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };
  const adminFirst = (club.admin_name || "there").split(" ")[0];
  const athleteCount = club.athlete_count || 0;
  const feesTotal = club.fees_per_athlete || 0;
  const totalDues = feesTotal * athleteCount;
  const feeBps = club.fee_bps || 500;
  const payout = Math.round(totalDues * (1 - feeBps / 10000));
  let payoutDate = "TBD, set your team dues after signing in";
  if (club.season_start) {
    const d = new Date(club.season_start + "T00:00:00");
    d.setDate(d.getDate() + 14);
    payoutDate = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  }
  const startStr = fmt(club.season_start);
  const endStr = fmt(club.season_end);
  const seasonDates = startStr && endStr ? `${startStr} to ${endStr}` : startStr || endStr || "TBD";
  const cityVal = club.city || "";
  const stateVal = club.state || "";
  const location = cityVal && stateVal && !cityVal.includes(stateVal) ? `${cityVal}, ${stateVal}` : cityVal || stateVal || "TBD";
  const duesStr = feesTotal > 0 ? `$${feesTotal.toLocaleString()}` : "TBD, set after signing in";
  const totalStr = totalDues > 0 ? `$${totalDues.toLocaleString()}` : "TBD";
  const payoutStr = payout > 0 ? `$${payout.toLocaleString()}` : "TBD";
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
    body{margin:0;padding:0;background-color:#F4F7F6;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;}
  </style></head><body style="margin:0;padding:0;background-color:#F4F7F6;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#F4F7F6;"><tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="560" style="background-color:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08);">
    <tr><td style="background-color:#004643;padding:20px 32px;">
      <span style="font-size:22px;font-weight:800;color:#FFFFFF;">Play</span><span style="font-size:22px;font-weight:800;color:#5BA888;">Fund</span>
      <span style="float:right;font-size:12px;color:rgba(255,255,255,0.6);">Club Registration</span>
    </td></tr>
    <tr><td style="padding:36px 32px 28px;border-bottom:1px solid #E8EDEC;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#5BA888;">You're all set</p>
      <h1 style="margin:0 0 12px;font-size:28px;font-weight:800;color:#004643;line-height:1.2;">${adminFirst}, ${club.name} is registered.</h1>
      <p style="margin:0;font-size:15px;color:#6B7280;line-height:1.6;">Set up your account below to connect your bank and start collecting, no call needed. Here's what you submitted.</p>
    </td></tr>
    <tr><td style="padding:0;background-color:#004643;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
        <tr><td style="padding:24px 32px 8px;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#5BA888;">Estimated Day 1 payout</p>
          <p style="margin:0 0 6px;font-size:48px;font-weight:800;color:#FFFFFF;line-height:1;">${payoutStr}</p>
          <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.6);">${athleteCount} athletes &middot; ${totalStr} total dues &middot; ${(feeBps / 100).toString().replace(/\.0$/, "")}% PlayFund fee &middot; illustrative</p>
        </td></tr>
        <tr><td style="padding:12px 32px 24px;border-top:1px solid rgba(255,255,255,0.12);">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
            <td style="font-size:13px;color:rgba(255,255,255,0.6);">Estimated payout date</td>
            <td align="right" style="font-size:13px;font-weight:700;color:#FFFFFF;">${payoutDate}</td>
          </tr></table>
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:24px 32px;border-bottom:1px solid #E8EDEC;">
      <p style="margin:0 0 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#9CA3AF;">What you submitted</p>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
        <tr><td style="padding:9px 0;border-bottom:1px solid #E8EDEC;"><table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td style="font-size:13px;color:#6B7280;">Club name</td><td align="right" style="font-size:13px;font-weight:700;color:#004643;">${club.name}</td></tr></table></td></tr>
        <tr><td style="padding:9px 0;border-bottom:1px solid #E8EDEC;"><table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td style="font-size:13px;color:#6B7280;">Sport</td><td align="right" style="font-size:13px;font-weight:700;color:#004643;">${club.sport || "TBD"}</td></tr></table></td></tr>
        <tr><td style="padding:9px 0;border-bottom:1px solid #E8EDEC;"><table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td style="font-size:13px;color:#6B7280;">Location</td><td align="right" style="font-size:13px;font-weight:700;color:#004643;">${location}</td></tr></table></td></tr>
        <tr><td style="padding:9px 0;border-bottom:1px solid #E8EDEC;"><table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td style="font-size:13px;color:#6B7280;">Season</td><td align="right" style="font-size:13px;font-weight:700;color:#004643;">${seasonDates}</td></tr></table></td></tr>
        <tr><td style="padding:9px 0;border-bottom:1px solid #E8EDEC;"><table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td style="font-size:13px;color:#6B7280;">Athletes</td><td align="right" style="font-size:13px;font-weight:700;color:#004643;">${athleteCount || "TBD"}</td></tr></table></td></tr>
        <tr><td style="padding:9px 0;"><table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td style="font-size:13px;color:#6B7280;">Season dues per athlete</td><td align="right" style="font-size:13px;font-weight:700;color:#004643;">${duesStr}</td></tr></table></td></tr>
      </table>
    </td></tr>
    <tr><td align="center" style="padding:24px 32px;border-bottom:1px solid #E8EDEC;">
      <p style="margin:0 0 14px;font-size:14px;color:#6B7280;line-height:1.5;">Start by setting up your dashboard login, it only takes a minute.</p>
      ${setupUrl ? `<a href="${setupUrl}" style="display:inline-block;background-color:#004643;color:#FFFFFF;text-decoration:none;font-size:15px;font-weight:700;padding:14px 36px;border-radius:10px;letter-spacing:0.02em;">Set up your account</a>
      <p style="margin:12px 0 0;font-size:11px;color:#9CA3AF;">This link expires in 24 hours. Contact us if it's expired.</p>` : `<p style="margin:0;font-size:13px;color:#9CA3AF;">We'll follow up separately with your setup link.</p>`}
    </td></tr>
    <tr><td style="padding:24px 32px;border-bottom:1px solid #E8EDEC;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
        <td style="padding:16px;background-color:#F4F7F6;border-radius:12px;">
          <p style="margin:0 0 5px;font-size:13px;font-weight:700;color:#004643;">Have these ready when you connect your bank</p>
          <p style="margin:0;font-size:13px;color:#6B7280;line-height:1.6;">&bull; Club EIN (Employer Identification Number)<br>&bull; Bank account and routing number<br>&bull; Your team roster with parent emails</p>
        </td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:28px 32px;">
      <p style="margin:0 0 4px;font-size:14px;color:#6B7280;">Questions? Just reply to this email.</p>
      <p style="margin:0;font-size:14px;font-weight:700;color:#004643;">The PlayFund Team</p>
      <p style="margin:0;font-size:13px;color:#9CA3AF;"><a href="mailto:admin@playfundai.com" style="color:#5BA888;text-decoration:none;">admin@playfundai.com</a></p>
    </td></tr>
  </table>
  </td></tr></table>
  </body></html>`;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "PlayFund <admin@playfundai.com>",
        to: [club.admin_email],
        subject: `Welcome to PlayFund, ${club.name}`,
        html
      })
    });
  } catch (e) {
    console.error("Club welcome email failed for", club.admin_email, e);
  }
}
__name(sendClubWelcomeEmail, "sendClubWelcomeEmail");
async function sendInternalClubAlert(env, club) {
  const RESEND_API_KEY = env.RESEND_API_KEY;
  if (!RESEND_API_KEY) return;
  const dues = club.fees_per_athlete || 0;
  const athletes = club.athlete_count || 0;
  const totalDues = dues * athletes;
  const feeBps = club.fee_bps || 500;
  const payout = Math.round(totalDues * (1 - feeBps / 10000));
  const cityVal = club.city || "";
  const stateVal = club.state || "";
  const location = cityVal && stateVal && !cityVal.includes(stateVal) ? `${cityVal}, ${stateVal}` : cityVal || stateVal || "Not provided";
  const fmt = (iso) => {
    if (!iso) return "Not provided";
    return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };
  const seasonDates = club.season_start || club.season_end ? `${fmt(club.season_start)} to ${fmt(club.season_end)}` : "Not provided";
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;margin:0;padding:0;background:#F4F7F6;}
    table{width:100%;border-collapse:collapse;}
    td{padding:9px 0;font-size:14px;border-bottom:1px solid #E8EDEC;}
    td:last-child{text-align:right;font-weight:700;color:#004643;}
    td:first-child{color:#6B7280;}
  </style></head><body>
  <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="background:#004643;padding:18px 28px;">
      <span style="font-size:20px;font-weight:800;color:#fff;">Play</span><span style="font-size:20px;font-weight:800;color:#5BA888;">Fund</span>
      <span style="float:right;font-size:12px;color:rgba(255,255,255,0.6);">New club registration</span>
    </div>
    <div style="padding:24px 28px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#5BA888;">New club signed up</p>
      <h2 style="margin:0 0 4px;font-size:22px;font-weight:800;color:#004643;">${club.name}</h2>
      <p style="margin:0 0 20px;font-size:14px;color:#6B7280;">Submitted ${(/* @__PURE__ */ new Date()).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p>
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#5BA888;">Estimated payout</p>
      <div style="font-size:36px;font-weight:800;color:#004643;margin:8px 0 4px;">$${payout > 0 ? payout.toLocaleString() : "TBD"}</div>
      <p style="font-size:13px;color:#9CA3AF;margin:0 0 20px;">${athletes} athletes &middot; ${payout > 0 ? "$" + totalDues.toLocaleString() : "TBD"} total dues</p>
      <table>
        <tr><td>Contact</td><td>${club.admin_name || "unknown"} (${club.admin_email || "no email"})</td></tr>
        <tr><td>Sport</td><td>${club.sport || "unknown"}</td></tr>
        <tr><td>Location</td><td>${location}</td></tr>
        <tr><td>Season</td><td>${seasonDates}</td></tr>
        <tr><td>Athletes</td><td>${athletes || "unknown"}</td></tr>
        <tr><td>Dues per athlete</td><td>${dues > 0 ? "$" + dues.toLocaleString() : "unknown"}</td></tr>
        <tr><td>Club code</td><td style="font-family:monospace;">${club.code || "unknown"}</td></tr>
      </table>
      <div style="margin-top:20px;padding:14px;background:#F4F7F6;border-radius:10px;">
        <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#004643;">Next step: reach out within 1 business day</p>
        <p style="margin:0;font-size:13px;color:#6B7280;">Reply to ${club.admin_email || "the club"} to schedule the onboarding call. They need EIN and bank details.</p>
      </div>
    </div>
  </div>
  </body></html>`;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "PlayFund Alerts <alerts@playfundai.com>",
        to: ["jackson@playfundai.com", "clyde@playfundai.com"],
        subject: `New club: ${club.name} (${location}), est. $${payout > 0 ? payout.toLocaleString() : "TBD"} payout`,
        html
      })
    });
  } catch (e) {
    console.error("Internal club alert failed", e);
  }
}
__name(sendInternalClubAlert, "sendInternalClubAlert");
async function runScheduledReminders(env) {
  const clubsRes = await supabase(
    env,
    "GET",
    "/clubs?reminders_enabled=eq.true&select=id,name,code,reminder_pre_due_days,reminder_recurring_interval_days"
  );
  const clubs = clubsRes.data || [];
  let totalSent = 0;
  const errors = [];
  for (const club of clubs) {
    const teamsRes = await supabase(
      env,
      "GET",
      `/teams?club_id=eq.${club.id}&active=eq.true&dues_due_date=not.is.null&select=id,name,dues_cents,dues_due_date`
    );
    const teams = teamsRes.data || [];
    for (const team of teams) {
      const athRes = await supabase(
        env,
        "GET",
        `/athletes?team_id=eq.${team.id}&select=id,name,parent_email,payment_status,last_reminder_sent_at&or=(payment_status.eq.unpaid,payment_status.is.null)`
      );
      const athletes = athRes.data || [];
      const today = new Date((/* @__PURE__ */ new Date()).toISOString().slice(0, 10) + "T00:00:00Z");
      const due = new Date(team.dues_due_date + "T00:00:00Z");
      const daysUntilDue = Math.round((due - today) / 864e5);
      for (const athlete of athletes) {
        if (!athlete.parent_email) continue;
        let eligible = false;
        if (club.reminder_pre_due_days != null && daysUntilDue === club.reminder_pre_due_days && !athlete.last_reminder_sent_at) {
          eligible = true;
        }
        if (!eligible && club.reminder_recurring_interval_days && daysUntilDue < 0) {
          if (!athlete.last_reminder_sent_at) {
            eligible = true;
          } else {
            const daysSinceLast = Math.floor((Date.now() - new Date(athlete.last_reminder_sent_at).getTime()) / 864e5);
            if (daysSinceLast >= club.reminder_recurring_interval_days) eligible = true;
          }
        }
        if (eligible) {
          const r = await sendReminderEmail(env, club, team, athlete);
          if (r.ok) totalSent++;
          else errors.push({ athlete: athlete.name, email: athlete.parent_email, error: r.error || "unknown" });
        }
      }
    }
  }
  console.log(`Scheduled reminders: sent ${totalSent}`);
  return { sent: totalSent, errors };
}
__name(runScheduledReminders, "runScheduledReminders");
var index_default = {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runScheduledReminders(env));
  },
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }
    if (method === "GET" && path === "/config") {
      return json({ stripePublishableKey: env.STRIPE_PUBLISHABLE_KEY || null });
    }
    if (method === "POST" && path === "/events") {
      let body;
      try {
        body = await request.json();
      } catch {
        return err("Invalid JSON");
      }
      const { event_name, session_id, athlete_id, club_id, properties } = body;
      if (!event_name || typeof event_name !== "string") return err("event_name required");
      try {
        await supabase(env, "POST", "/events", {
          event_name,
          session_id: session_id || null,
          athlete_id: athlete_id || null,
          club_id: club_id || null,
          properties: properties && typeof properties === "object" ? properties : {}
        });
      } catch (e) {
      }
      return json({ success: true });
    }
    if (method === "POST" && path === "/remind") {
      const authHeader = request.headers.get("Authorization") || "";
      const token = authHeader.replace("Bearer ", "").trim();
      if (!token) return err("Authorization required", 401);
      const callerRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
        headers: { "apikey": env.SUPABASE_ANON_KEY, "Authorization": `Bearer ${token}` }
      });
      if (!callerRes.ok) return err("Invalid token", 401);
      const callerData = await callerRes.json();
      const callerProfileRes = await supabase(env, "GET", `/user_profiles?id=eq.${callerData.id}&select=role,club_id,team_id`);
      const callerProfile = callerProfileRes.data?.[0];
      if (!callerProfile) return err("Forbidden", 403);
      let body;
      try {
        body = await request.json();
      } catch {
        return err("Invalid JSON");
      }
      const { team_id } = body;
      if (!team_id) return err("team_id required");
      const teamRes = await supabase(env, "GET", `/teams?select=id,name,dues_cents,club_id&id=eq.${team_id}`);
      const team = teamRes.data?.[0];
      if (!team) return err("Team not found", 404);
      const isAllowed = callerProfile.role === "playfund_admin" || callerProfile.role === "club_admin" && callerProfile.club_id === team.club_id || callerProfile.role === "team_admin" && callerProfile.team_id === team_id;
      if (!isAllowed) return err("Forbidden", 403);
      const clubRes = await supabase(env, "GET", `/clubs?select=id,name,code&id=eq.${team.club_id}`);
      const club = clubRes.data?.[0];
      if (!club) return err("Club not found", 404);
      const athRes = await supabase(
        env,
        "GET",
        `/athletes?select=id,name,parent_email,payment_status&team_id=eq.${team_id}&or=(payment_status.eq.unpaid,payment_status.is.null)`
      );
      const athletes = athRes.data || [];
      if (!athletes.length) return json({ sent: 0, message: "No unpaid athletes found" });
      let sent = 0;
      const skipped = [];
      for (const athlete of athletes) {
        const r = await sendReminderEmail(env, club, team, athlete);
        if (r.ok) sent++;
        else if (r.skipped) skipped.push(athlete.name);
      }
      return json({ sent, skipped, total: athletes.length });
    }
    if (method === "POST" && path === "/auth/signup") {
      let body;
      try {
        body = await request.json();
      } catch {
        return err("Invalid JSON");
      }
      const { email, password, athlete_ids } = body;
      if (!email || !password) return err("email and password required");
      if (password.length < 8) return err("Password must be at least 8 characters");
      const signupRes = await fetch(`${env.SUPABASE_URL}/auth/v1/signup`, {
        method: "POST",
        headers: {
          "apikey": env.SUPABASE_SERVICE_KEY,
          "Authorization": `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email: email.toLowerCase().trim(), password })
      });
      const signupData = await signupRes.json();
      let userId = signupData?.user?.id || signupData?.id;
      let accessToken = signupData?.session?.access_token;
      if (!userId) {
        const { ok, data } = await supabaseSignIn(env, email, password);
        if (!ok) return err("Email already in use. Try signing in instead.", 409);
        userId = data.user.id;
        accessToken = data.access_token;
      }
      const existingProfile = await supabase(env, "GET", `/user_profiles?id=eq.${userId}&select=id,role`);
      if (!existingProfile.data?.length) {
        await supabase(env, "POST", "/user_profiles", {
          id: userId,
          role: "parent",
          display_name: null
        });
      }
      if (athlete_ids?.length) {
        for (const aid of athlete_ids) {
          await supabase(env, "PATCH", `/athletes?id=eq.${aid}`, {
            parent_user_id: userId
          });
        }
      }
      return json({
        success: true,
        user: { id: userId, email, role: "parent" },
        access_token: accessToken
      }, 201);
    }
    if (method === "POST" && path === "/auth/login") {
      let body;
      try {
        body = await request.json();
      } catch {
        return err("Invalid JSON");
      }
      const { email, password } = body;
      if (!email || !password) return err("email and password required");
      const { ok, data } = await supabaseSignIn(env, email, password);
      if (!ok) return err("Invalid email or password", 401);
      const profileRes = await supabase(
        env,
        "GET",
        `/user_profiles?id=eq.${data.user.id}&select=role,club_id,team_id,display_name`
      );
      const profile = profileRes.data?.[0] || {};
      const allowedRoles = ["club_admin", "team_admin", "playfund_admin", "parent"];
      if (!allowedRoles.includes(profile.role)) {
        return err("This account does not have admin access", 403);
      }
      let clubData = null;
      let teamData = null;
      if (profile.role === "club_admin" && profile.club_id) {
        const clubRes = await supabase(
          env,
          "GET",
          `/clubs?id=eq.${profile.club_id}&select=id,name,sport,city,state,code`
        );
        clubData = clubRes.data?.[0] || null;
      }
      if (profile.role === "team_admin" && profile.team_id) {
        const teamRes = await supabase(
          env,
          "GET",
          `/teams?id=eq.${profile.team_id}&select=id,name,age_group,dues_cents,club_id`
        );
        teamData = teamRes.data?.[0] || null;
        if (teamData?.club_id) {
          const clubRes = await supabase(
            env,
            "GET",
            `/clubs?id=eq.${teamData.club_id}&select=id,name,sport,city,state,code`
          );
          clubData = clubRes.data?.[0] || null;
        }
      }
      return json({
        access_token: data.access_token,
        user: {
          id: data.user.id,
          email: data.user.email,
          role: profile.role,
          club_id: profile.club_id,
          team_id: profile.team_id || null,
          display_name: profile.display_name,
          club: clubData,
          team: teamData
        }
      });
    }
    if (method === "POST" && path.startsWith("/admin/clubs/") && path.endsWith("/backfill-klarna")) {
      const clubId = path.split("/")[3];
      if (!clubId) return err("Club ID required");
      const authHeader = request.headers.get("Authorization") || "";
      const token = authHeader.replace("Bearer ", "").trim();
      if (!token) return err("Authorization required", 401);
      const userRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
        headers: { "apikey": env.SUPABASE_ANON_KEY, "Authorization": `Bearer ${token}` }
      });
      if (!userRes.ok) return err("Invalid token", 401);
      const userData = await userRes.json();
      const profileRes = await supabase(env, "GET", `/user_profiles?id=eq.${userData.id}&select=role`);
      if (profileRes.data?.[0]?.role !== "playfund_admin") return err("Forbidden", 403);
      const clubRes = await supabase(env, "GET", `/clubs?id=eq.${clubId}&select=stripe_account_id`);
      const club = clubRes.data?.[0];
      if (!club?.stripe_account_id) return err("Club has no connected Stripe account", 400);
      const updateRes = await stripeV2(env, "POST", `/core/accounts/${club.stripe_account_id}`, {
        configuration: { merchant: { capabilities: { klarna_payments: { requested: true } } } },
        include: ["configuration.merchant"]
      });
      if (!updateRes.ok) return err("Failed to update capabilities: " + JSON.stringify(updateRes.data), 500);
      return json({ success: true, capabilities: updateRes.data?.configuration?.merchant?.capabilities });
    }
    if (method === "POST" && path === "/admin/run-reminders") {
      const authHeader = request.headers.get("Authorization") || "";
      const token = authHeader.replace("Bearer ", "").trim();
      if (!token) return err("Authorization required", 401);
      const userRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
        headers: { "apikey": env.SUPABASE_ANON_KEY, "Authorization": `Bearer ${token}` }
      });
      if (!userRes.ok) return err("Invalid token", 401);
      const userData = await userRes.json();
      const profileRes = await supabase(env, "GET", `/user_profiles?id=eq.${userData.id}&select=role`);
      if (profileRes.data?.[0]?.role !== "playfund_admin") return err("Forbidden", 403);
      if (url.searchParams.get("debug") === "1") {
        const clubsRes2 = await supabase(env, "GET", "/clubs?reminders_enabled=eq.true&select=id,name,reminder_pre_due_days,reminder_recurring_interval_days");
        const clubs2 = clubsRes2.data || [];
        const trace = [];
        for (const club of clubs2) {
          const teamsRes2 = await supabase(env, "GET", `/teams?club_id=eq.${club.id}&active=eq.true&dues_due_date=not.is.null&select=id,name,dues_due_date`);
          const teams2 = teamsRes2.data || [];
          for (const team of teams2) {
            const athRes2 = await supabase(env, "GET", `/athletes?team_id=eq.${team.id}&select=id,name,parent_email,last_reminder_sent_at&or=(payment_status.eq.unpaid,payment_status.is.null)`);
            const today2 = new Date((/* @__PURE__ */ new Date()).toISOString().slice(0, 10) + "T00:00:00Z");
            const due2 = new Date(team.dues_due_date + "T00:00:00Z");
            trace.push({
              club: club.name,
              team: team.name,
              dues_due_date: team.dues_due_date,
              nowISO: (/* @__PURE__ */ new Date()).toISOString(),
              todayComputed: today2.toISOString(),
              dueComputed: due2.toISOString(),
              daysUntilDue: Math.round((due2 - today2) / 864e5),
              reminder_pre_due_days: club.reminder_pre_due_days,
              athletes: athRes2.data
            });
          }
        }
        return json({ trace });
      }
      const result = await runScheduledReminders(env);
      return json(result);
    }
    if (method === "PATCH" && path.startsWith("/admin/clubs/")) {
      const clubId = path.split("/")[3];
      if (!clubId) return err("Club ID required");
      const authHeader = request.headers.get("Authorization") || "";
      const token = authHeader.replace("Bearer ", "").trim();
      if (!token) return err("Authorization required", 401);
      const userRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
        headers: { "apikey": env.SUPABASE_ANON_KEY, "Authorization": `Bearer ${token}` }
      });
      if (!userRes.ok) return err("Invalid token", 401);
      const userData = await userRes.json();
      const profileRes = await supabase(env, "GET", `/user_profiles?id=eq.${userData.id}&select=role`);
      if (profileRes.data?.[0]?.role !== "playfund_admin") return err("Forbidden", 403);
      let body;
      try {
        body = await request.json();
      } catch {
        return err("Invalid JSON");
      }
      const updateData = {};
      if (body.fee_bps !== void 0) {
        if (!Number.isInteger(body.fee_bps) || body.fee_bps < 0 || body.fee_bps > 10000) {
          return err("fee_bps must be an integer between 0 and 10000");
        }
        updateData.fee_bps = body.fee_bps;
      }
      if (body.reminders_enabled !== void 0) {
        if (typeof body.reminders_enabled !== "boolean") return err("reminders_enabled must be a boolean");
        updateData.reminders_enabled = body.reminders_enabled;
      }
      if (body.reminder_pre_due_days !== void 0) {
        if (body.reminder_pre_due_days !== null && (!Number.isInteger(body.reminder_pre_due_days) || body.reminder_pre_due_days < 0)) {
          return err("reminder_pre_due_days must be a non-negative integer or null");
        }
        updateData.reminder_pre_due_days = body.reminder_pre_due_days;
      }
      if (body.reminder_recurring_interval_days !== void 0) {
        if (body.reminder_recurring_interval_days !== null && (!Number.isInteger(body.reminder_recurring_interval_days) || body.reminder_recurring_interval_days < 1)) {
          return err("reminder_recurring_interval_days must be a positive integer or null");
        }
        updateData.reminder_recurring_interval_days = body.reminder_recurring_interval_days;
      }
      if (Object.keys(updateData).length === 0) return err("No valid fields to update");
      const updateRes = await supabase(env, "PATCH", `/clubs?id=eq.${clubId}`, updateData);
      if (!updateRes.ok) return err("Failed to update club: " + JSON.stringify(updateRes.data), 500);
      return json({ success: true, ...updateData });
    }
    if (method === "GET" && path === "/admin/clubs") {
      const authHeader = request.headers.get("Authorization") || "";
      const token = authHeader.replace("Bearer ", "").trim();
      if (!token) return err("Authorization required", 401);
      const userRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
        headers: { "apikey": env.SUPABASE_ANON_KEY, "Authorization": `Bearer ${token}` }
      });
      if (!userRes.ok) return err("Invalid token", 401);
      const userData = await userRes.json();
      const profileRes = await supabase(env, "GET", `/user_profiles?id=eq.${userData.id}&select=role`);
      if (profileRes.data?.[0]?.role !== "playfund_admin") return err("Forbidden", 403);
      const clubsRes = await supabase(
        env,
        "GET",
        "/clubs?select=id,name,sport,city,state,code,active,fee_bps,reminders_enabled,reminder_pre_due_days,reminder_recurring_interval_days&order=name.asc"
      );
      if (!clubsRes.ok) return err("Failed to fetch clubs", 500);
      const clubs = clubsRes.data || [];
      // Fetch teams/athletes/payments for ALL clubs in three batched queries total,
      // rather than three queries per club — the per-club version hits Cloudflare's
      // per-invocation subrequest cap (50 on the free plan) once there are more than
      // a handful of clubs.
      const clubIds = clubs.map((c) => c.id);
      let allTeams = [];
      if (clubIds.length) {
        const teamsRes = await supabase(
          env,
          "GET",
          `/teams?select=id,club_id,name,age_group,dues_cents&club_id=in.(${clubIds.join(",")})&active=eq.true`
        );
        allTeams = teamsRes.data || [];
      }
      const teamIds = allTeams.map((t) => t.id);
      let allAthletes = [];
      if (teamIds.length) {
        const athRes = await supabase(
          env,
          "GET",
          `/athletes?select=id,payment_status,team_id&team_id=in.(${teamIds.join(",")})`
        );
        allAthletes = athRes.data || [];
      }
      const athleteIds = allAthletes.map((a) => a.id);
      let allPayments = [];
      if (athleteIds.length) {
        const paymentsRes = await supabase(
          env,
          "GET",
          `/payments?select=athlete_id,amount_cents&athlete_id=in.(${athleteIds.join(",")})&status=eq.succeeded`
        );
        allPayments = paymentsRes.data || [];
      }
      const teamsByClub = new Map();
      allTeams.forEach((t) => {
        if (!teamsByClub.has(t.club_id)) teamsByClub.set(t.club_id, []);
        teamsByClub.get(t.club_id).push(t);
      });
      const athletesByTeam = new Map();
      allAthletes.forEach((a) => {
        if (!athletesByTeam.has(a.team_id)) athletesByTeam.set(a.team_id, []);
        athletesByTeam.get(a.team_id).push(a);
      });
      const collectedByAthlete = new Map();
      allPayments.forEach((p) => {
        collectedByAthlete.set(p.athlete_id, (collectedByAthlete.get(p.athlete_id) || 0) + (p.amount_cents || 0));
      });
      const FUNDED_STATUSES = ["paid_full", "bnpl_active", "bnpl_complete"];
      const enriched = clubs.map((club) => {
        const teams = teamsByClub.get(club.id) || [];
        const athletes = teams.flatMap((t) => athletesByTeam.get(t.id) || []);
        const funded = athletes.filter((a) => FUNDED_STATUSES.includes(a.payment_status)).length;
        let fronted_cents = 0;
        let collected_cents = 0;
        athletes.forEach((a) => {
          if (FUNDED_STATUSES.includes(a.payment_status)) {
            const team = teams.find((t) => t.id === a.team_id);
            if (team) fronted_cents += Math.round(team.dues_cents * 0.95);
          }
          collected_cents += collectedByAthlete.get(a.id) || 0;
        });
        const teamsWithCounts = teams.map((t) => ({
          ...t,
          athlete_count: (athletesByTeam.get(t.id) || []).length
        }));
        return {
          ...club,
          team_count: teams.length,
          athlete_count: athletes.length,
          funded_count: funded,
          fronted_cents,
          collected_cents,
          teams: teamsWithCounts
        };
      });
      const totals = enriched.reduce((acc, c) => ({
        clubs: acc.clubs + 1,
        teams: acc.teams + c.team_count,
        athletes: acc.athletes + c.athlete_count,
        funded: acc.funded + c.funded_count,
        fronted_cents: acc.fronted_cents + c.fronted_cents,
        collected_cents: acc.collected_cents + c.collected_cents
      }), { clubs: 0, teams: 0, athletes: 0, funded: 0, fronted_cents: 0, collected_cents: 0 });
      return json({ clubs: enriched, totals });
    }
    if (method === "GET" && path.startsWith("/admin/clubs/") && path.endsWith("/payments")) {
      const clubId = path.split("/")[3];
      if (!clubId) return err("Club ID required");
      const authHeader = request.headers.get("Authorization") || "";
      const token = authHeader.replace("Bearer ", "").trim();
      if (!token) return err("Authorization required", 401);
      const userRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
        headers: { "apikey": env.SUPABASE_ANON_KEY, "Authorization": `Bearer ${token}` }
      });
      if (!userRes.ok) return err("Invalid token", 401);
      const userData = await userRes.json();
      const profileRes = await supabase(env, "GET", `/user_profiles?id=eq.${userData.id}&select=role,club_id`);
      const profile = profileRes.data?.[0];
      const isAllowed = profile && (profile.role === "playfund_admin" || profile.role === "club_admin" && profile.club_id === clubId);
      if (!isAllowed) return err("Forbidden", 403);
      const teamsRes = await supabase(env, "GET", `/teams?select=id,name&club_id=eq.${clubId}`);
      const teams = teamsRes.data || [];
      const teamMap = {};
      teams.forEach((t) => { teamMap[t.id] = t.name; });
      const teamIds = teams.map((t) => t.id);
      let payments = [];
      if (teamIds.length) {
        const athRes = await supabase(
          env,
          "GET",
          `/athletes?select=id,name,team_id&team_id=in.(${teamIds.join(",")})`
        );
        const athletes = athRes.data || [];
        const athleteMap = {};
        athletes.forEach((a) => { athleteMap[a.id] = a; });
        const athleteIds = athletes.map((a) => a.id);
        if (athleteIds.length) {
          const paymentsRes = await supabase(
            env,
            "GET",
            `/payments?select=id,created_at,amount_cents,status,payment_method,installment_number,athlete_id&athlete_id=in.(${athleteIds.join(",")})&order=created_at.desc`
          );
          payments = (paymentsRes.data || []).map((p) => {
            const athlete = athleteMap[p.athlete_id] || {};
            return {
              ...p,
              amount: (p.amount_cents || 0) / 100,
              athlete_name: athlete.name || "Unknown",
              team_name: teamMap[athlete.team_id] || "Unknown"
            };
          });
        }
      }
      return json({ payments });
    }
    if (method === "GET" && path === "/parent/athletes") {
      const authHeader = request.headers.get("Authorization") || "";
      const token = authHeader.replace("Bearer ", "").trim();
      if (!token) return err("Authorization required", 401);
      const userRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
        headers: { "apikey": env.SUPABASE_ANON_KEY, "Authorization": `Bearer ${token}` }
      });
      if (!userRes.ok) return err("Invalid token", 401);
      const userData = await userRes.json();
      const userId = userData.id;
      const athRes = await supabase(
        env,
        "GET",
        `/athletes?select=id,name,age,payment_status,payment_method,team_id,club_id,parent_email&parent_user_id=eq.${userId}`
      );
      const athletes = athRes.data || [];
      const enriched = await Promise.all(athletes.map(async (a) => {
        let team = null, club = null;
        if (a.team_id) {
          const tr = await supabase(env, "GET", `/teams?id=eq.${a.team_id}&select=id,name,dues_cents,season_start,season_end`);
          team = tr.data?.[0] || null;
        }
        if (a.club_id) {
          const cr = await supabase(env, "GET", `/clubs?id=eq.${a.club_id}&select=id,name,code,city,state`);
          club = cr.data?.[0] || null;
        }
        return { ...a, team, club };
      }));
      return json({ athletes: enriched });
    }
    if (method === "POST" && path.startsWith("/club/") && path.endsWith("/stripe-onboard")) {
      const clubId = path.split("/")[2];
      if (!clubId) return err("Club ID required");
      const authHeader = request.headers.get("Authorization") || "";
      const token = authHeader.replace("Bearer ", "").trim();
      if (!token) return err("Authorization required", 401);
      const callerRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
        headers: { "apikey": env.SUPABASE_ANON_KEY, "Authorization": `Bearer ${token}` }
      });
      if (!callerRes.ok) return err("Invalid token", 401);
      const callerData = await callerRes.json();
      const callerProfileRes = await supabase(env, "GET", `/user_profiles?id=eq.${callerData.id}&select=role,club_id`);
      const callerProfile = callerProfileRes.data?.[0];
      const isAllowed = callerProfile && (callerProfile.role === "playfund_admin" || callerProfile.role === "club_admin" && callerProfile.club_id === clubId);
      if (!isAllowed) return err("Forbidden", 403);
      const clubRes = await supabase(env, "GET", `/clubs?id=eq.${clubId}&select=id,name,admin_email,stripe_account_id`);
      const club = clubRes.data?.[0];
      if (!club) return err("Club not found", 404);
      let accountId = club.stripe_account_id;
      if (!accountId) {
        const acctRes = await stripeV2(env, "POST", "/core/accounts", {
          contact_email: club.admin_email || void 0,
          display_name: club.name,
          dashboard: "express",
          identity: { country: "us" },
          configuration: {
            merchant: { capabilities: { card_payments: { requested: true }, klarna_payments: { requested: true } } },
            recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } }
          },
          defaults: {
            currency: "usd",
            responsibilities: { fees_collector: "application", losses_collector: "application" }
          }
        });
        if (!acctRes.ok) return err("Failed to create Stripe account [" + acctRes.status + "]: " + JSON.stringify(acctRes.data), 500);
        accountId = acctRes.data.id;
        await supabase(env, "PATCH", `/clubs?id=eq.${clubId}`, { stripe_account_id: accountId });
      }
      const APP_URL = env.APP_URL || "https://jacksonwatkins30.github.io/playfund-app";
      const linkRes = await stripe(env, "POST", "/account_links", {
        account: accountId,
        refresh_url: `${APP_URL}?stripe_onboard=refresh&club_id=${clubId}`,
        return_url: `${APP_URL}?stripe_onboard=complete&club_id=${clubId}`,
        type: "account_onboarding"
      });
      if (!linkRes.ok) return err("Failed to create onboarding link: " + (linkRes.data?.error?.message || "unknown error"), 500);
      return json({ url: linkRes.data.url, stripe_account_id: accountId });
    }
    if (method === "GET" && path.startsWith("/club/") && path.endsWith("/stripe-status")) {
      const clubId = path.split("/")[2];
      if (!clubId) return err("Club ID required");
      const clubRes = await supabase(env, "GET", `/clubs?id=eq.${clubId}&select=stripe_account_id`);
      const club = clubRes.data?.[0];
      if (!club) return err("Club not found", 404);
      if (!club.stripe_account_id) return json({ connected: false, charges_enabled: false, details_submitted: false });
      const acctRes = await stripe(env, "GET", `/accounts/${club.stripe_account_id}`);
      if (!acctRes.ok) return err("Failed to fetch Stripe account status", 500);
      return json({
        connected: true,
        charges_enabled: !!acctRes.data.charges_enabled,
        details_submitted: !!acctRes.data.details_submitted
      });
    }
    if (method === "GET" && path.startsWith("/club/")) {
      const code = path.split("/")[2]?.toUpperCase();
      if (!code) return err("Club code required");
      const clubRes = await supabase(
        env,
        "GET",
        `/clubs?select=id,name,sport,city,state,code,active,fees_per_athlete&code=eq.${code}`
      );
      if (!clubRes.ok || !clubRes.data?.length) return err("Club not found", 404);
      const club = clubRes.data[0];
      const teamsRes = await supabase(
        env,
        "GET",
        `/teams?select=id,name,age_group,dues_cents,season_start,season_end,dues_due_date&club_id=eq.${club.id}&active=eq.true&order=age_group.asc`
      );
      const teams = teamsRes.data || [];

      // Roster data (names, ages, payment status) is only returned to a caller
      // authenticated as this specific club's admin/team admin, or a PlayFund
      // admin. Anyone else — including a parent who just knows the club
      // code — gets club/team summary info only, no minors' PII.
      let authorized = false;
      const authHeader = request.headers.get("Authorization") || "";
      const callerToken = authHeader.replace("Bearer ", "").trim();
      if (callerToken) {
        const callerRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
          headers: { "apikey": env.SUPABASE_ANON_KEY, "Authorization": `Bearer ${callerToken}` }
        });
        if (callerRes.ok) {
          const callerData = await callerRes.json();
          const callerProfileRes = await supabase(env, "GET", `/user_profiles?id=eq.${callerData.id}&select=role,club_id,team_id`);
          const callerProfile = callerProfileRes.data?.[0];
          if (callerProfile) {
            if (callerProfile.role === "playfund_admin") authorized = true;
            else if (callerProfile.role === "club_admin" && callerProfile.club_id === club.id) authorized = true;
            else if (callerProfile.role === "team_admin" && teams.some((t) => t.id === callerProfile.team_id)) authorized = true;
          }
        }
      }
      if (!authorized) {
        return json({
          club: {
            ...club,
            teams: teams.map((team) => ({ ...team, dues: team.dues_cents / 100 }))
          }
        });
      }

      const teamIds = teams.map((t) => t.id);
      let athletes = [];
      if (teamIds.length) {
        const athletesRes = await supabase(
          env,
          "GET",
          `/athletes?team_id=in.(${teamIds.join(",")})&select=id,name,age,team_id,payment_status,payment_method,approval_status,parent_email,enrolled_at&order=name.asc`
        );
        athletes = athletesRes.data || [];
      }
      const teamsWithAthletes = teams.map((team) => ({
        ...team,
        dues: team.dues_cents / 100,
        athletes: athletes.filter((a) => a.team_id === team.id)
      }));
      const totalAthletes = athletes.length;
      const fundedAthletes = athletes.filter(
        (a) => ["paid_full", "bnpl_active", "bnpl_complete"].includes(a.payment_status)
      ).length;
      let fronted_cents = 0;
      athletes.forEach((a) => {
        if (["paid_full", "bnpl_active", "bnpl_complete"].includes(a.payment_status)) {
          const team = teams.find((t) => t.id === a.team_id);
          if (team) fronted_cents += Math.round(team.dues_cents * 0.95);
        }
      });
      let collected_cents = 0;
      if (athletes.length) {
        const athleteIds = athletes.map((a) => a.id);
        const paymentsRes = await supabase(
          env,
          "GET",
          `/payments?select=amount_cents&athlete_id=in.(${athleteIds.join(",")})&status=eq.succeeded`
        );
        collected_cents = (paymentsRes.data || []).reduce((sum, p) => sum + (p.amount_cents || 0), 0);
      }
      return json({
        club: { ...club, teams: teamsWithAthletes },
        stats: { total_athletes: totalAthletes, funded_athletes: fundedAthletes, fronted_cents, collected_cents }
      });
    }
    if (method === "POST" && path === "/invite") {
      const authHeader = request.headers.get("Authorization") || "";
      const token = authHeader.replace("Bearer ", "").trim();
      if (!token) return err("Authorization required", 401);
      const callerRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
        headers: { "apikey": env.SUPABASE_ANON_KEY, "Authorization": `Bearer ${token}` }
      });
      if (!callerRes.ok) return err("Invalid token", 401);
      const callerData = await callerRes.json();
      const callerProfileRes = await supabase(env, "GET", `/user_profiles?id=eq.${callerData.id}&select=role,club_id`);
      const callerProfile = callerProfileRes.data?.[0];
      if (!callerProfile) return err("Forbidden", 403);
      let body;
      try {
        body = await request.json();
      } catch {
        return err("Invalid JSON");
      }
      const { email, display_name, role, club_id, team_id } = body;
      if (!email || !role) return err("email and role required");
      if (!["club_admin", "team_admin"].includes(role)) return err("Invalid role");
      if (role === "team_admin" && !team_id) return err("team_id required for team_admin");
      if (!club_id) return err("club_id required");
      if (callerProfile.role === "club_admin") {
        if (callerProfile.club_id !== club_id) return err("Forbidden", 403);
        if (role !== "team_admin") return err("Forbidden", 403);
      } else if (callerProfile.role !== "playfund_admin") {
        return err("Forbidden", 403);
      }
      const inviteRes = await fetch(`${env.SUPABASE_URL}/auth/v1/invite`, {
        method: "POST",
        headers: {
          "apikey": env.SUPABASE_SERVICE_KEY,
          "Authorization": `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email })
      });
      const inviteData = await inviteRes.json();
      let userId = inviteData?.id;
      if (!inviteRes.ok) {
        if (inviteData?.error_code === "email_exists") {
          const usersRes = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, {
            headers: { "apikey": env.SUPABASE_SERVICE_KEY, "Authorization": `Bearer ${env.SUPABASE_SERVICE_KEY}` }
          });
          const usersData = await usersRes.json();
          const existingUser = (usersData.users || []).find((u) => u.email?.toLowerCase() === email.toLowerCase());
          if (!existingUser) return err("A user with this email already exists but couldn't be found.", 500);
          userId = existingUser.id;
        } else {
          return err(inviteData?.msg || inviteData?.message || inviteData?.error_description || "Failed to invite user", 400);
        }
      }
      if (!userId) return err("Could not retrieve user ID after invite", 500);
      const existingProfile = await supabase(
        env,
        "GET",
        `/user_profiles?id=eq.${userId}&select=id,role`
      );
      if (existingProfile.data?.length) {
        await supabase(env, "PATCH", `/user_profiles?id=eq.${userId}`, {
          role,
          club_id,
          team_id: team_id || null,
          display_name: display_name || null
        });
      } else {
        await supabase(env, "POST", "/user_profiles", {
          id: userId,
          role,
          club_id,
          team_id: team_id || null,
          display_name: display_name || null
        });
      }
      return json({ success: true, message: `Invite sent to ${email}` }, 201);
    }
    if (method === "POST" && path === "/club/register") {
      let body;
      try {
        body = await request.json();
      } catch {
        return err("Invalid JSON");
      }
      const { name, sport, city, state, admin_email, admin_name, athlete_count, fees, teams } = body;
      if (!name || !sport || !admin_email) return err("name, sport, and admin_email required");
      let code = randomClubCode();
      for (let attempt = 0; attempt < 10; attempt++) {
        const existsRes = await supabase(env, "GET", `/clubs?code=eq.${code}&select=id`);
        if (!existsRes.data?.length) break;
        code = randomClubCode();
      }
      const feesPerAthlete = fees && fees.length ? fees.reduce((sum, f) => sum + (parseFloat(f.amount) || 0), 0) : 0;
      const insertData = {
        name: name.trim(),
        sport: sport.trim(),
        city: city || null,
        state: state || null,
        code,
        pin_hash: crypto.randomUUID(),
        active: false
      };
      if (admin_email) insertData.admin_email = admin_email.toLowerCase().trim();
      if (admin_name) insertData.admin_name = admin_name.trim();
      if (athlete_count) insertData.athlete_count = parseInt(athlete_count) || null;
      if (feesPerAthlete) insertData.fees_per_athlete = Math.round(feesPerAthlete);
      if (body.season_start) insertData.season_start = body.season_start;
      if (body.season_end) insertData.season_end = body.season_end;
      const clubRes = await supabase(env, "POST", "/clubs", insertData);
      if (!clubRes.ok) return err("Failed to create club: " + JSON.stringify(clubRes.data), 500);
      const club = clubRes.data[0];
      let createdTeams = [];
      if (teams && teams.length) {
        for (const t of teams) {
          const tRes = await supabase(env, "POST", "/teams", {
            club_id: club.id,
            name: t.name,
            age_group: t.age_group || null,
            dues_cents: Math.round((t.dues || 0) * 100),
            active: true
          });
          if (tRes.ok && tRes.data[0]) createdTeams.push(tRes.data[0]);
        }
      }
      let inviteUrl = null;
      if (admin_email) {
        try {
          const linkRes = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/generate_link`, {
            method: "POST",
            headers: {
              "apikey": env.SUPABASE_SERVICE_KEY,
              "Authorization": `Bearer ${env.SUPABASE_SERVICE_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              type: "invite",
              email: admin_email.toLowerCase().trim(),
              options: {
                redirect_to: env.APP_URL || "https://jacksonwatkins30.github.io/playfund-app"
              }
            })
          });
          const linkData = await linkRes.json();
          inviteUrl = linkData?.action_link || null;
          if (linkData?.id) {
            await supabase(env, "POST", "/user_profiles", {
              id: linkData.id,
              role: "club_admin",
              club_id: club.id,
              display_name: admin_name || null
            });
          }
        } catch (e) {
          console.error("Generate invite link error:", e);
        }
      }
      await Promise.all([
        sendClubWelcomeEmail(env, club, inviteUrl),
        sendInternalClubAlert(env, club)
      ]);
      return json({
        club: { ...club, teams: createdTeams },
        invite_url: inviteUrl,
        message: "Registration received. Check your email for a link to set up your account."
      }, 201);
    }
    if (method === "POST" && path === "/team") {
      const authHeader = request.headers.get("Authorization") || "";
      const token = authHeader.replace("Bearer ", "").trim();
      if (!token) return err("Authorization required", 401);
      const callerRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
        headers: { "apikey": env.SUPABASE_ANON_KEY, "Authorization": `Bearer ${token}` }
      });
      if (!callerRes.ok) return err("Invalid token", 401);
      const callerData = await callerRes.json();
      const callerProfileRes = await supabase(env, "GET", `/user_profiles?id=eq.${callerData.id}&select=role,club_id`);
      const callerProfile = callerProfileRes.data?.[0];
      if (!callerProfile) return err("Forbidden", 403);
      let body;
      try {
        body = await request.json();
      } catch {
        return err("Invalid JSON");
      }
      const { club_id, club_code, name, age_group, dues_cents, season_start, season_end, dues_due_date } = body;
      if (!name || !dues_cents) return err("name and dues_cents are required");
      let resolvedClubId = club_id;
      if (!resolvedClubId && club_code) {
        const clubRes = await supabase(env, "GET", `/clubs?select=id&code=eq.${club_code.toUpperCase()}`);
        if (!clubRes.data?.length) return err("Club not found", 404);
        resolvedClubId = clubRes.data[0].id;
      }
      if (!resolvedClubId) return err("club_id or club_code required");
      const isAllowed = callerProfile.role === "playfund_admin" || callerProfile.role === "club_admin" && callerProfile.club_id === resolvedClubId;
      if (!isAllowed) return err("Forbidden", 403);
      const insertData = {
        club_id: resolvedClubId,
        name: name.trim(),
        age_group: age_group || null,
        dues_cents: Math.round(dues_cents),
        season_start: season_start || null,
        season_end: season_end || null,
        dues_due_date: dues_due_date || null,
        active: true
      };
      const insertRes = await supabase(env, "POST", "/teams", insertData);
      if (!insertRes.ok) return err("Failed to create team: " + JSON.stringify(insertRes.data), 500);
      return json({ team: insertRes.data[0] }, 201);
    }
    if (method === "POST" && path === "/athlete") {
      let body;
      try {
        body = await request.json();
      } catch {
        return err("Invalid JSON");
      }
      const { club_code, team_id, athlete_name, athlete_age, parent_email, parent_phone } = body;
      if (!club_code || !team_id || !athlete_name || !parent_email) {
        return err("club_code, team_id, athlete_name, and parent_email are required");
      }
      const clubRes = await supabase(
        env,
        "GET",
        `/clubs?code=eq.${club_code.toUpperCase()}&select=id,name,code,admin_email`
      );
      if (!clubRes.data?.length) return err("Invalid club code", 404);
      const club = clubRes.data[0];
      const clubId = club.id;
      const teamRes = await supabase(
        env,
        "GET",
        `/teams?id=eq.${team_id}&club_id=eq.${clubId}&select=id,name,dues_cents`
      );
      if (!teamRes.data?.length) return err("Team not found for this club", 404);
      const team = teamRes.data[0];

      // An athlete added by an authenticated club/team admin (or PlayFund admin)
      // for their own club/team is trusted automatically. Anyone else — the
      // normal parent self-serve path — can't be verified against the real
      // roster, so the athlete stays pending until the club confirms them.
      // No payment link works for a pending athlete.
      let approvalStatus = "pending";
      const authHeader = request.headers.get("Authorization") || "";
      const token = authHeader.replace("Bearer ", "").trim();
      if (token) {
        const callerRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
          headers: { "apikey": env.SUPABASE_ANON_KEY, "Authorization": `Bearer ${token}` }
        });
        if (callerRes.ok) {
          const callerData = await callerRes.json();
          const callerProfileRes = await supabase(env, "GET", `/user_profiles?id=eq.${callerData.id}&select=role,club_id,team_id`);
          const callerProfile = callerProfileRes.data?.[0];
          if (callerProfile) {
            if (callerProfile.role === "playfund_admin") approvalStatus = "approved";
            else if (callerProfile.role === "club_admin" && callerProfile.club_id === clubId) approvalStatus = "approved";
            else if (callerProfile.role === "team_admin" && callerProfile.team_id === team_id) approvalStatus = "approved";
          }
        }
      }

      const insertRes = await supabase(env, "POST", "/athletes", {
        club_id: clubId,
        team_id,
        name: athlete_name.trim(),
        age: athlete_age || null,
        parent_email: parent_email.toLowerCase().trim(),
        parent_phone: parent_phone || null,
        payment_status: "unpaid",
        approval_status: approvalStatus,
        enrolled_at: (/* @__PURE__ */ new Date()).toISOString()
      });
      if (!insertRes.ok) return err("Failed to register athlete: " + JSON.stringify(insertRes.data), 500);
      const newAthlete = insertRes.data[0];
      if (approvalStatus === "pending") {
        await sendPendingApprovalEmail(env, club, team, newAthlete);
      } else {
        await sendApprovalEmail(env, club, team, newAthlete);
      }
      return json({ athlete: newAthlete }, 201);
    }
    if (method === "POST" && path.startsWith("/athlete/") && path.endsWith("/notify-club")) {
      const athleteId = path.split("/")[2];
      if (!athleteId) return err("Athlete ID required");
      const athleteRes = await supabase(env, "GET", `/athletes?id=eq.${athleteId}&select=name,team_id,club_id,parent_email`);
      const athlete = athleteRes.data?.[0];
      if (!athlete) return err("Athlete not found", 404);
      const teamRes = await supabase(env, "GET", `/teams?id=eq.${athlete.team_id}&select=name,dues_cents`);
      const team = teamRes.data?.[0];
      const clubRes = await supabase(env, "GET", `/clubs?id=eq.${athlete.club_id}&select=name,admin_email`);
      const club = clubRes.data?.[0];
      if (!club) return err("Club not found", 404);
      if (!club.admin_email) return err("This club doesn't have an admin contact on file yet", 400);
      const RESEND_API_KEY = env.RESEND_API_KEY;
      if (!RESEND_API_KEY) return err("Email not configured", 500);
      const dues = ((team && team.dues_cents) || 0) / 100;
      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
        body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;margin:0;padding:0;background:#F4F7F6;}
      </style></head><body style="margin:0;padding:0;background:#F4F7F6;">
      <table cellpadding="0" cellspacing="0" width="100%" style="background:#F4F7F6;"><tr><td align="center" style="padding:32px 16px;">
      <table cellpadding="0" cellspacing="0" width="520" style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <tr><td style="background:#004643;padding:18px 28px;">
          <span style="font-size:20px;font-weight:800;color:#fff;">Play</span><span style="font-size:20px;font-weight:800;color:#5BA888;">Fund</span>
          <span style="float:right;font-size:12px;color:rgba(255,255,255,0.6);">${club.name}</span>
        </td></tr>
        <tr><td style="padding:28px;">
          <p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#5BA888;">Family wants to pay directly</p>
          <h2 style="margin:0 0 12px;font-size:22px;font-weight:800;color:#004643;">${athlete.name}'s family would like to arrange payment with you</h2>
          <p style="margin:0 0 20px;font-size:15px;color:#6B7280;line-height:1.6;">
            Their installment plan through Klarna couldn't be approved, and they've asked to set up a payment plan directly with ${club.name} instead of paying online through PlayFund.
          </p>
          <table cellpadding="0" cellspacing="0" width="100%" style="background:#F4F7F6;border-radius:10px;margin-bottom:20px;">
            <tr><td style="padding:16px;">
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="font-size:13px;color:#6B7280;">Athlete</td>
                  <td align="right" style="font-size:13px;font-weight:700;color:#004643;">${athlete.name}</td>
                </tr>
                ${team ? `<tr><td style="font-size:13px;color:#6B7280;padding-top:6px;">Team</td><td align="right" style="font-size:13px;font-weight:700;color:#004643;padding-top:6px;">${team.name}</td></tr>` : ""}
                <tr>
                  <td style="font-size:13px;color:#6B7280;padding-top:6px;">Season dues</td>
                  <td align="right" style="font-size:16px;font-weight:800;color:#004643;padding-top:6px;">$${dues.toLocaleString()}</td>
                </tr>
                ${athlete.parent_email ? `<tr><td style="font-size:13px;color:#6B7280;padding-top:6px;">Parent email</td><td align="right" style="font-size:13px;font-weight:700;color:#004643;padding-top:6px;">${athlete.parent_email}</td></tr>` : ""}
              </table>
            </td></tr>
          </table>
          <p style="margin:0;font-size:12px;color:#9CA3AF;text-align:center;">
            You can reply directly to this email to reach the family.
          </p>
        </td></tr>
      </table>
      </td></tr></table>
      </body></html>`;
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "PlayFund <admin@playfundai.com>",
            to: [club.admin_email],
            reply_to: athlete.parent_email || void 0,
            subject: `${athlete.name}'s family wants to arrange payment directly`,
            html
          })
        });
        if (!res.ok) return err("Failed to send notification: " + await res.text(), 500);
      } catch (e) {
        return err("Failed to send notification", 500);
      }
      return json({ success: true });
    }
    if (method === "POST" && path.startsWith("/athlete/") && path.endsWith("/checkout")) {
      const athleteId = path.split("/")[2];
      if (!athleteId) return err("Athlete ID required");
      let body;
      try {
        body = await request.json();
      } catch {
        return err("Invalid JSON");
      }
      const { payment_type } = body;
      if (!["full", "bnpl"].includes(payment_type)) return err("payment_type must be 'full' or 'bnpl'");
      const athleteRes = await supabase(env, "GET", `/athletes?id=eq.${athleteId}&select=id,name,team_id,club_id,approval_status`);
      const athlete = athleteRes.data?.[0];
      if (!athlete) return err("Athlete not found", 404);
      if (athlete.approval_status === "pending") return err("This athlete is still waiting on the club to confirm they're on the roster before you can pay.", 403);
      const teamRes = await supabase(env, "GET", `/teams?id=eq.${athlete.team_id}&select=id,name,dues_cents`);
      const team = teamRes.data?.[0];
      if (!team) return err("Team not found", 404);
      const clubRes = await supabase(env, "GET", `/clubs?id=eq.${athlete.club_id}&select=id,name,code,stripe_account_id,fee_bps`);
      const club = clubRes.data?.[0];
      if (!club) return err("Club not found", 404);
      if (!club.stripe_account_id) return err("This club hasn't connected Stripe yet", 400);
      const duesCents = team.dues_cents;
      if (!duesCents) return err("Team has no dues configured", 400);
      const feeBps = club.fee_bps != null ? club.fee_bps : 500;
      const applicationFeeAmount = Math.round(duesCents * feeBps / 1e4);
      const APP_URL = env.APP_URL || "https://jacksonwatkins30.github.io/playfund-app";
      // 'full' and 'bnpl' are deliberately restricted to disjoint payment_method_types —
      // Klarna must never appear as an option on a "pay in full" checkout, and card/bank
      // must never appear on the installment checkout. Keep these two lists disjoint.
      const paymentMethodTypes = payment_type === "bnpl" ? ["klarna"] : ["card", "us_bank_account"];
      const sessionRes = await stripe(env, "POST", "/checkout/sessions", {
        mode: "payment",
        ui_mode: "embedded",
        payment_method_types: paymentMethodTypes,
        line_items: [{
          price_data: {
            currency: "usd",
            product_data: { name: `${athlete.name} — ${team.name} season dues` },
            unit_amount: duesCents
          },
          quantity: 1
        }],
        payment_intent_data: {
          application_fee_amount: applicationFeeAmount,
          transfer_data: { destination: club.stripe_account_id },
          metadata: { athlete_id: athleteId }
        },
        metadata: { athlete_id: athleteId },
        return_url: `${APP_URL}?checkout=return&athlete=${athleteId}&session_id={CHECKOUT_SESSION_ID}`
      });
      if (!sessionRes.ok) return err("Failed to create checkout session: " + JSON.stringify(sessionRes.data), 500);
      return json({ client_secret: sessionRes.data.client_secret });
    }
    if (method === "GET" && path === "/athletes/status") {
      const idsParam = url.searchParams.get("ids") || "";
      const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
      if (!ids.length) return json({ statuses: [] });
      const statusRes = await supabase(
        env,
        "GET",
        `/athletes?id=in.(${ids.join(",")})&select=id,payment_status,approval_status`
      );
      return json({ statuses: statusRes.data || [] });
    }
    if (method === "GET" && path.startsWith("/athlete/")) {
      const athleteId = path.split("/")[2];
      if (!athleteId) return err("Athlete ID required");
      const athleteRes = await supabase(
        env,
        "GET",
        `/athletes?id=eq.${athleteId}&select=id,name,age,payment_status,payment_method,approval_status,enrolled_at,team_id,club_id`
      );
      if (!athleteRes.data?.length) return err("Athlete not found", 404);
      const athlete = athleteRes.data[0];
      const paymentsRes = await supabase(
        env,
        "GET",
        `/payments?athlete_id=eq.${athleteId}&select=id,created_at,amount_cents,status,payment_method,installment_number&order=created_at.asc`
      );
      const payments = (paymentsRes.data || []).map((p) => ({
        ...p,
        amount: p.amount_cents / 100
      }));
      const teamRes = await supabase(
        env,
        "GET",
        `/teams?id=eq.${athlete.team_id}&select=name,dues_cents`
      );
      const team = teamRes.data?.[0] || {};
      return json({
        athlete: {
          ...athlete,
          team_name: team.name,
          dues: (team.dues_cents || 0) / 100
        },
        payments
      });
    }
    if (method === "POST" && path.startsWith("/athlete/") && path.endsWith("/approve")) {
      const athleteId = path.split("/")[2];
      if (!athleteId) return err("Athlete ID required");
      const authHeader = request.headers.get("Authorization") || "";
      const token = authHeader.replace("Bearer ", "").trim();
      if (!token) return err("Authorization required", 401);
      const callerRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
        headers: { "apikey": env.SUPABASE_ANON_KEY, "Authorization": `Bearer ${token}` }
      });
      if (!callerRes.ok) return err("Invalid token", 401);
      const callerData = await callerRes.json();
      const callerProfileRes = await supabase(env, "GET", `/user_profiles?id=eq.${callerData.id}&select=role,club_id,team_id`);
      const callerProfile = callerProfileRes.data?.[0];
      if (!callerProfile) return err("Forbidden", 403);
      const athleteRes = await supabase(env, "GET", `/athletes?id=eq.${athleteId}&select=id,name,parent_email,club_id,team_id`);
      const athlete = athleteRes.data?.[0];
      if (!athlete) return err("Athlete not found", 404);
      const isAllowed = callerProfile.role === "playfund_admin" || callerProfile.role === "club_admin" && callerProfile.club_id === athlete.club_id || callerProfile.role === "team_admin" && callerProfile.team_id === athlete.team_id;
      if (!isAllowed) return err("Forbidden", 403);
      const updateRes = await supabase(env, "PATCH", `/athletes?id=eq.${athleteId}`, { approval_status: "approved" });
      if (!updateRes.ok) return err("Failed to approve athlete: " + JSON.stringify(updateRes.data), 500);
      const [clubForEmailRes, teamForEmailRes] = await Promise.all([
        supabase(env, "GET", `/clubs?id=eq.${athlete.club_id}&select=id,name,code`),
        supabase(env, "GET", `/teams?id=eq.${athlete.team_id}&select=id,name,dues_cents`)
      ]);
      const clubForEmail = clubForEmailRes.data?.[0];
      const teamForEmail = teamForEmailRes.data?.[0];
      if (clubForEmail && teamForEmail) {
        await sendApprovalEmail(env, clubForEmail, teamForEmail, athlete);
      }
      return json({ success: true });
    }
    if (method === "DELETE" && path.startsWith("/athlete/")) {
      const athleteId = path.split("/")[2];
      if (!athleteId) return err("Athlete ID required");
      const authHeader = request.headers.get("Authorization") || "";
      const token = authHeader.replace("Bearer ", "").trim();
      if (!token) return err("Authorization required", 401);
      const callerRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
        headers: { "apikey": env.SUPABASE_ANON_KEY, "Authorization": `Bearer ${token}` }
      });
      if (!callerRes.ok) return err("Invalid token", 401);
      const callerData = await callerRes.json();
      const callerProfileRes = await supabase(env, "GET", `/user_profiles?id=eq.${callerData.id}&select=role,club_id,team_id`);
      const callerProfile = callerProfileRes.data?.[0];
      if (!callerProfile) return err("Forbidden", 403);
      const athleteRes = await supabase(env, "GET", `/athletes?id=eq.${athleteId}&select=id,club_id,team_id`);
      const athlete = athleteRes.data?.[0];
      if (!athlete) return err("Athlete not found", 404);
      const isAllowed = callerProfile.role === "playfund_admin" || callerProfile.role === "club_admin" && callerProfile.club_id === athlete.club_id || callerProfile.role === "team_admin" && callerProfile.team_id === athlete.team_id;
      if (!isAllowed) return err("Forbidden", 403);
      const deleteRes = await supabase(env, "DELETE", `/athletes?id=eq.${athleteId}`);
      if (!deleteRes.ok) return err("Failed to remove athlete: " + JSON.stringify(deleteRes.data), 500);
      return json({ success: true });
    }
    if (method === "POST" && path === "/webhook/stripe") {
      const rawBody = await request.text();
      const sig = request.headers.get("stripe-signature");
      const valid = await verifyStripeSignature(rawBody, sig, env.STRIPE_WEBHOOK_SECRET);
      if (!valid) return err("Invalid Stripe signature", 401);
      const event = JSON.parse(rawBody);
      const eventId = event.id;
      const eventType = event.type;
      const metadata = event.data?.object?.metadata || {};
      const athleteId = metadata.athlete_id;
      if (!athleteId) {
        console.log("Stripe event missing athlete_id metadata:", eventId);
        return json({ received: true });
      }
      if (eventType === "payment_intent.succeeded") {
        const pi = event.data.object;
        const amountCents = pi.amount_received;
        const paymentMethod = pi.payment_method_types?.[0] || "card";
        const existing = await supabase(
          env,
          "GET",
          `/payments?stripe_event_id=eq.${eventId}&select=id`
        );
        if (existing.data?.length) {
          return json({ received: true, duplicate: true });
        }
        await supabase(env, "POST", "/payments", {
          athlete_id: athleteId,
          stripe_payment_intent: pi.id,
          stripe_event_id: eventId,
          amount_cents: amountCents,
          status: "succeeded",
          payment_method: paymentMethod,
          notes: `Stripe event ${eventId}`
        });
        const athleteRes = await supabase(
          env,
          "GET",
          `/athletes?id=eq.${athleteId}&select=name,team_id,club_id,payment_status,parent_email`
        );
        const athlete = athleteRes.data?.[0];
        if (!athlete) return json({ received: true });
        const teamRes = await supabase(
          env,
          "GET",
          `/teams?id=eq.${athlete.team_id}&select=dues_cents`
        );
        const duesCents = teamRes.data?.[0]?.dues_cents || 0;
        const totalPaidRes = await supabase(
          env,
          "GET",
          `/payments?athlete_id=eq.${athleteId}&status=eq.succeeded&select=amount_cents`
        );
        const totalPaid = (totalPaidRes.data || []).reduce((sum, p) => sum + p.amount_cents, 0);
        let newStatus = "bnpl_active";
        if (paymentMethod === "klarna") {
          newStatus = totalPaid >= duesCents ? "bnpl_complete" : "bnpl_active";
        } else {
          newStatus = totalPaid >= duesCents ? "paid_full" : "bnpl_active";
        }
        await supabase(
          env,
          "PATCH",
          `/athletes?id=eq.${athleteId}`,
          { payment_status: newStatus, payment_method: paymentMethod }
        );
        const clubRes = await supabase(env, "GET", `/clubs?id=eq.${athlete.club_id}&select=id,name`);
        const club = clubRes.data?.[0];
        if (club) await sendReceiptEmail(env, club, athlete, amountCents, paymentMethod, newStatus);
      } else if (eventType === "payment_intent.payment_failed") {
        const pi = event.data.object;
        await supabase(env, "POST", "/payments", {
          athlete_id: athleteId,
          stripe_payment_intent: pi.id,
          stripe_event_id: eventId,
          amount_cents: pi.amount || 0,
          status: "failed",
          payment_method: pi.payment_method_types?.[0] || "card",
          notes: pi.last_payment_error?.message || "Payment failed"
        });
      }
      return json({ received: true });
    }
    return err("Not found", 404);
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
