<?php
/**
 * SGND - Database Normalization: Results
 * Cleans up and standardizes 'resultado_diligencia' in the database.
 */

require_once __DIR__ . '/db.php';

// Only allow execution with a specific parameter for safety
$is_cli = php_sapi_name() === 'cli';
if (!$is_cli && (!isset($_GET['action']) || $_GET['action'] !== 'run_normalization')) {
    die("Error: Add '?action=run_normalization' to the URL to run this script.");
}
if ($is_cli && (!isset($argv[1]) || $argv[1] !== 'run_normalization')) {
    die("Error: Add 'run_normalization' as argument to run this script.");
}

$db = Database::getInstance();
$pdo = $db->getConnection();

echo "<pre>Starting Diligence Results Normalization...\n";

$normalizations = [
    'domicilio inexistente' => 'Domicilio Inexistente',
    'atiende' => 'Atiende',
    'no atiende' => 'No Atiende',
    'no_atiende' => 'No Atiende',
    'domicilio_inexistente' => 'Domicilio Inexistente',
    'entregada' => 'Entregada',
    'pre aviso' => 'Pre Aviso',
    'pre_aviso' => 'Pre Aviso',
    'preaviso' => 'Pre Aviso',
    'estrados' => 'Estrados',
    'diligenciador ausente' => 'Diligenciador Ausente',
    'diligenciador_ausente' => 'Diligenciador Ausente',
    'traslado' => 'Traslado',
    'fallecido' => 'Fallecido'
];

$total_updated = 0;

try {
    foreach ($normalizations as $old_keyword => $new_value) {
        // Find variations (case-insensitive, with/without underscores, with/without spaces)
        $stmt = $pdo->prepare("
            UPDATE notificaciones 
            SET resultado_diligencia = ? 
            WHERE 
                LOWER(REPLACE(resultado_diligencia, '_', ' ')) = ? OR
                LOWER(resultado_diligencia) = ?
        ");

        $stmt->execute([$new_value, $old_keyword, $old_keyword]);
        $rows = $stmt->rowCount();

        if ($rows > 0) {
            echo "Standardized $rows records: '$old_keyword' -> '$new_value'\n";
            $total_updated += $rows;
        }
    }

    echo "\nNormalization complete. Total records standardized: $total_updated\n";
    echo "</pre>";

} catch (PDOException $e) {
    echo "\nError during normalization: " . $e->getMessage();
}
