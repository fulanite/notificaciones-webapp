-- ================================================
-- Script para actualizar estado de notificaciones
-- basándose en la última visita
-- ================================================

-- Primero, ver los valores únicos de resultado en visitas
SELECT DISTINCT resultado, COUNT(*) as cantidad
FROM visitas
WHERE migrated_from_glide = 1
GROUP BY resultado
ORDER BY cantidad DESC;
