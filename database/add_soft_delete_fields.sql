-- SGND - Migration: Add Soft Delete Fields to Notifications
-- Run this SQL in your database (e.g., PHPMyAdmin) to enable notification deletion logic.

ALTER TABLE `notificaciones` 
ADD COLUMN `eliminada` TINYINT(1) DEFAULT 0,
ADD COLUMN `eliminada_por` VARCHAR(255) NULL,
ADD COLUMN `eliminada_fecha` DATETIME NULL,
ADD COLUMN `eliminada_motivo` TEXT NULL;

-- Index for performance on filters
CREATE INDEX idx_notificaciones_eliminada ON notificaciones(eliminada);
