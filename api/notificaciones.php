<?php
/**
 * SGND - Notifications API
 * Endpoints for notification management
 */

require_once __DIR__ . '/db.php';

$db = Database::getInstance();
$pdo = $db->getConnection();
$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {
        case 'GET':
            if (isset($_GET['id'])) {
                // Get single notification with user info
                $stmt = $pdo->prepare("
                    SELECT n.*, 
                           COALESCE(u1.nombre, u2.nombre) as ujier_nombre, 
                           COALESCE(u1.email, u2.email) as ujier_email
                    FROM notificaciones n
                    LEFT JOIN usuarios u1 ON n.asignado_a = u1.id
                    LEFT JOIN usuarios u2 ON n.asignado_a = u2.dni
                    WHERE n.id = ?
                ");
                $stmt->execute([$_GET['id']]);
                $notification = $stmt->fetch();

                if ($notification) {
                    Database::sendResponse($notification);
                } else {
                    Database::sendError('Notification not found', 404);
                }
            } elseif (isset($_GET['asignado_a'])) {
                // Get notifications assigned to a user
                $estadosStr = $_GET['estado'] ?? 'pendiente';
                $estadosArr = explode(',', $estadosStr);
                $placeholders = implode(',', array_fill(0, count($estadosArr), '?'));

                $sql = "SELECT * FROM notificaciones 
                        WHERE asignado_a = ? AND estado IN ($placeholders) AND devuelta_por_ujier = 0
                        ORDER BY COALESCE(fecha_entrega_ujier, fecha_carga) ASC";

                $stmt = $pdo->prepare($sql);
                $stmt->execute(array_merge([$_GET['asignado_a']], $estadosArr));
                Database::sendResponse($stmt->fetchAll());
            } else {
                // Get all notifications with filters
                $where = ["1=1"];
                $params = [];

                if (!empty($_GET['estado'])) {
                    $estadosArr = explode(',', $_GET['estado']);
                    $placeholders = implode(',', array_fill(0, count($estadosArr), '?'));
                    $where[] = "n.estado IN ($placeholders)";
                    foreach ($estadosArr as $est) {
                        $params[] = trim($est);
                    }
                }

                if (!empty($_GET['tipo'])) {
                    $where[] = "n.tipo_notificacion = ?";
                    $params[] = $_GET['tipo'];
                }

                if (!empty($_GET['fecha'])) {
                    $where[] = "DATE(COALESCE(n.fecha_entrega_ujier, n.fecha_carga)) = ?";
                    $params[] = $_GET['fecha'];
                }

                if (!empty($_GET['zona'])) {
                    $where[] = "n.zona = ?";
                    $params[] = $_GET['zona'];
                }

                if (!empty($_GET['year'])) {
                    $year = (int) $_GET['year'];
                    $where[] = "YEAR(COALESCE(n.fecha_entrega_ujier, n.fecha_carga)) = ?";
                    $params[] = $year;
                }

                if (isset($_GET['devuelta_por_ujier'])) {
                    $val = (int) $_GET['devuelta_por_ujier'];
                    if ($val === 0) {
                        $where[] = "(n.devuelta_por_ujier = 0 OR n.devuelta_por_ujier IS NULL)";
                    } else {
                        $where[] = "n.devuelta_por_ujier = ?";
                        $params[] = $val;
                    }
                }

                if (!empty($_GET['own_only']) && $_GET['own_only'] == '1' && !empty($_GET['user_email'])) {
                    $where[] = "n.usuario_carga = ?";
                    $params[] = $_GET['user_email'];
                }

                if (!empty($_GET['search'])) {
                    $search = "%" . $_GET['search'] . "%";
                    $where[] = "(
                        n.id LIKE ? OR 
                        n.glide_id_cedula LIKE ? OR 
                        n.n_expediente LIKE ? OR 
                        n.destinatario_nombre LIKE ? OR 
                        n.caratula LIKE ? OR 
                        n.origen LIKE ? OR 
                        n.letrado LIKE ? OR 
                        n.domicilio LIKE ? OR 
                        n.zona LIKE ? OR 
                        n.n_troquel LIKE ? OR 
                        n.tipo_notificacion LIKE ? OR 
                        n.observaciones_iniciales LIKE ? OR 
                        n.observaciones_resultado LIKE ? OR 
                        n.destinatario_especial LIKE ?
                    )";
                    // Add params for each field (14 fields now)
                    for ($i = 0; $i < 14; $i++) {
                        $params[] = $search;
                    }
                }

                // Count total
                $countSql = "SELECT COUNT(*) as total FROM notificaciones n WHERE " . implode(" AND ", $where);
                $countStmt = $pdo->prepare($countSql);
                $countStmt->execute($params);
                $total = $countStmt->fetch()['total'];

                // Pagination
                $page = isset($_GET['page']) ? max(1, (int) $_GET['page']) : 1;
                $limit = isset($_GET['limit']) ? min(5000, max(1, (int) $_GET['limit'])) : 20;
                $offset = ($page - 1) * $limit;

                $sql = "
                    SELECT n.*, 
                           COALESCE(u1.nombre, u2.nombre) as ujier_nombre, 
                           COALESCE(u1.email, u2.email) as ujier_email
                    FROM notificaciones n
                    LEFT JOIN usuarios u1 ON n.asignado_a = u1.id
                    LEFT JOIN usuarios u2 ON n.asignado_a = u2.dni
                    WHERE " . implode(" AND ", $where) . "
                    ORDER BY COALESCE(n.fecha_entrega_ujier, n.fecha_carga) DESC, n.created_at DESC
                    LIMIT $limit OFFSET $offset
                ";

                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);

                Database::sendResponse([
                    'data' => $stmt->fetchAll(),
                    'total' => (int) $total,
                    'page' => $page,
                    'limit' => $limit,
                    'pages' => ceil($total / $limit)
                ]);
            }
            break;

        case 'POST':
            $data = Database::getJsonBody();

            // Validate required fields
            $required = ['tipo_notificacion', 'n_expediente', 'caratula', 'origen', 'destinatario_nombre', 'zona'];
            foreach ($required as $field) {
                if (empty($data[$field])) {
                    Database::sendError("Field '$field' is required", 400);
                }
            }

            // Domicilio is only required if NOT a special recipient
            if (empty($data['destinatario_especial']) && empty($data['domicilio'])) {
                Database::sendError("Field 'domicilio' is required for regular recipients", 400);
            }

            $id = Database::generateUUID();
            $stmt = $pdo->prepare("
                INSERT INTO notificaciones (
                    id, fecha_carga, fecha_entrega_ujier, usuario_carga, estado,
                    tipo_notificacion, n_expediente, caratula, origen, letrado,
                    destinatario_especial, destinatario_nombre, domicilio, zona,
                    tipo_troquel, sin_troquel, n_troquel, medio_pago, costo,
                    asignado_a, fecha_asignacion, asignado_por,
                    observaciones_iniciales, created_at, updated_at
                ) VALUES (
                    ?, NOW(), ?, ?, 'pendiente',
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?, ?,
                    ?, NOW(), NOW()
                )
            ");

            $stmt->execute([
                $id,
                $data['fecha_entrega_ujier'] ?? date('Y-m-d'),
                $data['usuario_carga'] ?? null,
                Database::sanitize($data['tipo_notificacion']),
                Database::sanitize($data['n_expediente']),
                Database::sanitize($data['caratula']),
                Database::sanitize($data['origen']),
                $data['letrado'] ?? null,
                $data['destinatario_especial'] ?? null,
                Database::sanitize($data['destinatario_nombre']),
                Database::sanitize($data['domicilio']),
                Database::sanitize($data['zona']),
                $data['tipo_troquel'] ?? null,
                $data['sin_troquel'] ?? 0,
                $data['n_troquel'] ?? null,
                $data['medio_pago'] ?? null,
                $data['costo'] ?? 0,
                $data['asignado_a'] ?? null,
                !empty($data['asignado_a']) ? date('Y-m-d H:i:s') : null,
                $data['asignado_por'] ?? null,
                $data['observaciones_iniciales'] ?? null
            ]);

            // Return created notification
            $stmt = $pdo->prepare("SELECT * FROM notificaciones WHERE id = ?");
            $stmt->execute([$id]);
            Database::sendResponse($stmt->fetch(), 201);
            break;

        case 'PUT':
            $data = Database::getJsonBody();

            if (empty($data['id'])) {
                Database::sendError('Notification ID is required', 400);
            }

            // Check for special actions
            if (isset($data['action'])) {
                switch ($data['action']) {
                    case 'assign':
                        // Assign notification to ujier
                        $stmt = $pdo->prepare("
                            UPDATE notificaciones SET
                                asignado_a = ?,
                                fecha_asignacion = NOW(),
                                asignado_por = ?,
                                updated_at = NOW(),
                                updated_by = ?
                            WHERE id = ?
                        ");
                        $stmt->execute([
                            $data['asignado_a'],
                            $data['asignado_por'],
                            $data['asignado_por'],
                            $data['id']
                        ]);
                        break;

                    case 'result':
                        // Register result (diligencia)
                        $newEstado = 'diligenciada';
                        if ($data['es_carga_diferida'] ?? false) {
                            $newEstado = 'diferida';
                        } elseif (($data['resultado'] ?? '') === 'pre_aviso') {
                            $newEstado = 'pre_aviso';
                        }

                        $stmt = $pdo->prepare("
                            UPDATE notificaciones SET
                                resultado_diligencia = ?,
                                fecha_diligencia = NOW(),
                                ubicacion_lat = ?,
                                ubicacion_lng = ?,
                                evidencia_foto = ?,
                                observacion_audio = ?,
                                transcripcion_audio = ?,
                                es_carga_diferida = ?,
                                motivo_falla_senal = ?,
                                observaciones_resultado = ?,
                                estado = ?,
                                diligenciado_por = ?,
                                updated_at = NOW(),
                                updated_by = ?
                            WHERE id = ?
                        ");
                        $stmt->execute([
                            $data['resultado'],
                            $data['ubicacion_lat'] ?? null,
                            $data['ubicacion_lng'] ?? null,
                            $data['evidencia_foto'] ?? null,
                            $data['observacion_audio'] ?? null,
                            $data['transcripcion_audio'] ?? null,
                            $data['es_carga_diferida'] ?? 0,
                            $data['motivo_falla_senal'] ?? null,
                            $data['observaciones'] ?? null,
                            $newEstado,
                            $data['user_id'],
                            $data['user_id'],
                            $data['id']
                        ]);

                        // Also save to visitas history
                        $visitaId = Database::generateUUID();
                        $stmtVisita = $pdo->prepare("
                            INSERT INTO visitas (id, notificacion_id, ujier_id, resultado, observaciones, transcripcion_audio, ubicacion_lat, ubicacion_lng, foto_url, audio_url, fecha)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                        ");
                        $stmtVisita->execute([
                            $visitaId,
                            $data['id'],
                            $data['user_id'],
                            $data['resultado'],
                            $data['observaciones'] ?? null,
                            $data['transcripcion_audio'] ?? null,
                            $data['ubicacion_lat'] ?? null,
                            $data['ubicacion_lng'] ?? null,
                            $data['evidencia_foto'] ?? null,
                            $data['observacion_audio'] ?? null
                        ]);
                        break;

                    case 'return':
                        // Mark as returned by ujier
                        $stmt = $pdo->prepare("
                            UPDATE notificaciones SET
                                devuelta_por_ujier = 1,
                                fecha_devolucion = NOW(),
                                updated_at = NOW(),
                                updated_by = ?
                            WHERE id = ?
                        ");
                        $stmt->execute([
                            $data['user_id'],
                            $data['id']
                        ]);
                        break;

                    default:
                        Database::sendError('Invalid action', 400);
                }
            } else {
                // Generic update
                $allowedFields = [
                    'estado',
                    'observaciones_iniciales',
                    'tipo_notificacion',
                    'n_expediente',
                    'caratula',
                    'origen',
                    'letrado',
                    'destinatario_nombre',
                    'domicilio',
                    'zona',
                    'asignado_a',
                    'fecha_entrega_ujier'
                ];
                $updates = [];
                $params = [];

                foreach ($allowedFields as $field) {
                    if (isset($data[$field])) {
                        $updates[] = "$field = ?";
                        $params[] = Database::sanitize($data[$field]);

                        // Si se cambia el ujier, actualizar también la fecha de asignación
                        if ($field === 'asignado_a' && !empty($data['asignado_a'])) {
                            $updates[] = "fecha_asignacion = NOW()";
                        }
                    }
                }

                if (empty($updates)) {
                    Database::sendError('No fields to update', 400);
                }

                $updates[] = "updated_at = NOW()";
                if (isset($data['updated_by'])) {
                    $updates[] = "updated_by = ?";
                    $params[] = $data['updated_by'];
                }
                $params[] = $data['id'];

                $sql = "UPDATE notificaciones SET " . implode(", ", $updates) . " WHERE id = ?";
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
            }

            // Return updated notification
            $stmt = $pdo->prepare("SELECT * FROM notificaciones WHERE id = ?");
            $stmt->execute([$data['id']]);
            Database::sendResponse($stmt->fetch());
            break;

        case 'DELETE':
            $data = Database::getJsonBody();

            if (empty($data['id'])) {
                Database::sendError('Notification ID is required', 400);
            }

            // Hard delete (or you could implement soft delete)
            $stmt = $pdo->prepare("DELETE FROM notificaciones WHERE id = ?");
            $stmt->execute([$data['id']]);

            Database::sendResponse(['deleted' => true]);
            break;

        default:
            Database::sendError('Method not allowed', 405);
    }
} catch (PDOException $e) {
    Database::sendError('Database error: ' . $e->getMessage(), 500);
}
