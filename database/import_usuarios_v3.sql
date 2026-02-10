-- SGND Usuarios (Deterministic V3)
SET FOREIGN_KEY_CHECKS = 0;

INSERT INTO usuarios (id, glide_id, dni, email, nombre, rol, foto, activo) 
            VALUES ('3643574', NULL, '3643574', 'modernizacion@fraymunicipalidad.gob.ar', 'Mateo Quiroga', 'admin', 'https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/fCtwpCHQKelx7T3y5tyR/pub/s4OMkioEmnubpMjQlDyw.jpg', 1)
            ON DUPLICATE KEY UPDATE 
                dni=VALUES(dni), email=VALUES(email), nombre=VALUES(nombre), rol=VALUES(rol), foto=VALUES(foto);
INSERT INTO usuarios (id, glide_id, dni, email, nombre, rol, foto, activo) 
            VALUES ('37643574', NULL, '37643574', 'matexcardozo@gmail.com', 'Sofia Alvarez', 'ujier', 'https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/fCtwpCHQKelx7T3y5tyR/pub/XmCoWskxBOAQz6cuzHho.png', 1)
            ON DUPLICATE KEY UPDATE 
                dni=VALUES(dni), email=VALUES(email), nombre=VALUES(nombre), rol=VALUES(rol), foto=VALUES(foto);
INSERT INTO usuarios (id, glide_id, dni, email, nombre, rol, foto, activo) 
            VALUES ('34716928', NULL, '34716928', 'ibanezmariangel@gmail.com', 'Mariangel Ibañez', 'admin', 'https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/fCtwpCHQKelx7T3y5tyR/pub/4TydZFozCwiGJ0KgBpXY.jpeg', 1)
            ON DUPLICATE KEY UPDATE 
                dni=VALUES(dni), email=VALUES(email), nombre=VALUES(nombre), rol=VALUES(rol), foto=VALUES(foto);
INSERT INTO usuarios (id, glide_id, dni, email, nombre, rol, foto, activo) 
            VALUES ('24362587', NULL, '24362587', 'adrianafurlan38@gmail.com', 'Adriana Esther Furlan', 'admin', 'https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/fCtwpCHQKelx7T3y5tyR/pub/liuSQUQDYtVV9tHDuVVW.jpeg', 1)
            ON DUPLICATE KEY UPDATE 
                dni=VALUES(dni), email=VALUES(email), nombre=VALUES(nombre), rol=VALUES(rol), foto=VALUES(foto);
INSERT INTO usuarios (id, glide_id, dni, email, nombre, rol, foto, activo) 
            VALUES ('37641984', NULL, '37641984', 'agos.alive1203@gmail.com', 'Agostina del Huerto Alive', 'admin', '', 1)
            ON DUPLICATE KEY UPDATE 
                dni=VALUES(dni), email=VALUES(email), nombre=VALUES(nombre), rol=VALUES(rol), foto=VALUES(foto);
INSERT INTO usuarios (id, glide_id, dni, email, nombre, rol, foto, activo) 
            VALUES ('24309864', NULL, '24309864', 'HECTORJOSEFERNANDOVARELA@gmail.com', 'Hector Jose Fernando Varela', 'admin', 'https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/fCtwpCHQKelx7T3y5tyR/pub/Bwyy7YuW3SJqG6AfoR3m.jpeg', 1)
            ON DUPLICATE KEY UPDATE 
                dni=VALUES(dni), email=VALUES(email), nombre=VALUES(nombre), rol=VALUES(rol), foto=VALUES(foto);
INSERT INTO usuarios (id, glide_id, dni, email, nombre, rol, foto, activo) 
            VALUES ('25746855', NULL, '25746855', 'soniaaries2012@gmail.com', 'Sonia Moreno Yunis', 'admin', '', 1)
            ON DUPLICATE KEY UPDATE 
                dni=VALUES(dni), email=VALUES(email), nombre=VALUES(nombre), rol=VALUES(rol), foto=VALUES(foto);
INSERT INTO usuarios (id, glide_id, dni, email, nombre, rol, foto, activo) 
            VALUES ('23355971', NULL, '23355971', 'ujier1.catamarca@gmail.com', 'Nicolas Emiliano Romero', 'ujier', 'https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/1hfcSKizDmCWbiikjxDb/pub/eJoyoJwt0uwwJaIilnHG.jpg', 1)
            ON DUPLICATE KEY UPDATE 
                dni=VALUES(dni), email=VALUES(email), nombre=VALUES(nombre), rol=VALUES(rol), foto=VALUES(foto);
