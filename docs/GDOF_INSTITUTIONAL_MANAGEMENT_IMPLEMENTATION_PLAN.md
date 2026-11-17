# GDOF Institutional Management System
## Final implementation blueprint and development plan

**Repository:** `wilsongikonyo/gdof-foundation-website`  
**Branch:** `main`  
**Architecture:** React + Vite, Cloudflare Workers, D1 and R2  
**Status:** Approved product direction; implementation staged and subject to testing

## 1. Confirmed product decisions

These decisions govern the implementation:

- **Geographic scope:** International from the beginning. Project, application, funding and reporting records must support multiple countries, local administrative areas and currencies. Country-specific legal, tax, safeguarding and data-protection rules must be configurable and reviewed before operations begin in each jurisdiction.
- **Financial management:** Full financial management, including budgets, expenditure, donation and grant receipts, verification, approvals, supporting documents and reconciliation. Amounts are stored as integer minor units with an explicit ISO currency code. Do not aggregate different currencies without a disclosed conversion method and rate.
- **Beneficiary management:** Applications, eligibility review, decisions and assistance records. Beneficiary records and supporting documents are private and restricted by role. Collect only necessary information, record consent where required, and define retention and deletion rules before collecting live personal data.
- **Board access:** No separate Board login in this stage. The Executive Director and Secretary manage Board documents and approval records. A Board approval must be recorded only after a real Board decision and must include the meeting/resolution reference, date and authorised recorder.

## 2. Existing functionality to preserve

Do not replace or reset existing records or features:

- Public homepage, programme descriptions and leadership profiles.
- Programme story drafts and published stories.
- R2 media library and media URLs.
- Contact and partnership enquiries.
- Existing donation records and payment webhook behaviour.
- Existing Partners & Grants register and public visibility rules.
- Existing administrator accounts, roles, login and session behaviour.
- Existing site content, announcement and public resource settings.
- Existing audit log records.

New data structures use the `im_` prefix to avoid collisions with existing application tables. All schema work is additive. No destructive migration, table rename, record rewrite or bulk conversion is authorised by this plan.

## 3. Target system architecture

### Public website
Public pages should contain approved institutional information only: About, Programmes, Impact, Partnerships, Get Involved, Transparency, News, Contact, privacy and safeguarding information. Publish only verified impact figures and explicitly approved documents.

### Protected administration
The existing `/admin` application remains the administration entry point. New modules should be introduced gradually and only displayed to users with the corresponding backend permission.

### Data and storage
- **D1:** structured records, workflow states, permissions, metadata and audit references.
- **R2:** uploaded documents and media objects.
- **Worker:** authenticated APIs, server-side validation, authorisation, publication filtering and audit events.
- **React:** administrative forms and views; never the sole enforcement point for security.

## 4. Administration modules and requirements

### 4.1 Institutional governance
Maintain Board member appointments, meeting metadata, resolutions, policies and controlled document versions. Board minutes and internal resolutions are private by default. Executive Director and Secretary are the designated record managers. Approval metadata must include the actual decision date, resolution reference, decision and recorder. Uploading a file alone never makes it Board-approved.

### 4.2 Project and programme management
Project fields: unique project code, title, programme, country, administrative area, community, description, objectives, manager, dates, budget and currency, funding source, status and public visibility. Support milestones, updates, evidence and completion reports. Public visibility requires explicit publication approval.

### 4.3 Beneficiary applications
Support applications, screening, assessment, approval/rejection, assistance records and follow-up. Personal details and uploaded evidence are restricted by default. Public reporting uses aggregated, non-identifying data only. Do not collect government IDs, health details or other sensitive data unless necessary, lawful, consented where required and access-controlled.

### 4.4 Financial management
Maintain budgets, budget lines, donations, grant receipts, expenses, refunds, transfers and adjustments. Separate request, approval, payment execution and verification. A payment is verified only by a trusted payment-provider event or documented reconciliation; a browser redirect or manual assertion is not proof. Preserve transaction references and supporting documents. Use immutable transaction history or reversal entries rather than silently editing or deleting posted financial records.

### 4.5 Grants and partnerships
Track funders, grant opportunities, eligibility/geography, deadlines, applications, submitted amounts, awarded amounts, agreements, conditions, disbursements and reporting deadlines. Requested, proposed, awarded, received and spent amounts must remain distinct.

### 4.6 Documents and approvals
Documents have category, visibility, approval state, uploader, version and related record. Internal/restricted documents are served only after server-side authorisation. Public documents require explicit approval and publication. Revisions create new versions; do not overwrite approved historical versions.

