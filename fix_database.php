<?php
/**
 * SGND - Database Migration Script
 * This file adds the necessary columns for the "Retira Profesional" feature.
 */
define('SGND_API', true);
require_once __DIR__ . '/api/db.php';

try {
    $db = Database::getInstance();
    $pdo = $db->getConnection();

    echo "<h1>SGND Migration Tool</h1>";
    echo "Connecting to database...<br>";

    // Add columns if they don't exist
    // Note: IF NOT EXISTS for columns is a MariaDB feature or requires manual checks in older MySQL.
    // For portability, we can check if they exist first.

    $checkSql = "SHOW COLUMNS FROM notificaciones LIKE 'retirada_por_profesional'";
    $exists = $pdo->query($checkSql)->fetch();

    if (!$exists) {
        echo "Adding 'retirada_por_profesional' column...<br>";
        $pdo->exec("ALTER TABLE notificaciones ADD COLUMN retirada_por_profesional TINYINT(1) DEFAULT 0");
    } else {
        echo "Column 'retirada_por_profesional' already exists.<br>";
    }

    $checkSql = "SHOW COLUMNS FROM notificaciones LIKE 'fecha_retiro_profesional'";
    $exists = $pdo->query($checkSql)->fetch();
    if (!$exists) {
        echo "Adding 'fecha_retiro_profesional' column...<br>";
        $pdo->exec("ALTER TABLE notificaciones ADD COLUMN fecha_retiro_profesional DATETIME NULL");
    }

    $checkSql = "SHOW COLUMNS FROM notificaciones LIKE 'retirado_por_usuario'";
    $exists = $pdo->query($checkSql)->fetch();
    if (!$exists) {
        echo "Adding 'retirado_por_usuario' column...<br>";
        $pdo->exec("ALTER TABLE notificaciones ADD COLUMN retirado_por_usuario VARCHAR(100) NULL");
    }

    echo "<h2 style='color: green;'>Migration successful!</h2>";
    echo "<p>You can now delete this file and use the new feature.</p>";
    echo "<a href='index.html'>Go back to App</a>";

} catch (Exception $e) {
    echo "<h2 style='color: red;'>Migration failed!</h2>";
    echo "Error: " . $e->getMessage();
}
