-- Run this migration once against the remote GDOF D1 database.
-- Existing administrator accounts become Super Admins to preserve current access.
ALTER TABLE admins ADD COLUMN role TEXT NOT NULL DEFAULT 'super_admin';
