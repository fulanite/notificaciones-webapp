-- ================================================
-- SGND - Supabase Database Schema
-- Sistema de Gestión de Notificaciones Digitales
-- Provincia de Catamarca
-- ================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================
-- TABLA: usuarios
-- Almacena los usuarios del sistema con sus roles
-- ================================================
CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    rol VARCHAR(50) NOT NULL CHECK (rol IN ('admin', 'administrativo', 'ujier', 'auditor')),
    foto TEXT,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para usuarios
CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_usuarios_rol ON usuarios(rol);

-- ================================================
-- TABLA: notificaciones
-- Registro principal de cédulas y mandamientos
-- ================================================
CREATE TABLE IF NOT EXISTS notificaciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Datos de carga inicial (Art. 3 inc a)
    fecha_carga TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    usuario_carga VARCHAR(255),
    estado VARCHAR(50) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'diligenciada', 'diferida')),
    
    -- Tipo y expediente
    tipo_notificacion VARCHAR(100) NOT NULL,
    n_expediente VARCHAR(100) NOT NULL,
    caratula TEXT NOT NULL,
    origen VARCHAR(255) NOT NULL,
    letrado VARCHAR(255),
    
    -- Destinatario
    destinatario_especial VARCHAR(50) CHECK (destinatario_especial IN ('estrados', 'arcat', NULL)),
    destinatario_nombre VARCHAR(255) NOT NULL,
    domicilio TEXT NOT NULL,
    zona VARCHAR(50) NOT NULL,
    
    -- Troquel y pago
    tipo_troquel CHAR(1) CHECK (tipo_troquel IN ('C', 'M')),
    sin_troquel BOOLEAN DEFAULT false,
    n_troquel INTEGER,
    medio_pago VARCHAR(50) CHECK (medio_pago IN ('gratuito', 'efectivo', 'transferencia', 'qr')),
    costo DECIMAL(10, 2) DEFAULT 0,
    
    -- Asignación
    asignado_a UUID REFERENCES usuarios(id),
    fecha_asignacion TIMESTAMP WITH TIME ZONE,
    asignado_por UUID REFERENCES usuarios(id),
    
    -- Observaciones iniciales
    observaciones_iniciales TEXT,
    
    -- Campos de resultado (completados por el Ujier)
    resultado_diligencia VARCHAR(50) CHECK (resultado_diligencia IN (
        'atiende', 'no_atiende', 'pre_aviso', 'estrados', 
        'domicilio_inexistente', 'diligenciador_ausente'
    )),
    fecha_diligencia TIMESTAMP WITH TIME ZONE,
    diligenciado_por UUID REFERENCES usuarios(id),
    
    -- Ubicación GPS
    ubicacion_lat DECIMAL(10, 8),
    ubicacion_lng DECIMAL(11, 8),
    
    -- Evidencia
    evidencia_foto TEXT,
    observacion_audio TEXT,
    transcripcion_audio TEXT,
    observaciones_resultado TEXT,
    
    -- Carga diferida
    es_carga_diferida BOOLEAN DEFAULT false,
    motivo_falla_senal VARCHAR(100),
    
    -- Auditoría
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES usuarios(id)
);

-- Índices para notificaciones
CREATE INDEX idx_notificaciones_estado ON notificaciones(estado);
CREATE INDEX idx_notificaciones_asignado ON notificaciones(asignado_a);
CREATE INDEX idx_notificaciones_fecha_carga ON notificaciones(fecha_carga);
CREATE INDEX idx_notificaciones_tipo ON notificaciones(tipo_notificacion);
CREATE INDEX idx_notificaciones_expediente ON notificaciones(n_expediente);
CREATE INDEX idx_notificaciones_diferida ON notificaciones(es_carga_diferida) WHERE es_carga_diferida = true;

