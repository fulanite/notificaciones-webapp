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

// 1. Procesar NOTIFICACIONES
echo "📦 Procesando Notificaciones...\n";
$stmt = $pdo->query("SELECT id, evidencia_foto FROM notificaciones WHERE evidencia_foto LIKE 'http%'");
$count = 0;
while ($row = $stmt->fetch()) {
    $newPath = migrarFoto($row['evidencia_foto'], $row['id'], 'notif');
    if ($newPath) {
        $update = $pdo->prepare("UPDATE notificaciones SET evidencia_foto = ? WHERE id = ?");
        $update->execute([$newPath, $row['id']]);
        $count++;
    }
}
echo "✅ $count fotos de notificaciones migradas.\n\n";

// 2. Procesar VISITAS
echo "📍 Procesando Visitas...\n";
$stmt = $pdo->query("SELECT id, foto_url FROM visitas WHERE foto_url LIKE 'http%'");
$count = 0;
while ($row = $stmt->fetch()) {
    $newPath = migrarFoto($row['foto_url'], $row['id'], 'visita');
    if ($newPath) {
        $update = $pdo->prepare("UPDATE visitas SET foto_url = ? WHERE id = ?");
        $update->execute([$newPath, $row['id']]);
        $count++;
    }
}
echo "✅ $count fotos de visitas migradas.\n\n";

// 3. Procesar USUARIOS
echo "👤 Procesando Usuarios...\n";
$stmt = $pdo->query("SELECT id, foto FROM usuarios WHERE foto LIKE 'http%'");
$count = 0;
while ($row = $stmt->fetch()) {
    $newPath = migrarFoto($row['foto'], $row['id'], 'user');
    if ($newPath) {
        $update = $pdo->prepare("UPDATE usuarios SET foto = ? WHERE id = ?");
        $update->execute([$newPath, $row['id']]);
        $count++;
    }
}
echo "✅ $count fotos de perfiles migradas.\n\n";

echo "---------------------------------\n";
echo "✨ Proceso Finalizado con éxito.\n";
if (!$isCli) {
    echo "\nPodés cerrar esta ventana.";
}
