<?php
/**
 * SGND - Database Migration Script: Rename Specific Zones
 */

require_once __DIR__ . '/db.php';

// Only allow execution with a specific parameter for safety
$is_cli = php_sapi_name() === 'cli';
if (!$is_cli && (!isset($_GET['action']) || $_GET['action'] !== 'run_migration')) {
    die("Error: Add '?action=run_migration' to the URL to run this script.");
}
if ($is_cli && (!isset($argv[1]) || $argv[1] !== 'run_migration')) {
    die("Error: Add 'run_migration' as argument to run this script.");
}

$db = Database::getInstance();
$pdo = $db->getConnection();

echo "<pre>Starting Zone Rename Migration...\n";

$migrations = [
    'Fuera de Radio NORTE - Mandamientos' => 'Turno permanente norte mandamientos',
    'Fuera de Radio SUR - Mandamientos' => 'Turno permanente sur mandamientos'
];

$total_updated = 0;

try {
    foreach ($migrations as $old => $new) {
        // Handle transitions from:
        // 1. Original: Fuera de Radio ... Mandamientos
        // 2. Original singular: Fuera de Radio ... Mandamiento
        // 3. New singular (if already run): Turno permanente ... mandamiento
        $old_variations = [
            $old,
            str_replace('Mandamientos', 'Mandamiento', $old),
            str_replace('Mandamientos', 'Mandamientos', $old),
            'Turno permanente norte mandamiento', // Case-specific from previous run
            'Turno permanente sur mandamiento'
        ];

        foreach (array_unique($old_variations) as $old_variant) {
            $stmt = $pdo->prepare("UPDATE notificaciones SET zona = ? WHERE zona = ?");
            $stmt->execute([$new, $old_variant]);
            $rows = $stmt->rowCount();
            if ($rows > 0) {
                echo "Updated $rows rows: '$old_variant' -> '$new'\n";
                $total_updated += $rows;
            }
        }
    }

    echo "\nMigration complete. Total rows updated: $total_updated\n";
    echo "</pre>";

} catch (PDOException $e) {
    echo "\nError during migration: " . $e->getMessage();
}
