-- ================================================
-- SGND - Migración Completa de Usuarios desde Glide
-- Incluye: nombre, dni, email, telefono, rol, foto
-- ================================================

-- ================================================
-- PASO 1: Agregar campos que faltan a la tabla usuarios
-- ================================================

ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS dni VARCHAR(20) DEFAULT NULL COMMENT 'DNI del usuario',
ADD COLUMN IF NOT EXISTS telefono VARCHAR(20) DEFAULT NULL COMMENT 'Número de celular';

CREATE INDEX IF NOT EXISTS idx_usuarios_dni ON usuarios(dni);

-- ================================================
-- PASO 2: Eliminar usuarios temporales
-- ================================================
DELETE FROM usuarios WHERE glide_id IS NOT NULL;

-- ================================================
-- PASO 3: Insertar usuarios completos
-- ================================================

-- Mateo Quiroga (administrativo)
INSERT INTO usuarios (id, email, nombre, rol, dni, telefono, foto, glide_id, activo) VALUES 
('u-001-mateo', 'modernizacion@fraymunicipalidad.gob.ar', 'Mateo Quiroga', 'administrativo', '3643574', NULL, 'https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/fCtwpCHQKelx7T3y5tyR/pub/s4OMkioEmnubpMjQlDyw.jpg', '3643574', 1)
ON DUPLICATE KEY UPDATE nombre='Mateo Quiroga', dni='3643574', rol='administrativo';

-- Sofia Alvarez (ujier)
INSERT INTO usuarios (id, email, nombre, rol, dni, telefono, foto, glide_id, activo) VALUES 
('u-002-sofia', 'matexcardozo@gmail.com', 'Sofia Alvarez', 'ujier', '37643574', NULL, 'https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/fCtwpCHQKelx7T3y5tyR/pub/XmCoWskxBOAQz6cuzHho.png', '37643574', 1)
ON DUPLICATE KEY UPDATE nombre='Sofia Alvarez', dni='37643574', rol='ujier';

-- Mariangel Ibañez (administrativo)
INSERT INTO usuarios (id, email, nombre, rol, dni, telefono, foto, glide_id, activo) VALUES 
('u-003-mariangel', 'ibanezmariangel@gmail.com', 'Mariangel Ibañez', 'administrativo', '34716928', NULL, 'https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/fCtwpCHQKelx7T3y5tyR/pub/4TydZFozCwiGJ0KgBpXY.jpeg', '34716928', 1)
ON DUPLICATE KEY UPDATE nombre='Mariangel Ibañez', dni='34716928', rol='administrativo';

-- Adriana Esther Furlan (administrativo)
INSERT INTO usuarios (id, email, nombre, rol, dni, telefono, foto, glide_id, activo) VALUES 
('u-004-adriana-f', 'adrianafurlan38@gmail.com', 'Adriana Esther Furlan', 'administrativo', '24362587', NULL, 'https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/fCtwpCHQKelx7T3y5tyR/pub/liuSQUQDYtVV9tHDuVVW.jpeg', '24362587', 1)
ON DUPLICATE KEY UPDATE nombre='Adriana Esther Furlan', dni='24362587', rol='administrativo';

-- Agostina del Huerto Alive (administrativo)
INSERT INTO usuarios (id, email, nombre, rol, dni, telefono, foto, glide_id, activo) VALUES 
('u-005-agostina', 'agos.alive1203@gmail.com', 'Agostina del Huerto Alive', 'administrativo', '37641984', NULL, NULL, '37641984', 1)
ON DUPLICATE KEY UPDATE nombre='Agostina del Huerto Alive', dni='37641984', rol='administrativo';

-- Hector Jose Fernando Varela (administrativo)
INSERT INTO usuarios (id, email, nombre, rol, dni, telefono, foto, glide_id, activo) VALUES 
('u-006-hector', 'hectorjosefernandovarela@gmail.com', 'Hector Jose Fernando Varela', 'administrativo', '24309864', NULL, 'https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/fCtwpCHQKelx7T3y5tyR/pub/Bwyy7YuW3SJqG6AfoR3m.jpeg', '24309864', 1)
ON DUPLICATE KEY UPDATE nombre='Hector Jose Fernando Varela', dni='24309864', rol='administrativo';

-- Sonia Moreno Yunis (administrativo) - Email 1
INSERT INTO usuarios (id, email, nombre, rol, dni, telefono, foto, glide_id, activo) VALUES 
('u-007-sonia-adm', 'soniaaries2012@gmail.com', 'Sonia Moreno Yunis', 'administrativo', '25746855', NULL, NULL, '25746855', 1)
ON DUPLICATE KEY UPDATE nombre='Sonia Moreno Yunis', dni='25746855', rol='administrativo';

