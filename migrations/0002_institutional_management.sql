-- GDOF Institutional Management System: additive Phase 1 schema
-- Safe design rule: create new prefixed tables only. Do not alter or delete existing tables.
-- Apply only after taking a D1 backup and reviewing the deployment checklist.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS im_projects (
  id TEXT PRIMARY KEY,
  project_code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  programme TEXT NOT NULL,
  country_code TEXT,
  country_name TEXT,
  administrative_area TEXT,
  community TEXT,
  description TEXT NOT NULL DEFAULT '',
  objectives TEXT NOT NULL DEFAULT '',
  project_manager_admin_id TEXT,
  start_date TEXT,
  end_date TEXT,
  budget_amount_minor INTEGER,
  budget_currency TEXT,
  funding_source TEXT,
  status TEXT NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed','pending_approval','approved','active','completed','suspended','cancelled')),
  public_visibility INTEGER NOT NULL DEFAULT 0 CHECK (public_visibility IN (0,1)),
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS im_project_milestones (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES im_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','in_progress','completed','delayed','cancelled')),
  completed_at TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS im_beneficiaries (
  id TEXT PRIMARY KEY,
  beneficiary_ref TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  country_code TEXT,
  country_name TEXT,
  administrative_area TEXT,
  locality TEXT,
  consent_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (consent_status IN ('pending','granted','withdrawn','not_required')),
  record_status TEXT NOT NULL DEFAULT 'active'
    CHECK (record_status IN ('active','inactive','archived')),
  sensitivity_level TEXT NOT NULL DEFAULT 'restricted'
    CHECK (sensitivity_level IN ('restricted','highly_restricted')),
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS im_applications (
  id TEXT PRIMARY KEY,
  application_ref TEXT NOT NULL UNIQUE,
  beneficiary_id TEXT NOT NULL REFERENCES im_beneficiaries(id),
  programme TEXT NOT NULL,
  project_id TEXT REFERENCES im_projects(id),
  application_type TEXT NOT NULL,
  country_code TEXT,
  requested_amount_minor INTEGER,
  requested_currency TEXT,
  application_data_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN ('received','screening','under_review','approved','rejected','withdrawn','closed')),
  decision_notes TEXT,
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  decided_by TEXT,
  decided_at TEXT,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS im_assistance_records (
  id TEXT PRIMARY KEY,
  application_id TEXT REFERENCES im_applications(id),
  beneficiary_id TEXT NOT NULL REFERENCES im_beneficiaries(id),
  project_id TEXT REFERENCES im_projects(id),
  programme TEXT NOT NULL,
  assistance_type TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  amount_minor INTEGER,
  currency TEXT,
  delivery_date TEXT,
  delivery_status TEXT NOT NULL DEFAULT 'planned'
    CHECK (delivery_status IN ('planned','approved','delivered','cancelled')),
  approved_by TEXT,
  delivered_by TEXT,
  evidence_document_id TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS im_budgets (
  id TEXT PRIMARY KEY,
  budget_code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  budget_type TEXT NOT NULL
    CHECK (budget_type IN ('organisation','programme','project','grant')),
  project_id TEXT REFERENCES im_projects(id),
  programme TEXT,
  fiscal_year INTEGER NOT NULL,
  country_code TEXT,
  currency TEXT NOT NULL,
  total_amount_minor INTEGER NOT NULL CHECK (total_amount_minor >= 0),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','approved','rejected','closed')),
  approved_by TEXT,
  approved_at TEXT,
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS im_budget_lines (
  id TEXT PRIMARY KEY,
  budget_id TEXT NOT NULL REFERENCES im_budgets(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS im_financial_transactions (
  id TEXT PRIMARY KEY,
  transaction_ref TEXT NOT NULL UNIQUE,
  transaction_type TEXT NOT NULL
    CHECK (transaction_type IN ('donation','grant_receipt','expense','refund','transfer','adjustment')),
  transaction_date TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  currency TEXT NOT NULL,
  programme TEXT,
  project_id TEXT REFERENCES im_projects(id),
  budget_id TEXT REFERENCES im_budgets(id),
  donor_or_payee TEXT,
  payment_method TEXT,
  external_reference TEXT,
  verification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending','verified','rejected')),
  approval_status TEXT NOT NULL DEFAULT 'not_required'
    CHECK (approval_status IN ('not_required','pending','approved','rejected')),
  restriction_type TEXT NOT NULL DEFAULT 'unrestricted'
    CHECK (restriction_type IN ('unrestricted','restricted')),
  restriction_details TEXT,
  supporting_document_id TEXT,
  notes TEXT,
  created_by TEXT NOT NULL,
  approved_by TEXT,
  verified_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS im_approval_records (
  id TEXT PRIMARY KEY,
  record_type TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('submitted','approved','rejected','returned','cancelled')),
  decision_notes TEXT,
  actor_admin_id TEXT,
  actor_email TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS im_documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  document_category TEXT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size >= 0),
  visibility TEXT NOT NULL DEFAULT 'internal'
    CHECK (visibility IN ('internal','restricted','public')),
  approval_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (approval_status IN ('draft','pending_review','approved','rejected','archived')),
  version_number INTEGER NOT NULL DEFAULT 1,
  related_record_type TEXT,
  related_record_id TEXT,
  uploaded_by TEXT NOT NULL,
  approved_by TEXT,
  approved_at TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS im_document_versions (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES im_documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  change_summary TEXT NOT NULL DEFAULT '',
  uploaded_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(document_id, version_number)
);

CREATE TABLE IF NOT EXISTS im_grant_opportunities (
  id TEXT PRIMARY KEY,
  funder_name TEXT NOT NULL,
  opportunity_title TEXT NOT NULL,
  programme TEXT,
  eligible_geographies TEXT NOT NULL DEFAULT '',
  funding_min_minor INTEGER,
  funding_max_minor INTEGER,
  currency TEXT,
  deadline TEXT,
  application_url TEXT,
  status TEXT NOT NULL DEFAULT 'identified'
    CHECK (status IN ('identified','assessing','preparing','submitted','under_review','awarded','declined','withdrawn','closed')),
  internal_notes TEXT,
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_im_projects_status ON im_projects(status);
CREATE INDEX IF NOT EXISTS idx_im_projects_country ON im_projects(country_code);
CREATE INDEX IF NOT EXISTS idx_im_applications_status ON im_applications(status);
CREATE INDEX IF NOT EXISTS idx_im_applications_beneficiary ON im_applications(beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_im_transactions_date ON im_financial_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_im_transactions_status ON im_financial_transactions(verification_status, approval_status);
CREATE INDEX IF NOT EXISTS idx_im_documents_visibility ON im_documents(visibility, approval_status);
CREATE INDEX IF NOT EXISTS idx_im_grants_deadline ON im_grant_opportunities(deadline);
