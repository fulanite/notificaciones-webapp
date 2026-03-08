<?php
require_once __DIR__ . '/api/db.php';
$pdo = Database::getInstance()->getConnection();
$stmt = $pdo->prepare("DESCRIBE notificaciones");
$stmt->execute();
$columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
echo json_encode($columns, JSON_PRETTY_PRINT);