-- Nicolas Emiliano Romero (ujier)
INSERT INTO usuarios (id, email, nombre, rol, dni, telefono, foto, glide_id, activo) VALUES 
('u-008-nicolas', 'ujier1.catamarca@gmail.com', 'Nicolas Emiliano Romero', 'ujier', '23355971', '3834035036', 'https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/1hfcSKizDmCWbiikjxDb/pub/eJoyoJwt0uwwJaIilnHG.jpg', '23355971', 1)
ON DUPLICATE KEY UPDATE nombre='Nicolas Emiliano Romero', dni='23355971', telefono='3834035036', rol='ujier';

-- Lorena Alicia Manfredi (ujier)
INSERT INTO usuarios (id, email, nombre, rol, dni, telefono, foto, glide_id, activo) VALUES 
('u-009-lorena', 'ujier2.catamarca@gmail.com', 'Lorena Alicia Manfredi', 'ujier', '27496338', '3834034895', NULL, '27496338', 1)
ON DUPLICATE KEY UPDATE nombre='Lorena Alicia Manfredi', dni='27496338', telefono='3834034895', rol='ujier';

-- Adriana Matilde Elizalde (ujier)
INSERT INTO usuarios (id, email, nombre, rol, dni, telefono, foto, glide_id, activo) VALUES 
('u-010-adriana-e', 'ujier3.catamarca@gmail.com', 'Adriana Matilde Elizalde', 'ujier', '21325608', '3834034972', 'https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/1hfcSKizDmCWbiikjxDb/pub/Znzospkyhsq7EBGZ1AWh.jpg', '21325608', 1)
ON DUPLICATE KEY UPDATE nombre='Adriana Matilde Elizalde', dni='21325608', telefono='3834034972', rol='ujier';

-- Cynthia Natalia Cardoso (ujier)
INSERT INTO usuarios (id, email, nombre, rol, dni, telefono, foto, glide_id, activo) VALUES 
('u-011-cynthia', 'ujier4.catamarca@gmail.com', 'Cynthia Natalia Cardoso', 'ujier', '31037802', '3834034998', NULL, '31037802', 1)
ON DUPLICATE KEY UPDATE nombre='Cynthia Natalia Cardoso', dni='31037802', telefono='3834034998', rol='ujier';

-- Sergio Fabian López (ujier)
INSERT INTO usuarios (id, email, nombre, rol, dni, telefono, foto, glide_id, activo) VALUES 
('u-012-sergio', 'ujier5.catamarca@gmail.com', 'Sergio Fabian López', 'ujier', '20924652', '3834034923', NULL, '20924652', 1)
ON DUPLICATE KEY UPDATE nombre='Sergio Fabian López', dni='20924652', telefono='3834034923', rol='ujier';

-- Rosana Chazarreta (ujier)
INSERT INTO usuarios (id, email, nombre, rol, dni, telefono, foto, glide_id, activo) VALUES 
('u-013-rosana', 'ujier6.catamarca@gmail.com', 'Rosana Chazarreta', 'ujier', '23561793', '3834034988', NULL, '23561793', 1)
ON DUPLICATE KEY UPDATE nombre='Rosana Chazarreta', dni='23561793', telefono='3834034988', rol='ujier';

-- Daniel Alberto Luna (ujier)
INSERT INTO usuarios (id, email, nombre, rol, dni, telefono, foto, glide_id, activo) VALUES 
('u-014-daniel', 'ujier7.catamarca@gmail.com', 'Daniel Alberto Luna', 'ujier', '20588005', '3834034958', NULL, '20588005', 1)
ON DUPLICATE KEY UPDATE nombre='Daniel Alberto Luna', dni='20588005', telefono='3834034958', rol='ujier';

-- Verónica Robert (ujier)
INSERT INTO usuarios (id, email, nombre, rol, dni, telefono, foto, glide_id, activo) VALUES 
('u-015-veronica', 'ujier8.catamarca@gmail.com', 'Verónica Robert', 'ujier', '20924125', '3834034926', NULL, '20924125', 1)
ON DUPLICATE KEY UPDATE nombre='Verónica Robert', dni='20924125', telefono='3834034926', rol='ujier';

-- Paula Acevedo (ujier)
INSERT INTO usuarios (id, email, nombre, rol, dni, telefono, foto, glide_id, activo) VALUES 
('u-016-paula', 'ujier9.catamarca@gmail.com', 'Paula Acevedo', 'ujier', '29651055', '3834035009', NULL, '29651055', 1)
ON DUPLICATE KEY UPDATE nombre='Paula Acevedo', dni='29651055', telefono='3834035009', rol='ujier';

