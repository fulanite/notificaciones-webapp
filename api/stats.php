<?php
/**
 * SGND - Statistics API
 * Endpoints for dashboard statistics
 */

require_once __DIR__ . '/db.php';

$db = Database::getInstance();
$pdo = $db->getConnection();
$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'GET') {
    Database::sendError('Method not allowed', 405);
}

try {
    $type = $_GET['type'] ?? 'general';

    switch ($type) {
        case 'general':
            // General statistics
            $stmt = $pdo->query("
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN estado = 'pendiente' THEN 1 ELSE 0 END) as pendientes,
                    SUM(CASE WHEN estado = 'diligenciada' THEN 1 ELSE 0 END) as diligenciadas,
                    SUM(CASE WHEN estado = 'diferida' THEN 1 ELSE 0 END) as diferidas
                FROM notificaciones
            ");
            Database::sendResponse($stmt->fetch());
            break;

        case 'by_type':
            // Statistics by notification type
            $stmt = $pdo->query("
                SELECT 
                    tipo_notificacion as type,
                    COUNT(*) as count
                FROM notificaciones
                GROUP BY tipo_notificacion
                ORDER BY count DESC
            ");
            Database::sendResponse($stmt->fetchAll());
            break;

        case 'by_result':
            // Statistics by result
            $stmt = $pdo->query("
                SELECT 
                    resultado_diligencia as result,
                    COUNT(*) as count
                FROM notificaciones
                WHERE resultado_diligencia IS NOT NULL
                GROUP BY resultado_diligencia
                ORDER BY count DESC
            ");
            Database::sendResponse($stmt->fetchAll());
            break;

        case 'by_ujier':
            // Performance by ujier
            $stmt = $pdo->query("
                SELECT 
                    u.id,
                    u.nombre,
                    COUNT(n.id) as total,
                    SUM(CASE WHEN n.estado = 'diligenciada' THEN 1 ELSE 0 END) as completed,
                    ROUND(
                        SUM(CASE WHEN n.estado = 'diligenciada' THEN 1 ELSE 0 END) * 100.0 / 
                        NULLIF(COUNT(n.id), 0), 
                        2
                    ) as percentage
                FROM usuarios u
                LEFT JOIN notificaciones n ON u.id = n.asignado_a
                WHERE u.rol = 'ujier' AND u.activo = 1
                GROUP BY u.id, u.nombre
                ORDER BY completed DESC
            ");
            Database::sendResponse($stmt->fetchAll());
            break;

        case 'by_zone':
            // Statistics by zone
            $stmt = $pdo->query("
                SELECT 
                    zona as zone,
                    COUNT(*) as total,
                    SUM(CASE WHEN estado = 'pendiente' THEN 1 ELSE 0 END) as pendientes,
                    SUM(CASE WHEN estado = 'diligenciada' THEN 1 ELSE 0 END) as diligenciadas
                FROM notificaciones
                GROUP BY zona
                ORDER BY total DESC
            ");
            Database::sendResponse($stmt->fetchAll());
            break;

        case 'daily':
            // Daily statistics for the last 30 days
            $stmt = $pdo->query("
                SELECT 
                    DATE(fecha_carga) as date,
                    COUNT(*) as created,
                    SUM(CASE WHEN estado = 'diligenciada' THEN 1 ELSE 0 END) as completed
                FROM notificaciones
                WHERE fecha_carga >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                GROUP BY DATE(fecha_carga)
                ORDER BY date DESC
            ");
            Database::sendResponse($stmt->fetchAll());
            break;

        default:
            Database::sendError('Invalid stats type', 400);
    }
} catch (PDOException $e) {
    Database::sendError('Database error: ' . $e->getMessage(), 500);
}
