// --- CONFIGURATION ---
const PANTRY_ID = "25b5c739-9d95-4604-bb7a-6415482390f0"; // Your persistent cloud DB ID
const BASKET_NAME = "qr_attendance_sync";
const BASE_URL = window.location.href.split('?')[0]; // Current page URL for QR redirection

// Initial Mock State Structure
const INITIAL_DB = {
    users: [
        { id: 1, email: "ogrenci@uni.edu.tr", password: "123", role: "student", name: "Ahmet Yılmaz", student_no: "20201010" },
        { id: 2, email: "hoca@uni.edu.tr", password: "123", role: "teacher", name: "Prof. Dr. Ayşe Kaya", department: "Bilgisayar Mühendisliği" },
        { id: 3, email: "veli@uni.edu.tr", password: "123", role: "student", name: "Veli Demir", student_no: "20201011" }
    ],
    courses: [
        { id: 101, code: "BLG301", name: "Yazılım Mühendisliği", teacher_id: 2 },
        { id: 102, code: "BLG305", name: "Veritabanı Yönetim Sistemleri", teacher_id: 2 },
    ],
    active_session: null, 
    records: []
};

// --- CLOUD SYNC METHODS (using Pantry API) ---

async function getCloudDB() {
    try {
        const response = await fetch(`https://getpantry.cloud/apiv1/pantry/${PANTRY_ID}/basket/${BASKET_NAME}`);
        if (!response.ok) return INITIAL_DB;
        return await response.json();
    } catch (e) {
        console.error("Cloud Error:", e);
        return INITIAL_DB;
    }
}

