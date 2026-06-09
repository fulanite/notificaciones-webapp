<?php
/**
 * SGND - Database Connection Class
 * PDO wrapper for MySQL/MariaDB
 */

define('SGND_API', true);
require_once __DIR__ . '/config.php';

class Database
{
    private static $instance = null;
    private $pdo;

    private function __construct()
    {
        try {
            $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
            $options = [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ];

            $this->pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
            // Set timezone for the session
            $this->pdo->exec("SET time_zone = '-03:00'");
        } catch (PDOException $e) {
            $this->sendError('Database connection failed: ' . $e->getMessage(), 500);
        }
    }

    public static function getInstance()
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public function getConnection()
    {
        return $this->pdo;
    }

    // Helper: Send JSON response
    public static function sendResponse($data, $code = 200)
    {
        if (isset($_SERVER['HTTP_ORIGIN'])) {
            header('Access-Control-Allow-Origin: ' . $_SERVER['HTTP_ORIGIN']);
            header('Access-Control-Allow-Credentials: true');
        } else {
            header('Access-Control-Allow-Origin: *');
        }

        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
        header('Content-Type: application/json');

        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            http_response_code(200);
            exit();
        }

        http_response_code($code);
        echo json_encode([
            'success' => $code >= 200 && $code < 300,
            'data' => $data
        ]);
        exit();
    }

    // Helper: Send error response
    public static function sendError($message, $code = 400)
    {
        if (isset($_SERVER['HTTP_ORIGIN'])) {
            header('Access-Control-Allow-Origin: ' . $_SERVER['HTTP_ORIGIN']);
            header('Access-Control-Allow-Credentials: true');
        } else {
            header('Access-Control-Allow-Origin: *');
        }

        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
        header('Content-Type: application/json');

        http_response_code($code);
        echo json_encode([
            'success' => false,
            'error' => $message
        ]);
        exit();
    }

    // Helper: Get JSON body
    public static function getJsonBody()
    {
        $json = file_get_contents('php://input');
        $data = json_decode($json, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            return [];
        }
        return $data;
    }

    // Helper: Generate UUID
    public static function generateUUID()
    {
        return sprintf(
            '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff)
        );
    }

    /**
     * Generar un ID secuencial atómico y seguro para concurrencia
     * Formato: N-YY-XXXX (Ej: N-26-0001)
     */
    public static function getNextId($pdo, $entity = 'notificacion', $prefix = 'N-')
    {
        $year = date('y');
        $fullPrefix = $prefix . $year . '-';

        try {
            $pdo->beginTransaction();

            // 1. Asegurar que exista la tabla de secuencias
            $pdo->exec("CREATE TABLE IF NOT EXISTS id_sequences (
                entity VARCHAR(50),
                year CHAR(2),
                last_number INT DEFAULT 0,
                PRIMARY KEY (entity, year)
            ) ENGINE=InnoDB");

            // 2. Bloquear la fila para el año actual (Atomicidad)
            $stmt = $pdo->prepare("SELECT last_number FROM id_sequences WHERE entity = ? AND year = ? FOR UPDATE");
            $stmt->execute([$entity, $year]);
            $current = $stmt->fetchColumn();

            if ($current === false) {
                // Primer ID del año
                $next = 1;
                $stmt = $pdo->prepare("INSERT INTO id_sequences (entity, year, last_number) VALUES (?, ?, ?)");
                $stmt->execute([$entity, $year, $next]);
            } else {
                $next = $current + 1;
                $stmt = $pdo->prepare("UPDATE id_sequences SET last_number = ? WHERE entity = ? AND year = ?");
                $stmt->execute([$next, $entity, $year]);
            }

            $pdo->commit();
            return $fullPrefix . str_pad($next, 4, '0', STR_PAD_LEFT);

        } catch (Exception $e) {
            if ($pdo->inTransaction())
                $pdo->rollBack();
            // Fallback: Si la tabla falla por alguna razón (permisos, etc), intentar leer directamente (menos seguro pero funcional)
            $stmt = $pdo->prepare("SELECT id FROM notificaciones WHERE id LIKE ? ORDER BY LENGTH(id) DESC, id DESC LIMIT 1");
            $stmt->execute([$fullPrefix . '%']);
            $lastId = $stmt->fetchColumn();
            $nextNumber = 1;
            if ($lastId) {
                $parts = explode('-', $lastId);
                $nextNumber = (int) end($parts) + 1;
            }
            return $fullPrefix . str_pad($nextNumber, 4, '0', STR_PAD_LEFT);
        }
    }

    // Helper: Sanitize input
    public static function sanitize($input)
    {
        if ($input === null)
            return null;
        if (is_array($input)) {
            return array_map([self::class, 'sanitize'], $input);
        }
        return htmlspecialchars(strip_tags(trim($input)), ENT_QUOTES, 'UTF-8');
    }
}
