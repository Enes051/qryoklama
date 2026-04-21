from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import uuid
from typing import List

from . import models, schemas, database

models.Base.metadata.create_all(bind=database.engine)

class AttendanceManager:
    def __init__(self, db: Session):
        self.db = db

    def authenticate_user(self, email, password):
        u = self.db.query(models.User).filter(models.User.email == email).first()
        if not u or u.password != password:
            return None
        return u

    def get_all_courses(self):
        return self.db.query(models.Course).all()

    def start_new_session(self, course_id):
        self.db.query(models.Session).filter(models.Session.course_id == course_id).update({"is_active": False})
        s = models.Session(
            course_id=course_id,
            qr_data="QR_" + str(uuid.uuid4())[:8],
            pin=str(uuid.uuid4().int)[:6],
            is_active=True
        )
        self.db.add(s)
        self.db.commit()
        self.db.refresh(s)
        return s

    def fetch_active_session(self, course_id):
        return self.db.query(models.Session).filter(
            models.Session.course_id == course_id, 
            models.Session.is_active == True
        ).first()

    def process_attendance(self, qr_data, student_id):
        s = self.db.query(models.Session).filter(
            (models.Session.qr_data == qr_data) | (models.Session.pin == qr_data),
            models.Session.is_active == True
        ).first()
        if not s:
            return {"error": "Gecersiz QR"}
        
        exists = self.db.query(models.Attendance).filter(
            models.Attendance.session_id == s.id, 
            models.Attendance.student_id == student_id
        ).first()
        if exists:
            return {"msg": "Zaten kaydedildi"}
        
        a = models.Attendance(session_id=s.id, student_id=student_id)
        self.db.add(a)
        self.db.commit()
        return {"msg": "Basarili"}

    def get_session_records(self, session_id):
        recs = self.db.query(models.Attendance).filter(models.Attendance.session_id == session_id).all()
        res = []
        for r in recs:
            res.append({
                "student_name": r.student.name,
                "student_no": r.student.student_no,
                "timestamp": r.timestamp
            })
        return res

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/login")
def login(data: schemas.UserLogin, db: Session = Depends(database.get_db)):
    manager = AttendanceManager(db)
    user = manager.authenticate_user(data.email, data.password)
    if not user:
        raise HTTPException(400, "Hatali giris")
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "detail": user.get_role_label()
    }

@app.get("/courses", response_model=List[schemas.Course])
def get_courses(db: Session = Depends(database.get_db)):
    manager = AttendanceManager(db)
    return manager.get_all_courses()

@app.post("/sessions", response_model=schemas.Session)
def create_session(course_id: int, db: Session = Depends(database.get_db)):
    manager = AttendanceManager(db)
    return manager.start_new_session(course_id)

@app.get("/sessions/active/{course_id}")
def get_active_session(course_id: int, db: Session = Depends(database.get_db)):
    manager = AttendanceManager(db)
    return manager.fetch_active_session(course_id)

@app.post("/attendance")
def take_attendance(data: schemas.AttendanceCreate, db: Session = Depends(database.get_db)):
    manager = AttendanceManager(db)
    result = manager.process_attendance(data.qr_data, data.student_id)
    if "error" in result:
        raise HTTPException(404, result["error"])
    return result

@app.get("/attendance/{session_id}", response_model=List[schemas.AttendanceRecord])
def get_records(session_id: int, db: Session = Depends(database.get_db)):
    manager = AttendanceManager(db)
    return manager.get_session_records(session_id)
