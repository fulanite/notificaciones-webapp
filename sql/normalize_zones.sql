-- ============================================================
-- SGND - Normalización de Zonas (MySQL)
-- Ejecuta este script en phpMyAdmin o tu cliente SQL
-- para unificar los datos migrados de Glide.
-- ============================================================

-- 1. Normalización de patrones específicos de Glide
UPDATE notificaciones SET zona = 'Urgente NORTE - Mandamientos' WHERE zona = 'urgente norte mandamiento';
UPDATE notificaciones SET zona = 'Urgente NORTE - Cédulas'      WHERE zona = 'urgente norte cedula';
UPDATE notificaciones SET zona = 'Urgente SUR - Mandamientos'   WHERE zona = 'urgente sur mandamiento';
UPDATE notificaciones SET zona = 'Urgente SUR - Cédulas'        WHERE zona = 'urgente sur cedula';

-- 2. Corrección de tildes inversas y variaciones de Cédulas
UPDATE notificaciones SET zona = 'A1 - Cédulas' WHERE zona = 'A1 - Cédula' OR zona = 'A1 - Cedula' OR zona = 'A1 - Cèdula';
UPDATE notificaciones SET zona = 'A2 - Cédulas' WHERE zona = 'A2 - Cédula' OR zona = 'A2 - Cedula' OR zona = 'A2 - Cèdula';
UPDATE notificaciones SET zona = 'B1 - Cédulas' WHERE zona = 'B1 - Cédula' OR zona = 'B1 - Cedula' OR zona = 'B1 - Cèdula';
UPDATE notificaciones SET zona = 'B2 - Cédulas' WHERE zona = 'B2 - Cédula' OR zona = 'B2 - Cedula' OR zona = 'B2 - Cèdula';
UPDATE notificaciones SET zona = 'C1 - Cédulas' WHERE zona = 'C1 - Cédula' OR zona = 'C1 - Cedula' OR zona = 'C1 - Cèdula';
UPDATE notificaciones SET zona = 'C2 - Cédulas' WHERE zona = 'C2 - Cédula' OR zona = 'C2 - Cedula' OR zona = 'C2 - Cèdula';
UPDATE notificaciones SET zona = 'D1 - Cédulas' WHERE zona = 'D1 - Cédula' OR zona = 'D1 - Cedula' OR zona = 'D1 - Cèdula';
UPDATE notificaciones SET zona = 'D2 - Cédulas' WHERE zona = 'D2 - Cédula' OR zona = 'D2 - Cedula' OR zona = 'D2 - Cèdula';

UPDATE notificaciones SET zona = 'Fuera de Radio NORTE - Cédulas' WHERE zona = 'Fuera de Radio NORTE - Cèdula' OR zona = 'Fuera de Radio NORTE - Cédula';
UPDATE notificaciones SET zona = 'Fuera de Radio SUR - Cédulas'   WHERE zona = 'Fuera de Radio SUR - Cèdula'   OR zona = 'Fuera de Radio SUR - Cédula';

-- 3. Corrección de Mandamientos singular a plural
UPDATE notificaciones SET zona = 'A1 - Mandamientos' WHERE zona = 'A1 - Mandamiento';
UPDATE notificaciones SET zona = 'A2 - Mandamientos' WHERE zona = 'A2 - Mandamiento';
UPDATE notificaciones SET zona = 'B1 - Mandamientos' WHERE zona = 'B1 - Mandamiento';
UPDATE notificaciones SET zona = 'B2 - Mandamientos' WHERE zona = 'B2 - Mandamiento';
UPDATE notificaciones SET zona = 'C1 - Mandamientos' WHERE zona = 'C1 - Mandamiento';
UPDATE notificaciones SET zona = 'C2 - Mandamientos' WHERE zona = 'C2 - Mandamiento';
UPDATE notificaciones SET zona = 'D1 - Mandamientos' WHERE zona = 'D1 - Mandamiento';
UPDATE notificaciones SET zona = 'D2 - Mandamientos' WHERE zona = 'D2 - Mandamiento';

UPDATE notificaciones SET zona = 'Fuera de Radio NORTE - Mandamientos' WHERE zona = 'Fuera de Radio NORTE - Mandamiento';
UPDATE notificaciones SET zona = 'Fuera de Radio SUR - Mandamientos'   WHERE zona = 'Fuera de Radio SUR - Mandamiento';

-- 4. Unificación de tipos_notificacion (si fuera necesario)
UPDATE notificaciones SET tipo_notificacion = 'cedulas'      WHERE tipo_notificacion = 'Cédula' OR tipo_notificacion = 'Cédulas';
UPDATE notificaciones SET tipo_notificacion = 'mandamientos' WHERE tipo_notificacion = 'Mandamiento' OR tipo_notificacion = 'Mandamientos';

-- 5. Limpieza genérica de espacios dobles
UPDATE notificaciones SET zona = TRIM(REPLACE(zona, '  ', ' '));
UPDATE notificaciones SET zona = 'ZONA SUR'      WHERE zona = 'sur';
UPDATE notificaciones SET zona = 'ZONA NORTE'    WHERE zona = 'norte';
UPDATE notificaciones SET zona = 'ZONA CENTRO'   WHERE zona = 'centro';
