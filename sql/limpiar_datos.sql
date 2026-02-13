-- Script para limpiar las tablas de notificaciones y visitas
-- ¡CUIDADO! Esto borrará permanentemente todos los registros de estas tablas.

SET FOREIGN_KEY_CHECKS = 0;

-- Borrar datos de visitas (primero por la relación de clave foránea)
DELETE FROM visitas;

-- Borrar datos de notificaciones
DELETE FROM notificaciones;

SET FOREIGN_KEY_CHECKS = 1;

-- Opcional: Si prefieres borrar pero mantener los IDs autoincrementales (aunque aquí usamos UUIDs)
-- DELETE FROM visitas;
-- DELETE FROM notificaciones;
