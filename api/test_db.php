<?php
require_once __DIR__ . '/db.php';

try {
    $db = Database::getInstance();
    $pdo = $db->getConnection();
    $stmt = $pdo->query("SELECT 1");
    Database::sendResponse(['status' => 'ok', 'message' => 'Database connection successful']);
} catch (Exception $e) {
    Database::sendError('Test failed: ' . $e->getMessage(), 500);
}
