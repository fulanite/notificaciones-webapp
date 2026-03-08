<?php
require_once __DIR__ . '/../playground/galactic-apogee/api/db.php';

try {
    $pdo = Database::getInstance()->getConnection();
    echo "<h1>Audit Table Check</h1>";

    $stmt = $pdo->query("SHOW TABLES LIKE 'audit_log'");
    $exists = $stmt->fetch();

    if ($exists) {
        echo "<p style='color: green;'>✅ Table 'audit_log' exists.</p>";
        $stmt = $pdo->query("DESCRIBE audit_log");
        $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo "<table border='1'><tr><th>Field</th><th>Type</th></tr>";
        foreach ($columns as $col) {
            echo "<tr><td>{$col['Field']}</td><td>{$col['Type']}</td></tr>";
        }
        echo "</table>";
    } else {
        echo "<p style='color: red;'>❌ Table 'audit_log' does not exist.</p>";
        echo "<p>Generating SQL to create the table...</p>";
        echo "<code><pre>
CREATE TABLE IF NOT EXISTS audit_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    usuario_id VARCHAR(50) NULL,
    usuario_nombre VARCHAR(255) NULL,
    usuario_rol VARCHAR(50) NULL,
    accion VARCHAR(100) NOT NULL,
    entidad VARCHAR(100) NOT NULL,
    entidad_id VARCHAR(100) NULL,
    descripcion TEXT NOT NULL,
    datos_anteriores JSON NULL,
    datos_nuevos JSON NULL,
    metadatos JSON NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    ruta TEXT NULL,
    metodo VARCHAR(10) NULL,
    severidad ENUM('info', 'warning', 'error', 'critical') DEFAULT 'info',
    resultado ENUM('exito', 'fallo') DEFAULT 'exito',
    mensaje_error TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX (usuario_id),
    INDEX (accion),
    INDEX (entidad),
    INDEX (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        </pre></code>";
    }

} catch (Exception $e) {
    echo "<p style='color: red;'>Error: " . $e->getMessage() . "</p>";
}
