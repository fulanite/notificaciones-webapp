-- ================================================
-- SQL Fix: Database Schema Corrections
-- Fixes truncation issues by changing ENUM columns to VARCHAR
-- ================================================

-- 1. Allow 'entregado' and any future results by changing to VARCHAR
ALTER TABLE notificaciones MODIFY COLUMN resultado_diligencia VARCHAR(100) DEFAULT NULL;

-- 2. Allow any Juzgado/Entity as special recipient by changing to VARCHAR
ALTER TABLE notificaciones MODIFY COLUMN destinatario_especial VARCHAR(255) DEFAULT NULL;

-- 3. Populate destinatario_nombre from destinatario_especial if missing
UPDATE notificaciones 
SET destinatario_nombre = destinatario_especial 
WHERE destinatario_especial IS NOT NULL 
AND (destinatario_nombre IS NULL OR destinatario_nombre = '' OR destinatario_nombre = ' ');

-- 4. Normalize 'atiende' to 'entregado' for special recipients
UPDATE notificaciones 
SET resultado_diligencia = 'entregado' 
WHERE destinatario_especial IS NOT NULL 
AND resultado_diligencia = 'atiende';

-- 5. Sync visits history
UPDATE visitas v
JOIN notificaciones n ON v.notificacion_id = n.id
SET v.resultado = 'entregado'
WHERE n.destinatario_especial IS NOT NULL
AND v.resultado = 'atiende';