### 4.7 Reporting
Provide authorised operational, programme, finance and grant reports. International reporting must preserve source currency and geography. Cross-currency totals require a recorded conversion rate, date and reporting currency. Impact statistics must be sourced from recorded evidence and must not be invented.

## 5. Permissions model

The existing roles are retained during Phase 1: `super_admin`, `editor`, `finance`, `viewer`. New specialist roles should be introduced only with explicit backend permission mappings and a tested migration path.

Target role capabilities:
- Super Admin: account administration, system configuration and full access.
- Executive Director: operational oversight, projects, grants, governance records and designated approvals.
- Finance Officer: financial records, budgets, reconciliation and finance reports.
- Programme Manager: assigned projects, applications and assistance records only.
- Grants Officer: opportunities, applications, funders and agreement tracking.
- Communications Officer: public content and approved media.
- Secretary: Board records, minutes, resolutions and document register.
- Auditor/Viewer: read-only access to explicitly assigned records.

Do not create a new role by changing only a React tab list. Every route must enforce permissions in the Worker. Enforce least privilege, deny by default, and prevent self-elevation. The Board has no direct portal account in this implementation.

## 6. Development phases

### Phase 1 — Foundation and security
1. Inspect current Worker routes, database schema and Cloudflare bindings.
2. Back up D1 and confirm restore procedure.
3. Document existing roles and endpoint access.
4. Add additive, prefixed D1 schema for future modules.
5. Add server-side permission helpers and security tests before enabling new modules.
6. Implement private document storage and controlled access.
7. Improve audit coverage and session controls.
8. Test that existing features and records remain intact.

### Phase 2 — Governance and transparency
Board records, resolutions, policy register, versioned documents, publication approval and public transparency pages. Board records remain managed by the Executive Director and Secretary.

### Phase 3 — Projects and beneficiary applications
Project register, milestones, applications, restricted beneficiary records, eligibility decisions and assistance history.

### Phase 4 — Finance
Budgets, budget lines, expenses, donation and grant receipts, approval workflow, reconciliation and reporting.

### Phase 5 — Grants and partnerships
Opportunity pipeline, applications, funder records, agreements, awards, disbursement schedules and reporting deadlines.

### Phase 6 — Public impact and reporting
Verified impact summaries, approved reports, project pages and public document centre.

## 7. Phase 1 data model

The additive migration file `migrations/0002_institutional_management.sql` creates prefixed tables for projects, milestones, beneficiaries, applications, assistance, budgets, budget lines, financial transactions, approvals, documents, document versions and grant opportunities. It does not modify or delete existing tables.

The migration is a schema foundation, not a completed application feature. It must be reviewed, backed up and applied deliberately. The application must not assume the tables exist until deployment confirms the migration succeeded.

## 8. Security and privacy release gates

Before any live beneficiary or financial data is entered:
- Verify role permissions on every API route.
- Use private R2 object keys for restricted documents.
- Authorise every document download server-side.
- Use signed payment-provider webhooks and idempotency checks.
- Keep financial records auditable; use reversals instead of silent deletion.
- Apply session expiry and revocation, MFA for privileged users, and secure password-reset procedures.
- Add rate limiting and login-abuse controls.
- Establish backup, restore and incident-response procedures.
- Define privacy notices, consent, data minimisation, retention and deletion rules for each operating country.
- Review local registration, fundraising, tax, employment, safeguarding and data-protection obligations before commencing activities in each country.

## 9. Acceptance tests

A phase is not complete until:
1. Existing website routes and public content work.
2. Existing stories, media, enquiries, donations and partnership records remain available.
3. Unauthenticated API requests are rejected.
4. A role cannot call an endpoint outside its permission.
5. Restricted beneficiary and finance data never appears in public responses.
6. Draft or unapproved documents cannot be published.
7. Public project and impact data is explicitly approved and verified.
8. Currency values are not incorrectly combined.
9. Approval records identify the actor and decision.
10. Audit events are recorded for critical changes.
11. Build and deployment checks pass.
12. A D1 restore test is completed before a production schema change.

## 10. Immediate next implementation tasks

1. Inspect and document the actual production D1 schema and existing Cloudflare bindings.
2. Take and verify a D1 backup.
3. Review the proposed additive migration against the actual database.
4. Apply the migration in a controlled deployment.
5. Implement the document register and private R2 download authorisation.
6. Add permission tests before expanding administrator roles.
7. Only then enable governance and project workflows.

**Release principle:** preserve the live website and existing records. New modules remain unavailable until their database migration, backend permissions, privacy controls and acceptance tests are complete.