-- ================================================
-- TABLA: audit_log
-- Registro de auditoría para todas las operaciones
-- ================================================
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tabla VARCHAR(100) NOT NULL,
    registro_id UUID NOT NULL,
    accion VARCHAR(50) NOT NULL CHECK (accion IN ('INSERT', 'UPDATE', 'DELETE')),
    datos_anteriores JSONB,
    datos_nuevos JSONB,
    usuario_id UUID REFERENCES usuarios(id),
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para audit_log
CREATE INDEX idx_audit_log_tabla ON audit_log(tabla);
CREATE INDEX idx_audit_log_registro ON audit_log(registro_id);
CREATE INDEX idx_audit_log_fecha ON audit_log(created_at);

-- ================================================
-- FUNCIONES Y TRIGGERS
-- ================================================

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para usuarios
CREATE TRIGGER trigger_usuarios_updated_at
    BEFORE UPDATE ON usuarios
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Trigger para notificaciones
CREATE TRIGGER trigger_notificaciones_updated_at
    BEFORE UPDATE ON notificaciones
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Función para registro de auditoría
CREATE OR REPLACE FUNCTION log_audit()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (tabla, registro_id, accion, datos_nuevos)
        VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (tabla, registro_id, accion, datos_anteriores, datos_nuevos, usuario_id)
        VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), NEW.updated_by);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (tabla, registro_id, accion, datos_anteriores)
        VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD));
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger de auditoría para notificaciones
CREATE TRIGGER trigger_notificaciones_audit
    AFTER INSERT OR UPDATE OR DELETE ON notificaciones
    FOR EACH ROW
    EXECUTE FUNCTION log_audit();

-- ================================================
-- ROW LEVEL SECURITY (RLS)
-- ================================================

-- Habilitar RLS
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Políticas para usuarios
CREATE POLICY "Usuarios pueden ver todos los usuarios"
    ON usuarios FOR SELECT
    USING (true);

CREATE POLICY "Solo admins pueden insertar usuarios"
    ON usuarios FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE email = auth.jwt() ->> 'email' 
            AND rol = 'admin'
        )
    );

CREATE POLICY "Solo admins pueden actualizar usuarios"
    ON usuarios FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE email = auth.jwt() ->> 'email' 
            AND rol = 'admin'
        )
    );

-- Políticas para notificaciones
CREATE POLICY "Usuarios autenticados pueden ver notificaciones"
    ON notificaciones FOR SELECT
    USING (true);

CREATE POLICY "Admins y administrativos pueden insertar notificaciones"
    ON notificaciones FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE email = auth.jwt() ->> 'email' 
            AND rol IN ('admin', 'administrativo')
        )
    );

CREATE POLICY "Usuarios pueden actualizar notificaciones asignadas"
    ON notificaciones FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE email = auth.jwt() ->> 'email' 
            AND (
                rol IN ('admin', 'administrativo') 
                OR (rol = 'ujier' AND id = notificaciones.asignado_a)
            )
        )
    );

-- Políticas para audit_log (solo lectura para auditores)
CREATE POLICY "Auditores pueden ver audit_log"
    ON audit_log FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE email = auth.jwt() ->> 'email' 
            AND rol IN ('admin', 'auditor')
        )
    );

-- ================================================
-- STORAGE BUCKET
-- ================================================
-- Ejecutar en Supabase Storage (UI o API):
-- 1. Crear bucket 'sgnd-files' con acceso público
-- 2. Crear carpetas: 'evidencias', 'audios'

-- ================================================
-- DATOS INICIALES DE PRUEBA
-- ================================================

-- Usuario administrador de prueba
INSERT INTO usuarios (email, nombre, rol) VALUES
    ('admin@sgnd.gob.ar', 'Administrador del Sistema', 'admin'),
    ('administrativo@sgnd.gob.ar', 'María García', 'administrativo'),
    ('ujier1@sgnd.gob.ar', 'Juan Pérez', 'ujier'),
    ('ujier2@sgnd.gob.ar', 'Carlos López', 'ujier'),
    ('auditor@sgnd.gob.ar', 'Ana Martínez', 'auditor')