-- Baltazar Diaz (ujier)
INSERT INTO usuarios (id, email, nombre, rol, dni, telefono, foto, glide_id, activo) VALUES 
('u-017-baltazar', 'ujier10.catamarca@gmail.com', 'Baltazar Diaz', 'ujier', '28885568', '3834035023', NULL, '28885568', 1)
ON DUPLICATE KEY UPDATE nombre='Baltazar Diaz', dni='28885568', telefono='3834035023', rol='ujier';

-- Gabriela Isabel Zurita (ujier)
INSERT INTO usuarios (id, email, nombre, rol, dni, telefono, foto, glide_id, activo) VALUES 
('u-018-gabriela', 'ujier11.catamarca@gmail.com', 'Gabriela Isabel Zurita', 'ujier', '18463380', '3834034983', NULL, '18463380', 1)
ON DUPLICATE KEY UPDATE nombre='Gabriela Isabel Zurita', dni='18463380', telefono='3834034983', rol='ujier';

-- Sonia Moreno Yunis (ujier) - Email 2
INSERT INTO usuarios (id, email, nombre, rol, dni, telefono, foto, glide_id, activo) VALUES 
('u-019-sonia-uj', 'ujier12.catamarca@gmail.com', 'Sonia Moreno Yunis', 'ujier', '25746855', '3834035031', NULL, NULL, 1)
ON DUPLICATE KEY UPDATE nombre='Sonia Moreno Yunis', telefono='3834035031', rol='ujier';

-- Nilda Rosario Tula (ujier)
INSERT INTO usuarios (id, email, nombre, rol, dni, telefono, foto, glide_id, activo) VALUES 
('u-020-nilda', 'ujier13.catamarca@gmail.com', 'Nilda Rosario Tula', 'ujier', '17763187', '3834035037', NULL, '17763187', 1)
ON DUPLICATE KEY UPDATE nombre='Nilda Rosario Tula', dni='17763187', telefono='3834035037', rol='ujier';

-- Carlos Osvaldo Rodriguez (ujier)
INSERT INTO usuarios (id, email, nombre, rol, dni, telefono, foto, glide_id, activo) VALUES 
('u-021-carlos-r', 'ujier14.catamarca@gmail.com', 'Carlos Osvaldo Rodriguez', 'ujier', '14239532', '3834034990', NULL, '14239532', 1)
ON DUPLICATE KEY UPDATE nombre='Carlos Osvaldo Rodriguez', dni='14239532', telefono='3834034990', rol='ujier';

-- Rubén Oscar Pérez (ujier)
INSERT INTO usuarios (id, email, nombre, rol, dni, telefono, foto, glide_id, activo) VALUES 
('u-022-ruben', 'ujier15.catamarca@gmail.com', 'Rubén Oscar Pérez', 'ujier', '18188326', '3834035022', NULL, '18188326', 1)
ON DUPLICATE KEY UPDATE nombre='Rubén Oscar Pérez', dni='18188326', telefono='3834035022', rol='ujier';

-- Guillermo Herrera (ujier)
INSERT INTO usuarios (id, email, nombre, rol, dni, telefono, foto, glide_id, activo) VALUES 
('u-023-guillermo', 'ujier16.catamarca@gmail.com', 'Guillermo Herrera', 'ujier', '28076539', '3834034899', 'https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/1hfcSKizDmCWbiikjxDb/pub/iUsIMv0Y1vrOzamhd2FQ.jpg', '28076539', 1)
ON DUPLICATE KEY UPDATE nombre='Guillermo Herrera', dni='28076539', telefono='3834034899', rol='ujier';

-- César Omar del Pino (ujier)
INSERT INTO usuarios (id, email, nombre, rol, dni, telefono, foto, glide_id, activo) VALUES 
('u-024-cesar', 'ujier17.catamarca@gmail.com', 'César Omar del Pino', 'ujier', '17529928', '3834034951', NULL, '17529928', 1)
ON DUPLICATE KEY UPDATE nombre='César Omar del Pino', dni='17529928', telefono='3834034951', rol='ujier';

-- Carlos Aragón (ujier)
INSERT INTO usuarios (id, email, nombre, rol, dni, telefono, foto, glide_id, activo) VALUES 
('u-025-carlos-a', 'ujier18.catamarca@gmail.com', 'Carlos Aragón', 'ujier', '21944001', '3834034956', 'https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/1hfcSKizDmCWbiikjxDb/pub/JN9CsX75lLsm1s3zPC2e.jpg', '21944001', 1)
ON DUPLICATE KEY UPDATE nombre='Carlos Aragón', dni='21944001', telefono='3834034956', rol='ujier';

