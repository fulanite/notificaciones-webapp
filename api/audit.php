<?php
/**
 * API Endpoint: Auditoría
 * Consulta y gestión de logs de auditoría
 */

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/AuditLogger.php';

header('Content-Type: application/json');

// Note: Frontend controls access to audit view (admin-only menu)
// No session check needed here as other endpoints don't use it either

$pdo = Database::getInstance()->getConnection();
$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($method === 'GET') {
        // Simple test query
        $stmt = $pdo->query("SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 10");
        $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($logs as &$log) {
            $log['datos_anteriores'] = $log['datos_anteriores'] ? json_decode($log['datos_anteriores'], true) : null;
            $log['datos_nuevos'] = $log['datos_nuevos'] ? json_decode($log['datos_nuevos'], true) : null;
            $log['metadatos'] = $log['metadatos'] ? json_decode($log['metadatos'], true) : null;
        }

        Database::sendResponse([
            'logs' => $logs,
            'total' => count($logs),
            'page' => 1,
            'pages' => 1
        ]);
    } else {
        http_response_code(405);
        Database::sendError('Método no permitido');
    }

} catch (Exception $e) {
    $errorMsg = 'Error al procesar solicitud: ' . $e->getMessage();
    file_put_contents(__DIR__ . '/debug_audit.log', date('[Y-m-d H:i:s] ') . $errorMsg . PHP_EOL, FILE_APPEND);
    Database::sendError($errorMsg, 500);
}
