<?php
/**
 * API Endpoint: Auditoría
 * Consulta y gestión de logs de auditoría
 */

require_once 'db.php';
require_once 'AuditLogger.php';

header('Content-Type: application/json');

// Note: Frontend controls access to audit view (admin-only menu)
// No session check needed here as other endpoints don't use it either

$pdo = Database::getInstance()->getConnection();
$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($method === 'GET') {
        // Check if requesting stats first
        if (isset($_GET['stats'])) {
            // Obtener estadísticas de auditoría
            $stats = [];

            // Total de acciones hoy
            $stmt = $pdo->query("
                SELECT COUNT(*) as total 
                FROM audit_log 
                WHERE DATE(created_at) = CURDATE()
            ");
            $stats['acciones_hoy'] = $stmt->fetch(PDO::FETCH_ASSOC)['total'];

            // Reportes generados esta semana
            $stmt = $pdo->query("
                SELECT COUNT(*) as total 
                FROM audit_log 
                WHERE accion = 'GENERATE_REPORT' 
                AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            ");
            $stats['reportes_semana'] = $stmt->fetch(PDO::FETCH_ASSOC)['total'];

            // Usuarios activos hoy
            $stmt = $pdo->query("
                SELECT COUNT(DISTINCT usuario_id) as total 
                FROM audit_log 
                WHERE DATE(created_at) = CURDATE()
            ");
            $stats['usuarios_activos'] = $stmt->fetch(PDO::FETCH_ASSOC)['total'];

            // Alertas (errores/warnings)
            $stmt = $pdo->query("
                SELECT COUNT(*) as total 
                FROM audit_log 
                WHERE severidad IN ('error', 'critical', 'warning')
                AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
            ");
            $stats['alertas'] = $stmt->fetch(PDO::FETCH_ASSOC)['total'];

            // Actividad por hora (últimas 24h)
            $stmt = $pdo->query("
                SELECT 
                    HOUR(created_at) as hora,
                    COUNT(*) as count
                FROM audit_log
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
                GROUP BY HOUR(created_at)
                ORDER BY hora
            ");
            $stats['actividad_por_hora'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Top 5 usuarios más activos
            $stmt = $pdo->query("
                SELECT 
                    usuario_nombre,
                    COUNT(*) as acciones
                FROM audit_log
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                AND usuario_nombre IS NOT NULL
                GROUP BY usuario_nombre
                ORDER BY acciones DESC
                LIMIT 5
            ");
            $stats['top_usuarios'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Distribución de acciones
            $stmt = $pdo->query("
                SELECT 
                    accion,
                    COUNT(*) as count
                FROM audit_log
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                GROUP BY accion
                ORDER BY count DESC
            ");
            $stats['distribucion_acciones'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

            Database::sendResponse($stats);
        } else {
            // Obtener logs con filtros
            $page = isset($_GET['page']) ? (int) $_GET['page'] : 1;
            $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 50;
            $offset = ($page - 1) * $limit;

            // Construir query con filtros
            $where = [];
            $params = [];

            if (isset($_GET['usuario_id'])) {
                $where[] = "usuario_id = :usuario_id";
                $params['usuario_id'] = $_GET['usuario_id'];
            }

            if (isset($_GET['accion'])) {
                $where[] = "accion = :accion";
                $params['accion'] = $_GET['accion'];
            }

            if (isset($_GET['entidad'])) {
                $where[] = "entidad = :entidad";
                $params['entidad'] = $_GET['entidad'];
            }

            if (isset($_GET['severidad'])) {
                $where[] = "severidad = :severidad";
                $params['severidad'] = $_GET['severidad'];
            }

            if (isset($_GET['fecha_desde'])) {
                $where[] = "created_at >= :fecha_desde";
                $params['fecha_desde'] = $_GET['fecha_desde'];
            }

            if (isset($_GET['fecha_hasta'])) {
                $where[] = "created_at <= :fecha_hasta";
                $params['fecha_hasta'] = $_GET['fecha_hasta'];
            }

            if (isset($_GET['buscar'])) {
                $where[] = "MATCH(descripcion) AGAINST(:buscar IN NATURAL LANGUAGE MODE)";
                $params['buscar'] = $_GET['buscar'];
            }

            $whereClause = count($where) > 0 ? 'WHERE ' . implode(' AND ', $where) : '';

            // Contar total de registros
            $countStmt = $pdo->prepare("SELECT COUNT(*) as total FROM audit_log $whereClause");
            $countStmt->execute($params);
            $total = $countStmt->fetch(PDO::FETCH_ASSOC)['total'];

            // Obtener logs
            $stmt = $pdo->prepare("
                SELECT 
                    id, usuario_id, usuario_nombre, usuario_rol,
                    accion, entidad, entidad_id,
                    descripcion, datos_anteriores, datos_nuevos, metadatos,
                    ip_address, user_agent, ruta, metodo,
                    severidad, resultado, mensaje_error,
                    created_at
                FROM audit_log
                $whereClause
                ORDER BY created_at DESC
                LIMIT :limit OFFSET :offset
            ");

            foreach ($params as $key => $value) {
                $stmt->bindValue(":$key", $value);
            }
            $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
            $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);

            $stmt->execute();
            $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Decodificar JSON
            foreach ($logs as &$log) {
                $log['datos_anteriores'] = $log['datos_anteriores'] ? json_decode($log['datos_anteriores'], true) : null;
                $log['datos_nuevos'] = $log['datos_nuevos'] ? json_decode($log['datos_nuevos'], true) : null;
                $log['metadatos'] = $log['metadatos'] ? json_decode($log['metadatos'], true) : null;
            }

            Database::sendResponse([
                'logs' => $logs,
                'total' => $total,
                'page' => $page,
                'limit' => $limit,
                'pages' => ceil($total / $limit)
            ]);
        }
    } else {
        http_response_code(405);
        Database::sendError('Método no permitido');
    }

} catch (Exception $e) {
    http_response_code(500);
    Database::sendError('Error al procesar solicitud: ' . $e->getMessage());
}
