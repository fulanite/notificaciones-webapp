<?php
require_once __DIR__ . '/api/db.php';
try {
    $db = Database::getInstance();
    $pdo = $db->getConnection();

    // Dynamic offset detection logic from stats.php
    $timeCheck = $pdo->query("SELECT HOUR(NOW()) as mysql_h, " . date('H') . " as php_h")->fetch();
    $offset = intval($timeCheck['php_h'] ?? 0) - intval($timeCheck['mysql_h'] ?? 0);
    if ($offset > 12)
        $offset -= 24;
    if ($offset < -12)
        $offset += 24;

    echo "<h1>Trend Report: Ujier Visits (Last 7 Days)</h1>";
    echo "<p>Detection: MySQL Hour=" . $timeCheck['mysql_h'] . ", PHP Hour=" . $timeCheck['php_h'] . " -> Offset: $offset</p>";

    $startDate = date('Y-m-d', strtotime('-7 days'));

    // Detailed hourly visit report for the last 7 days
    $stmt = $pdo->prepare("
        SELECT 
            DATE(DATE_ADD(fecha_diligencia, INTERVAL $offset HOUR)) as visit_date,
            HOUR(DATE_ADD(fecha_diligencia, INTERVAL $offset HOUR)) as visit_hour,
            COUNT(*) as visit_count
        FROM notificaciones
        WHERE fecha_diligencia >= ?
        AND (eliminada = 0 OR eliminada IS NULL)
        GROUP BY visit_date, visit_hour
        ORDER BY visit_date DESC, visit_hour DESC
    ");
    $stmt->execute([$startDate]);
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo "<table border='1' cellpadding='5' style='border-collapse: collapse;'>";
    echo "<thead><tr><th>Fecha</th><th>Hora (Arg)</th><th>Cantidad de Visitas</th></tr></thead>";
    echo "<tbody>";
    foreach ($results as $row) {
        $color = ($row['visit_hour'] >= 8 && $row['visit_hour'] <= 14) ? "style='background-color: #e6ffed;'" : ""; // Highlighting morning shifts
        echo "<tr $color>";
        echo "<td>{$row['visit_date']}</td>";
        echo "<td>{$row['visit_hour']}:00</td>";
        echo "<td>{$row['visit_count']}</td>";
        echo "</tr>";
    }
    echo "</tbody></table>";

    echo "<h2>Comparing Load Hours (for control)</h2>";
    $stmtLoads = $pdo->prepare("
        SELECT 
            DATE(DATE_ADD(fecha_carga, INTERVAL $offset HOUR)) as load_date,
            HOUR(DATE_ADD(fecha_carga, INTERVAL $offset HOUR)) as load_hour,
            COUNT(*) as load_count
        FROM notificaciones
        WHERE fecha_carga >= ?
        AND (eliminada = 0 OR eliminada IS NULL)
        GROUP BY load_date, load_hour
        ORDER BY load_date DESC, load_hour DESC
        LIMIT 20
    ");
    $stmtLoads->execute([$startDate]);
    $loads = $stmtLoads->fetchAll(PDO::FETCH_ASSOC);

    echo "<table border='1' cellpadding='5' style='border-collapse: collapse;'>";
    echo "<thead><tr><th>Fecha</th><th>Hora Carga (Arg)</th><th>Cantidad Cargas</th></tr></thead>";
    echo "<tbody>";
    foreach ($loads as $row) {
        echo "<tr><td>{$row['load_date']}</td><td>{$row['load_hour']}:00</td><td>{$row['load_count']}</td></tr>";
    }
    echo "</tbody></table>";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
