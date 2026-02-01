-- ================================================
-- SGND - Migration Enhancement Schema
-- Adds columns to store original Glide IDs for traceability
-- ================================================

-- Add Glide ID reference column to notificaciones
ALTER TABLE notificaciones 
ADD COLUMN IF NOT EXISTS glide_id_cedula VARCHAR(100) DEFAULT NULL COMMENT 'Original Glide id_cedula for migrated records',
ADD COLUMN IF NOT EXISTS migrated_from_glide TINYINT(1) DEFAULT 0 COMMENT 'Flag indicating record was migrated from Glide';

-- Add index for Glide ID lookups
CREATE INDEX IF NOT EXISTS idx_notificaciones_glide_id ON notificaciones(glide_id_cedula);

-- Add Glide reference to visitas
ALTER TABLE visitas 
ADD COLUMN IF NOT EXISTS migrated_from_glide TINYINT(1) DEFAULT 0 COMMENT 'Flag indicating record was migrated from Glide';

-- Add Glide ID reference column to usuarios for ujier mapping
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS glide_id VARCHAR(100) DEFAULT NULL COMMENT 'Original Glide user ID for migrated records';

CREATE INDEX IF NOT EXISTS idx_usuarios_glide_id ON usuarios(glide_id);

-- ================================================
-- View for migration verification
-- ================================================
CREATE OR REPLACE VIEW v_migration_status AS
SELECT 
    'notificaciones' AS tabla,
    COUNT(*) AS total,
    SUM(CASE WHEN migrated_from_glide = 1 THEN 1 ELSE 0 END) AS migrated,
    SUM(CASE WHEN migrated_from_glide = 0 THEN 1 ELSE 0 END) AS native
FROM notificaciones
UNION ALL
SELECT 
    'visitas' AS tabla,
    COUNT(*) AS total,
    SUM(CASE WHEN migrated_from_glide = 1 THEN 1 ELSE 0 END) AS migrated,
    SUM(CASE WHEN migrated_from_glide = 0 THEN 1 ELSE 0 END) AS native
FROM visitas;
