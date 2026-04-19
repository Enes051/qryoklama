<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

$db_file = 'db.json';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input_data = file_get_contents('php://input');
    if ($input_data) {
        file_put_contents($db_file, $input_data);
        echo json_encode(['status' => 'success', 'updated_at' => date('H:i:s')]);
    } else {
        http_response_code(400);
        echo json_encode(['error' => 'No data received']);
    }
} 
else {
    if (file_exists($db_file)) {
        echo file_get_contents($db_file);
    } else {
        echo json_encode(['records' => [], 'active_session' => null, 'first_run' => true]);
    }
}
?>
