<?php
define('SGND_API', true);
require_once __DIR__ . '/db.php';
$pdo = Database::getInstance()->getConnection();

function getTableSchema($tableName)
{
    global $pdo;
    $stmt = $pdo->prepare("DESCRIBE $tableName");
    $stmt->execute();
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

$schema = [
    'notificaciones' => getTableSchema('notificaciones'),
    'visitas' => getTableSchema('visitas'),
    'usuarios' => getTableSchema('usuarios'),
    'audit_log' => getTableSchema('audit_log')
];

header('Content-Type: application/json');
echo json_encode($schema, JSON_PRETTY_PRINT);
