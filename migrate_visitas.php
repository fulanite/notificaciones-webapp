<?php
require_once __DIR__ . '/api/db.php';

$db = Database::getInstance();
$pdo = $db->getConnection();

try {
    // Check if transcripcion_audio exists in visitas
    $stmt = $pdo->query("SHOW COLUMNS FROM visitas LIKE 'transcripcion_audio'");
    $exists = $stmt->fetch();

    if (!$exists) {
        $pdo->exec("ALTER TABLE visitas ADD COLUMN transcripcion_audio TEXT NULL AFTER audio_url");
        echo "Column transcripcion_audio added to visitas table.\n";
    } else {
        echo "Column transcripcion_audio already exists in visitas table.\n";
    }

    // Check if ubicacion_lat exists (it should, but just in case)
    $stmt = $pdo->query("SHOW COLUMNS FROM visitas LIKE 'ubicacion_lat'");
    if (!$stmt->fetch()) {
        $pdo->exec("ALTER TABLE visitas ADD COLUMN ubicacion_lat VARCHAR(50) NULL");
        $pdo->exec("ALTER TABLE visitas ADD COLUMN ubicacion_lng VARCHAR(50) NULL");
        echo "Location columns added to visitas table.\n";
    }

} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
