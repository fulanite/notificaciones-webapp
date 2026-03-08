<?php
require_once __DIR__ . '/api/db.php';
$pdo = Database::getInstance()->getConnection();
$stmt = $pdo->query("SELECT COUNT(*) FROM notificaciones");
echo "Count: " . $stmt->fetchColumn();
