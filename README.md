# GDOF Foundation Website

Responsive React + Vite public website for Global Development and Opportunity Foundation, Inc.

## Run locally
1. Install Node.js LTS.
2. Run `npm install`.
3. Run `npm run dev`.
4. Build with `npm run build`.

## Cloudflare Pages deployment
- Connect this GitHub repository in Workers & Pages.
- Framework preset: Vite
- Build command: `npm run build`
- Build output directory: `dist`

## Integrations
The donation and contact forms are frontend placeholders until Stripe and Supabase are configured. Stripe secret keys must never be placed in frontend code or committed to GitHub. Use Cloudflare server-side secrets and a server endpoint for Checkout Session creation.

## Before publication
Verify all board names and titles, program descriptions, legal disclosures, contact details, and the tax-exemption status. The site currently states that IRS 501(c)(3) recognition is pending and does not represent donations as U.S. tax-deductible.