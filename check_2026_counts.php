<?php
require_once __DIR__ . '/api/db.php';
try {
    $db = Database::getInstance();
    $pdo = $db->getConnection();

    // Check raw counts for 2026 by hour
    echo "RAW COUNTS BY HOUR (FECHA_DILIGENCIA) FOR 2026:\n";
    $stmt = $pdo->query("
        SELECT 
            HOUR(fecha_diligencia) as hour,
            COUNT(*) as count
        FROM notificaciones
        WHERE YEAR(fecha_diligencia) = 2026
        AND fecha_diligencia IS NOT NULL
        GROUP BY hour
        ORDER BY hour
    ");
    $raw = $stmt->fetchAll(PDO::FETCH_ASSOC);
    print_r($raw);

    echo "\nRAW COUNTS BY HOUR (FECHA_CARGA) FOR 2026:\n";
    $stmt = $pdo->query("
        SELECT 
            HOUR(fecha_carga) as hour,
            COUNT(*) as count
        FROM notificaciones
        WHERE YEAR(fecha_carga) = 2026
        GROUP BY hour
        ORDER BY hour
    ");
    $loads = $stmt->fetchAll(PDO::FETCH_ASSOC);
    print_r($loads);

} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