async function saveCloudDB(data) {
    try {
        await fetch(`https://getpantry.cloud/apiv1/pantry/${PANTRY_ID}/basket/${BASKET_NAME}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    } catch (e) {
        console.error("Cloud Save Error:", e);
    }
}

// Global State
let MOCK_DB = INITIAL_DB;
let currentUser = null;
let qrcodeInstance = null;
let html5QrcodeScanner = null;
let pollInterval = null;

// UI Elements
const els = {
    navbar: document.getElementById('navbar'),
    userNameDisplay: document.getElementById('user-name-display'),
    userRoleDisplay: document.getElementById('user-role-display'),
    viewLogin: document.getElementById('view-login'),
    viewTeacher: document.getElementById('view-teacher'),
    viewTeacherQr: document.getElementById('view-teacher-qr'),
    viewStudent: document.getElementById('view-student'),
    loginRole: document.getElementById('login-role'),
    loginEmail: document.getElementById('login-email'),
    loginPassword: document.getElementById('login-password'),
    courseList: document.getElementById('course-list'),
    teacherNameDash: document.getElementById('teacher-name-dash'),
    activeCourseName: document.getElementById('active-course-name'),
    qrContainer: document.getElementById('qr-container'),
    sessionPinDisplay: document.getElementById('session-pin-display'),
    manualPinInput: document.getElementById('manual-pin-input'),
    attendanceListUl: document.getElementById('attendance-list-ul'),
    attendanceCount: document.getElementById('attendance-count'),
    scanSuccessMsg: document.getElementById('scan-success-msg'),
    reader: document.getElementById('reader'),
    btnStartScan: document.getElementById('btn-start-scan')
};

// --- INITIALIZATION ---
window.onload = async () => {
    MOCK_DB = await getCloudDB();
    checkURLParams();
};

async function checkURLParams() {
    const params = new URLSearchParams(window.location.search);
    const sessionQr = params.get('session');
    
    if (sessionQr) {
        // If opened from phone scanner via URL
        currentUser = MOCK_DB.users[0]; // Auto-login as student for demo if not logged in
        alert(`Hoş geldin ${currentUser.name}! Yoklaman sisteme işleniyor...`);
        showDashboard();
        submitAttendanceRecord(sessionQr);
    }
}

function showDashboard() {
    els.userNameDisplay.innerText = currentUser.name;
    els.userRoleDisplay.innerText = currentUser.role === 'teacher' ? 'Profesör' : 'Öğrenci';
    els.userRoleDisplay.className = `status-badge ${currentUser.role === 'teacher' ? 'btn-danger' : 'status-present'}`;
    switchView(currentUser.role);
}

// Poll for updates (especially for Teacher screen)
async function startPolling() {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(async () => {
        MOCK_DB = await getCloudDB();
        if (currentUser && currentUser.role === 'teacher' && !els.viewTeacherQr.classList.contains('hidden')) {
            updateAttendanceListUI();
        }
    }, 3000);
}

// --- LOGIN METHODS ---
function autoFillLogin() {
    if (els.loginRole.value === 'student') {
        els.loginEmail.value = "ogrenci@uni.edu.tr";
        els.loginPassword.value = "123";
    } else {
        els.loginEmail.value = "hoca@uni.edu.tr";
        els.loginPassword.value = "123";
    }
}

async function login() {
    const email = els.loginEmail.value;
    const pwd = els.loginPassword.value;
    
    const user = MOCK_DB.users.find(u => u.email === email && u.password === pwd);
    
    if (user) {
        currentUser = user;
        showDashboard();
        startPolling();
    } else {
        alert("E-Posta veya Şifre Hatalı!");
    }
}

function logout() {
    currentUser = null;
    if (pollInterval) clearInterval(pollInterval);
    if(html5QrcodeScanner) {
        html5QrcodeScanner.clear().catch(e => console.error(e));
        els.reader.classList.add('hidden');
        els.btnStartScan.classList.remove('hidden');
    }
    els.scanSuccessMsg.classList.add('hidden');
    switchView('login');
}

function switchView(viewName) {
    els.viewLogin.classList.add('hidden');
    els.viewTeacher.classList.add('hidden');
    els.viewTeacherQr.classList.add('hidden');
    els.viewStudent.classList.add('hidden');
    
    if (viewName === 'login') {
        els.navbar.classList.add('hidden');
        els.viewLogin.classList.remove('hidden');
    } else {
        els.navbar.classList.remove('hidden');
        if (viewName === 'teacher') { loadTeacherDashboard(); els.viewTeacher.classList.remove('hidden'); }
        else if (viewName === 'student') { els.viewStudent.classList.remove('hidden'); }
    }
}

// --- TEACHER LOGIC ---
function loadTeacherDashboard() {
    els.teacherNameDash.innerText = currentUser.name;
    const courses = MOCK_DB.courses.filter(c => c.teacher_id === currentUser.id);
    els.courseList.innerHTML = '';
    courses.forEach(course => {
        const card = document.createElement('div');
        card.className = 'course-card';
        card.innerHTML = `<h3>${course.code}</h3><p>${course.name}</p><button class="btn btn-accent" style="margin-top: 1rem; padding: 0.5rem;" onclick="startSession(${course.id}, '${course.name}')">Yoklama Başlat</button>`;
        els.courseList.appendChild(card);
    });
}

async function startSession(courseId, courseName) {
    els.activeCourseName.innerText = courseName;
    const pinStr = Math.floor(100000 + Math.random() * 900000).toString();
    const qrData = "SESSION_" + Date.now().toString() + "_" + courseId;

    MOCK_DB.active_session = { course_id: courseId, qr_data: qrData, pin: pinStr, active: true };
    MOCK_DB.records = []; 
    await saveCloudDB(MOCK_DB);
    
    els.viewTeacher.classList.add('hidden');
    els.viewTeacherQr.classList.remove('hidden');
    els.sessionPinDisplay.innerText = pinStr;

    // Create URL-based QR for phone to open the site directly
    const qrUrl = `${BASE_URL}?session=${qrData}`;

    els.qrContainer.innerHTML = '';
    qrcodeInstance = new QRCode(els.qrContainer, {
        text: qrUrl,
        width: 300, height: 300,
        colorDark : "#0f172a", colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.H
    });
    
    updateAttendanceListUI();
}

async function closeSession() {
    MOCK_DB.active_session = null;
    await saveCloudDB(MOCK_DB);
    els.viewTeacherQr.classList.add('hidden');
    els.viewTeacher.classList.remove('hidden');
}

function updateAttendanceListUI() {
    els.attendanceListUl.innerHTML = '';
    els.attendanceCount.innerText = MOCK_DB.records.length;
    if (MOCK_DB.records.length === 0) {
        els.attendanceListUl.innerHTML = '<li class="text-muted">Henüz katılan öğrenci yok...</li>';
        return;
    }
    MOCK_DB.records.forEach(studentId => {
        const s = MOCK_DB.users.find(u => u.id === studentId);
        if (!s) return;
        const li = document.createElement('li');
        li.innerHTML = `<div><strong>${s.name}</strong><br><span class="text-muted" style="font-size:0.8rem;">${s.student_no}</span></div><div><span class="status-badge status-present">Burada</span></div>`;
        els.attendanceListUl.appendChild(li);
    });
}

// --- STUDENT LOGIC ---
async function joinWithPin() {
    const pin = els.manualPinInput.value;
    if (!pin) { alert("Lütfen kodu girin"); return; }

    // FETCH LATEST FROM CLOUD
    MOCK_DB = await getCloudDB();

    if (!MOCK_DB.active_session?.active) { 
        alert("Sanal veri tabanında aktif yoklama bulunamadı! Lütfen hocanızın yoklamayı başlattığından emin olun."); 
        return; 
    }
    if (MOCK_DB.active_session.pin !== pin) {
        alert("Girdiğiniz kod hatalı!");
        return;
    }
    await submitAttendanceRecord(MOCK_DB.active_session.qr_data);
}

async function simulateScan() {
    MOCK_DB = await getCloudDB();
    if (!MOCK_DB.active_session?.active) { 
        alert("Şu anda aktif bir bulut oturumu bulunamadı."); 
        return; 
    }
    await submitAttendanceRecord(MOCK_DB.active_session.qr_data);
}

function startScanner() {
    els.btnStartScan.classList.add('hidden');
    els.reader.classList.remove('hidden');
    html5QrcodeScanner = new Html5Qrcode("reader");
    html5QrcodeScanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, 
        (decodedText) => {
            html5QrcodeScanner.clear(); els.reader.classList.add('hidden');
            // Check if it's a URL or just the data
            const sessionMatch = decodedText.match(/session=([^&]+)/);
            const finalData = sessionMatch ? sessionMatch[1] : decodedText;
            submitAttendanceRecord(finalData);
        }
    ).catch(err => {
        alert("Kamera hatası, manuel kod girin.");
        els.btnStartScan.classList.remove('hidden'); els.reader.classList.add('hidden');
    });
}

async function submitAttendanceRecord(qrData) {
    // RE-FETCH again before saving to prevent data loss
    MOCK_DB = await getCloudDB(); 

    if (MOCK_DB.active_session?.qr_data === qrData) {
        if (!MOCK_DB.records.includes(currentUser.id)) {
            MOCK_DB.records.push(currentUser.id);
            await saveCloudDB(MOCK_DB);
            els.scanSuccessMsg.classList.remove('hidden');
            els.manualPinInput.value = "";
            alert("Yoklamanız başarıyla kaydedildi!");
        } else {
            alert("Zaten yoklamaya katıldınız!");
            els.scanSuccessMsg.classList.remove('hidden');
        }
    } else {
        alert("Geçersiz veya süresi dolmuş bir QR kod!");
        els.btnStartScan.classList.remove('hidden');
    }
}
