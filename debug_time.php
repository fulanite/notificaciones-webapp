<?php
require_once __DIR__ . '/api/db.php';
try {
    $db = Database::getInstance();
    $pdo = $db->getConnection();
    echo "<pre>";
    echo "Time Verification:\n";
    $stmt = $pdo->query("SELECT NOW() as mysql_now, @@session.time_zone as session_tz, @@global.time_zone as global_tz");
    print_r($stmt->fetch());

    echo "\nSample records (notificaciones):\n";
    $stmt = $pdo->query("SELECT id, fecha_carga, HOUR(fecha_carga) as h_raw, HOUR(DATE_SUB(fecha_carga, INTERVAL 3 HOUR)) as h_adj FROM notificaciones ORDER BY fecha_carga DESC LIMIT 5");
    print_r($stmt->fetchAll());

    echo "</pre>";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
