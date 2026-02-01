-- ================================================
-- SGND - Actualizar Estados de Visitas y Notificaciones
-- Convierte estados viejos a los 6 estados actuales
-- ================================================

-- =========================================
-- PASO 1: Actualizar estados en VISITAS
-- Convertir estados viejos a los nuevos
-- =========================================

-- Entregado → Atiende
UPDATE visitas 
SET resultado = 'Atiende'
WHERE resultado = 'Entregado' AND migrated_from_glide = 1;

-- No Atiende / se deja bajo la puerta → No Atiende
UPDATE visitas 
SET resultado = 'No Atiende'
WHERE resultado = 'No Atiende / se deja bajo la puerta' AND migrated_from_glide = 1;

-- Pendiente → NULL (sin resultado aún)
UPDATE visitas 
SET resultado = NULL
WHERE resultado = 'Pendiente' AND migrated_from_glide = 1;

-- Otros estados que pudieran existir con variantes de escritura
UPDATE visitas 
SET resultado = 'Atiende'
WHERE LOWER(resultado) LIKE '%atiende%' AND resultado != 'No Atiende' AND migrated_from_glide = 1;

UPDATE visitas 
SET resultado = 'Pre Aviso'
WHERE LOWER(resultado) LIKE '%pre%aviso%' AND migrated_from_glide = 1;

UPDATE visitas 
SET resultado = 'Estrados'
WHERE LOWER(resultado) LIKE '%estrado%' AND migrated_from_glide = 1;

-- =========================================
-- PASO 2: Verificar estados en visitas
-- =========================================
SELECT 
    IFNULL(resultado, '(sin resultado)') as resultado,
    COUNT(*) as cantidad
FROM visitas
WHERE migrated_from_glide = 1
GROUP BY resultado
ORDER BY cantidad DESC;

-- =========================================
-- PASO 3: Actualizar NOTIFICACIONES 
-- con resultado de última visita
-- =========================================

UPDATE notificaciones n
INNER JOIN (
    SELECT 
        v.notificacion_id,
        v.resultado,
        v.fecha
    FROM visitas v
    INNER JOIN (
        SELECT notificacion_id, MAX(fecha) as max_fecha
        FROM visitas
        WHERE migrated_from_glide = 1
        GROUP BY notificacion_id
    ) latest ON v.notificacion_id = latest.notificacion_id 
            AND v.fecha = latest.max_fecha
    WHERE v.migrated_from_glide = 1
) uv ON n.id = uv.notificacion_id
SET 
    n.resultado_diligencia = CASE uv.resultado
        WHEN 'Atiende' THEN 'atiende'
        WHEN 'No Atiende' THEN 'no_atiende'
        WHEN 'Pre Aviso' THEN 'pre_aviso'
        WHEN 'Estrados' THEN 'estrados'
        WHEN 'Domicilio Inexistente' THEN 'domicilio_inexistente'
        WHEN 'Diligenciador Ausente' THEN 'diligenciador_ausente'
        ELSE NULL
    END,
    n.fecha_diligencia = uv.fecha
WHERE n.migrated_from_glide = 1;

-- =========================================
-- PASO 4: Verificar resultados finales
-- =========================================
SELECT 
    IFNULL(resultado_diligencia, '(pendiente)') as resultado,
    COUNT(*) as cantidad
FROM notificaciones
WHERE migrated_from_glide = 1
GROUP BY resultado_diligencia
ORDER BY cantidad DESC;