INSERT INTO usuarios (id, glide_id, dni, email, nombre, rol, foto, activo) 
            VALUES ('27496338', NULL, '27496338', 'ujier2.catamarca@gmail.com', 'Lorena Alicia Manfredi', 'ujier', '', 1)
            ON DUPLICATE KEY UPDATE 
                dni=VALUES(dni), email=VALUES(email), nombre=VALUES(nombre), rol=VALUES(rol), foto=VALUES(foto);
INSERT INTO usuarios (id, glide_id, dni, email, nombre, rol, foto, activo) 
            VALUES ('21325608', NULL, '21325608', 'ujier3.catamarca@gmail.com', 'Adriana Matilde Elizalde', 'ujier', 'https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/1hfcSKizDmCWbiikjxDb/pub/Znzospkyhsq7EBGZ1AWh.jpg', 1)
            ON DUPLICATE KEY UPDATE 
                dni=VALUES(dni), email=VALUES(email), nombre=VALUES(nombre), rol=VALUES(rol), foto=VALUES(foto);
INSERT INTO usuarios (id, glide_id, dni, email, nombre, rol, foto, activo) 
            VALUES ('31037802', NULL, '31037802', 'ujier4.catamarca@gmail.com', 'Cynthia Natalia Cardoso', 'ujier', '', 1)
            ON DUPLICATE KEY UPDATE 
                dni=VALUES(dni), email=VALUES(email), nombre=VALUES(nombre), rol=VALUES(rol), foto=VALUES(foto);
INSERT INTO usuarios (id, glide_id, dni, email, nombre, rol, foto, activo) 
            VALUES ('20924652', NULL, '20924652', 'ujier5.catamarca@gmail.com', 'Sergio Fabian López', 'ujier', '', 1)
            ON DUPLICATE KEY UPDATE 
                dni=VALUES(dni), email=VALUES(email), nombre=VALUES(nombre), rol=VALUES(rol), foto=VALUES(foto);
INSERT INTO usuarios (id, glide_id, dni, email, nombre, rol, foto, activo) 
            VALUES ('23561793', NULL, '23561793', 'ujier6.catamarca@gmail.com', 'Rosana Chazarreta', 'ujier', '', 1)
            ON DUPLICATE KEY UPDATE 
                dni=VALUES(dni), email=VALUES(email), nombre=VALUES(nombre), rol=VALUES(rol), foto=VALUES(foto);
INSERT INTO usuarios (id, glide_id, dni, email, nombre, rol, foto, activo) 
            VALUES ('20588005', NULL, '20588005', 'ujier7.catamarca@gmail.com', 'Daniel Alberto Luna', 'ujier', '', 1)
            ON DUPLICATE KEY UPDATE 
                dni=VALUES(dni), email=VALUES(email), nombre=VALUES(nombre), rol=VALUES(rol), foto=VALUES(foto);
INSERT INTO usuarios (id, glide_id, dni, email, nombre, rol, foto, activo) 
            VALUES ('20924125', NULL, '20924125', 'ujier8.catamarca@gmail.com', 'Verónica Robert', 'ujier', '', 1)
            ON DUPLICATE KEY UPDATE 
                dni=VALUES(dni), email=VALUES(email), nombre=VALUES(nombre), rol=VALUES(rol), foto=VALUES(foto);
INSERT INTO usuarios (id, glide_id, dni, email, nombre, rol, foto, activo) 
            VALUES ('29651055', NULL, '29651055', 'ujier9.catamarca@gmail.com', 'Paula Acevedo', 'ujier', '', 1)
            ON DUPLICATE KEY UPDATE 
                dni=VALUES(dni), email=VALUES(email), nombre=VALUES(nombre), rol=VALUES(rol), foto=VALUES(foto);
INSERT INTO usuarios (id, glide_id, dni, email, nombre, rol, foto, activo) 
            VALUES ('28885568', NULL, '28885568', 'ujier10.catamarca@gmail.com', 'Baltazar Diaz', 'ujier', '', 1)
            ON DUPLICATE KEY UPDATE 
                dni=VALUES(dni), email=VALUES(email), nombre=VALUES(nombre), rol=VALUES(rol), foto=VALUES(foto);
