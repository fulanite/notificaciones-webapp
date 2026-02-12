-- SGND - Migration: Update User Roles and Email Support
-- Run this SQL in your database (e.g., PHPMyAdmin) to ensure all roles are supported and fields are consistent.

-- 1. Update the rol column to include 'coordinador'
ALTER TABLE `usuarios` 
MODIFY COLUMN `rol` ENUM('admin', 'administrativo', 'ujier', 'auditor', 'coordinador') NOT NULL;

-- 2. Ensure DNI column exists (it might have been added manually, but good to have here)
-- ALTER TABLE `usuarios` ADD COLUMN IF NOT EXISTS `dni` VARCHAR(20) AFTER `email`;

-- 3. Ensure indices exist for performance
-- CREATE INDEX idx_usuarios_dni ON usuarios(dni);