-- María de los Angeles Saavedra (ujier)
INSERT INTO usuarios (id, email, nombre, rol, dni, telefono, foto, glide_id, activo) VALUES 
('u-026-maria', 'ujier19.catamarca@gmail.com', 'María de los Angeles Saavedra', 'ujier', '20924824', '3834034959', NULL, '20924824', 1)
ON DUPLICATE KEY UPDATE nombre='María de los Angeles Saavedra', dni='20924824', telefono='3834034959', rol='ujier';

-- Héctor Isola Navarro (ujier)
INSERT INTO usuarios (id, email, nombre, rol, dni, telefono, foto, glide_id, activo) VALUES 
('u-027-hector-i', 'ujier20.catamarca@gmail.com', 'Héctor Isola Navarro', 'ujier', '14058181', '3834035041', NULL, '14058181', 1)
ON DUPLICATE KEY UPDATE nombre='Héctor Isola Navarro', dni='14058181', telefono='3834035041', rol='ujier';

-- Cecilia Rodriguez (ujier)
INSERT INTO usuarios (id, email, nombre, rol, dni, telefono, foto, glide_id, activo) VALUES 
('u-028-cecilia', 'ujier21.catamarca@gmail.com', 'Cecilia Rodriguez', 'ujier', '31691073', '3834034955', NULL, '31691073', 1)
ON DUPLICATE KEY UPDATE nombre='Cecilia Rodriguez', dni='31691073', telefono='3834034955', rol='ujier';

-- Ujier sin nombre 22-25 (solo teléfono)
INSERT INTO usuarios (id, email, nombre, rol, dni, telefono, foto, glide_id, activo) VALUES 
('u-029-ujier22', 'ujier22.catamarca@gmail.com', 'Ujier 22', 'ujier', NULL, '3834035012', NULL, NULL, 1)
ON DUPLICATE KEY UPDATE telefono='3834035012';

INSERT INTO usuarios (id, email, nombre, rol, dni, telefono, foto, glide_id, activo) VALUES 
('u-030-ujier23', 'ujier23.catamarca@gmail.com', 'Ujier 23', 'ujier', NULL, '3834035015', NULL, NULL, 1)
ON DUPLICATE KEY UPDATE telefono='3834035015';

INSERT INTO usuarios (id, email, nombre, rol, dni, telefono, foto, glide_id, activo) VALUES 
('u-031-ujier24', 'ujier24.catamarca@gmail.com', 'Ujier 24', 'ujier', NULL, '3834034961', NULL, NULL, 1)
ON DUPLICATE KEY UPDATE telefono='3834034961';

INSERT INTO usuarios (id, email, nombre, rol, dni, telefono, foto, glide_id, activo) VALUES 
('u-032-ujier25', 'ujier25.catamarca@gmail.com', 'Ujier 25', 'ujier', NULL, '3834034979', NULL, NULL, 1)
ON DUPLICATE KEY UPDATE telefono='3834034979';

-- Julio Guillermo Sarquis (administrativo)
INSERT INTO usuarios (id, email, nombre, rol, dni, telefono, foto, glide_id, activo) VALUES 
('u-033-julio', 'perrinychangoo@gmail.com', 'Julio Guillermo Sarquis', 'administrativo', '28885759', NULL, NULL, '28885759', 1)
ON DUPLICATE KEY UPDATE nombre='Julio Guillermo Sarquis', dni='28885759', rol='administrativo';

-- Viviana Guerrero (admin)
INSERT INTO usuarios (id, email, nombre, rol, dni, telefono, foto, glide_id, activo) VALUES 
('u-034-viviana', 'vivigd84@hotmail.com', 'Viviana Guerrero', 'admin', NULL, NULL, NULL, NULL, 1)
ON DUPLICATE KEY UPDATE nombre='Viviana Guerrero', rol='admin';

-- Julio Sarquis 2 (administrativo)
INSERT INTO usuarios (id, email, nombre, rol, dni, telefono, foto, glide_id, activo) VALUES 
('u-035-julio2', 'perrinsx@gmail.com', 'Julio Sarquis', 'administrativo', '28885759', NULL, NULL, NULL, 1)
ON DUPLICATE KEY UPDATE nombre='Julio Sarquis', rol='administrativo';

-- ================================================
-- PASO 4: Verificar usuarios
-- ================================================
SELECT COUNT(*) as total_usuarios FROM usuarios;
SELECT rol, COUNT(*) as cantidad FROM usuarios GROUP BY rol;
SELECT id, nombre, email, dni, telefono, rol FROM usuarios ORDER BY rol, nombre;