INSERT INTO usuarios (id, glide_id, dni, email, nombre, rol, foto, activo) 
            VALUES ('18463380', NULL, '18463380', 'ujier11.catamarca@gmail.com', 'Gabriela Isabel Zurita', 'ujier', '', 1)
            ON DUPLICATE KEY UPDATE 
                dni=VALUES(dni), email=VALUES(email), nombre=VALUES(nombre), rol=VALUES(rol), foto=VALUES(foto);
INSERT INTO usuarios (id, glide_id, dni, email, nombre, rol, foto, activo) 
            VALUES ('25746855', NULL, '25746855', 'ujier12.catamarca@gmail.com', 'Sonia Moreno Yunis', 'ujier', '', 1)
            ON DUPLICATE KEY UPDATE 
                dni=VALUES(dni), email=VALUES(email), nombre=VALUES(nombre), rol=VALUES(rol), foto=VALUES(foto);
INSERT INTO usuarios (id, glide_id, dni, email, nombre, rol, foto, activo) 
            VALUES ('17763187', NULL, '17763187', 'ujier13.catamarca@gmail.com', 'Nilda Rosario Tula', 'ujier', '', 1)
            ON DUPLICATE KEY UPDATE 
                dni=VALUES(dni), email=VALUES(email), nombre=VALUES(nombre), rol=VALUES(rol), foto=VALUES(foto);
INSERT INTO usuarios (id, glide_id, dni, email, nombre, rol, foto, activo) 
            VALUES ('14239532', NULL, '14239532', 'ujier14.catamarca@gmail.com', 'Carlos Osvaldo Rodriguez', 'ujier', '', 1)
            ON DUPLICATE KEY UPDATE 
                dni=VALUES(dni), email=VALUES(email), nombre=VALUES(nombre), rol=VALUES(rol), foto=VALUES(foto);
INSERT INTO usuarios (id, glide_id, dni, email, nombre, rol, foto, activo) 
            VALUES ('18188326', NULL, '18188326', 'ujier15.catamarca@gmail.com', 'Rubén Oscar Pérez', 'ujier', '', 1)
            ON DUPLICATE KEY UPDATE 
                dni=VALUES(dni), email=VALUES(email), nombre=VALUES(nombre), rol=VALUES(rol), foto=VALUES(foto);
INSERT INTO usuarios (id, glide_id, dni, email, nombre, rol, foto, activo) 
            VALUES ('28076539', NULL, '28076539', 'ujier16.catamarca@gmail.com', 'Guillermo Herrera', 'ujier', 'https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/1hfcSKizDmCWbiikjxDb/pub/iUsIMv0Y1vrOzamhd2FQ.jpg', 1)
            ON DUPLICATE KEY UPDATE 
                dni=VALUES(dni), email=VALUES(email), nombre=VALUES(nombre), rol=VALUES(rol), foto=VALUES(foto);
INSERT INTO usuarios (id, glide_id, dni, email, nombre, rol, foto, activo) 
            VALUES ('17529928', NULL, '17529928', 'ujier17.catamarca@gmail.com', 'César Omar del Pino', 'ujier', '', 1)
            ON DUPLICATE KEY UPDATE 
                dni=VALUES(dni), email=VALUES(email), nombre=VALUES(nombre), rol=VALUES(rol), foto=VALUES(foto);
INSERT INTO usuarios (id, glide_id, dni, email, nombre, rol, foto, activo) 
            VALUES ('21944001', NULL, '21944001', 'ujier18.catamarca@gmail.com', 'Carlos Aragón', 'ujier', 'https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/1hfcSKizDmCWbiikjxDb/pub/JN9CsX75lLsm1s3zPC2e.jpg', 1)
            ON DUPLICATE KEY UPDATE 
                dni=VALUES(dni), email=VALUES(email), nombre=VALUES(nombre), rol=VALUES(rol), foto=VALUES(foto);
INSERT INTO usuarios (id, glide_id, dni, email, nombre, rol, foto, activo) 
            VALUES ('20924824', NULL, '20924824', 'ujier19.catamarca@gmail.com', 'María de los Angeles Saavedra', 'ujier', '', 1)
            ON DUPLICATE KEY UPDATE 
                dni=VALUES(dni), email=VALUES(email), nombre=VALUES(nombre), rol=VALUES(rol), foto=VALUES(foto);
