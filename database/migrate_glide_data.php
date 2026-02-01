<?php
/**
 * ================================================
 * SGND - Glide Data Migration Script
 * ================================================
 * 
 * This script migrates historical data from the old Glide system
 * into the new SGND MySQL database.
 * 
 * CSV Files:
 * - 92e43e.cedulas.csv -> notificaciones table
 * - e9c740.visitas.csv -> visitas table
 * 
 * Usage: php migrate_glide_data.php [--dry-run]
 */

// Configuration
$config = [
    'db_host' => 'localhost',
    'db_name' => 'sgnd_database',
    'db_user' => 'root',
    'db_pass' => '',
    'cedulas_file' => __DIR__ . '/../92e43e.cedulas.csv',
    'visitas_file' => __DIR__ . '/../e9c740.visitas.csv',
];

// Check for dry run mode
$dryRun = in_array('--dry-run', $argv ?? []);

echo "================================================\n";
echo "SGND - Glide Data Migration Script\n";
echo "================================================\n";
echo "Mode: " . ($dryRun ? "DRY RUN (no changes will be made)" : "LIVE") . "\n\n";

// ------------------------------------
// Helper Functions
// ------------------------------------

function generateUuid(): string
{
    return sprintf(
        '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000,
        mt_rand(0, 0x3fff) | 0x8000,
        mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0xffff)
    );
}

function parseDate(?string $dateStr): ?string
{
    if (empty($dateStr))
        return null;

    // Try different date formats
    $formats = [
        'd/m/Y H:i:s',
        'd/m/Y H:i',
        'd/m/Y',
        'Y-m-d H:i:s',
        'Y-m-d',
        'm/d/Y H:i:s',
        'm/d/Y',
    ];

    foreach ($formats as $format) {
        $date = DateTime::createFromFormat($format, trim($dateStr));
        if ($date !== false) {
            return $date->format('Y-m-d H:i:s');
        }
    }

    // Try strtotime as fallback
    $timestamp = strtotime($dateStr);
    if ($timestamp !== false) {
        return date('Y-m-d H:i:s', $timestamp);
    }

    return null;
}

function parseDecimal(?string $value): float
{
    if (empty($value))
        return 0.0;
    // Handle comma as decimal separator
    $value = str_replace(',', '.', $value);
    $value = preg_replace('/[^0-9.\-]/', '', $value);
    return floatval($value);
}

function parseCoordinates(?string $location): array
{
    if (empty($location))
        return ['lat' => null, 'lng' => null];

    // Parse "lat, lng" format or Google Maps URL
    if (preg_match('/(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/', $location, $matches)) {
        return [
            'lat' => floatval($matches[1]),
            'lng' => floatval($matches[2])
        ];
    }

    // Try to extract from Google Maps URL
    if (preg_match('/@(-?\d+\.?\d*),(-?\d+\.?\d*)/', $location, $matches)) {
        return [
            'lat' => floatval($matches[1]),
            'lng' => floatval($matches[2])
        ];
    }

    return ['lat' => null, 'lng' => null];
}

function mapEstado(?string $estado): string
{
    $estado = strtolower(trim($estado ?? ''));

    $mapping = [
        'pendiente' => 'pendiente',
        'asignada' => 'pendiente',
        'diligenciada' => 'diligenciada',
        'notificada' => 'diligenciada',
        'completada' => 'diligenciada',
        'diferida' => 'diferida',
        'devuelta' => 'diferida',
    ];

    return $mapping[$estado] ?? 'pendiente';
}

function mapMedioPago(?string $medio): ?string
{
    $medio = strtolower(trim($medio ?? ''));

    $mapping = [
        'gratuito' => 'gratuito',
        'gratis' => 'gratuito',
        'efectivo' => 'efectivo',
        'cash' => 'efectivo',
        'transferencia' => 'transferencia',
        'banco' => 'transferencia',
        'qr' => 'qr',
    ];

    return $mapping[$medio] ?? null;
}

function mapDestinoEspecial(?string $destino): ?string
{
    $destino = strtolower(trim($destino ?? ''));

    if (strpos($destino, 'estrado') !== false)
        return 'estrados';
    if (strpos($destino, 'arcat') !== false)
        return 'arcat';

    return null;
}

function cleanString(?string $value): ?string
{
    if (empty($value))
        return null;
    return trim($value);
}

function readCsvFile(string $filePath): array
{
    if (!file_exists($filePath)) {
        throw new Exception("File not found: $filePath");
    }

    $rows = [];
    $handle = fopen($filePath, 'r');
    if ($handle === false) {
        throw new Exception("Cannot open file: $filePath");
    }

    // Read header
    $header = fgetcsv($handle);
    if ($header === false) {
        throw new Exception("Cannot read CSV header");
    }

    // Clean header column names
    $header = array_map(function ($col) {
        return trim($col);
    }, $header);

    // Read rows
    while (($row = fgetcsv($handle)) !== false) {
        if (count($row) === count($header)) {
            $rows[] = array_combine($header, $row);
        }
    }

    fclose($handle);

    return $rows;
}

