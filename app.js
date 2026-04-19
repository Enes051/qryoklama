// --- CONFIGURATION ---
const KVDB_KEY = "enes051_v9_ultimate"; 
const KVDB_URL = `https://kvdb.io/88pU9f2qA7pZfR2N6jA1mG/${KVDB_KEY}`; 
const BASE_URL = window.location.href.split('?')[0];

const log = (msg) => {
    const d = document.getElementById('debug-log');
    if(d) {
        d.innerText += "\n> " + msg;
        d.scrollTop = d.scrollHeight;
    }
    console.log(msg);
    const s = document.getElementById('sync-status');
    if(s) s.innerText = "Sync: " + msg.substring(0, 15);
};

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

// --- CLOUD SYNC METHODS (ULTIMATE STABLE VERSION) ---
async function getCloudDB() {
    try {
        log("Bağlanıyor...");
        const response = await fetch(KVDB_URL, {
            cache: 'no-store'
        });
        if (!response.ok) {
            log("Yenileniyor (404)...");
            return INITIAL_DB;
        }
        const data = await response.json();
        log("Bulut Güncel.");
        return data;
    } catch (e) {
        log("Hata: " + e.message);
        return INITIAL_DB;
    }
}

async function saveCloudDB(data) {
    try {
        log("İşleniyor...");
        // KVDB supports PUT for raw body updates
        const response = await fetch(KVDB_URL, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if(response.ok) {
            log("Bulut: OK.");
        } else {
            log("Hata: " + response.status);
            // Fallback for some browsers that dislike direct PUT
            await fetch(KVDB_URL, { method: 'POST', body: JSON.stringify(data) });
        }
    } catch (e) {
        log("Bağlantı Hatası.");
    }
}

// Global State
let MOCK_DB = INITIAL_DB;
let currentUser = null;
let qrcodeInstance = null;
let html5QrcodeScanner = null;

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

window.onload = async () => {
    MOCK_DB = await getCloudDB();
    checkURLParams();
    setInterval(async () => {
       if (currentUser && currentUser.role === 'teacher' && !els.viewTeacherQr.classList.contains('hidden')) {
            MOCK_DB = await getCloudDB();
            updateAttendanceListUI();
       }
    }, 5000);
};

async function checkURLParams() {
    const params = new URLSearchParams(window.location.search);
    const sessionQr = params.get('session');
    if (sessionQr) {
        currentUser = MOCK_DB.users[0]; 
        showDashboard();
        await submitAttendanceRecord(sessionQr);
    }
}

function showDashboard() {
    els.userNameDisplay.innerText = currentUser.name;
    els.userRoleDisplay.innerText = currentUser.role === 'teacher' ? 'Profesör' : 'Öğrenci';
    els.userRoleDisplay.className = `status-badge ${currentUser.role === 'teacher' ? 'btn-danger' : 'status-present'}`;
    switchView(currentUser.role);
}

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
    MOCK_DB = await getCloudDB();
    const email = els.loginEmail.value;
    const pwd = els.loginPassword.value;
    const user = MOCK_DB.users.find(u => u.email === email && u.password === pwd);
    if (user) {
        currentUser = user;
        showDashboard();
    } else {
        alert("Giriş Hatalı!");
    }
}

function logout() {
    location.href = BASE_URL; 
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

function loadTeacherDashboard() {
    els.teacherNameDash.innerText = currentUser.name;
    const courses = MOCK_DB.courses.filter(c => c.teacher_id === currentUser.id);
    els.courseList.innerHTML = '';
    courses.forEach(course => {
        const card = document.createElement('div');
        card.className = 'course-card';
        card.innerHTML = `<h3>${course.code}</h3><p>${course.name}</p><button class="btn btn-accent" onclick="startSession(${course.id}, '${course.name}')">Yoklama Başlat</button>`;
        els.courseList.appendChild(card);
    });
}

async function startSession(courseId, courseName) {
    const pinStr = Math.floor(100000 + Math.random() * 900000).toString();
    const qrData = "SESSION_" + Date.now().toString();
    
    log("Yoklama Kaydediliyor...");
    MOCK_DB.active_session = { course_id: courseId, qr_data: qrData, pin: pinStr, active: true };
    MOCK_DB.records = []; 
    await saveCloudDB(MOCK_DB);
    
    els.activeCourseName.innerText = courseName;
    els.viewTeacher.classList.add('hidden');
    els.viewTeacherQr.classList.remove('hidden');
    els.sessionPinDisplay.innerText = pinStr;
    const qrUrl = `${BASE_URL}?session=${qrData}`;
    els.qrContainer.innerHTML = '';
    new QRCode(els.qrContainer, { text: qrUrl, width: 250, height: 250 });
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
        els.attendanceListUl.innerHTML = '<li>Katılım bekliyor...</li>';
        return;
    }
    MOCK_DB.records.forEach(studentId => {
        const s = MOCK_DB.users.find(u => u.id === studentId);
        if (s) {
            const li = document.createElement('li');
            li.innerHTML = `<div><strong>${s.name}</strong></div><span class="status-badge status-present">Burada</span>`;
            els.attendanceListUl.appendChild(li);
        }
    });
}

async function joinWithPin() {
    const pin = els.manualPinInput.value;
    log("Kod kontrolü...");
    MOCK_DB = await getCloudDB();
    if (!MOCK_DB.active_session?.active) { alert("Şu an aktif yoklama bulunamadı!"); return; }
    if (MOCK_DB.active_session.pin !== pin) { alert("Hatalı Kod!"); return; }
    await submitAttendanceRecord(MOCK_DB.active_session.qr_data);
}

async function simulateScan() {
    MOCK_DB = await getCloudDB();
    if (!MOCK_DB.active_session?.active) { alert("Aktif yoklama yok."); return; }
    await submitAttendanceRecord(MOCK_DB.active_session.qr_data);
}

function startScanner() {
    els.btnStartScan.classList.add('hidden');
    els.reader.classList.remove('hidden');
    const scanner = new Html5Qrcode("reader");
    scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, (decodedText) => {
        scanner.stop();
        els.reader.classList.add('hidden');
        const sessionMatch = decodedText.match(/session=([^&]+)/);
        submitAttendanceRecord(sessionMatch ? sessionMatch[1] : decodedText);
    }).catch(err => {
        alert("Kamera hatası.");
        els.btnStartScan.classList.remove('hidden');
    });
}

async function submitAttendanceRecord(qrData) {
    log("Kayıt yapılıyor...");
    MOCK_DB = await getCloudDB(); 
    if (MOCK_DB.active_session?.qr_data === qrData) {
        if (!MOCK_DB.records.includes(currentUser.id)) {
            MOCK_DB.records.push(currentUser.id);
            await saveCloudDB(MOCK_DB);
            els.scanSuccessMsg.classList.remove('hidden');
            alert("Yoklamaya KATILDINIZ!");
        } else {
            alert("Zaten listedesiniz.");
        }
    } else {
        alert("Hatalı veya Süresi Dolmuş Yoklama!");
    }
}
