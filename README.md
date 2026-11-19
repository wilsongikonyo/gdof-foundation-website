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

## ReliefWeb research integration

The AI Story Studio uses the approved ReliefWeb Read / Search API to retrieve humanitarian reports. Configure the approved appname as a Cloudflare Worker secret (do not hardcode it in frontend code):

```powershell
npx wrangler secret put RELIEFWEB_APPNAME
```

When prompted, enter the approved appname supplied by ReliefWeb. The appname is required on every Read / Search API request. A separate ReliefWeb Publish API key and provider UUID are only required if GDOF later applies for permission to publish content directly to ReliefWeb; they are not required for reading and searching reports.

After setting the secret, deploy the Worker and open **Admin → AI Story Studio → Test ReliefWeb Connection**. Automatic story generation retrieves ReliefWeb reports and saves source references with the draft. All AI-generated stories remain private until a Super Admin approves them.

Generated content must be original, accurately attributed, and reviewed against the linked source reports. Do not reproduce full ReliefWeb reports or imply that external activities were carried out by GDOF.

## Before publication
Verify all board names and titles, program descriptions, legal disclosures, contact details, and the tax-exemption status. The site currently states that IRS 501(c)(3) recognition is pending and does not represent donations as U.S. tax-deductible.