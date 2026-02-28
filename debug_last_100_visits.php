<?php
require_once __DIR__ . '/api/db.php';
try {
    $db = Database::getInstance();
    $pdo = $db->getConnection();

    // Dynamic offset detection
    $timeCheck = $pdo->query("SELECT HOUR(NOW()) as mysql_h, " . date('H') . " as php_h")->fetch();
    $offset = intval($timeCheck['php_h'] ?? 0) - intval($timeCheck['mysql_h'] ?? 0);
    if ($offset > 12)
        $offset -= 24;
    if ($offset < -12)
        $offset += 24;

    echo "<h1>Reporte: Últimas 100 Visitas Registradas</h1>";
    echo "<p>Mostrando hora local de Argentina (Offset detectado: $offset h)</p>";

    $stmt = $pdo->prepare("
        SELECT 
            v.fecha as fecha_raw,
            DATE_ADD(v.fecha, INTERVAL $offset HOUR) as fecha_argentina,
            v.resultado,
            v.notificacion_id,
            n.n_expediente,
            n.destinatario_nombre,
            u.nombre as ujier_nombre
        FROM visitas v
        LEFT JOIN notificaciones n ON v.notificacion_id = n.id
        LEFT JOIN usuarios u ON v.ujier_id = u.id
        ORDER BY v.fecha DESC
        LIMIT 100
    ");
    $stmt->execute();
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo "<table border='1' cellpadding='8' style='border-collapse: collapse; font-family: sans-serif; width: 100%;'>";
    echo "<thead style='background: #f4f4f4;'><tr>
            <th>Fecha/Hora (Arg)</th>
            <th>Expediente</th>
            <th>Ujier</th>
            <th>Resultado</th>
            <th>Destinatario</th>
            <th>ID Notif</th>
          </tr></thead>";
    echo "<tbody>";
    foreach ($rows as $row) {
        echo "<tr>";
        echo "<td><strong>" . date('d/m/Y H:i', strtotime($row['fecha_argentina'])) . "</strong></td>";
        echo "<td>" . ($row['n_expediente'] ?? '-') . "</td>";
        echo "<td>" . ($row['ujier_nombre'] ?? '-') . "</td>";
        echo "<td>" . ($row['resultado'] ?? '-') . "</td>";
        echo "<td>" . ($row['destinatario_nombre'] ?? '-') . "</td>";
        echo "<td style='font-size: 0.7rem; color: #888;'>" . $row['notificacion_id'] . "</td>";
        echo "</tr>";
    }
    echo "</tbody></table>";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
