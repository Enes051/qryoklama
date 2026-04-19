/**
 * PREMIUM ATTEND - CORE LOGIC
 * Redesigned for maximum reliability and aesthetic excellence.
 */

const CONFIG = {
    // We use npoint.io for robust cross-origin JSON storage (Bridge)
    // Each run uses a somewhat unique but stable ID for this user session
    API_URL: "https://api.npoint.io/75a7c21689100867855b",
    POLL_INTERVAL: 4000,
    BASE_URL: window.location.href.split('?')[0]
};

const INITIAL_STATE = {
    users: [
        { id: 1, email: "ogrenci@uni.edu.tr", password: "123", role: "student", name: "Ahmet Yılmaz", student_no: "20201010" },
        { id: 2, email: "hoca@uni.edu.tr", password: "123", role: "teacher", name: "Prof. Dr. Ayşe Kaya", department: "Bilgisayar Mühendisliği" },
        { id: 3, email: "veli@uni.edu.tr", password: "123", role: "student", name: "Veli Demir", student_no: "20201011" }
    ],
    courses: [
        { id: 101, code: "BLG301", name: "Yazılım Mühendisliği", teacher_id: 2 },
        { id: 102, code: "BLG305", name: "Veritabanı Yönetimi", teacher_id: 2 },
    ],
    active_session: null, 
    records: []
};

class AttendanceApp {
    constructor() {
        this.db = INITIAL_STATE;
        this.currentUser = null;
        this.scanner = null;
        this.init();
    }

    async init() {
        this.updateStatus("Buluta Bağlanılıyor...");
        await this.syncFromCloud();
        this.setupEventListeners();
        this.handleRouting();
        this.startBackgroundPoller();
        this.updateStatus("Sistem Çevrimiçi", true);
    }

    updateStatus(text, success = false) {
        const el = document.getElementById('status-text');
        const pulse = document.querySelector('.pulse');
        if (el) el.innerText = text;
        if (pulse) pulse.style.background = success ? 'var(--success)' : 'var(--accent)';
    }

