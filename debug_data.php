<?php
require_once __DIR__ . '/api/db.php';
try {
    $db = Database::getInstance();
    $pdo = $db->getConnection();
    echo "<pre>";
    echo "Sample data from 'notificaciones':\n";
    $stmt = $pdo->query("SELECT id, estado, resultado_diligencia, fecha_diligencia FROM notificaciones WHERE resultado_diligencia IS NOT NULL LIMIT 10");
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    print_r($rows);
    echo "</pre>";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