ON CONFLICT (email) DO NOTHING;

-- Notificaciones de ejemplo
INSERT INTO notificaciones (
    tipo_notificacion, n_expediente, caratula, origen, 
    destinatario_nombre, domicilio, zona, 
    tipo_troquel, n_troquel, medio_pago,
    usuario_carga
) VALUES
    ('cedulas', '12345/2024', 'González c/ Rodríguez s/ Cobro de pesos', 'Juzgado Civil N°1', 
     'Roberto González', 'Av. Güemes 450, Capital', 'centro', 
     'C', 1001, 'efectivo', 'administrativo@sgnd.gob.ar'),
    ('mandamientos', '23456/2024', 'Banco Nación c/ Fernández s/ Ejecución', 'Juzgado Comercial N°2', 
     'María Fernández', 'Esquiú 1234, Barrio Sur', 'sur', 
     'M', 2001, 'transferencia', 'administrativo@sgnd.gob.ar'),
    ('cedulas_urgente_norte', '34567/2024', 'Sánchez c/ Municipalidad s/ Amparo', 'Juzgado Contencioso', 
     'Pedro Sánchez', 'Av. Ocampo 890, Valle Viejo', 'norte', 
     'C', 1002, 'gratuito', 'administrativo@sgnd.gob.ar')
ON CONFLICT DO NOTHING;

-- ================================================
-- VISTAS ÚTILES
-- ================================================

-- Vista de notificaciones con información de usuario
CREATE OR REPLACE VIEW v_notificaciones_completas AS
SELECT 
    n.*,
    u.nombre AS ujier_nombre,
    u.email AS ujier_email
FROM notificaciones n
LEFT JOIN usuarios u ON n.asignado_a = u.id;

-- Vista de estadísticas por ujier
CREATE OR REPLACE VIEW v_estadisticas_ujier AS
SELECT 
    u.id AS ujier_id,
    u.nombre AS ujier_nombre,
    COUNT(n.id) AS total_asignadas,
    COUNT(CASE WHEN n.estado = 'diligenciada' THEN 1 END) AS completadas,
    COUNT(CASE WHEN n.estado = 'pendiente' THEN 1 END) AS pendientes,
    COUNT(CASE WHEN n.estado = 'diferida' THEN 1 END) AS diferidas,
    ROUND(
        COUNT(CASE WHEN n.estado = 'diligenciada' THEN 1 END)::numeric / 
        NULLIF(COUNT(n.id), 0) * 100, 
        2
    ) AS porcentaje_completado
FROM usuarios u
LEFT JOIN notificaciones n ON u.id = n.asignado_a
WHERE u.rol = 'ujier'
GROUP BY u.id, u.nombre;

-- ================================================
-- FUNCIONES DE UTILIDAD
-- ================================================

-- Función para obtener estadísticas generales
CREATE OR REPLACE FUNCTION get_estadisticas_generales()
RETURNS TABLE (
    total_notificaciones BIGINT,
    pendientes BIGINT,
    diligenciadas BIGINT,
    diferidas BIGINT,
    porcentaje_completado NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) AS total_notificaciones,
        COUNT(CASE WHEN estado = 'pendiente' THEN 1 END) AS pendientes,
        COUNT(CASE WHEN estado = 'diligenciada' THEN 1 END) AS diligenciadas,
        COUNT(CASE WHEN estado = 'diferida' THEN 1 END) AS diferidas,
        ROUND(
            COUNT(CASE WHEN estado = 'diligenciada' THEN 1 END)::numeric / 
            NULLIF(COUNT(*), 0) * 100, 
            2
        ) AS porcentaje_completado
    FROM notificaciones;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE usuarios IS 'Usuarios del sistema SGND con roles y permisos';
COMMENT ON TABLE notificaciones IS 'Registro principal de cédulas y mandamientos judiciales';
COMMENT ON TABLE audit_log IS 'Registro de auditoría para seguimiento de cambios';
