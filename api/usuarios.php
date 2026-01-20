<?php
/**
 * SGND - Users API
 * Endpoints for user management
 */

require_once __DIR__ . '/db.php';

$db = Database::getInstance();
$pdo = $db->getConnection();
$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {
        case 'GET':
            // Get users
            if (isset($_GET['id'])) {
                // Get single user by ID
                $stmt = $pdo->prepare("SELECT * FROM usuarios WHERE id = ?");
                $stmt->execute([$_GET['id']]);
                $user = $stmt->fetch();

                if ($user) {
                    Database::sendResponse($user);
                } else {
                    Database::sendError('User not found', 404);
                }
            } elseif (isset($_GET['email'])) {
                // Get user by email
                $stmt = $pdo->prepare("SELECT * FROM usuarios WHERE email = ?");
                $stmt->execute([$_GET['email']]);
                $user = $stmt->fetch();

                if ($user) {
                    Database::sendResponse($user);
                } else {
                    Database::sendError('User not found', 404);
                }
            } elseif (isset($_GET['rol'])) {
                // Get users by role
                $stmt = $pdo->prepare("SELECT * FROM usuarios WHERE rol = ? AND activo = 1 ORDER BY nombre");
                $stmt->execute([$_GET['rol']]);
                Database::sendResponse($stmt->fetchAll());
            } else {
                // Get all users
                $stmt = $pdo->query("SELECT * FROM usuarios WHERE activo = 1 ORDER BY nombre");
                Database::sendResponse($stmt->fetchAll());
            }
            break;

        case 'POST':
            // Create user
            $data = Database::getJsonBody();

            if (empty($data['email']) || empty($data['nombre']) || empty($data['rol'])) {
                Database::sendError('Email, nombre and rol are required', 400);
            }

            $id = Database::generateUUID();
            $stmt = $pdo->prepare("
                INSERT INTO usuarios (id, email, nombre, rol, foto, activo, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW())
            ");

            $stmt->execute([
                $id,
                Database::sanitize($data['email']),
                Database::sanitize($data['nombre']),
                Database::sanitize($data['rol']),
                $data['foto'] ?? null
            ]);

            // Return created user
            $stmt = $pdo->prepare("SELECT * FROM usuarios WHERE id = ?");
            $stmt->execute([$id]);
            Database::sendResponse($stmt->fetch(), 201);
            break;

        case 'PUT':
            // Update user
            $data = Database::getJsonBody();

            if (empty($data['id'])) {
                Database::sendError('User ID is required', 400);
            }

            $updates = [];
            $params = [];

            if (isset($data['nombre'])) {
                $updates[] = "nombre = ?";
                $params[] = Database::sanitize($data['nombre']);
            }
            if (isset($data['rol'])) {
                $updates[] = "rol = ?";
                $params[] = Database::sanitize($data['rol']);
            }
            if (isset($data['foto'])) {
                $updates[] = "foto = ?";
                $params[] = $data['foto'];
            }
            if (isset($data['activo'])) {
                $updates[] = "activo = ?";
                $params[] = $data['activo'] ? 1 : 0;
            }

            if (empty($updates)) {
                Database::sendError('No fields to update', 400);
            }

            $updates[] = "updated_at = NOW()";
            $params[] = $data['id'];

            $sql = "UPDATE usuarios SET " . implode(", ", $updates) . " WHERE id = ?";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);

            // Return updated user
            $stmt = $pdo->prepare("SELECT * FROM usuarios WHERE id = ?");
            $stmt->execute([$data['id']]);
            Database::sendResponse($stmt->fetch());
            break;

        case 'DELETE':
            // Soft delete user (set activo = 0)
            $data = Database::getJsonBody();

            if (empty($data['id'])) {
                Database::sendError('User ID is required', 400);
            }

            $stmt = $pdo->prepare("UPDATE usuarios SET activo = 0, updated_at = NOW() WHERE id = ?");
            $stmt->execute([$data['id']]);

            Database::sendResponse(['deleted' => true]);
            break;

        default:
            Database::sendError('Method not allowed', 405);
    }
} catch (PDOException $e) {
    Database::sendError('Database error: ' . $e->getMessage(), 500);
}
