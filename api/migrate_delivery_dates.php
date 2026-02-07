<?php
require_once 'db.php';

// This script migrates the delivery date from the original Glide CSV to the MySQL database
header('Content-Type: text/plain');

$csvFile = '../92e43e.cedulas.csv';

if (!file_exists($csvFile)) {
    die("Error: CSV file not found at $csvFile\n");
}

try {
    $db = Database::getInstance();
    $pdo = $db->getConnection();

    echo "Clearing old delivery dates for migrated records...\n";
    $pdo->exec("UPDATE notificaciones SET fecha_entrega_ujier = NULL WHERE migrated_from_glide = 1");

    $handle = fopen($csvFile, 'r');
    if (!$handle) {
        die("Error: Could not open CSV file\n");
    }

    // Read header
    $header = fgetcsv($handle);
    $idIndex = array_search('id_cedula', $header);
    $dateIndex = array_search('fecha_entrega_ujier', $header);

    if ($idIndex === false || $dateIndex === false) {
        die("Error: Required columns not found in CSV\n");
    }

    echo "Starting migration from CSV...\n";

    $stmt = $pdo->prepare("UPDATE notificaciones SET fecha_entrega_ujier = ? WHERE glide_id_cedula = ? AND migrated_from_glide = 1");

    $count = 0;
    $updated = 0;

    // Use transaction for speed
    $pdo->beginTransaction();

    while (($data = fgetcsv($handle)) !== false) {
        if (count($data) <= max($idIndex, $dateIndex))
            continue;

        $glideId = $data[$idIndex];
        $rawDate = $data[$dateIndex];

        if (empty($rawDate) || $rawDate === 'null') {
            continue;
        }

        // Format: 2025-10-01T00:00:00.000Z
        // Convert to MySQL format: 2025-10-01 00:00:00
        $formattedDate = null;
        try {
            $dt = new DateTime($rawDate);
            $formattedDate = $dt->format('Y-m-d H:i:s');
        } catch (Exception $e) {
            echo "Warning: Could not parse date '$rawDate' for ID $glideId\n";
            continue;
        }

        $stmt->execute([$formattedDate, $glideId]);

        if ($stmt->rowCount() > 0) {
            $updated++;
        }

        $count++;
        if ($count % 500 === 0) {
            echo "Processed $count records...\n";
        }
    }

    $pdo->commit();
    fclose($handle);

    echo "Migration complete!\n";
    echo "Total CSV records processed: $count\n";
    echo "Records updated in DB with correct dates: $updated\n";

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    die("Error during migration: " . $e->getMessage() . "\n");
}
