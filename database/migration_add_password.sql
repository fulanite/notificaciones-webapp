-- ================================================
-- SGND - Migration: Add password_hash column
-- Run this in phpMyAdmin if you already created the database
-- ================================================

-- Add password_hash column to usuarios table
ALTER TABLE usuarios 
ADD COLUMN password_hash VARCHAR(255) DEFAULT NULL 
AFTER rol;

-- ================================================
-- IMPORTANT: After running this migration, all users
-- can login with:
--   - Email: their email
--   - Password: sgnd2024
--
-- Users should change their password after first login!
-- ================================================
