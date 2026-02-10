-- SGND - Mantenimiento de Base de Datos
-- Sincroniza el resultado de la notificación con la última visita registrada
-- Ideal para datos migrados o inconsistentes.

-- 1. Sincronizar la columna 'resultado_diligencia' con el resultado de la última visita
UPDATE notificaciones n
SET n.resultado_diligencia = (
    SELECT v.resultado 
    FROM visitas v 
    WHERE v.notificacion_id = n.id 
    ORDER BY v.fecha DESC, v.id DESC 
    LIMIT 1
)
WHERE (n.resultado_diligencia IS NULL OR n.resultado_diligencia = '' OR n.resultado_diligencia = 'pendiente')
AND EXISTS (
    SELECT 1 FROM visitas v2 WHERE v2.notificacion_id = n.id
);

-- 2. Actualizar el estado a 'diligenciada' para aquellas con resultado final
-- (Se excluyen los Pre Avisos ya que no terminan el proceso)
UPDATE notificaciones 
SET estado = 'diligenciada' 
WHERE estado = 'pendiente' 
AND resultado_diligencia IS NOT NULL 
AND LOWER(REPLACE(resultado_diligencia, '_', ' ')) NOT IN ('pre aviso');

-- 3. Asegurar que los 'Pre Aviso' mantengan el estado 'pendiente'
-- (Esto permite que el ujier las siga viendo en su hoja de ruta)
UPDATE notificaciones 
SET estado = 'pendiente' 
WHERE LOWER(REPLACE(resultado_diligencia, '_', ' ')) = 'pre aviso'
AND estado != 'pendiente';