    /**
     * CLOUD SYNC LAYER (NPOINT)
     */
    async syncFromCloud() {
        try {
            const response = await fetch(CONFIG.API_URL);
            if (response.ok) {
                const cloudData = await response.json();
                // Merge cloud data but keep initial users if cloud is empty/new
                if (cloudData && cloudData.users) {
                    this.db = cloudData;
                }
            } else {
                // If 404/Empty, initialize the cloud with our base data
                await this.syncToCloud();
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
            this.updateStatus("Bağlantı Hatası!", false);
        }
    }

    startBackgroundPoller() {
        setInterval(async () => {
            // Only poll if we are in a session view as a teacher
            if (this.currentUser && this.currentUser.role === 'teacher' && !document.getElementById('view-session').classList.contains('hidden')) {
                await this.syncFromCloud();
                this.renderAttendeeList();
            }
        }, CONFIG.POLL_INTERVAL);
    }

    /**
     * UI & ROUTING
     */
    handleRouting() {
        const params = new URLSearchParams(window.location.search);
        const sessionQr = params.get('session');
        
        if (sessionQr) {
            // Auto-detect student for presentation if URL has session
            this.currentUser = this.db.users[0]; 
            this.showDashboard();
            this.processAttendance(sessionQr);
        }
    }

    switchView(viewId) {
        const views = ['view-login', 'view-teacher', 'view-session', 'view-student'];
        views.forEach(v => document.getElementById(v).classList.add('hidden'));
        document.getElementById(viewId).classList.remove('hidden');
        
        const nav = document.getElementById('nav-main');
        if (viewId === 'view-login') nav.classList.add('hidden');
        else nav.classList.remove('hidden');
    }

    handleRoleChange() {
        const role = document.getElementById('login-role').value;
        const emailInput = document.getElementById('login-email');
        if (role === 'teacher') emailInput.value = "hoca@uni.edu.tr";
        else emailInput.value = "ogrenci@uni.edu.tr";
        document.getElementById('login-password').value = "123";
    }

    /**
     * AUTHENTICATION
     */
    async login() {
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-password').value;
        
        this.updateStatus("Kimlik Doğrulanıyor...");
        
        const user = this.db.users.find(u => u.email === email && u.password === pass);
        if (user) {
            this.currentUser = user;
            this.showDashboard();
        } else {
            alert("Hatalı Giriş Bilgileri!");
            this.updateStatus("Giriş Başarısız", false);
        }
    }

    logout() {
        this.currentUser = null;
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
        this.updateStatus("Hoş Geldiniz, " + this.currentUser.name, true);
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
            card.innerHTML = `
                <div style="font-size: 0.7rem; color: var(--accent); font-weight: 800; margin-bottom: 0.5rem;">${c.code}</div>
                <h3>${c.name}</h3>
                <p style="font-size: 0.8rem; color: var(--text-secondary);">Aktif oturum başlatmak için dokunun.</p>
            `;
            card.onclick = () => this.startSession(c);
            container.appendChild(card);
        });
    }

    async startSession(course) {
        document.getElementById('active-session-title').innerText = course.name;
        
        const pin = Math.floor(100000 + Math.random() * 900000).toString();
        const qrData = "ATTEND_" + Date.now();
        
        this.db.active_session = {
            course_id: course.id,
            qr_data: qrData,
            pin: pin,
            active: true
        };
        this.db.records = []; // Clear for new session
        
        this.updateStatus("Oturum Hazırlanıyor...");
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
        new QRCode(container, {
            text: qrUrl,
            width: 250,
            height: 250,
            colorDark : "#05070a",
            colorLight : "#ffffff",
            correctLevel : QRCode.CorrectLevel.H
        });
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
            container.innerHTML = '<div class="text-center text-muted" style="padding: 2rem;">Henüz katılım sağlanmadı...</div>';
            return;
        }

        container.innerHTML = '';
        this.db.records.forEach(studentId => {
            const s = this.db.users.find(u => u.id === studentId);
            if (s) {
                const item = document.createElement('div');
                item.className = 'list-item';
                item.innerHTML = `
                    <div>
                        <div style="font-weight: 700;">${s.name}</div>
                        <div style="font-size: 0.7rem; color: var(--text-secondary);">${s.student_no}</div>
                    </div>
                    <div class="status-present">DERSTE</div>
                `;
                container.appendChild(item);
            }
        });
    }

    /**
     * STUDENT ACTIONS
     */
    async startScan() {
        const btn = document.getElementById('btn-scan');
        const container = document.getElementById('scanner-container');
        
        btn.classList.add('hidden');
        container.classList.remove('hidden');
        
        this.scanner = new Html5Qrcode("scanner-container");
        this.scanner.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: 250 },
            (decodedText) => {
                this.stopScan();
                const sessionMatch = decodedText.match(/session=([^&]+)/);
                this.processAttendance(sessionMatch ? sessionMatch[1] : decodedText);
            },
            () => {}
        ).catch(e => {
            alert("Kamera erişimi reddedildi.");
            this.stopScan();
        });
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
            this.processAttendance(this.db.active_session.qr_data);
        } else {
            alert("Geçersiz veya Hatalı Kod!");
        }
    }

    async processAttendance(qrData) {
        await this.syncFromCloud();
        
        if (this.db.active_session && this.db.active_session.qr_data === qrData) {
            if (!this.db.records.includes(this.currentUser.id)) {
                this.db.records.push(this.currentUser.id);
                await this.syncToCloud();
                
                // Show Success
                document.getElementById('manual-code').disabled = true;
                document.getElementById('btn-scan').classList.add('hidden');
                const course = this.db.courses.find(c => c.id === this.db.active_session.course_id);
                document.getElementById('success-course-name').innerText = course ? course.name : "Ders";
                document.getElementById('success-overlay').classList.remove('hidden');
            } else {
                alert("Zaten yoklamaya katıldınız!");
            }
        } else {
            alert("Geçersiz veya Süresi Dolmuş Oturum!");
        }
    }

    setupEventListeners() {
        // Handle enter key on login
        document.getElementById('login-password').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.login();
        });
    }
}

// Global Instant
const app = new AttendanceApp();
