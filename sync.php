<?php
/**
 * PREMIUM ATTEND - SQL EDITION (MySQL/PDO)
 * Powered by Hostinger MySQL for stability and project compliance.
 */

// --- VERİTABANI BAĞLANTI BİLGİLERİ ---
$host = 'localhost';
$db_name = 'u530013548_yoklama_db';
$username = 'u530013548_yoklamasistemi';
$password = 'Yoklama5151';

// CORS ve JSON Başlıkları
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db_name;charset=utf8", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    echo json_encode(['error' => 'Bağlantı Hatası: ' . $e->getMessage()]);
    exit;
}

// --- VERİ OKUMA (GET) ---
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $response = [
        'users' => [],
        'courses' => [],
        'active_session' => null,
        'records' => []
    ];

    // 1. Kullanıcıları Çek
    $response['users'] = $pdo->query("SELECT id, name, email, password, role, student_no, department FROM users")->fetchAll();

    // 2. Dersleri Çek
    $response['courses'] = $pdo->query("SELECT id, code, name, teacher_id FROM courses")->fetchAll();

    // 3. Aktif Oturumu Çek
    $session = $pdo->query("SELECT id, course_id, qr_data, pin FROM sessions WHERE is_active = 1 ORDER BY created_at DESC LIMIT 1")->fetch();
    
    if ($session) {
        $response['active_session'] = [
            'course_id' => (int)$session['course_id'],
            'qr_data' => $session['qr_data'],
            'pin' => $session['pin'],
            'active' => true
        ];

        // 4. Bu oturuma ait yoklama kayıtlarını çek
        $stmt = $pdo->prepare("SELECT student_id FROM attendance WHERE session_id = ?");
        $stmt->execute([$session['id']]);
        $response['records'] = $stmt->fetchAll(PDO::FETCH_COLUMN);
    }

    echo json_encode($response);
} 

// --- VERİ YAZMA (POST) ---
else if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        echo json_encode(['error' => 'Geçersiz veri']);
        exit;
    }

    try {
        $pdo->beginTransaction();

        // 1. Aktif Oturum Güncelleme/Ekleme
        if (isset($input['active_session']) && $input['active_session'] !== null) {
            $sess = $input['active_session'];
            
            // Mevcut aktif oturumu kontrol et
            $stmt = $pdo->prepare("SELECT id FROM sessions WHERE qr_data = ? LIMIT 1");
            $stmt->execute([$sess['qr_data']]);
            $existing = $stmt->fetch();

            if (!$existing) {
                // Önce diğerlerini pasif yap
                $pdo->query("UPDATE sessions SET is_active = 0");
                
                // Yeni oturum ekle
                $stmt = $pdo->prepare("INSERT INTO sessions (course_id, qr_data, pin, is_active) VALUES (?, ?, ?, 1)");
                $stmt->execute([$sess['course_id'], $sess['qr_data'], $sess['pin']]);
                $sessionId = $pdo->lastInsertId();
            } else {
                $sessionId = $existing['id'];
            }

            // 2. Yoklama Kayıtlarını Güncelle (Yeni gelenleri ekle)
            if (isset($input['records']) && is_array($input['records'])) {
                $courseId = $sess['course_id'];
                foreach ($input['records'] as $studentId) {
                    $uStmt = $pdo->prepare("INSERT IGNORE INTO attendance (student_id, session_id, course_id) VALUES (?, ?, ?)");
                    $uStmt->execute([$studentId, $sessionId, $courseId]);
                }
            }
        } else {
            // Eğer active_session null geldiyse, tüm oturumları kapat
            $pdo->query("UPDATE sessions SET is_active = 0");
        }

        $pdo->commit();
        echo json_encode(['status' => 'success', 'message' => 'Veritabanı Senkronize Edildi']);
    } catch (Exception $e) {
        $pdo->rollBack();
        echo json_encode(['error' => 'Giriş Hatası: ' . $e->getMessage()]);
    }
}
?>
