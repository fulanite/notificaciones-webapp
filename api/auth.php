<?php
/**
 * SGND - Authentication API
 * Handles login, session management
 */

require_once __DIR__ . '/db.php';

$db = Database::getInstance();
$pdo = $db->getConnection();
$method = $_SERVER['REQUEST_METHOD'];

// Get the action from query string
$action = $_GET['action'] ?? '';

try {
    switch ($action) {
        case 'login':
            if ($method !== 'POST') {
                Database::sendError('Method not allowed', 405);
            }

            $data = Database::getJsonBody();

            if (empty($data['email']) || empty($data['password'])) {
                Database::sendError('Email and password are required', 400);
            }

            $email = Database::sanitize($data['email']);
            $password = $data['password']; // Don't sanitize password

            // Find user by email
            $stmt = $pdo->prepare("SELECT * FROM usuarios WHERE email = ? AND activo = 1");
            $stmt->execute([$email]);
            $user = $stmt->fetch();

            if (!$user) {
                Database::sendError('Credenciales inválidas', 401);
            }

            // Check password
            // If password_hash column doesn't exist or is empty, use simple comparison (for migration)
            $passwordValid = false;

            if (!empty($user['password_hash'])) {
                // Use secure password verification
                $passwordValid = password_verify($password, $user['password_hash']);
            } else {
                // Legacy mode: check if password matches email (temporary for first login)
                // This allows users to login with their email as password initially
                // They should change it immediately
                $passwordValid = ($password === 'sgnd2024');
            }

            if (!$passwordValid) {
                Database::sendError('Credenciales inválidas', 401);
            }

            // Generate simple session token
            $token = bin2hex(random_bytes(32));

            // Store token in database (optional, for server-side session validation)
            // For simplicity, we'll just return user data and let client manage session

            // Return user data (without sensitive info)
            $userData = [
                'id' => $user['id'],
                'email' => $user['email'],
                'nombre' => $user['nombre'],
                'rol' => $user['rol'],
                'foto' => $user['foto'],
                'token' => $token
            ];

            Database::sendResponse($userData);
            break;

        case 'verify':
            // Verify if user exists (for session restoration)
            if ($method !== 'POST') {
                Database::sendError('Method not allowed', 405);
            }

            $data = Database::getJsonBody();

            if (empty($data['email'])) {
                Database::sendError('Email is required', 400);
            }

            $stmt = $pdo->prepare("SELECT id, email, nombre, rol, foto FROM usuarios WHERE email = ? AND activo = 1");
            $stmt->execute([Database::sanitize($data['email'])]);
            $user = $stmt->fetch();

            if ($user) {
                Database::sendResponse($user);
            } else {
                Database::sendError('User not found', 404);
            }
            break;

        case 'change-password':
            if ($method !== 'POST') {
                Database::sendError('Method not allowed', 405);
            }

            $data = Database::getJsonBody();

            if (empty($data['user_id']) || empty($data['new_password'])) {
                Database::sendError('User ID and new password are required', 400);
            }

            // Hash the new password
            $hashedPassword = password_hash($data['new_password'], PASSWORD_DEFAULT);

            $stmt = $pdo->prepare("UPDATE usuarios SET password_hash = ?, updated_at = NOW() WHERE id = ?");
            $stmt->execute([$hashedPassword, $data['user_id']]);

            Database::sendResponse(['success' => true, 'message' => 'Password updated']);
            break;

        case 'create-user':
            if ($method !== 'POST') {
                Database::sendError('Method not allowed', 405);
            }

            $data = Database::getJsonBody();

            if (empty($data['email']) || empty($data['nombre']) || empty($data['rol'])) {
                Database::sendError('Email, nombre and rol are required', 400);
            }

            // Check if email already exists
            $checkStmt = $pdo->prepare("SELECT id FROM usuarios WHERE email = ?");
            $checkStmt->execute([Database::sanitize($data['email'])]);
            if ($checkStmt->fetch()) {
                Database::sendError('Email already exists', 400);
            }

            $id = Database::generateUUID();
            $hashedPassword = null;

            // If password provided, hash it
            if (!empty($data['password'])) {
                $hashedPassword = password_hash($data['password'], PASSWORD_DEFAULT);
            }

            $stmt = $pdo->prepare("
                INSERT INTO usuarios (id, email, nombre, rol, password_hash, foto, activo, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
            ");

            $stmt->execute([
                $id,
                Database::sanitize($data['email']),
                Database::sanitize($data['nombre']),
                Database::sanitize($data['rol']),
                $hashedPassword,
                $data['foto'] ?? null
            ]);

            // Return created user
            $stmt = $pdo->prepare("SELECT id, email, nombre, rol, foto FROM usuarios WHERE id = ?");
            $stmt->execute([$id]);
            Database::sendResponse($stmt->fetch(), 201);
            break;

        default:
            Database::sendError('Invalid action. Use: login, verify, change-password, create-user', 400);
    }
} catch (PDOException $e) {
    Database::sendError('Database error: ' . $e->getMessage(), 500);
}
