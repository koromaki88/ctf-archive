<?php

declare(strict_types=1);

$secretFile = getenv('SECRET_FILE') ?: '/secret';
if (! is_file($secretFile)) {
    fwrite(STDERR, "Secret file missing at {$secretFile}\n");
    exit(0);
}

$secret = trim(file_get_contents($secretFile));
if ($secret === '') {
    fwrite(STDERR, "Secret is empty.\n");
    exit(0);
}

$dbHost = getenv('DB_HOST') ?: 'mysql';
$dbPort = getenv('DB_PORT') ?: '3306';
$dbName = getenv('DB_DATABASE') ?: 'hyperf';
$dbUser = getenv('DB_USERNAME') ?: 'root';
$dbPass = getenv('DB_PASSWORD') ?: '';

$dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $dbHost, $dbPort, $dbName);

$pdo = new PDO($dsn, $dbUser, $dbPass, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);

$pdo->exec(file_get_contents(__DIR__ . '/../db/init/01_schema.sql'));

$passwordHash = '$2y$10$25ilCsvLKhYNIzkpxdJy2uNKmAfbNnPqnvZuY1cK/Tw6yiBgXhfv2'; // password123
$now = time();

$stmt = $pdo->prepare('INSERT INTO users (username, password, created_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE password = VALUES(password)');
$stmt->execute(['Hidaka Koyomi', $passwordHash, $now]);
$stmt->execute(['Satou Shiori', $passwordHash, $now]);

$hidakaId = $pdo->query("SELECT id FROM users WHERE username = 'Hidaka Koyomi' LIMIT 1")->fetchColumn();
if (! $hidakaId) {
    fwrite(STDERR, "Seed user not found; aborting message insert.\n");
    exit(0);
}

$exists = $pdo->prepare('SELECT COUNT(*) FROM messages WHERE sender_id = ? AND recipient = ? AND encrypted = 1');
$exists->execute([$hidakaId, 'Satou Shiori']);
$count = (int) $exists->fetchColumn();

if ($count === 0) {
    $cipherPayload = encryptClientStyle('W1{fake_flag}', $secret);
    $insert = $pdo->prepare('INSERT INTO messages (sender_id, recipient, body, encrypted, created_at) VALUES (?, ?, ?, 1, ?)');
    $insert->execute([$hidakaId, 'Satou Shiori', $cipherPayload, $now]);
}

function encryptClientStyle(string $plaintext, string $secret): string
{
    $salt = random_bytes(16);
    $iv = random_bytes(12);
    $key = hash_pbkdf2('sha256', $secret, $salt, 100000, 32, true);
    $tag = '';
    $ciphertext = openssl_encrypt($plaintext, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag, '');
    $payload = [
        'alg' => 'AES-GCM',
        'salt' => base64_encode($salt),
        'iv' => base64_encode($iv),
        'ct' => base64_encode($ciphertext . $tag),
    ];

    return base64_encode(json_encode($payload));
}
