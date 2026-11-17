# GDOF AI Story Studio — setup and operating guide

## What this adds

The existing Cloudflare Worker, D1 database binding (`GDOF_DB`) and R2 bucket (`GDOF_MEDIA`) are reused. Story records are stored in the existing `site_content` key-value row named `program_stories`; this avoids a destructive schema change or a new D1 migration.

Super Admin-only dashboard tabs:
- **AI Story Studio** — category selection, source-led auto-generation, or drafting from field notes.
- **Pending Approval** — edit text, preview images/video, add uploaded media, approve and publish, or reject/delete.

The backend routes are:
- `POST /api/admin/generate-auto`
- `POST /api/admin/generate-from-notes`
- `PUT /api/admin/update-story`
- `POST /api/admin/approve-story` with `action: "approve" | "reject"`
- `GET /api/admin/stories` (authenticated)
- `POST /api/admin/media` (Super Admin only; image/video upload)
- `GET /api/programs/:slug` (public; only records with `status === "PUBLISHED"`)

## Cloudflare Worker configuration

Set these as Worker secrets from the repository directory. Do not put keys in frontend code, GitHub commits, or public Vite variables, and do not send them in chat.

```bash
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put PEXELS_API_KEY
npx wrangler secret put RELIEFWEB_APPNAME
```

Existing required configuration remains:
- `GDOF_DB` D1 binding
- `GDOF_MEDIA` R2 binding
- `ADMIN_SESSION_SECRET` Worker secret
- existing Super Admin bootstrap settings, if used

Optional Worker variable:
- `OPENAI_MODEL` — defaults to `gpt-4.1-mini`; set as a non-secret Worker variable if a different supported model is selected.

Use a valid ReliefWeb `appname` registered for your application. ReliefWeb access may be rate-limited or change its API requirements. The generator fails safely if no relevant source reports are returned.

## Obtain provider credentials

1. Open the OpenAI developer platform, create an API key, and ensure API billing/usage is enabled.
2. Create a Pexels developer account and obtain an API key. Review the current Pexels API and license terms before publishing media.
3. Register/use a ReliefWeb API application name for the `appname` parameter.
4. Add the credentials with the Wrangler commands above. Keep them in Cloudflare Worker secrets only.

## Deploy

After secrets are set:

```bash
npm install
npm run build
npx wrangler deploy
```

The existing site uses Cloudflare Worker static assets from `./dist`. Deploy from a trusted local checkout with Wrangler authenticated to the correct Cloudflare account. Do not paste Cloudflare tokens into this project or chat.

## Editorial safeguards

- Auto-generated drafts are research summaries of external ReliefWeb reports, not claims that GDOF carried out the activity.
- Field-note drafts must be checked against the original notes. The model is instructed not to invent results, participants, locations, dates, partnerships or quotations; uncertain items should be verified before approval.
- Pexels images/videos are treated as selected media for the proposed story. The Super Admin reviews and approves the complete story package, including its accompanying media, before publication. Keep Pexels source and licensing details in the administrative record.
- All generated records begin as `PENDING_APPROVAL`. Public category routes return only `PUBLISHED` records.
- Rejection deletes the draft record from the story list. It does not automatically delete uploaded media objects from R2.
- The legacy manual story editor now submits drafts for approval; AI drafts are kept separate from its legacy editing list.

## Operational notes and limitations

- The Pexels video search endpoint uses the current `/v1/videos/search` route. Existing Pexels API keys can be used; Pexels currently notes that issuance of new API keys may be paused, so confirm availability before planning a new integration.

The story list currently uses the existing JSON value in `site_content`, not a new relational D1 table. This is compatible with the site's current schema but is less suitable for very large story volumes; move to a dedicated table with a reviewed migration if volume grows.
- Pexels API results and availability vary by query. Generation stops without saving a draft if the required stock media cannot be found.
- ReliefWeb may not have suitable reports for every category (especially animal welfare or entrepreneurship). In that case the system returns an error and creates no invented "real-world" story. Use the field-notes mode for a GDOF idea or activity.
- Video uploads are limited to 50 MB; image uploads to 8 MB. Supported formats are JPG, PNG, WebP, GIF, MP4, WebM and MOV.
- Run a production build and test every endpoint in the target Cloudflare environment before announcing the feature as live.
