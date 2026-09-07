# Pilot prep punchlist

A running list of workstreams to tackle before the pilot, editable across sessions. Check items off as they're done; add new ones as they come up. This is separate from `pilot-readiness-plan.md`, which is an earlier, more technical phase-by-phase plan — this file tracks the items identified in review conversations.

## 1. Email & customer-facing copy consistency

Grounded in: 6 email templates in `worker/index.js` (`sendReminderEmail`, `sendApprovalEmail`, `sendReceiptEmail`, `sendPendingApprovalEmail`, `sendClubWelcomeEmail`, `sendInternalClubAlert`).

- [x] Audit all 6 templates for one shared header/footer/sign-off pattern — the 5 customer-facing ones (all but the internal alert) now close with the same "reply, contact the club, or reach admin@playfundai.com" line
- [x] Replace the amber/orange left-border callout box in `sendClubWelcomeEmail` with a neutral card (`#F4F7F6` bg, no accent border) matching the rest of the template
- [x] Remove or soften specific response-time promises: the scholarship flow's "within 48 hours" (was 3 places in `index.html`) and the FAQ's "we typically respond within a few hours" are gone
- [x] Decided the standard: no specific time window anywhere customer-facing, just "we'll get back to you" / "reply to this email"
- [x] Reviewed `sendInternalClubAlert`'s "reach out within 1 business day" — kept as-is, it's an internal staff SLA reminder (goes to jackson@/clyde@, never seen by a club), not a customer-facing promise
- [x] Rolled in the hello@ → admin@ swap (item 5) across all 6 templates

## 2. Homepage direction

Grounded in: the two mockups already published (Option A: app-language with a "What is PlayFund?" section; Option B: traditional SaaS layout), both scrubbed of Klarna mentions and specific timelines/terms.

- [ ] Review both options with Clyde and Jackson
- [ ] Pick a direction, or specify a hybrid of the two
- [ ] Re-check the chosen direction's copy against the same bar just applied (no vendor names, no timelines, no unverified terms) since further edits may reintroduce risk
- [ ] Decide what "Get Started" / "Request a demo" actually do today, before real self-serve onboarding exists (a form? a mailto? a Calendly link?)
- [ ] Turn the chosen canvas into real site files once decided

## 3. playfundai.com setup (Squarespace)

Depends on item 2 — need a homepage before "loading stuff in."

- [ ] Confirm where the actual app is hosted today (verify current deployment target, not just what old docs say)
- [ ] Decide the split: root domain (playfundai.com) for marketing, subdomain (e.g. app.playfundai.com) for the real product — matches the URL pattern already used in the homepage mockups' dashboard screenshot
- [ ] Add the new DNS records in Squarespace without breaking the existing Resend sending-domain records (SPF/DKIM) — check those first so they don't get overwritten
- [ ] Point the chosen homepage build at the root domain once item 2 is settled

## 4. Data tracking strategy (Stripe/Klarna + PlayFund's own instrumentation)

- [ ] Write down the actual questions to answer first — the ones a lender or investor will ask: payment-method mix (full vs. installments), approval/decline rates, time-to-registration, club retention, average dues size, geographic/sport demographics
- [ ] Map each question to where the data actually lives: Stripe (payment status/method/fees), Klarna (approval/decline outcomes — confirm what's exposed via the Stripe integration vs. needing direct Klarna dashboard access), Supabase (system of record for clubs/athletes/payments), Resend (send/open/click — not currently captured anywhere but Resend's own dashboard)
- [ ] Add email engagement tracking (opens/clicks): Resend supports it natively, but nothing today pipes it into Supabase where it can sit next to product data. Needs a Resend webhook endpoint in the Worker (`email.opened`, `email.clicked`) writing into the same `events` table added below, so "did this reminder get opened" can be queried alongside payment status
- [x] Added a lightweight product-events table in Supabase (`events`: event_name, session_id, athlete_id, club_id, properties jsonb, created_at) — see setup step under item 6, since the embedded-checkout build needed it first
- [x] Added funnel/click tracking as of the embedded-checkout build: every `showScreen()` call now logs a `screen_view` event, and the checkout flow logs `payment_method_selected`, `checkout_mounted`, `checkout_completed`, `checkout_confirmed`, `checkout_declined`, `checkout_canceled`, `checkout_error`. Interaction-level only (which screen/button), never what was typed — payment fields are Stripe's own iframe and never touch this page. Club admin signup / parent login funnels aren't instrumented yet, same pattern, just not done
- [ ] Keep any demographic tracking at the parent/club level, not the athlete level — consistent with CLAUDE.md's minors data-minimization rule
- [ ] Check what regulations actually apply to collecting minors' data (name, team, age group) — e.g. COPPA — and confirm today's minimal fields plus any new tracking added here stay compliant, not just "minimal because CLAUDE.md says so"
- [ ] Confirm PlayFund isn't storing anything Stripe already stores on its side (card numbers, bank details) — CLAUDE.md already locks this for card data, so this is a verification pass on the actual Supabase schema and any new events/analytics tables added here, not a new rule