// ------------------------------------
// Main Migration Logic
// ------------------------------------

try {
    // Connect to database (skip in dry run)
    $pdo = null;
    if (!$dryRun) {
        $dsn = "mysql:host={$config['db_host']};dbname={$config['db_name']};charset=utf8mb4";
        $pdo = new PDO($dsn, $config['db_user'], $config['db_pass'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        echo "✓ Connected to database\n\n";
    }

    // ------------------------------------
    // Step 1: Migrate Cédulas (Notificaciones)
    // ------------------------------------
    echo "Step 1: Migrating Cédulas to Notificaciones\n";
    echo "--------------------------------------------\n";

    $cedulas = readCsvFile($config['cedulas_file']);
    echo "Found " . count($cedulas) . " cédulas to migrate\n";

    // Track ID mapping for visitas migration
    $idMapping = []; // old_id_cedula => new_uuid

    $successCount = 0;
    $errorCount = 0;
    $errors = [];

    // Prepare insert statement
    $insertSql = "INSERT INTO notificaciones (
        id, fecha_carga, usuario_carga, estado, tipo_notificacion,
        n_expediente, caratula, origen, letrado,
        destinatario_especial, destinatario_nombre, domicilio, zona,
        tipo_troquel, n_troquel, medio_pago, costo,
        observaciones_iniciales, created_at
    ) VALUES (
        :id, :fecha_carga, :usuario_carga, :estado, :tipo_notificacion,
        :n_expediente, :caratula, :origen, :letrado,
        :destinatario_especial, :destinatario_nombre, :domicilio, :zona,
        :tipo_troquel, :n_troquel, :medio_pago, :costo,
        :observaciones_iniciales, :created_at
    )";

    if (!$dryRun) {
        $stmt = $pdo->prepare($insertSql);
    }

    foreach ($cedulas as $index => $cedula) {
        try {
            $idCedula = $cedula['id_cedula'] ?? '';
            if (empty($idCedula)) {
                throw new Exception("Missing id_cedula");
            }

            // Generate new UUID and store mapping
            $newId = generateUuid();
            $idMapping[$idCedula] = $newId;

            // Map fields
            $data = [
                ':id' => $newId,
                ':fecha_carga' => parseDate($cedula['fecha_carga'] ?? null),
                ':usuario_carga' => cleanString($cedula['cargado_por'] ?? null),
                ':estado' => mapEstado($cedula['estado_notificacion'] ?? null),
                ':tipo_notificacion' => cleanString($cedula['tipo_not'] ?? null) ?: 'cedulas',
                ':n_expediente' => cleanString($cedula['n_exp'] ?? null) ?: 'SIN EXPEDIENTE',
                ':caratula' => cleanString($cedula['caratula'] ?? null) ?: 'SIN CARÁTULA',
                ':origen' => cleanString($cedula['origen'] ?? null) ?: 'SIN ORIGEN',
                ':letrado' => cleanString($cedula['letrado'] ?? null),
                ':destinatario_especial' => mapDestinoEspecial($cedula['destino_especial'] ?? null),
                ':destinatario_nombre' => cleanString($cedula['destinatario'] ?? null) ?: 'SIN DESTINATARIO',
                ':domicilio' => cleanString($cedula['domicilio'] ?? null) ?: 'SIN DOMICILIO',
                ':zona' => cleanString($cedula['zona_cedula'] ?? null) ?: 'sin_zona',
                ':tipo_troquel' => substr(cleanString($cedula['troquel_categoria'] ?? null) ?: 'X', 0, 1),
                ':n_troquel' => !empty($cedula['troquel']) ? intval($cedula['troquel']) : null,
                ':medio_pago' => mapMedioPago($cedula['Medio de pago'] ?? null),
                ':costo' => parseDecimal($cedula['costo'] ?? '0'),
                ':observaciones_iniciales' => cleanString($cedula['observaciones'] ?? null),
                ':created_at' => parseDate($cedula['fecha_carga'] ?? null) ?: date('Y-m-d H:i:s'),
            ];

            if (!$dryRun) {
                $stmt->execute($data);
            }

            $successCount++;

            // Progress indicator
            if (($index + 1) % 100 === 0) {
                echo "  Processed " . ($index + 1) . " records...\n";
            }

        } catch (Exception $e) {
            $errorCount++;
            $errors[] = "Row $index (id_cedula: $idCedula): " . $e->getMessage();
        }
    }

    echo "\n✓ Cédulas migration complete:\n";
    echo "  - Successful: $successCount\n";
    echo "  - Errors: $errorCount\n";

    if ($errorCount > 0 && count($errors) <= 10) {
        echo "  - Error details:\n";
        foreach ($errors as $error) {
            echo "    • $error\n";
        }
    }

    // ------------------------------------
    // Step 2: Migrate Visitas
    // ------------------------------------
    echo "\nStep 2: Migrating Visitas\n";
    echo "-------------------------\n";

    $visitas = readCsvFile($config['visitas_file']);
    echo "Found " . count($visitas) . " visitas to migrate\n";

    $successCount = 0;
    $errorCount = 0;
    $skippedCount = 0;
    $errors = [];

    // Prepare insert statement
    $insertVisitaSql = "INSERT INTO visitas (
        id, notificacion_id, ujier_id, resultado,
        observaciones, ubicacion_lat, ubicacion_lng,
        foto_url, fecha
    ) VALUES (
        :id, :notificacion_id, :ujier_id, :resultado,
        :observaciones, :ubicacion_lat, :ubicacion_lng,
        :foto_url, :fecha
    )";

    if (!$dryRun) {
        $stmtVisita = $pdo->prepare($insertVisitaSql);
    }

    foreach ($visitas as $index => $visita) {
        try {
            $idCedula = $visita['ID_cedula'] ?? '';

            // Check if parent notificacion exists
            if (!isset($idMapping[$idCedula])) {
                $skippedCount++;
                continue; // Skip orphaned visitas
            }

            $notificacionId = $idMapping[$idCedula];

            // Parse coordinates
            $coords = parseCoordinates($visita['ubicacion_ujier'] ?? null);

            // Generate new UUID
            $newId = generateUuid();

            // Map fields
            $data = [
                ':id' => $newId,
                ':notificacion_id' => $notificacionId,
                ':ujier_id' => null, // Will need to be mapped separately to usuarios table
                ':resultado' => cleanString($visita['estado_notificacion'] ?? null),
                ':observaciones' => cleanString($visita['observaciones_ujier'] ?? null),
                ':ubicacion_lat' => $coords['lat'],
                ':ubicacion_lng' => $coords['lng'],
                ':foto_url' => cleanString($visita['foto_domicilio'] ?? null),
                ':fecha' => parseDate($visita['fecha_hora_visita'] ?? null) ?: date('Y-m-d H:i:s'),
            ];

            if (!$dryRun) {
                $stmtVisita->execute($data);
            }

            $successCount++;

            // Progress indicator
            if (($index + 1) % 100 === 0) {
                echo "  Processed " . ($index + 1) . " records...\n";
            }

        } catch (Exception $e) {
            $errorCount++;
            $errors[] = "Row $index (ID_cedula: $idCedula): " . $e->getMessage();
        }
    }

    echo "\n✓ Visitas migration complete:\n";
    echo "  - Successful: $successCount\n";
    echo "  - Skipped (orphaned): $skippedCount\n";
    echo "  - Errors: $errorCount\n";

    if ($errorCount > 0 && count($errors) <= 10) {
        echo "  - Error details:\n";
        foreach ($errors as $error) {
            echo "    • $error\n";
        }
    }

    // ------------------------------------
    // Step 3: Extract Unique Users (Ujieres)
    // ------------------------------------
    echo "\nStep 3: Extracting Unique Ujieres\n";
    echo "---------------------------------\n";

    $ujieres = [];
    foreach ($visitas as $visita) {
        $idUjier = $visita['id_ujier'] ?? '';
        $nombreUjier = $visita['nombre_ujier'] ?? '';

        if (!empty($idUjier) && !isset($ujieres[$idUjier])) {
            $ujieres[$idUjier] = [
                'id_glide' => $idUjier,
                'nombre' => $nombreUjier,
            ];
        }
    }

    echo "Found " . count($ujieres) . " unique ujieres\n";
    echo "\nUjier List (for manual user creation):\n";

    foreach ($ujieres as $ujier) {
        echo "  • {$ujier['nombre']} (Glide ID: {$ujier['id_glide']})\n";
    }

    // Save ujieres to CSV for reference
    $ujieresFile = __DIR__ . '/ujieres_to_import.csv';
    $handle = fopen($ujieresFile, 'w');
    fputcsv($handle, ['glide_id', 'nombre', 'email_sugerido', 'new_uuid']);
    foreach ($ujieres as $ujier) {
        $emailSugerido = strtolower(str_replace(' ', '.', $ujier['nombre'])) . '@sgnd.gob.ar';
        fputcsv($handle, [$ujier['id_glide'], $ujier['nombre'], $emailSugerido, generateUuid()]);
    }
    fclose($handle);
    echo "\n→ Ujieres exported to: $ujieresFile\n";

    // ------------------------------------
    // Summary
    // ------------------------------------
    echo "\n================================================\n";
    echo "MIGRATION COMPLETE\n";
    echo "================================================\n";
    echo "ID Mapping file created: " . count($idMapping) . " records\n";
    echo "\n";

    // Save ID mapping for reference
    $mappingFile = __DIR__ . '/id_mapping.json';
    file_put_contents($mappingFile, json_encode($idMapping, JSON_PRETTY_PRINT));
    echo "→ ID mapping saved to: $mappingFile\n";

    if ($dryRun) {
        echo "\n⚠ This was a dry run. No data was actually inserted.\n";
        echo "  Run without --dry-run to perform the actual migration.\n";
    }

} catch (Exception $e) {
    echo "\n✗ ERROR: " . $e->getMessage() . "\n";
    exit(1);
}
