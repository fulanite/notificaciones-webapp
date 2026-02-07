<?php
/**
 * SGND - Remedio para Visitas Migradas
 * Corrige el ujier_id faltante en la tabla visitas basándose en el CSV original.
 */

require_once __DIR__ . '/../api/db.php';

$db = Database::getInstance();
$pdo = $db->getConnection();

$visitasFile = __DIR__ . '/../e9c740.visitas.csv';

if (!file_exists($visitasFile)) {
    die("Error: No se encuentra el archivo CSV de visitas.\n");
}

echo "Iniciando corrección de visitas migradas...\n";

// 1. Obtener mapeo de Glide ID a UUID de notificaciones
$stmt = $pdo->query("SELECT id, glide_id_cedula FROM notificaciones WHERE glide_id_cedula IS NOT NULL");
$idMapping = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

echo "Mapeo cargado: " . count($idMapping) . " notificaciones encontradas.\n";

$handle = fopen($visitasFile, 'r');
$header = fgetcsv($handle);

// Identificar columnas
$idxIdCedula = array_search('ID_cedula', $header);
$idxIdUjier = array_search('id_ujier', $header);

if ($idxIdCedula === false || $idxIdUjier === false) {
    die("Error: Columnas ID_cedula o id_ujier no encontradas en el CSV.\n");
}

$success = 0;
$notFound = 0;
$total = 0;

// Preparar el update
$updateStmt = $pdo->prepare("UPDATE visitas SET ujier_id = ? WHERE notificacion_id = ? AND ujier_id IS NULL AND migrated_from_glide = 1");

while (($row = fgetcsv($handle)) !== false) {
    $total++;
    $glideId = $row[$idxIdCedula];
    $ujierId = $row[$idxIdUjier];

    if (isset($idMapping[$glideId])) {
        $uuid = $idMapping[$glideId];
        $updateStmt->execute([$ujierId, $uuid]);
        if ($updateStmt->rowCount() > 0) {
            $success++;
        }
    } else {
        $notFound++;
    }

    if ($total % 500 === 0) {
        echo "Procesados $total registros...\n";
    }
}

fclose($handle);

echo "\nResultados:\n";
echo "- Total filas CSV: $total\n";
echo "- Visitas actualizadas: $success\n";
echo "- Cédulas no encontradas en DB local: $notFound\n";
echo "Done.\n";
