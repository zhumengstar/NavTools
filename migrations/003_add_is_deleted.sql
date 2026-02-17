-- Add is_deleted and deleted_at columns to sites table
ALTER TABLE sites ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE sites ADD COLUMN deleted_at TIMESTAMP;
