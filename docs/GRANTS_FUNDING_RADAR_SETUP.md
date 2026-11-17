# GDOF Grants & Funding Radar

The Grants & Funding Radar is being moved to a built-in scanner inside the GDOF Cloudflare Worker. No separate `GRANTS_RADAR_SCAN_URL` or `GRANTS_RADAR_SCAN_TOKEN` is required for the built-in Grants.gov adapter.

## Current built-in source

### U.S. Grants.gov

The scanner searches the public Grants.gov Applicant API using its unauthenticated `search2` and `fetchOpportunity` endpoints. It searches terms related to all seven GDOF programme categories, retrieves opportunity details, and records the official Grants.gov opportunity link.

Official API documentation:
- Search: https://www.grants.gov/api/common/search2
- Fetch opportunity: https://grants.gov/api/common/fetchopportunity
- API guide: https://www.grants.gov/api/api-guide

The API currently does not require a key for `search2` or `fetchOpportunity`. No new Cloudflare secrets are required for this source.

## Endpoints

- `GET /api/admin/notifications` — returns `{ notifications, unread_count }`.
- `POST /api/admin/notifications/scan-now` — scans the built-in source adapters and stores normalized results.
- `PATCH /api/admin/notifications/:id/read` — marks one notification as read.

All three endpoints require a valid authenticated Super Admin session. Other administrator roles receive HTTP 403. Results are stored in the existing D1 `site_content` table under `grants_radar_notifications`; no schema migration is required.

## What the match score means

The current Grants.gov score is a preliminary keyword relevance score based on programme/category wording and listing status. It is not an AI legal eligibility determination, an award prediction, or confirmation that GDOF may apply. The eligibility note asks the reviewer to check the official notice, including foreign-organization, U.S. tax-status, geographic, partnership, and applicant-type restrictions.

## Important source coverage limitation

There is no single comprehensive public API for independent/private foundation grants. The current built-in adapter searches Grants.gov (U.S. federal government opportunities). Independent/private foundation sources need separate official publisher feeds or public APIs, each checked for access terms, open/closed status, application URL, geography, and applicant restrictions before being added. Do not label a private opportunity as open or suitable based only on a third-party directory or an old article.

A future adapter can use an official foundation API/RSS feed or a carefully maintained list of funder opportunity pages. If a funder has no feed/API, automated page extraction must respect its terms, robots rules, rate limits, and source-link attribution.

## Data quality rules

- Only HTTPS application links are stored.
- Missing amount or deadline values are shown as not stated rather than guessed.
- The scanner does not create grant opportunities or auto-apply.
- Verify every opportunity on its official funder page before preparing an application.
- A Delaware incorporation certificate alone does not establish eligibility for every U.S. or international grant. GDOF must accurately represent its IRS recognition/tax status and operational registrations.
- A match score is a screening aid only; Super Admin review remains required.
