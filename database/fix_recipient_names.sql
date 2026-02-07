-- ================================================
-- SQL Fix: SyncRecipientNames
-- Synchronize destinatario_nombre with destinatario_especial where missing
-- and update 'atiende' to 'entregado' for special recipients
-- ================================================

-- 1. Populate destinatario_nombre from destinatario_especial if missing
UPDATE notificaciones 
SET destinatario_nombre = destinatario_especial 
WHERE destinatario_especial IS NOT NULL 
AND (destinatario_nombre IS NULL OR destinatario_nombre = '' OR destinatario_nombre = ' ');

-- 2. Update 'atiende' to 'entregado' for special recipients to ensure visual consistency
UPDATE notificaciones 
SET resultado_diligencia = 'entregado' 
WHERE destinatario_especial IS NOT NULL 
AND resultado_diligencia = 'atiende';

-- 3. Also update visitas history for consistency
UPDATE visitas v
JOIN notificaciones n ON v.notificacion_id = n.id
SET v.resultado = 'entregado'
WHERE n.destinatario_especial IS NOT NULL
AND v.resultado = 'atiende';
