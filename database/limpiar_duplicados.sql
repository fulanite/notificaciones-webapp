-- ================================================
-- SQL PARA LIMPIAR DUPLICADOS DE MIGRACIÓN GLIDE
-- ================================================

-- 1. Eliminar duplicados de la tabla notificaciones (mantiene el registro más antiguo)
DELETE n1 FROM notificaciones n1
INNER JOIN notificaciones n2 
WHERE 
    n1.id > n2.id AND 
    n1.glide_id_cedula = n2.glide_id_cedula AND 
    n1.migrated_from_glide = 1;

-- 2. Hacer que glide_id_cedula sea único para evitar futuras duplicaciones
ALTER TABLE notificaciones ADD UNIQUE INDEX idx_unique_glide_id (glide_id_cedula);

-- 3. Limpiar duplicados de la tabla visitas
-- (En visitas es más complejo porque no tienen un ID único de Glide por fila, 
-- pero podemos eliminar registros idénticos asociados a la misma notificación)
DELETE v1 FROM visitas v1
INNER JOIN visitas v2 
WHERE 
    v1.id > v2.id AND 
    v1.notificacion_id = v2.notificacion_id AND 
    v1.fecha = v2.fecha AND
    v1.migrated_from_glide = 1;
