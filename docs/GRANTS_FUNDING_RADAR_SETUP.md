# GDOF Grants & Funding Radar setup

The Super Admin radar UI and authenticated notification endpoints are implemented in the website Worker. Notifications are stored in the existing D1 `site_content` table under `grants_radar_notifications`; no schema migration is required.

## Endpoints

- `GET /api/admin/notifications` — returns `{ notifications, unread_count }`.
- `POST /api/admin/notifications/scan-now` — asks the configured scanner service to discover and score current opportunities, then stores the normalized results.
- `PATCH /api/admin/notifications/:id/read` — marks one notification as read.

All three endpoints require a valid authenticated Super Admin session. Other administrator roles receive HTTP 403.

## Connect a funding research scanner

The website Worker deliberately does not invent funding opportunities or treat ReliefWeb as a grant database. To run live scans, connect a trusted scanner service that searches official government grant portals and independent/private foundation funding pages, checks current deadlines and eligibility, and returns sourced results.

Configure these Worker values:

- `GRANTS_RADAR_SCAN_URL` — HTTPS URL of the scanner service endpoint.
- `GRANTS_RADAR_SCAN_TOKEN` — optional bearer token used to authenticate requests to that service.

From Windows PowerShell, use `npx.cmd` (rather than `npx`) if PowerShell blocks the `npx.ps1` script:

```powershell
npx.cmd wrangler secret put GRANTS_RADAR_SCAN_URL
npx.cmd wrangler secret put GRANTS_RADAR_SCAN_TOKEN
```

Enter the scanner URL/token when Wrangler prompts. Do not paste tokens into chat, source files, or GitHub commits. Redeploy the Worker after setting the values if Wrangler does not automatically deploy the secret update.

## Scanner request

The Worker sends a JSON POST containing GDOF's organization profile, the seven programme slugs, requested fields, and a maximum result count. If configured, it sends `Authorization: Bearer <GRANTS_RADAR_SCAN_TOKEN>`.

## Required scanner response

Return JSON in this shape:

```json
{
  "notifications": [
    {
      "title": "Name of the funding opportunity",
      "funder": "Official funder name",
      "type": "government",
      "amount": "Up to USD 50,000",
      "deadline": "2027-02-15",
      "fit_score": 86,
      "matched_gdof_category": "Youth Entrepreneurship",
      "eligibility_note": "Explain the published eligibility criteria and any unresolved conditions for GDOF.",
      "apply_url": "https://official-funder.example/apply"
    }
  ]
}
```

Use `type: "government"` for government grants. Use `type: "independent"` for independent/private foundation funds. The Worker accepts only HTTPS application URLs, limits scores to 0–100, preserves read state for existing matching application URLs, and stores up to 250 notifications.

## Important eligibility and editorial safeguards

- The scanner must use current, authoritative funder pages and retain evidence/source URLs in its own research records.
- A fit score is a relevance estimate, not an eligibility decision or award prediction.
- The eligibility note must disclose restrictions such as geography, applicant type, nonprofit/tax status, registration, matching funds, and deadlines.
- Do not assume GDOF has IRS 501(c)(3) recognition or that Delaware incorporation alone qualifies it for every US or international grant.
- Do not create or display invented opportunities. If no verified results are found, return an empty `notifications` array.
- The radar is Super Admin-only. Clicking an application link opens it in a new tab and marks that notification as read.
