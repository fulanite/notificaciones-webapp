-- ================================================
-- FIX: audit_log table schema
-- ================================================

-- Drop the table if it exists to recreate it correctly (since it's empty/not working anyway)
-- OR just alter it. Recreating is safer for column types.

DROP TABLE IF EXISTS audit_log;

CREATE TABLE audit_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    
    -- Quién (Usuario que ejecuta la acción)
    usuario_id VARCHAR(50), 
    usuario_nombre VARCHAR(255),
    usuario_rol VARCHAR(50),
    
    -- Qué (Acción realizada)
    accion VARCHAR(50) NOT NULL,
    -- Valores: 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 
    --          'EXPORT', 'GENERATE_REPORT', 'VIEW', 'ASSIGN', 'IMPORT', 'RESULT'
    
    entidad VARCHAR(100) NOT NULL,
    -- Valores: 'notificacion', 'usuario', 'planilla', 'reporte_mensual',
    --          'asignacion', 'configuracion', 'sesion', 'visita'
    
    entidad_id VARCHAR(255),
    -- ID del registro afectado (puede ser NULL para acciones generales)
    
    -- Detalles de la acción
    descripcion TEXT NOT NULL,
    
    datos_anteriores JSON,
    datos_nuevos JSON,
    metadatos JSON,
    
    -- Contexto técnico
    ip_address VARCHAR(45),
    user_agent TEXT,
    ruta VARCHAR(255),
    metodo VARCHAR(10),
    
    -- Clasificación
    severidad ENUM('info', 'warning', 'error', 'critical') DEFAULT 'info',
    resultado ENUM('exito', 'fallo') DEFAULT 'exito',
    mensaje_error TEXT,
    
    -- Timestamp
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Índices
    INDEX idx_usuario (usuario_id),
    INDEX idx_entidad (entidad, entidad_id),
    INDEX idx_accion (accion),
    INDEX idx_fecha (created_at),
    INDEX idx_severidad (severidad)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
