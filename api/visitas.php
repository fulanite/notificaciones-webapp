<?php
/**
 * SGND - Visitas API
 * Endpoints for visit history
 */

require_once __DIR__ . '/db.php';

$db = Database::getInstance();
$pdo = $db->getConnection();
$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {
        case 'GET':
            if (isset($_GET['notificacion_id'])) {
                // Get visits for a notification
                $stmt = $pdo->prepare("
                    SELECT v.*, u.nombre as ujier_nombre
                    FROM visitas v
                    LEFT JOIN usuarios u ON v.ujier_id = u.id
                    WHERE v.notificacion_id = ?
                    ORDER BY v.fecha DESC
                ");
                $stmt->execute([$_GET['notificacion_id']]);
                Database::sendResponse($stmt->fetchAll());
            } elseif (isset($_GET['ujier_id'])) {
                // Get visits by ujier
                $stmt = $pdo->prepare("
                    SELECT v.*, n.n_expediente, n.destinatario_nombre, n.tipo_notificacion
                    FROM visitas v
                    LEFT JOIN notificaciones n ON v.notificacion_id = n.id
                    WHERE v.ujier_id = ?
                    ORDER BY v.fecha DESC
                    LIMIT 100
                ");
                $stmt->execute([$_GET['ujier_id']]);
                Database::sendResponse($stmt->fetchAll());
            } else {
                // Get all recent visits
                $stmt = $pdo->query("
                    SELECT v.*, u.nombre as ujier_nombre, n.n_expediente
                    FROM visitas v
                    LEFT JOIN usuarios u ON v.ujier_id = u.id
                    LEFT JOIN notificaciones n ON v.notificacion_id = n.id
                    ORDER BY v.fecha DESC
                    LIMIT 100
                ");
                Database::sendResponse($stmt->fetchAll());
            }
            break;

        case 'POST':
            // Create visit record
            $data = Database::getJsonBody();

            if (empty($data['notificacion_id'])) {
                Database::sendError('Notification ID is required', 400);
            }

            $id = Database::generateUUID();
            $stmt = $pdo->prepare("
                INSERT INTO visitas (id, notificacion_id, ujier_id, resultado, observaciones, ubicacion_lat, ubicacion_lng, foto_url, audio_url, fecha)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            ");

            $stmt->execute([
                $id,
                $data['notificacion_id'],
                $data['ujier_id'] ?? null,
                $data['resultado'] ?? null,
                $data['observaciones'] ?? null,
                $data['ubicacion_lat'] ?? null,
                $data['ubicacion_lng'] ?? null,
                $data['foto_url'] ?? null,
                $data['audio_url'] ?? null
            ]);

            $stmt = $pdo->prepare("SELECT * FROM visitas WHERE id = ?");
            $stmt->execute([$id]);
            Database::sendResponse($stmt->fetch(), 201);
            break;

        default:
            Database::sendError('Method not allowed', 405);
    }
} catch (PDOException $e) {
    Database::sendError('Database error: ' . $e->getMessage(), 500);
}
