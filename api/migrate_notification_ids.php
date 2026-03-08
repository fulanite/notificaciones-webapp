<?php
/**
 * SGND - Script de Migración de IDs de Notificaciones
 * Convierte IDs UUID a formato N-YY-XXXX
 */

set_time_limit(0);
ini_set('memory_limit', '512M');

define('SGND_API', true);
require_once __DIR__ . '/db.php';

$isCli = (php_sapi_name() === 'cli');
if (!$isCli && ($_GET['token'] ?? '') !== 'adm-migrate-2026') {
    die("Acceso no autorizado. Se requiere token de seguridad.");
}

$db = Database::getInstance();
$pdo = $db->getConnection();

echo "🚀 Iniciando Migración de IDs...\n";

try {
    // 1. Obtener todas las notificaciones con UUID (longitud > 15)
    $stmt = $pdo->query("SELECT id, fecha_carga, created_at FROM notificaciones WHERE LENGTH(id) > 15 ORDER BY fecha_carga ASC, created_at ASC");
    $notificaciones = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($notificaciones)) {
        die("✅ No hay notificaciones con UUID para migrar.");
    }

    echo "📊 Total a migrar: " . count($notificaciones) . "\n";

    // IMPORTANT: Disable foreign key checks for the ID swap
    $pdo->exec("SET FOREIGN_KEY_CHECKS = 0");
    $pdo->beginTransaction();

    $counts = [
        '24' => 0,
        '25' => 0,
        '26' => 0
    ];

    foreach ($notificaciones as $n) {
        $oldId = $n['id'];

        // Determinar año para el ID
        $date = !empty($n['fecha_carga']) ? $n['fecha_carga'] : $n['created_at'];
        $yearCode = date('y', strtotime($date));

        if (!isset($counts[$yearCode]))
            $counts[$yearCode] = 0;
        $counts[$yearCode]++;

        $newId = "N-" . $yearCode . "-" . str_pad($counts[$yearCode], 4, '0', STR_PAD_LEFT);

        echo "🔄 Migrando $oldId -> $newId\n";

        // A. Actualizar Visitas (dependencia)
        $stmtV = $pdo->prepare("UPDATE visitas SET notificacion_id = ? WHERE notificacion_id = ?");
        $stmtV->execute([$newId, $oldId]);

        // B. Actualizar Audit Log (dependencia)
        $stmtA = $pdo->prepare("UPDATE audit_log SET entidad_id = ? WHERE entidad_id = ? AND entidad = 'notificacion'");
        $stmtA->execute([$newId, $oldId]);

        // C. Actualizar Notificación (Maestro)
        $stmtN = $pdo->prepare("UPDATE notificaciones SET id = ? WHERE id = ?");
        $stmtN->execute([$newId, $oldId]);
    }

    $pdo->commit();
    $pdo->exec("SET FOREIGN_KEY_CHECKS = 1");

    // 2. Inicializar la tabla de secuencias para que la próxima carga siga el orden
    echo "⚙️ Inicializando tabla de secuencias...\n";
    $pdo->exec("CREATE TABLE IF NOT EXISTS id_sequences (
        entity VARCHAR(50),
        year CHAR(2),
        last_number INT DEFAULT 0,
        PRIMARY KEY (entity, year)
    ) ENGINE=InnoDB");

    foreach ($counts as $year => $last) {
        if ($last > 0) {
            $stmtSeq = $pdo->prepare("REPLACE INTO id_sequences (entity, year, last_number) VALUES ('notificacion', ?, ?)");
            $stmtSeq->execute([$year, $last]);
        }
    }

    echo "\n✨ Migración finalizada con éxito!\n";
    echo "📊 Resumen por año:\n";
    foreach ($counts as $year => $total) {
        if ($total > 0)
            echo "   - 20$year: $total notificaciones\n";
    }

} catch (Exception $e) {
    if ($pdo->inTransaction())
        $pdo->rollBack();
    $pdo->exec("SET FOREIGN_KEY_CHECKS = 1");
    die("\n❌ ERROR DURANTE LA MIGRACIÓN: " . $e->getMessage());
}
