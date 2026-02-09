-- ================================================
-- TABLA: audit_log
-- Sistema de auditoría completo para SGND
-- ================================================

CREATE TABLE IF NOT EXISTS audit_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    
    -- Quién (Usuario que ejecuta la acción)
    usuario_id INT,
    usuario_nombre VARCHAR(255),
    usuario_rol VARCHAR(50),
    
    -- Qué (Acción realizada)
    accion VARCHAR(50) NOT NULL,
    -- Valores: 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 
    --          'EXPORT', 'GENERATE_REPORT', 'VIEW', 'ASSIGN', 'IMPORT'
    
    entidad VARCHAR(100) NOT NULL,
    -- Valores: 'notificacion', 'usuario', 'planilla', 'reporte_mensual',
    --          'asignacion', 'configuracion', 'sesion'
    
    entidad_id VARCHAR(255),
    -- ID del registro afectado (puede ser NULL para acciones generales)
    
    -- Detalles de la acción
    descripcion TEXT NOT NULL,
    -- Descripción legible: "Generó reporte mensual de Enero 2026"
    
    datos_anteriores JSON,
    -- Estado anterior del registro (para UPDATE/DELETE)
    
    datos_nuevos JSON,
    -- Estado nuevo del registro (para CREATE/UPDATE)
    
    metadatos JSON,
    -- Información adicional específica de la acción:
    -- Para reportes: {"tipo", "rango_fechas", "filtros", "registros_count", "formato", "tamaño_kb"}
    -- Para exportaciones: {"vista", "filtros", "registros_count", "formato"}
    -- Para asignaciones: {"ujier_anterior", "ujier_nuevo", "zona"}
    
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
    
    -- Índices para búsquedas rápidas
    INDEX idx_usuario (usuario_id),
    INDEX idx_entidad (entidad, entidad_id),
    INDEX idx_accion (accion),
    INDEX idx_fecha (created_at),
    INDEX idx_severidad (severidad),
    INDEX idx_usuario_fecha (usuario_id, created_at),
    INDEX idx_entidad_fecha (entidad, created_at),
    
    -- Índice de texto completo para búsqueda en descripción
    FULLTEXT INDEX idx_descripcion (descripcion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
