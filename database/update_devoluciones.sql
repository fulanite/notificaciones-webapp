-- ================================================
-- Add devuelta_por_ujier column for track return of physical notifications
-- ================================================

ALTER TABLE notificaciones 
ADD COLUMN IF NOT EXISTS devuelta_por_ujier TINYINT(1) DEFAULT 0 COMMENT 'Flag indicating the physical notification was returned by the bailiff',
ADD COLUMN IF NOT EXISTS fecha_devolucion DATETIME DEFAULT NULL COMMENT 'Date when the physical notification was returned';

-- Index for performance in the coordinator panel
CREATE INDEX IF NOT EXISTS idx_notificaciones_devolucion ON notificaciones(devuelta_por_ujier, zona);
