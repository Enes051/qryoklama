/**
 * PREMIUM ATTEND - SQL EDITION
 * Synchronized with Hostinger MySQL Database.
 */

const CONFIG = {
    API_URL: "./sync.php",
    POLL_INTERVAL: 4000,
    BASE_URL: window.location.href.split('?')[0]
};

// INITIAL_STATE only as a fallback for the very first run
const INITIAL_STATE = {
    users: [
        { id: 101, email: "ufuk@uni.edu.tr", password: "123", role: "student", name: "Ufuk Buğra Şahin", student_no: "20202020" },
        { id: 102, email: "peri@uni.edu.tr", password: "123", role: "teacher", name: "Peri Güneş", department: "Bilgisayar Mühendisliği" },
        { id: 103, email: "boran@uni.edu.tr", password: "123", role: "student", name: "Boran Özsoy", student_no: "20202021" },
        { id: 104, email: "enes@uni.edu.tr", password: "123", role: "student", name: "Enes Cinipi", student_no: "20202022" },
        { id: 105, email: "ogrenci@uni.edu.tr", password: "123", role: "student", name: "Deneme Öğrencisi", student_no: "20200000" }
    ],
    courses: [
        { id: 501, code: "BLG301", name: "Yazılım Mühendisliği", teacher_id: 102 },
        { id: 502, code: "BLG305", name: "Veritabanı Yönetimi", teacher_id: 102 },
    ],
    active_session: null, 
    records: []
};

class AttendanceApp {
    constructor() {
        this.db = JSON.parse(JSON.stringify(INITIAL_STATE));
        this.currentUser = null;
        this.scanner = null;
        this.init();
    }

    async init() {
        await this.syncFromCloud();
        this.setupEventListeners();
        this.handleRouting();
        this.startBackgroundPoller();
    }



    /**
     * SQL CLOUD SYNC
     */
    async syncFromCloud() {
        try {
            const response = await fetch(`${CONFIG.API_URL}?cache_bust=${Date.now()}`);
            if (response.ok) {
                const cloudData = await response.json();
                
                // If the PHP returned actual users from SQL
                if (cloudData && cloudData.users && cloudData.users.length > 0) {
                    // Convert IDs to Numbers to ensure fixed matching
                    cloudData.users.forEach(u => u.id = parseInt(u.id));
                    cloudData.courses.forEach(c => {
                        c.id = parseInt(c.id);
                        c.teacher_id = parseInt(c.teacher_id);
                    });
                    if (cloudData.records) {
                        cloudData.records = cloudData.records.map(id => parseInt(id));
                    }
                    this.db = cloudData;
                } else if (cloudData && cloudData.first_run) {
                    // If DB is empty, push initial state to SQL
                    await this.syncToCloud();
                }
            }
        } catch (e) {
            console.error("Sync Error:", e);
        }
    }

