<?php
/**
 * SGND - Database Normalization Utility
 * Run this to fix inconsistencies in 'zona' column from migrated data.
 */

require_once __DIR__ . '/db.php';

// Only allow execution with a specific parameter for safety
if (!isset($_GET['action']) || $_GET['action'] !== 'run_normalization') {
    die("Error: Add '?action=run_normalization' to the URL to run this script.");
}

$db = Database::getInstance();
$pdo = $db->getConnection();

echo "<pre>Starting Normalization...\n";

$count = 0;

// 1. Generic Normalization: Singular to Plural and Accents
// We do this in steps to avoid "Cédulass"
$replacements = [
    // Accents and pluralization
    'Cèdula' => 'Cédulas',
    'Cedula' => 'Cédulas',
    'Cédula' => 'Cédulas',
    'Mandamiento' => 'Mandamientos',

    // Fix common singulars that might be part of a string
    'Cédulas' => 'Cédulas', // No-op
    'Mandamientos' => 'Mandamientos', // No-op
];

// Re-map common migrated patterns from Glide
$normalization_map = [
    // Urgentes
    'urgente norte mandamiento' => 'Urgente NORTE - Mandamientos',
    'urgente norte cedula' => 'Urgente NORTE - Cédulas',
    'urgente sur mandamiento' => 'Urgente SUR - Mandamientos',
    'urgente sur cedula' => 'Urgente SUR - Cédulas',

    // Fuera de Radio
    'Fuera de Radio NORTE - Cèdula' => 'Fuera de Radio NORTE - Cédulas',
    'Fuera de Radio SUR - Cèdula' => 'Fuera de Radio SUR - Cédulas',

    // Case fixes and generic pluralization
    'A1 - Cédula' => 'A1 - Cédulas',
    'A2 - Cédula' => 'A2 - Cédulas',
    'B1 - Cédula' => 'B1 - Cédulas',
    'B2 - Cédula' => 'B2 - Cédulas',
    'C1 - Cédula' => 'C1 - Cédulas',
    'C2 - Cédula' => 'C2 - Cédulas',
    'D1 - Cédula' => 'D1 - Cédulas',
    'D2 - Cédula' => 'D2 - Cédulas',

    'A1 - Mandamiento' => 'A1 - Mandamientos',
    'A2 - Mandamiento' => 'A2 - Mandamientos',
    'B1 - Mandamiento' => 'B1 - Mandamientos',
    'B2 - Mandamiento' => 'B2 - Mandamientos',
    'C1 - Mandamiento' => 'C1 - Mandamientos',
    'C2 - Mandamiento' => 'C2 - Mandamientos',
    'D1 - Mandamiento' => 'D1 - Mandamientos',
    'D2 - Mandamiento' => 'D2 - Mandamientos',

    // Lowercase variants
    'sur' => 'ZONA SUR',
    'norte' => 'ZONA NORTE',
    'centro' => 'ZONA CENTRO',
];

try {
    // Phase 1: Direct replacements from map
    foreach ($normalization_map as $old => $new) {
        $stmt = $pdo->prepare("UPDATE notificaciones SET zona = ? WHERE zona = ?");
        $stmt->execute([$new, $old]);
        $rows = $stmt->rowCount();
        if ($rows > 0) {
            echo "Fixed $rows rows: '$old' -> '$new'\n";
            $count += $rows;
        }
    }

    // Phase 2: Generic singular to plural fix (using Regex in MySQL 8+ or multiple REPLACE)
    // Basic singular fix for 'Mandamiento' -> 'Mandamientos'
    $stmt = $pdo->prepare("UPDATE notificaciones SET zona = REPLACE(zona, 'Mandamiento', 'Mandamientos') WHERE zona LIKE '%Mandamiento' AND zona NOT LIKE '%Mandamientos'");
    $stmt->execute();
    $rows = $stmt->rowCount();
    if ($rows > 0) {
        echo "Fixed $rows rows: generic Mandamiento pluralization\n";
        $count += $rows;
    }

    // Basic singular fix for 'Cédula' variants -> 'Cédulas'
    $variants = ['Cédula', 'Cedula', 'Cèdula'];
    foreach ($variants as $v) {
        $stmt = $pdo->prepare("UPDATE notificaciones SET zona = REPLACE(zona, ?, 'Cédulas') WHERE zona LIKE ? AND zona NOT LIKE '%Cédulas'");
        $stmt->execute([$v, "%$v%"]);
        $rows = $stmt->rowCount();
        if ($rows > 0) {
            echo "Fixed $rows rows: generic $v -> Cédulas normalization\n";
            $count += $rows;
        }
    }

    // Phase 3: Fix double plurals if any (Cédulass)
    $stmt = $pdo->prepare("UPDATE notificaciones SET zona = REPLACE(zona, 'Cédulass', 'Cédulas') WHERE zona LIKE '%Cédulass%'");
    $stmt->execute();
    $stmt = $pdo->prepare("UPDATE notificaciones SET zona = REPLACE(zona, 'Mandamientoss', 'Mandamientos') WHERE zona LIKE '%Mandamientoss%'");
    $stmt->execute();

    echo "\nNormalization complete. Total rows updated: $count\n";
    echo "</pre>";

} catch (PDOException $e) {
    echo "\nError during normalization: " . $e->getMessage();
}
