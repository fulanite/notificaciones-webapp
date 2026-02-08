-- Script para identificar diferencias entre el CSV de Glide y la base de datos actual
-- Ejecutar en phpMyAdmin

-- 1. Verificar si hay notificaciones en la base que NO están en el CSV de Glide
SELECT 
    'Notificaciones en BD pero NO en CSV' as tipo,
    COUNT(*) as cantidad
FROM notificaciones
WHERE fecha_carga >= '2025-12-01' AND fecha_carga < '2026-01-01'
  AND (glide_id_cedula IS NULL OR glide_id_cedula = '');

-- 2. Listar esas notificaciones (si existen)
SELECT 
    id,
    fecha_carga,
    tipo_notificacion,
    n_expediente,
    origen,
    migrated_from_glide
FROM notificaciones
WHERE fecha_carga >= '2025-12-01' AND fecha_carga < '2026-01-01'
  AND (glide_id_cedula IS NULL OR glide_id_cedula = '')
LIMIT 20;

-- 3. Verificar el total exacto de notificaciones migradas de Glide en diciembre 2025
SELECT 
    COUNT(*) as total_migradas_glide
FROM notificaciones
WHERE fecha_carga >= '2025-12-01' AND fecha_carga < '2026-01-01'
  AND migrated_from_glide = 1;

-- 4. Comparar tipos de notificación: contar cuántas hay de cada tipo
SELECT 
    tipo_notificacion,
    COUNT(*) as cantidad
FROM notificaciones
WHERE fecha_carga >= '2025-12-01' AND fecha_carga < '2026-01-01'
  AND migrated_from_glide = 1
GROUP BY tipo_notificacion
ORDER BY tipo_notificacion;

-- 5. Verificar si hay duplicados por glide_id_cedula
SELECT 
    glide_id_cedula,
    COUNT(*) as veces
FROM notificaciones
WHERE fecha_carga >= '2025-12-01' AND fecha_carga < '2026-01-01'
  AND glide_id_cedula IS NOT NULL
GROUP BY glide_id_cedula
HAVING COUNT(*) > 1;