## 5. Replace hello@playfundai.com with admin@playfundai.com

Grounded in: 11 occurrences across `worker/index.js` and `index.html` (from-addresses, footer mailto links, FAQ copy, decline-screen copy).

- [x] Confirmed admin@playfundai.com is a real, monitored inbox
- [x] Updated all 11 occurrences
- [x] No separate Resend identity update needed — sending is verified at the playfundai.com domain level, not per local-part, so admin@ sends the same as hello@ did

## 6. Stripe/Klarna: embedded vs. redirect

Was: `openStripeCheckout()` did a full-page redirect (`window.location.href = data.url`) to a Stripe-hosted Checkout Session. Now: the same session is created with `ui_mode: "embedded"` and mounted inline via Stripe.js's `initEmbeddedCheckout`, so the parent stays on playfundai.com for card/bank; Klarna still briefly redirects away and back (required by Klarna's own approval step) via a single `return_url`, handled the same way as before — status is always re-verified against the server/webhook, never trusted from the redirect.

- [x] Documented today's flow as the baseline
- [x] Built Embedded Checkout: `POST /athlete/:id/checkout` now returns `client_secret` instead of `url`; a new `GET /config` endpoint serves the Stripe publishable key; `index.html` loads Stripe.js and mounts checkout into a new `screen-embedded-checkout`
- [x] "Pay in full" and "installments" stay on strictly separate Stripe Checkout Sessions — see below, this needed more than just `payment_method_types`
- [x] **Real bug you caught live:** after a real test payment, "pay in full" still showed Klarna as an option, labeled "Powered by Link" — even though the session's `payment_method_types` was verified server-side to be exactly `["card","us_bank_account"]`. Root cause: Stripe Link recognizes a returning customer/device and offers their previously-saved payment method (including a saved Klarna instrument) regardless of what the merchant restricted that session to — Link treats it as its own cross-session wallet, not something our per-session list gates. Fixed by creating a dedicated Stripe Payment Method Configuration (`pmc_1UD4SnPyhgYp24ebsPEd8LSJ`, hardcoded as `PAY_IN_FULL_PMC_ID` in `worker/index.js`) with card + bank on and Link/Klarna/Affirm/Afterpay all explicitly off, and pointing the "pay in full" session at that configuration instead of `payment_method_types`. "bnpl" is untouched and still explicitly `["klarna"]` only.
- [x] Tested checkout session creation directly against live Stripe (test mode) via a self-contained test club/team/athlete (no production data touched). Found and fixed a real bug: Stripe now rejects `ui_mode: "embedded"` outright ("no longer supported, use embedded_page instead") — every checkout attempt was failing 100% of the time. Fixed in `worker/index.js` and pushed.
- [x] Confirmed Klarna is actually accepted by Stripe for this account: after finishing test-mode Stripe Connect onboarding on a throwaway test club, both `payment_type: "full"` and `payment_type: "bnpl"` checkout sessions were created successfully via direct API calls. Stripe validates `payment_method_types` at session-creation time and would reject `["klarna"]` outright if Klarna weren't enabled/available for the account — it didn't, so Klarna is live and correctly isolated to the installments path only.
- [x] Also caught and fixed a second real bug while testing: `APP_URL` (used for checkout `return_url`, Stripe Connect onboarding links, and Supabase invite redirects) still fell back to the old `jacksonwatkins30.github.io` Pages URL, which no longer serves the app — the app now lives at `playfundai.github.io/playfund-app`. Added `APP_URL` as a proper env var in `worker/wrangler.toml` and fixed the in-code fallback.
- [ ] Optional: visually eyeball Klarna in a real browser (club code `5D2GU64`, athlete "QA Test Athlete") — not required, since Stripe's own validation already confirms it, but nice to see once
- [ ] Full test-mode run needed: pay in full (card + bank), set up installments (Klarna), a decline, a cancel — see setup steps below
- [ ] Old paynow/terms screens stay gone — the new `screen-embedded-checkout` replaces what they would have done

