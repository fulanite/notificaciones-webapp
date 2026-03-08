<?php
/**
 * SGND - Migrador de Fotos Externas (Glide/Google)
 * Descarga las fotos alojadas externamente y las guarda en el servidor local de Hostinger.
 */

// Aumentar límites para procesamiento pesado
set_time_limit(0);
ini_set('memory_limit', '512M');

define('SGND_API', true);
require_once __DIR__ . '/db.php';

// Seguridad: Solo permitir ejecución mediante confirmación o desde CLI
$isCli = (php_sapi_name() === 'cli');
if (!$isCli && ($_GET['run'] ?? '') !== 'true') {
    header('Content-Type: text/html; charset=UTF-8');
    die("
    <div style='font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 50px auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 12px; background: white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);'>
        <h1 style='color: #2b6cb0; margin-top: 0;'>📸 Migrador de Fotos</h1>
        <p>Este script buscará todas las URLs de fotos que apunten a Glide o Google y las descargará a este servidor para que no se pierdan cuando Glide deje de funcionar.</p>
        <div style='background: #ebf8ff; border-left: 4px solid #3182ce; padding: 15px; margin: 20px 0;'>
            <strong>Tablas a procesar:</strong>
            <ul style='margin-bottom: 0;'>
                <li><code>notificaciones</code> (evidencia_foto)</li>
                <li><code>visitas</code> (foto_url)</li>
                <li><code>usuarios</code> (foto)</li>
            </ul>
        </div>
        <p style='color: #4a5568;'>El proceso puede tardar varios minutos dependiendo de la cantidad de fotos.</p>
        <div style='text-align: center; margin-top: 30px;'>
            <a href='?run=true' style='display: inline-block; background: #3182ce; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;'>
                INICIAR MIGRACIÓN AHORA
            </a>
        </div>
    </div>
    ");
}

if (!$isCli) {
    header('Content-Type: text/plain; charset=UTF-8');
}

echo "🚀 Iniciando Migración de Fotos...\n";
echo "---------------------------------\n\n";

$pdo = Database::getInstance()->getConnection();

// Directorio de destino
$evidenciasDir = UPLOAD_DIR . 'evidencias/';
if (!file_exists($evidenciasDir)) {
    mkdir($evidenciasDir, 0755, true);
    echo "📁 Carpeta de evidencias creada.\n";
}

// Configuración de URL base para detectar fotos ya migradas
$baseUrl = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http");
$baseUrl .= "://" . ($_SERVER['HTTP_HOST'] ?? 'localhost');

/**
 * Función para descargar y guardar fotos
 */
function migrarFoto($url, $id, $prefix)
{
    global $evidenciasDir, $baseUrl;

    if (empty($url) || strpos($url, 'http') !== 0)
        return false;

    // Si ya empieza con la URL de nuestro servidor, saltar
    if (strpos($url, $baseUrl) === 0 || strpos($url, '/uploads/') === 0) {
        return false;
    }

    try {
        // Limpiar URL de parámetros de Glide
        $cleanUrl = explode('?', $url)[0];
        $ext = pathinfo($cleanUrl, PATHINFO_EXTENSION);
        if (empty($ext) || strlen($ext) > 4)
            $ext = 'jpg';

        $filename = $prefix . '_' . substr($id, 0, 8) . '_' . time() . '.' . $ext;
        $destPath = $evidenciasDir . $filename;

        // Descargar usando cURL
        $ch = curl_init($url);
        $fp = fopen($destPath, 'wb');
        curl_setopt($ch, CURLOPT_FILE, $fp);
        curl_setopt($ch, CURLOPT_HEADER, 0);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 20);
        curl_exec($ch);
        $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        fclose($fp);

        if ($statusCode == 200 && filesize($destPath) > 0) {
            return '/uploads/evidencias/' . $filename;
        } else {
            if (file_exists($destPath))
                unlink($destPath);
            return false;
        }
    } catch (Exception $e) {
        return false;
    }
}

// 1. Configuración de lotes
$batchSize = 50;
$totalMigrated = 0;

if (!$isCli) {
    echo "📦 Procesando lote actual (máx $batchSize archivos)...\n";
}

$pdo = Database::getInstance()->getConnection();

