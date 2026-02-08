-- Verificar cuántas notificaciones de diciembre 2025 hay en la base de datos actual
-- vs las que había en el CSV de Glide

-- Total en base de datos actual (por fecha_carga)
SELECT 
    'Base de datos actual' as fuente,
    COUNT(*) as total,
    SUM(CASE WHEN migrated_from_glide = 1 THEN 1 ELSE 0 END) as migradas_de_glide,
    SUM(CASE WHEN migrated_from_glide = 0 OR migrated_from_glide IS NULL THEN 1 ELSE 0 END) as nuevas
FROM notificaciones
WHERE fecha_carga >= '2025-12-01' AND fecha_carga < '2026-01-01';

-- Desglose por tipo de notificación
SELECT 
    tipo_notificacion,
    COUNT(*) as total,
    SUM(CASE WHEN migrated_from_glide = 1 THEN 1 ELSE 0 END) as migradas,
    SUM(CASE WHEN migrated_from_glide = 0 OR migrated_from_glide IS NULL THEN 1 ELSE 0 END) as nuevas
FROM notificaciones
WHERE fecha_carga >= '2025-12-01' AND fecha_carga < '2026-01-01'
GROUP BY tipo_notificacion
ORDER BY tipo_notificacion;

-- Ver si hay notificaciones con tipo_notificacion diferente al CSV
SELECT DISTINCT tipo_notificacion
FROM notificaciones
WHERE fecha_carga >= '2025-12-01' AND fecha_carga < '2026-01-01'
  AND migrated_from_glide = 0
ORDER BY tipo_notificacion;
