-- Script SQL para actualizar tabla usuarios
-- Ejecutar en phpMyAdmin o cliente MySQL

-- Agregar campo DNI si no existe
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS dni VARCHAR(20) AFTER email;

-- Agregar campos para password reset si no existen
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS password_reset_required BOOLEAN DEFAULT FALSE AFTER activo;

ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255) DEFAULT NULL AFTER password_reset_required;

-- Crear índice para búsqueda por DNI (ignorar si ya existe)
CREATE INDEX IF NOT EXISTS idx_usuarios_dni ON usuarios(dni);

-- NO actualizar roles existentes - mantener compatibilidad
-- Los roles 'admin', 'administrativo', 'coordinador', 'ujier' son todos válidos