// --- AYUDANTE PARA CONTAR PENDIENTES ---
function getPendingCount($pdo)
{
    $q1 = $pdo->query("SELECT COUNT(*) FROM notificaciones WHERE evidencia_foto LIKE 'http%' AND evidencia_foto NOT LIKE '%sgnd.click%' AND evidencia_foto NOT LIKE '%hostingersite.com%'")->fetchColumn();
    $q2 = $pdo->query("SELECT COUNT(*) FROM visitas WHERE (foto_url LIKE 'http%' AND foto_url NOT LIKE '%sgnd.click%' AND foto_url NOT LIKE '%hostingersite.com%') OR (audio_url LIKE 'http%' AND audio_url NOT LIKE '%sgnd.click%' AND audio_url NOT LIKE '%hostingersite.com%')")->fetchColumn();
    $q3 = $pdo->query("SELECT COUNT(*) FROM usuarios WHERE foto LIKE 'http%' AND foto NOT LIKE '%sgnd.click%' AND foto NOT LIKE '%hostingersite.com%'")->fetchColumn();
    return $q1 + $q2 + $q3;
}

// A. Procesar NOTIFICACIONES (Lote)
$stmt = $pdo->prepare("SELECT id, evidencia_foto FROM notificaciones WHERE evidencia_foto LIKE 'http%' AND evidencia_foto NOT LIKE '%sgnd.click%' AND evidencia_foto NOT LIKE '%hostingersite.com%' LIMIT ?");
$stmt->execute([$batchSize]);
while ($row = $stmt->fetch()) {
    $newPath = migrarFoto($row['evidencia_foto'], $row['id'], 'notif');
    if ($newPath) {
        $update = $pdo->prepare("UPDATE notificaciones SET evidencia_foto = ? WHERE id = ?");
        $update->execute([$newPath, $row['id']]);
        $totalMigrated++;
    }
}

// B. Procesar VISITAS (Fotos - Lote)
if ($totalMigrated < $batchSize) {
    $stmt = $pdo->prepare("SELECT id, foto_url FROM visitas WHERE foto_url LIKE 'http%' AND foto_url NOT LIKE '%sgnd.click%' AND foto_url NOT LIKE '%hostingersite.com%' LIMIT ?");
    $stmt->execute([$batchSize - $totalMigrated]);
    while ($row = $stmt->fetch()) {
        $newPath = migrarFoto($row['foto_url'], $row['id'], 'visita');
        if ($newPath) {
            $update = $pdo->prepare("UPDATE visitas SET foto_url = ? WHERE id = ?");
            $update->execute([$newPath, $row['id']]);
            $totalMigrated++;
        }
    }
}

// C. Procesar VISITAS (Audios - Lote)
if ($totalMigrated < $batchSize) {
    $stmt = $pdo->prepare("SELECT id, audio_url FROM visitas WHERE audio_url LIKE 'http%' AND audio_url NOT LIKE '%sgnd.click%' AND audio_url NOT LIKE '%hostingersite.com%' LIMIT ?");
    $stmt->execute([$batchSize - $totalMigrated]);
    while ($row = $stmt->fetch()) {
        $newPath = migrarFoto($row['audio_url'], $row['id'], 'audio');
        if ($newPath) {
            $update = $pdo->prepare("UPDATE visitas SET audio_url = ? WHERE id = ?");
            $update->execute([$newPath, $row['id']]);
            $totalMigrated++;
        }
    }
}

// D. Procesar USUARIOS (Lote)
if ($totalMigrated < $batchSize) {
    $stmt = $pdo->prepare("SELECT id, foto FROM usuarios WHERE foto LIKE 'http%' AND foto NOT LIKE '%sgnd.click%' AND foto NOT LIKE '%hostingersite.com%' LIMIT ?");
    $stmt->execute([$batchSize - $totalMigrated]);
    while ($row = $stmt->fetch()) {
        $newPath = migrarFoto($row['foto'], $row['id'], 'user');
        if ($newPath) {
            $update = $pdo->prepare("UPDATE usuarios SET foto = ? WHERE id = ?");
            $update->execute([$newPath, $row['id']]);
            $totalMigrated++;
        }
    }
}

$remaining = getPendingCount($pdo);

echo "✅ Se migraron $totalMigrated archivos en este lote.\n";
echo "📊 Archivos pendientes totales: $remaining\n";

if ($remaining > 0) {
    echo "\n🔄 REINICIANDO PARA EL SIGUIENTE LOTE EN 2 SEGUNDOS...\n";
    if (!$isCli) {
        echo "<script>setTimeout(() => { window.location.href = '?run=true&t=" . time() . "'; }, 2000);</script>";
    }
} else {
    echo "\n---------------------------------\n";
    echo "✨ TODOS LOS ARCHIVOS HAN SIDO MIGRADOS CON ÉXITO.\n";
    if (!$isCli) {
        echo "\nYa podés cerrar esta ventana.";
    }
}
