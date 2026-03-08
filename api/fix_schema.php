<?php
require_once __DIR__ . '/db.php';
$pdo = Database::getInstance()->getConnection();
header('Content-Type: text/plain');
try {
    // Check if column exists
    $q = $pdo->query("SHOW COLUMNS FROM notificaciones LIKE 'updated_by'");
    if ($q->rowCount() == 0) {
        echo "Añadiendo columna updated_by a notificaciones...\n";
        $pdo->exec("ALTER TABLE notificaciones ADD COLUMN updated_by VARCHAR(50) DEFAULT NULL AFTER updated_at");
        echo "Columna añadida.\n";
    } else {
        echo "La columna updated_by ya existe.\n";
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
