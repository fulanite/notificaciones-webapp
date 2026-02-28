<?php
require_once __DIR__ . '/api/db.php';
try {
    $db = Database::getInstance();
    $pdo = $db->getConnection();
    echo "<pre>";
    echo "TIME CHECK (PHP vs MySQL)\n";
    $m_now = $pdo->query("SELECT NOW()")->fetchColumn();
    $p_now = date('Y-m-d H:i:s');
    echo "MySQL NOW: $m_now\n";
    echo "PHP NOW:   $p_now\n";

    echo "\nRAW DATA SAMPLES (Last 5 visits/completed notifications):\n";
    $stmt = $pdo->query("SELECT id, fecha_carga, fecha_diligencia, (fecha_diligencia IS NOT NULL) as has_vis, migrated_from_glide FROM notificaciones WHERE fecha_diligencia IS NOT NULL ORDER BY fecha_diligencia DESC LIMIT 5");
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($rows as $row) {
        printf("ID: %s | Carga: %s | Diligencia: %s | Migrated: %d\n", $row['id'], $row['fecha_carga'], $row['fecha_diligencia'], $row['migrated_from_glide']);
    }

    echo "\nRAW DATA SAMPLES (Old migrated data):\n";
    $stmt = $pdo->query("SELECT id, fecha_carga, fecha_diligencia, migrated_from_glide FROM notificaciones WHERE migrated_from_glide = 1 AND fecha_diligencia IS NOT NULL LIMIT 5");
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($rows as $row) {
        printf("ID: %s | Carga: %s | Diligencia: %s | Migrated: %d\n", $row['id'], $row['fecha_carga'], $row['fecha_diligencia'], $row['migrated_from_glide']);
    }

    echo "</pre>";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
