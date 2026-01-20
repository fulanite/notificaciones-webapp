-- ================================================
-- SGND - MySQL Database Schema
-- Sistema de Gestión de Notificaciones Digitales
-- Adapted for Hostinger MySQL/MariaDB
-- ================================================

-- ================================================
-- TABLA: usuarios
-- ================================================
CREATE TABLE IF NOT EXISTS usuarios (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    rol ENUM('admin', 'administrativo', 'ujier', 'auditor') NOT NULL,
    foto TEXT,
    activo TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Índices para usuarios
CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_usuarios_rol ON usuarios(rol);

-- ================================================
-- TABLA: notificaciones
-- ================================================
CREATE TABLE IF NOT EXISTS notificaciones (
    id VARCHAR(36) PRIMARY KEY,
    
    -- Datos de carga inicial
    fecha_carga DATETIME DEFAULT CURRENT_TIMESTAMP,
    usuario_carga VARCHAR(255),
    estado ENUM('pendiente', 'diligenciada', 'diferida') DEFAULT 'pendiente',
    
    -- Tipo y expediente
    tipo_notificacion VARCHAR(100) NOT NULL,
    n_expediente VARCHAR(100) NOT NULL,
    caratula TEXT NOT NULL,
    origen VARCHAR(255) NOT NULL,
    letrado VARCHAR(255),
    
    -- Destinatario
    destinatario_especial ENUM('estrados', 'arcat') DEFAULT NULL,
    destinatario_nombre VARCHAR(255) NOT NULL,
    domicilio TEXT NOT NULL,
    zona VARCHAR(50) NOT NULL,
    
    -- Troquel y pago
    tipo_troquel CHAR(1),
    sin_troquel TINYINT(1) DEFAULT 0,
    n_troquel INT,
    medio_pago ENUM('gratuito', 'efectivo', 'transferencia', 'qr') DEFAULT NULL,
    costo DECIMAL(10, 2) DEFAULT 0,
    
    -- Asignación
    asignado_a VARCHAR(36),
    fecha_asignacion DATETIME,
    asignado_por VARCHAR(36),
    
    -- Observaciones iniciales
    observaciones_iniciales TEXT,
    
    -- Campos de resultado
    resultado_diligencia ENUM('atiende', 'no_atiende', 'pre_aviso', 'estrados', 'domicilio_inexistente', 'diligenciador_ausente') DEFAULT NULL,
    fecha_diligencia DATETIME,
    diligenciado_por VARCHAR(36),
    
    -- Ubicación GPS
    ubicacion_lat DECIMAL(10, 8),
    ubicacion_lng DECIMAL(11, 8),
    
    -- Evidencia
    evidencia_foto TEXT,
    observacion_audio TEXT,
    transcripcion_audio TEXT,
    observaciones_resultado TEXT,
    
    -- Carga diferida
    es_carga_diferida TINYINT(1) DEFAULT 0,
    motivo_falla_senal VARCHAR(100),
    
    -- Auditoría
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(36),
    
    -- Foreign Keys
    FOREIGN KEY (asignado_a) REFERENCES usuarios(id) ON DELETE SET NULL,
    FOREIGN KEY (asignado_por) REFERENCES usuarios(id) ON DELETE SET NULL,
    FOREIGN KEY (diligenciado_por) REFERENCES usuarios(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Índices para notificaciones
CREATE INDEX idx_notificaciones_estado ON notificaciones(estado);
CREATE INDEX idx_notificaciones_asignado ON notificaciones(asignado_a);
CREATE INDEX idx_notificaciones_fecha_carga ON notificaciones(fecha_carga);
CREATE INDEX idx_notificaciones_tipo ON notificaciones(tipo_notificacion);
CREATE INDEX idx_notificaciones_expediente ON notificaciones(n_expediente);

-- ================================================
-- TABLA: visitas
-- Historial de visitas/intentos por notificación
-- ================================================
CREATE TABLE IF NOT EXISTS visitas (
    id VARCHAR(36) PRIMARY KEY,
    notificacion_id VARCHAR(36) NOT NULL,
    ujier_id VARCHAR(36),
    resultado VARCHAR(50),
    observaciones TEXT,
    ubicacion_lat DECIMAL(10, 8),
    ubicacion_lng DECIMAL(11, 8),
    foto_url TEXT,
    audio_url TEXT,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (notificacion_id) REFERENCES notificaciones(id) ON DELETE CASCADE,
    FOREIGN KEY (ujier_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_visitas_notificacion ON visitas(notificacion_id);
CREATE INDEX idx_visitas_ujier ON visitas(ujier_id);
CREATE INDEX idx_visitas_fecha ON visitas(fecha);

-- ================================================
-- TABLA: audit_log
-- ================================================
CREATE TABLE IF NOT EXISTS audit_log (
    id VARCHAR(36) PRIMARY KEY,
    tabla VARCHAR(100) NOT NULL,
    registro_id VARCHAR(36) NOT NULL,
    accion ENUM('INSERT', 'UPDATE', 'DELETE') NOT NULL,
    datos_anteriores JSON,
    datos_nuevos JSON,
    usuario_id VARCHAR(36),
    ip_address VARCHAR(45),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_audit_log_tabla ON audit_log(tabla);
CREATE INDEX idx_audit_log_registro ON audit_log(registro_id);
CREATE INDEX idx_audit_log_fecha ON audit_log(created_at);

-- ================================================
-- DATOS INICIALES DE PRUEBA
-- ================================================
INSERT INTO usuarios (id, email, nombre, rol) VALUES
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'admin@sgnd.gob.ar', 'Administrador del Sistema', 'admin'),
    ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'administrativo@sgnd.gob.ar', 'María García', 'administrativo'),
    ('c3d4e5f6-a7b8-9012-cdef-012345678902', 'ujier1@sgnd.gob.ar', 'Juan Pérez', 'ujier'),
    ('d4e5f6a7-b8c9-0123-def0-123456789013', 'ujier2@sgnd.gob.ar', 'Carlos López', 'ujier'),
    ('e5f6a7b8-c9d0-1234-ef01-234567890124', 'auditor@sgnd.gob.ar', 'Ana Martínez', 'auditor')
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

-- Notificaciones de ejemplo
INSERT INTO notificaciones (
    id, tipo_notificacion, n_expediente, caratula, origen, 
    destinatario_nombre, domicilio, zona, 
    tipo_troquel, n_troquel, medio_pago, usuario_carga
) VALUES
    ('11111111-1111-1111-1111-111111111111', 'cedulas', '12345/2024', 'González c/ Rodríguez s/ Cobro de pesos', 'Juzgado Civil N°1', 
     'Roberto González', 'Av. Güemes 450, Capital', 'centro', 
     'C', 1001, 'efectivo', 'administrativo@sgnd.gob.ar'),
    ('22222222-2222-2222-2222-222222222222', 'mandamientos', '23456/2024', 'Banco Nación c/ Fernández s/ Ejecución', 'Juzgado Comercial N°2', 
     'María Fernández', 'Esquiú 1234, Barrio Sur', 'sur', 
     'M', 2001, 'transferencia', 'administrativo@sgnd.gob.ar'),
    ('33333333-3333-3333-3333-333333333333', 'cedulas_urgente_norte', '34567/2024', 'Sánchez c/ Municipalidad s/ Amparo', 'Juzgado Contencioso', 
     'Pedro Sánchez', 'Av. Ocampo 890, Valle Viejo', 'norte', 
     'C', 1002, 'gratuito', 'administrativo@sgnd.gob.ar')
ON DUPLICATE KEY UPDATE caratula = VALUES(caratula);

-- ================================================
-- VISTA: Notificaciones completas
-- ================================================
CREATE OR REPLACE VIEW v_notificaciones_completas AS
SELECT 
    n.*,
    u.nombre AS ujier_nombre,
    u.email AS ujier_email
FROM notificaciones n
LEFT JOIN usuarios u ON n.asignado_a = u.id;

-- ================================================
-- VISTA: Estadísticas por ujier
-- ================================================
CREATE OR REPLACE VIEW v_estadisticas_ujier AS
SELECT 
    u.id AS ujier_id,
    u.nombre AS ujier_nombre,
    COUNT(n.id) AS total_asignadas,
    SUM(CASE WHEN n.estado = 'diligenciada' THEN 1 ELSE 0 END) AS completadas,
    SUM(CASE WHEN n.estado = 'pendiente' THEN 1 ELSE 0 END) AS pendientes,
    SUM(CASE WHEN n.estado = 'diferida' THEN 1 ELSE 0 END) AS diferidas,
    ROUND(
        SUM(CASE WHEN n.estado = 'diligenciada' THEN 1 ELSE 0 END) * 100.0 / 
        NULLIF(COUNT(n.id), 0), 
        2
    ) AS porcentaje_completado
FROM usuarios u
LEFT JOIN notificaciones n ON u.id = n.asignado_a
WHERE u.rol = 'ujier'
GROUP BY u.id, u.nombre;
