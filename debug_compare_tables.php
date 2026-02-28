<?php
require_once __DIR__ . '/api/db.php';
try {
    $db = Database::getInstance();
    $pdo = $db->getConnection();

    echo "<h1>Comparativa: Notificaciones vs Visitas (2026)</h1>";

    echo "<h3>Notificaciones (fecha_diligencia)</h3>";
    $stmt = $pdo->query("SELECT COUNT(*) FROM notificaciones WHERE fecha_diligencia IS NOT NULL AND YEAR(fecha_diligencia) = 2026");
    echo "Total 2026: " . $stmt->fetchColumn() . "<br>";
    $stmt = $pdo->query("
        SELECT HOUR(fecha_diligencia) as hour, COUNT(*) as count 
        FROM notificaciones 
        WHERE YEAR(fecha_diligencia) = 2026 
        GROUP BY hour ORDER BY hour
    ");
    $dataNotif = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo "<pre>";
    print_r($dataNotif);
    echo "</pre>";

    echo "<h3>Visitas (fecha)</h3>";
    $stmt = $pdo->query("SELECT COUNT(*) FROM visitas WHERE YEAR(fecha) = 2026");
    echo "Total 2026: " . $stmt->fetchColumn() . "<br>";
    $stmt = $pdo->query("
        SELECT HOUR(fecha) as hour, COUNT(*) as count 
        FROM visitas 
        WHERE YEAR(fecha) = 2026 
        GROUP BY hour ORDER BY hour
    ");
    $dataVisitas = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo "<pre>";
    print_r($dataVisitas);
    echo "</pre>";

    echo "<h3>Sample Visitas Rows</h3>";
    $stmt = $pdo->query("SELECT * FROM visitas ORDER BY fecha DESC LIMIT 5");
    echo "<pre>";
    print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
    echo "</pre>";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
