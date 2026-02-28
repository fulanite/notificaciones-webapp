<?php
/**
 * SGND - Settings API
 * Manages application-wide settings
 */

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/AuditLogger.php';

session_start();
$db = Database::getInstance();
$pdo = $db->getConnection();
$logger = new AuditLogger($pdo);
$method = $_SERVER['REQUEST_METHOD'];

// Ensure table exists
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS app_settings (
        setting_key VARCHAR(50) PRIMARY KEY,
        setting_value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_by VARCHAR(100)
    )");
} catch (PDOException $e) {
    // Ignore error if table exists or permission issue
}

try {
    switch ($method) {
        case 'GET':
            $stmt = $pdo->prepare("SELECT setting_key, setting_value FROM app_settings");
            $stmt->execute();
            $results = $stmt->fetchAll();
            $settings = [];
            foreach ($results as $row) {
                // Try to JSON decode if it looks like JSON, but for now we only have strings
                $settings[$row['setting_key']] = $row['setting_value'];
            }
            Database::sendResponse($settings);
            break;

        case 'POST':
        case 'PUT':
            // Only Coordinator and Admin can update settings
            $userRol = $_SESSION['user_rol'] ?? '';
            if ($userRol !== 'coordinador' && $userRol !== 'admin') {
                Database::sendError('No tenés permisos para cambiar la configuración', 403);
            }

            $data = Database::getJsonBody();
            if (empty($data)) {
                Database::sendError('No data provided', 400);
            }

            foreach ($data as $key => $value) {
                $stmt = $pdo->prepare("
                    INSERT INTO app_settings (setting_key, setting_value, updated_at, updated_by)
                    VALUES (?, ?, NOW(), ?)
                    ON DUPLICATE KEY UPDATE 
                        setting_value = VALUES(setting_value), 
                        updated_at = NOW(), 
                        updated_by = VALUES(updated_by)
                ");
                $stmt->execute([$key, $value, $_SESSION['user_nombre'] ?? 'System']);

                // Log the change
                $logger->logUpdate('setting', $key, null, ['value' => $value], [
                    'id' => $_SESSION['user_id'] ?? 'system',
                    'nombre' => $_SESSION['user_nombre'] ?? 'System',
                    'rol' => $_SESSION['user_rol'] ?? 'system'
                ], "Actualizó configuración: $key = $value");
            }

            Database::sendResponse(['message' => 'Configuración actualizada']);
            break;

        default:
            Database::sendError('Method not allowed', 405);
    }
} catch (PDOException $e) {
    Database::sendError('Database error: ' . $e->getMessage(), 500);
}
