<?php
/**
 * SGND - File Upload API
 * Handles photo and audio uploads
 */

define('SGND_API', true);
require_once __DIR__ . '/config.php';

// Only accept POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit();
}

// Create upload directories if they don't exist
$evidenciasDir = UPLOAD_DIR . 'evidencias/';
$audiosDir = UPLOAD_DIR . 'audios/';

if (!file_exists($evidenciasDir)) {
    mkdir($evidenciasDir, 0755, true);
}
if (!file_exists($audiosDir)) {
    mkdir($audiosDir, 0755, true);
}

try {
    $type = $_POST['type'] ?? 'photo';
    $notificationId = $_POST['notification_id'] ?? 'unknown';

    if (!isset($_FILES['file'])) {
        throw new Exception('No file uploaded');
    }

    $file = $_FILES['file'];

    // Validate file
    if ($file['error'] !== UPLOAD_ERR_OK) {
        throw new Exception('Upload error: ' . $file['error']);
    }

    if ($file['size'] > MAX_UPLOAD_SIZE) {
        throw new Exception('File too large. Maximum size is ' . (MAX_UPLOAD_SIZE / 1024 / 1024) . 'MB');
    }

    // Determine file extension and destination
    if ($type === 'photo') {
        $allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);

        if (!in_array($mimeType, $allowedTypes)) {
            throw new Exception('Invalid file type. Allowed: JPEG, PNG, WebP');
        }

        $extension = match ($mimeType) {
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
            default => 'jpg'
        };

        $destDir = $evidenciasDir;
    } else {
        // Audio
        $extension = 'webm';
        $destDir = $audiosDir;
    }

    // Generate unique filename
    $filename = $notificationId . '_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $extension;
    $destPath = $destDir . $filename;

    // Move file
    if (!move_uploaded_file($file['tmp_name'], $destPath)) {
        throw new Exception('Failed to save file');
    }

    // Generate public URL
    $baseUrl = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http");
    $baseUrl .= "://" . $_SERVER['HTTP_HOST'];
    $relativePath = '/uploads/' . ($type === 'photo' ? 'evidencias/' : 'audios/') . $filename;
    $publicUrl = $baseUrl . $relativePath;

    echo json_encode([
        'success' => true,
        'data' => [
            'url' => $publicUrl,
            'filename' => $filename,
            'size' => $file['size']
        ]
    ]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