**Setup needed before this can be tested (manual, can't be done from here):**
1. In the Cloudflare dashboard: playfund-worker → Settings → Variables and Secrets → add `STRIPE_PUBLISHABLE_KEY` with your Stripe **test-mode** publishable key (starts `pk_test_...`, found in the Stripe Dashboard under Developers → API keys). This is the public-facing key, safe to store as a plain variable rather than an encrypted secret.
2. In the Supabase SQL editor, run:
   ```sql
   create table events (
     id uuid primary key default gen_random_uuid(),
     event_name text not null,
     session_id text,
     athlete_id uuid,
     club_id uuid,
     properties jsonb not null default '{}'::jsonb,
     created_at timestamptz not null default now()
   );
   create index events_event_name_idx on events (event_name);
   create index events_created_at_idx on events (created_at);
   ```

**Deployment gap found while testing this:** the live Worker had been running a 5-day-old manual deploy this whole time — merging to `main` on GitHub was never actually deploying anything, since no CI/CD was wired up. Connected Cloudflare Workers Builds to the GitHub repo to fix this going forward. Its "Root directory" setting defaulted to `/`, which is wrong (`wrangler.toml` lives in `worker/`, not the repo root) — changed it to `worker`. Still needs a first successful build to confirm the fix; watch the Deployments tab after this commit lands on `main`.

## 7. Club reporting (Jackson's track)

Grounded in: the TeamSnap/SportsEngine reporting teardown already done, and the per-club payments CSV export already built (`GET /admin/clubs/:clubId/payments` in `worker/index.js`, rendered in `screen-admin-club-detail` in `index.html`).

- [ ] Get specifics from Nikki on exactly what was bad about the SportsEngine reporting she used (a concrete complaint beats "make it better")
- [ ] Decide which additional cuts of the payments data clubs actually want: by team, by date range, by payment method, deposit/payout reconciliation against what Stripe Connect actually transferred
- [ ] Scope as Jackson's own workstream from there

## 8. How PlayFund actually uses AI

- [ ] List real candidate uses without committing yet: support-reply drafting from the existing FAQ content, at-risk-family flagging before a payment fails, natural-language dashboard queries for club admins, roster-import extraction from uploaded spreadsheets during onboarding
- [ ] Decide deliberately after pilot data exists — what's actually painful is clearer once there's real usage, rather than backfilling a feature to justify the name
- [ ] Until decided, keep AI claims out of any marketing copy (ties back to item 2's honesty bar)

## 9. Volume / scaling

Grounded in: real patterns already in `worker/index.js`.

- [x] Fixed: `GET /admin/clubs` now fetches teams/athletes/payments for all clubs in 3 batched queries total instead of 3 queries per club (was scaling linearly toward Cloudflare's 50-subrequest free-plan cap)
- [x] Fixed: `syncPaymentStatuses` in `index.html` now calls one new bulk endpoint (`GET /athletes/status?ids=...`) instead of hitting `GET /athlete/:id` once per athlete on every parent app load
- [ ] Check Supabase plan limits (connections, row counts, egress) against pilot-scale projections
- [ ] Check Resend sending limits and domain reputation as email volume grows
- [ ] None of this is urgent at 5 pilot clubs — the point is writing it down now so it's not forgotten before the next growth stage