INSERT INTO usuarios (id, glide_id, dni, email, nombre, rol, foto, activo) 
            VALUES ('14058181', NULL, '14058181', 'ujier20.catamarca@gmail.com', 'Héctor Isola Navarro', 'ujier', '', 1)
            ON DUPLICATE KEY UPDATE 
                dni=VALUES(dni), email=VALUES(email), nombre=VALUES(nombre), rol=VALUES(rol), foto=VALUES(foto);
INSERT INTO usuarios (id, glide_id, dni, email, nombre, rol, foto, activo) 
            VALUES ('31691073', NULL, '31691073', 'ujier21.catamarca@gmail.com', 'Cecilia Rodriguez', 'ujier', '', 1)
            ON DUPLICATE KEY UPDATE 
                dni=VALUES(dni), email=VALUES(email), nombre=VALUES(nombre), rol=VALUES(rol), foto=VALUES(foto);
INSERT INTO usuarios (id, glide_id, dni, email, nombre, rol, foto, activo) 
            VALUES ('6a79592c-2163-53e4-9d59-b3d84d0a0f55', NULL, NULL, 'ujier22.catamarca@gmail.com', '', 'ujier', '', 1)
            ON DUPLICATE KEY UPDATE 
                dni=VALUES(dni), email=VALUES(email), nombre=VALUES(nombre), rol=VALUES(rol), foto=VALUES(foto);
INSERT INTO usuarios (id, glide_id, dni, email, nombre, rol, foto, activo) 
            VALUES ('2e2c39c5-9d57-55ac-98c1-0acd712d7b5f', NULL, NULL, 'ujier23.catamarca@gmail.com', '', 'ujier', '', 1)
            ON DUPLICATE KEY UPDATE 
                dni=VALUES(dni), email=VALUES(email), nombre=VALUES(nombre), rol=VALUES(rol), foto=VALUES(foto);
INSERT INTO usuarios (id, glide_id, dni, email, nombre, rol, foto, activo) 
            VALUES ('6662a1af-b7ff-5061-9102-3b4f46a2a478', NULL, NULL, 'ujier24.catamarca@gmail.com', '', 'ujier', '', 1)
            ON DUPLICATE KEY UPDATE 
                dni=VALUES(dni), email=VALUES(email), nombre=VALUES(nombre), rol=VALUES(rol), foto=VALUES(foto);
INSERT INTO usuarios (id, glide_id, dni, email, nombre, rol, foto, activo) 
            VALUES ('a965ad1c-6511-5922-9a6c-8de24f20bd90', NULL, NULL, 'ujier25.catamarca@gmail.com', '', 'ujier', '', 1)
            ON DUPLICATE KEY UPDATE 
                dni=VALUES(dni), email=VALUES(email), nombre=VALUES(nombre), rol=VALUES(rol), foto=VALUES(foto);
INSERT INTO usuarios (id, glide_id, dni, email, nombre, rol, foto, activo) 
            VALUES ('28885759', NULL, '28885759', 'perrinychangoo@gmail.com', 'Julio Guillermo Sarquis', 'admin', '', 1)
            ON DUPLICATE KEY UPDATE 
                dni=VALUES(dni), email=VALUES(email), nombre=VALUES(nombre), rol=VALUES(rol), foto=VALUES(foto);
INSERT INTO usuarios (id, glide_id, dni, email, nombre, rol, foto, activo) 
            VALUES ('0b2eb348-3eba-51dc-9bb6-007f9cac6fdb', NULL, NULL, 'vivigd84@hotmail.com', 'Viviana Guerrero', 'admin', '', 1)
            ON DUPLICATE KEY UPDATE 
                dni=VALUES(dni), email=VALUES(email), nombre=VALUES(nombre), rol=VALUES(rol), foto=VALUES(foto);
INSERT INTO usuarios (id, glide_id, dni, email, nombre, rol, foto, activo) 
            VALUES ('28885759', NULL, '28885759', 'perrinsx@gmail.com', 'julio sarquis 2', 'admin', '', 1)
            ON DUPLICATE KEY UPDATE 
                dni=VALUES(dni), email=VALUES(email), nombre=VALUES(nombre), rol=VALUES(rol), foto=VALUES(foto);
SET FOREIGN_KEY_CHECKS = 1;