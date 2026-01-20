<?php
/**
 * SGND - API Configuration
 * Database connection settings for MySQL/MariaDB
 */

// Prevent direct access
if (!defined('SGND_API')) {
    die('Direct access not allowed');
}

// Load local credentials (this file should NOT be in Git)
// Create this file manually on the server with your credentials
$localConfigPath = __DIR__ . '/config.local.php';
if (file_exists($localConfigPath)) {
    require_once $localConfigPath;
} else {
    // Default/placeholder values - REPLACE THESE ON SERVER
    define('DB_HOST', 'localhost');
    define('DB_NAME', 'YOUR_DATABASE_NAME');
    define('DB_USER', 'YOUR_DATABASE_USER');
    define('DB_PASS', 'YOUR_DATABASE_PASSWORD');
}
define('DB_CHARSET', 'utf8mb4');

// API Settings
define('API_VERSION', '1.0.0');
define('UPLOAD_DIR', __DIR__ . '/../uploads/');
define('MAX_UPLOAD_SIZE', 10 * 1024 * 1024); // 10MB

// CORS Settings - Add your domains here
$allowed_origins = [
    'http://localhost',
    'http://localhost:3000',
    'https://darkblue-caribou-343892.hostingersite.com',
    'http://darkblue-caribou-343892.hostingersite.com',
];

// Set CORS headers
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowed_origins)) {
    header("Access-Control-Allow-Origin: $origin");
}
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json; charset=UTF-8");

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Error reporting (disable in production)
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// Timezone
date_default_timezone_set('America/Argentina/Catamarca');
