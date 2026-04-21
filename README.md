### 1. Gerekli Kütüphaneleri Kurun
Terminalinizi açın ve şu komutu çalıştırın:
```powershell
pip install -r requirements.txt
```

### 2. Veritabanını Hazırlayın
 Öğretmen ve Öğrenci hesapları oluşturmak için:
```powershell
python -m backend.seed_data
```

### 3. Sunucuyu Başlatın
Uygulamayı yerel sunucuda çalıştırmak için:
```powershell
python -m uvicorn backend.main:app --reload
```

### 4. Giriş Yapın
Tarayıcınızdan `frontend/index.html` dosyasını açın ve şu bilgilerle giriş yapın:

**Öğretmen Hesabı:**
- E-posta: peri@uni.edu.tr
- Şifre: 123

**Öğrenci Hesabı:**
- E-posta: ufuk@uni.edu.tr, boran@uni.edu.tr, enes@uni.edu.tr
- Şifre: 123
