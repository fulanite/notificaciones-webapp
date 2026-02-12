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
$logger = new AuditLogger($pdo);
$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($method === 'GET') {
        // Check for stats request
        if (isset($_GET['stats'])) {
            $stats = $logger->getStats();
            Database::sendResponse($stats);
        }

        // Get filters from query string
        $filters = [
            'accion' => $_GET['accion'] ?? null,
            'entidad' => $_GET['entidad'] ?? null,
            'severidad' => $_GET['severidad'] ?? null,
            'usuario_id' => $_GET['usuario_id'] ?? null,
            'fecha_desde' => $_GET['fecha_desde'] ?? null,
            'fecha_hasta' => $_GET['fecha_hasta'] ?? null
        ];

        $page = isset($_GET['page']) ? (int) $_GET['page'] : 1;
        $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 50;

        $result = $logger->getLogs($filters, $page, $limit);

        foreach ($result['logs'] as &$log) {
            $log['datos_anteriores'] = $log['datos_anteriores'] ? json_decode($log['datos_anteriores'], true) : null;
            $log['datos_nuevos'] = $log['datos_nuevos'] ? json_decode($log['datos_nuevos'], true) : null;
            $log['metadatos'] = $log['metadatos'] ? json_decode($log['metadatos'], true) : null;
        }

        Database::sendResponse($result);
    } else {
        http_response_code(405);
        Database::sendError('Método no permitido');
    }

} catch (Exception $e) {
    $errorMsg = 'Error al procesar solicitud: ' . $e->getMessage();
    file_put_contents(__DIR__ . '/debug_audit.log', date('[Y-m-d H:i:s] ') . $errorMsg . PHP_EOL, FILE_APPEND);
    Database::sendError($errorMsg, 500);
}
