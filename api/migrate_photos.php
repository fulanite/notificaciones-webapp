<?php
/**
 * SGND - Photo Migration Tool
 * Downloads photos from external Glide/Google URLs and saves them locally.
 */

define('SGND_API', true);
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

// Increase limits for processing
set_time_limit(0);
ini_set('memory_limit', '512M');

header('Content-Type: text/plain');

echo "🚀 Starting Photo Migration...\n";

$pdo = Database::getInstance()->getConnection();

// Create directories if they don't exist
$evidenciasDir = UPLOAD_DIR . 'evidencias/';
if (!file_exists($evidenciasDir)) {
    mkdir($evidenciasDir, 0755, true);
    echo "Created directory: $evidenciasDir\n";
}

$baseUrl = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http");
$baseUrl .= "://" . $_SERVER['HTTP_HOST'];

/**
 * Migration for VISITAS table (foto_url)
 */
echo "\n--- Processing VISITAS ---\n";
$stmt = $pdo->prepare("SELECT id, foto_url FROM visitas WHERE foto_url LIKE 'http%' AND foto_url NOT LIKE ?");
$stmt->execute([$baseUrl . '%']);
$visitas = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo "Found " . count($visitas) . " visits with external photos.\n";

$count = 0;
foreach ($visitas as $v) {
    $id = $v['id'];
    $url = $v['foto_url'];

    $localPath = downloadAndSave($url, $id, 'visita');

    if ($localPath) {
        $update = $pdo->prepare("UPDATE visitas SET foto_url = ? WHERE id = ?");
        $update->execute([$localPath, $id]);
        $count++;
        if ($count % 50 == 0)
            echo "Processed $count visitas...\n";
    }
}
echo "Finished Visitas. Migrated: $count\n";

/**
 * Migration for NOTIFICACIONES table (evidencia_foto)
 */
echo "\n--- Processing NOTIFICACIONES ---\n";
$stmt = $pdo->prepare("SELECT id, evidencia_foto FROM notificaciones WHERE evidencia_foto LIKE 'http%' AND evidencia_foto NOT LIKE ?");
$stmt->execute([$baseUrl . '%']);
$notifs = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo "Found " . count($notifs) . " notifications with external photos.\n";

$count = 0;
foreach ($notifs as $n) {
    $id = $n['id'];
    $url = $n['evidencia_foto'];

    $localPath = downloadAndSave($url, $id, 'notif');

    if ($localPath) {
        $update = $pdo->prepare("UPDATE notificaciones SET evidencia_foto = ? WHERE id = ?");
        $update->execute([$localPath, $id]);
        $count++;
        if ($count % 50 == 0)
            echo "Processed $count notifications...\n";
    }
}
echo "Finished Notifications. Migrated: $count\n";

/**
 * Migration for USUARIOS table (foto)
 */
echo "\n--- Processing USUARIOS ---\n";
$stmt = $pdo->prepare("SELECT id, foto FROM usuarios WHERE foto LIKE 'http%' AND foto NOT LIKE ?");
$stmt->execute([$baseUrl . '%']);
$usuarios = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo "Found " . count($usuarios) . " users with external photos.\n";

$count = 0;
foreach ($usuarios as $u) {
    $id = $u['id'];
    $url = $u['foto'];

    $localPath = downloadAndSave($url, $id, 'user');

    if ($localPath) {
        $update = $pdo->prepare("UPDATE usuarios SET foto = ? WHERE id = ?");
        $update->execute([$localPath, $id]);
        $count++;
    }
}
echo "Finished Users. Migrated: $count\n";

/**
 * Helper to download and save
 */
function downloadAndSave($url, $id, $prefix)
{
    global $evidenciasDir;

    try {
        // Clean URL (remove glide params after ?)
        $cleanUrl = explode('?', $url)[0];
        $ext = pathinfo($cleanUrl, PATHINFO_EXTENSION);
        if (empty($ext) || strlen($ext) > 4)
            $ext = 'jpg';

        $filename = $prefix . '_' . $id . '_' . time() . '.' . $ext;
        $destPath = $evidenciasDir . $filename;

        // Use cURL for better handling
        $ch = curl_init($url);
        $fp = fopen($destPath, 'wb');
        curl_setopt($ch, CURLOPT_FILE, $fp);
        curl_setopt($ch, CURLOPT_HEADER, 0);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        curl_exec($ch);
        $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        fclose($fp);

        if ($statusCode == 200) {
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
