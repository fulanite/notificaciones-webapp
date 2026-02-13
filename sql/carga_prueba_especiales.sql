SET @usuario_carga = '37643574';

-- 1. Identificar IDs de ujieres actuales
DROP TEMPORARY TABLE IF EXISTS tmp_ujieres;
CREATE TEMPORARY TABLE tmp_ujieres (id VARCHAR(50));
INSERT INTO tmp_ujieres (id) 
SELECT id FROM usuarios WHERE rol = 'ujier' AND activo = 1;

-- 2. Carga de ARCAT (3 por ujier)
INSERT INTO notificaciones (
    id, glide_id_cedula, migrated_from_glide, fecha_carga, fecha_entrega_ujier, devuelta_por_ujier, usuario_carga,
    estado, tipo_notificacion, n_expediente, caratula, origen, letrado,
    destinatario_especial, destinatario_nombre, domicilio, zona,
    tipo_troquel, sin_troquel, n_troquel, medio_pago, costo, observaciones_iniciales, asignado_a, created_at
)
SELECT 
    UUID(), UUID(), 0, NOW(), CURDATE() + INTERVAL 1 DAY, 0, @usuario_carga,
    'pendiente', 'cedulas', CONCAT('ARC-', FLOOR(RAND()*9999), '/25'), 'S/ PRUEBA ESPECIAL', 'Oficina de Cargas', 'Dr. System Test',
    '1', 'ARCAT', 'SIN DOMICILIO', 'ZONA ESPECIAL',
    'C', 0, FLOOR(RAND()*9000 + 1000), 'gratuito', 0, 'Carga masiva de prueba ARCAT', u.id, NOW()
FROM tmp_ujieres u CROSS JOIN (SELECT 1 UNION SELECT 2 UNION SELECT 3) AS t;

-- 3. Carga de Juzgado Comercial 1/1 (5 por ujier)
INSERT INTO notificaciones (
    id, glide_id_cedula, migrated_from_glide, fecha_carga, fecha_entrega_ujier, devuelta_por_ujier, usuario_carga,
    estado, tipo_notificacion, n_expediente, caratula, origen, letrado,
    destinatario_especial, destinatario_nombre, domicilio, zona,
    tipo_troquel, sin_troquel, n_troquel, medio_pago, costo, observaciones_iniciales, asignado_a, created_at
)
SELECT 
    UUID(), UUID(), 0, NOW(), CURDATE() + INTERVAL 1 DAY, 0, @usuario_carga,
    'pendiente', 'cedulas', CONCAT('COM1-', FLOOR(RAND()*9999), '/25'), 'S/ PRUEBA COMERCIAL', 'Oficina de Cargas', 'Dr. System Test',
    '1', 'Juzgado Comercial 1/1', 'SIN DOMICILIO', 'ZONA ESPECIAL',
    'C', 0, FLOOR(RAND()*9000 + 1000), 'gratuito', 0, 'Carga masiva de prueba Com 1/1', u.id, NOW()
FROM tmp_ujieres u CROSS JOIN (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) AS t;

-- 4. Carga de Juzgado Comercial 3 (4 por ujier)
INSERT INTO notificaciones (
    id, glide_id_cedula, migrated_from_glide, fecha_carga, fecha_entrega_ujier, devuelta_por_ujier, usuario_carga,
    estado, tipo_notificacion, n_expediente, caratula, origen, letrado,
    destinatario_especial, destinatario_nombre, domicilio, zona,
    tipo_troquel, sin_troquel, n_troquel, medio_pago, costo, observaciones_iniciales, asignado_a, created_at
)
SELECT 
    UUID(), UUID(), 0, NOW(), CURDATE() + INTERVAL 1 DAY, 0, @usuario_carga,
    'pendiente', 'cedulas', CONCAT('COM3-', FLOOR(RAND()*9999), '/25'), 'S/ PRUEBA COMERCIAL 3', 'Oficina de Cargas', 'Dr. System Test',
    '1', 'Juzgado Comercial 3', 'SIN DOMICILIO', 'ZONA ESPECIAL',
    'C', 0, FLOOR(RAND()*9000 + 1000), 'gratuito', 0, 'Carga masiva de prueba Com 3', u.id, NOW()
FROM tmp_ujieres u CROSS JOIN (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4) AS t;

DROP TEMPORARY TABLE tmp_ujieres;
