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

            // Quick fix for missing columns
            try {
                $this->pdo->exec("ALTER TABLE visitas ADD COLUMN transcripcion_audio TEXT NULL AFTER audio_url");
            } catch (PDOException $e) {
            }

            try {
                $this->pdo->exec("ALTER TABLE visitas ADD COLUMN ubicacion_lng VARCHAR(50) NULL AFTER ubicacion_lat");
            } catch (PDOException $e) {
            }

            // Fix ENUM truncations
            try {
                $this->pdo->exec("ALTER TABLE notificaciones MODIFY COLUMN resultado_diligencia VARCHAR(100) NULL");
                $this->pdo->exec("ALTER TABLE notificaciones MODIFY COLUMN destinatario_especial VARCHAR(255) NULL");
            } catch (PDOException $e) {
            }

            try {
                $this->pdo->exec("ALTER TABLE notificaciones ADD COLUMN devuelta_por_ujier TINYINT(1) DEFAULT 0");
                $this->pdo->exec("ALTER TABLE notificaciones ADD COLUMN fecha_devolucion DATETIME NULL");
            } catch (PDOException $e) {
            }
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
        header('Access-Control-Allow-Origin: *');
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
        header('Access-Control-Allow-Origin: *');
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

    // Helper: Sanitize input
    public static function sanitize($input)
    {
        if (is_array($input)) {
            return array_map([self::class, 'sanitize'], $input);
        }
        return htmlspecialchars(strip_tags(trim($input)), ENT_QUOTES, 'UTF-8');
    }
}