    async syncToCloud() {
        try {
            await fetch(CONFIG.API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.db)
            });
        } catch (e) {
            console.error("Cloud Save Failed", e);
        }
    }

    startBackgroundPoller() {
        setInterval(async () => {
            if (this.currentUser && this.currentUser.role === 'teacher' && !document.getElementById('view-session').classList.contains('hidden')) {
                await this.syncFromCloud();
                this.renderAttendeeList();
            }
        }, CONFIG.POLL_INTERVAL);
    }

    /**
     * NAVIGATION & UI
     */
    handleRouting() {
        const params = new URLSearchParams(window.location.search);
        const sessionQr = params.get('session');
        if (sessionQr) {
            sessionStorage.setItem('pending_session', sessionQr);
            this.switchView('view-login');
        }
    }

    switchView(viewId) {
        const views = ['view-login', 'view-teacher', 'view-session', 'view-student'];
        views.forEach(v => {
            const el = document.getElementById(v);
            if (el) el.classList.add('hidden');
        });
        const target = document.getElementById(viewId);
        if (target) target.classList.remove('hidden');
        
        const nav = document.getElementById('nav-main');
        if (viewId === 'view-login') nav.classList.add('hidden');
        else nav.classList.remove('hidden');
    }

    handleRoleChange() {
        const role = document.getElementById('login-role').value;
        const emailInput = document.getElementById('login-email');
        if (role === 'teacher') emailInput.value = "peri@uni.edu.tr";
        else emailInput.value = "ufuk@uni.edu.tr";
        document.getElementById('login-password').value = "123";
    }

    /**
     * AUTHENTICATION
     */
    async login() {
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-password').value;
        
        await this.syncFromCloud();
        
        const user = this.db.users.find(u => u.email === email && u.password === pass);
        
        if (user) {
            this.currentUser = user;
            this.showDashboard();

            // Handle pending QR session
            const pendingSession = sessionStorage.getItem('pending_session');
            if (pendingSession && user.role === 'student') {
                await this.processAttendance(pendingSession);
                sessionStorage.removeItem('pending_session');
            }
        } else {
            alert("Giriş Hatalı! Lütfen bilgilerinizi kontrol edin.");
        }
    }

    logout() {
        window.location.href = CONFIG.BASE_URL;
    }

    showDashboard() {
        document.getElementById('user-display-name').innerText = this.currentUser.name;
        document.getElementById('user-display-role').innerText = this.currentUser.role === 'teacher' ? 'Profesör' : 'Öğrenci';
        
        if (this.currentUser.role === 'teacher') {
            this.renderTeacherCourses();
            this.switchView('view-teacher');
        } else {
            this.switchView('view-student');
        }
    }

    /**
     * TEACHER ACTIONS
     */
    renderTeacherCourses() {
        const container = document.getElementById('teacher-courses');
        container.innerHTML = '';
        const myCourses = this.db.courses.filter(c => c.teacher_id === this.currentUser.id);
        myCourses.forEach(c => {
            const card = document.createElement('div');
            card.className = 'course-card glass-card';
            card.innerHTML = `<div style="color:var(--accent);font-weight:800;font-size:0.7rem;">${c.code}</div><h3>${c.name}</h3><p style="font-size:0.8rem;color:var(--text-secondary);">Yoklama Başlat</p>`;
            card.onclick = () => this.startSession(c);
            container.appendChild(card);
        });
    }

    async startSession(course) {
        document.getElementById('active-session-title').innerText = course.name;
        const pin = Math.floor(100000 + Math.random() * 900000).toString();
        const qrData = "ATTEND_" + Date.now();
        this.db.active_session = { course_id: course.id, qr_data: qrData, pin: pin, active: true };
        this.db.records = []; 
        await this.syncToCloud();
        document.getElementById('session-pin').innerText = pin;
        this.renderQRCode(qrData);
        this.renderAttendeeList();
        this.switchView('view-session');
    }

    renderQRCode(data) {
        const container = document.getElementById('qr-output');
        container.innerHTML = '';
        const qrUrl = `${CONFIG.BASE_URL}?session=${data}`;
        new QRCode(container, { text: qrUrl, width: 250, height: 250 });
    }

    async closeSession() {
        this.db.active_session = null;
        await this.syncToCloud();
        this.switchView('view-teacher');
    }

    renderAttendeeList() {
        const container = document.getElementById('attendee-list-container');
        document.getElementById('attendee-count').innerText = this.db.records.length;
        if (this.db.records.length === 0) {
            container.innerHTML = '<div style="padding:2rem;" class="text-muted text-center">Öğrenci bekleniyor...</div>';
            return;
        }
        container.innerHTML = '';
        this.db.records.forEach(studentId => {
            const s = this.db.users.find(u => u.id === parseInt(studentId));
            if (s) {
                const item = document.createElement('div');
                item.className = 'list-item';
                item.innerHTML = `<div><div style="font-weight:700;">${s.name}</div><div style="font-size:0.7rem;color:var(--text-secondary);">${s.student_no}</div></div><div class="status-present">DERSTE</div>`;
                container.appendChild(item);
            }
        });
    }

    /**
     * STUDENT ACTIONS
     */
    async startScan() {
        const container = document.getElementById('scanner-container');
        document.getElementById('btn-scan').classList.add('hidden');
        container.classList.remove('hidden');
        this.scanner = new Html5Qrcode("scanner-container");
        this.scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, (decodedText) => {
            this.stopScan();
            const sessionMatch = decodedText.match(/session=([^&]+)/);
            this.processAttendance(sessionMatch ? sessionMatch[1] : decodedText);
        }).catch(() => this.stopScan());
    }

    stopScan() {
        if (this.scanner) {
            this.scanner.stop().then(() => {
                document.getElementById('scanner-container').classList.add('hidden');
                document.getElementById('btn-scan').classList.remove('hidden');
            });
        }
    }

    async submitManual() {
        const code = document.getElementById('manual-code').value;
        await this.syncFromCloud();
        if (this.db.active_session && this.db.active_session.pin === code) {
            await this.processAttendance(this.db.active_session.qr_data);
        } else { alert("Hatalı Kod!"); }
    }

    async processAttendance(qrData) {
        await this.syncFromCloud();
        if (this.db.active_session && this.db.active_session.qr_data === qrData) {
            if (!this.db.records.includes(this.currentUser.id)) {
                this.db.records.push(this.currentUser.id);
                await this.syncToCloud();
                document.getElementById('btn-scan').classList.add('hidden');
                const course = this.db.courses.find(c => c.id === this.db.active_session.course_id);
                document.getElementById('success-course-name').innerText = course ? course.name : "Ders";
                document.getElementById('success-overlay').classList.remove('hidden');
            } else { alert("Zaten katıldınız!"); }
        } else { alert("Geçersiz Oturum!"); }
    }

    setupEventListeners() {
        const pwdInput = document.getElementById('login-password');
        if (pwdInput) {
            pwdInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.login();
            });
        }
    }
}
const app = new AttendanceApp();
