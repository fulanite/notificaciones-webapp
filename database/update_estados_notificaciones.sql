-- ================================================
-- SGND - Cambiar Estados a los del Ujier
-- Modificar ENUM para usar los estados reales
-- ================================================

-- ================================================
-- PASO 1: Cambiar el tipo de columna estado
-- De ENUM limitado a VARCHAR para permitir cualquier estado
-- ================================================

ALTER TABLE notificaciones 
MODIFY COLUMN estado VARCHAR(50) DEFAULT 'Pendiente';

-- ================================================
-- PASO 2: Actualizar notificaciones con el estado
-- del resultado de la última visita
-- ================================================

-- Primero normalizar los resultados en visitas
UPDATE visitas SET resultado = 'Atiende' WHERE resultado = 'Entregado';
UPDATE visitas SET resultado = 'No Atiende' WHERE resultado LIKE '%No Atiende%';

-- Actualizar estado en notificaciones desde la última visita
UPDATE notificaciones n
INNER JOIN (
    SELECT 
        v1.notificacion_id,
        v1.resultado,
        v1.fecha
    FROM visitas v1
    INNER JOIN (
        SELECT notificacion_id, MAX(fecha) as max_fecha
        FROM visitas
        GROUP BY notificacion_id
    ) v2 ON v1.notificacion_id = v2.notificacion_id 
        AND v1.fecha = v2.max_fecha
    WHERE v1.resultado IS NOT NULL AND v1.resultado != ''
) ultima ON n.id = ultima.notificacion_id
SET 
    n.estado = ultima.resultado,
    n.fecha_diligencia = ultima.fecha
WHERE n.migrated_from_glide = 1;

-- Las que no tienen visita quedan como Pendiente
UPDATE notificaciones
SET estado = 'Pendiente'
WHERE (estado IS NULL OR estado = '' OR estado = 'pendiente')
  AND migrated_from_glide = 1;

-- ================================================
-- PASO 3: Verificar resultados
-- ================================================
SELECT 
    estado,
    COUNT(*) as cantidad
FROM notificaciones
WHERE migrated_from_glide = 1
GROUP BY estado
ORDER BY cantidad DESC;

-- Ver muestra
SELECT 
    LEFT(id, 8) as id_corto,
    destinatario_nombre,
    estado,
    fecha_diligencia
FROM notificaciones
WHERE migrated_from_glide = 1
  AND estado != 'Pendiente'
LIMIT 10;
