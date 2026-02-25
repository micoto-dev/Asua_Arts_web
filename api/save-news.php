<?php
/**
 * Asua Arts - News JSON Save API
 *
 * Receives POST with JSON body and saves to data/news.json
 * Requires X-Auth-Token header (SHA-256 of PASSWORD_HASH) for authentication
 */

// CORS headers for same-origin requests
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

// Only allow POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

// Authentication: verify X-Auth-Token header
// This should be SHA-256 hash of the PASSWORD_HASH from admin.js
$expectedToken = hash('sha256', 'f2a145df8433ddd694635fb03545d3dad2e5a79c720016a975ac78ed9610ff2e');
$providedToken = $_SERVER['HTTP_X_AUTH_TOKEN'] ?? '';

if (!hash_equals($expectedToken, $providedToken)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

// Read request body
$input = file_get_contents('php://input');
if (empty($input)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Empty request body']);
    exit;
}

// Validate JSON
$data = json_decode($input, true);
if (json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid JSON']);
    exit;
}

// Validate structure
if (!isset($data['news']) || !is_array($data['news'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid data structure: missing news array']);
    exit;
}

// Target file path
$targetPath = __DIR__ . '/../data/news.json';

// Create backup before overwriting
$backupDir = __DIR__ . '/../data/backups';
if (!is_dir($backupDir)) {
    mkdir($backupDir, 0755, true);
}

if (file_exists($targetPath)) {
    $backupFile = $backupDir . '/news_' . date('Ymd_His') . '.json';
    copy($targetPath, $backupFile);

    // Keep only the latest 10 backups
    $backups = glob($backupDir . '/news_*.json');
    if (count($backups) > 10) {
        sort($backups);
        $toDelete = array_slice($backups, 0, count($backups) - 10);
        foreach ($toDelete as $old) {
            unlink($old);
        }
    }
}

// Write JSON with pretty print
$jsonOutput = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
$result = file_put_contents($targetPath, $jsonOutput);

if ($result === false) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to write file']);
    exit;
}

echo json_encode(['success' => true, 'message' => 'Saved successfully', 'bytes' => $result]);
