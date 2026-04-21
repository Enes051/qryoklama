const app = {
    user: null,
    apiUrl: "http://127.0.0.1:8000",

    async login() {
        const email = document.getElementById('email').value;
        const pass = document.getElementById('pass').value;
        const resp = await fetch(`${this.apiUrl}/login`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({email, password: pass})
        });
        if (resp.ok) {
            this.user = await resp.json();
            this.showView();
        } else {
            alert("Giris hatasi");
        }
    },

    showView() {
        document.querySelectorAll('.box').forEach(b => b.classList.add('hidden'));
        if (!this.user) {
            document.getElementById('login-view').classList.remove('hidden');
        } else if (this.user.role === 'teacher') {
            document.getElementById('teacher-view').classList.remove('hidden');
            document.getElementById('t-name').innerText = "Hocam Hosgeldiniz: " + this.user.name + "\n" + this.user.detail;
            this.loadCourses();
        } else {
            document.getElementById('student-view').classList.remove('hidden');
            document.getElementById('st-name').innerText = "Ogrenci: " + this.user.name + "\n" + this.user.detail;
        }
    },

    async loadCourses() {
        const resp = await fetch(`${this.apiUrl}/courses`);
        const courses = await resp.json();
        const list = document.getElementById('course-list');
        list.innerHTML = "";
        courses.filter(c => c.teacher_id === this.user.id).forEach(c => {
            const div = document.createElement('div');
            div.className = "course-item";
            div.innerText = c.code + " - " + c.name;
            div.onclick = () => this.startSession(c);
            list.appendChild(div);
        });
    },

    async startSession(course) {
        const resp = await fetch(`${this.apiUrl}/sessions?course_id=${course.id}`, {method: 'POST'});
        const session = await resp.json();
        this.showSession(course.name, session);
    },

    showSession(name, session) {
        document.querySelectorAll('.box').forEach(b => b.classList.add('hidden'));
        document.getElementById('session-view').classList.remove('hidden');
        document.getElementById('s-title').innerText = name;
        document.getElementById('s-pin').innerText = session.pin;
        document.getElementById('qr-code').innerHTML = "";
        new QRCode(document.getElementById("qr-code"), session.qr_data);
        this.pollRecords(session.id);
    },

    pollRecords(sessionId) {
        this.pollInterval = setInterval(async () => {
            const resp = await fetch(`${this.apiUrl}/attendance/${sessionId}`);
            const data = await resp.json();
            const list = document.getElementById('student-list');
            list.innerHTML = "<h4>Gelenler (" + data.length + ")</h4>";
            data.forEach(r => {
                const p = document.createElement('p');
                p.innerText = r.student_name + " (" + r.student_no + ")";
                list.appendChild(p);
            });
        }, 3000);
    },

    async startScanner() {
        const readerEl = document.getElementById('reader');
        readerEl.classList.remove('hidden');
        this.html5QrCode = new Html5Qrcode("reader");
        this.html5QrCode.start(
            { facingMode: "environment" }, 
            { fps: 10, qrbox: { width: 250, height: 250 } },
            (decodedText) => {
                document.getElementById('qr-input').value = decodedText;
                this.stopScanner();
                this.sendAttendance();
            },
            (errorMessage) => {}
        ).catch(err => alert("Kamera acilamadi"));
        document.getElementById('scan-btn').innerText = "Kapat";
        document.getElementById('scan-btn').onclick = () => this.stopScanner();
    },

    stopScanner() {
        if (this.html5QrCode) {
            this.html5QrCode.stop().then(() => {
                document.getElementById('reader').classList.add('hidden');
                document.getElementById('scan-btn').innerText = "Kamerayi Ac";
                document.getElementById('scan-btn').onclick = () => this.startScanner();
            });
        }
    },

    async sendAttendance() {
        const val = document.getElementById('qr-input').value;
        const resp = await fetch(`${this.apiUrl}/attendance`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({qr_data: val, student_id: this.user.id})
        });
        const res = await resp.json();
        alert(res.msg || res.detail);
    },

    async closeSession() {
        clearInterval(this.pollInterval);
        this.showView();
    },

    logout() {
        this.user = null;
        this.showView();
    }
};
