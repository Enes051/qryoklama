from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
import uuid

import models, schemas, database

models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="QR Attendance System API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/")
def read_root():
    return {"message": "Welcome to QR Attendance System API"}

@app.post("/users/register", response_model=schemas.User)
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    new_user = models.User(
        name=user.name,
        email=user.email,
        password_hash=user.password, # DUMMY HASH
        role=user.role,
        student_no=user.student_no,
        department=user.department
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/users/login")
def login(user: schemas.UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if not db_user or db_user.password_hash != user.password:
        raise HTTPException(status_code=400, detail="Invalid credentials")
    
    return {
        "access_token": "dummy_token_for_presentation",
        "token_type": "bearer",
        "user": {
            "id": db_user.id,
            "name": db_user.name,
            "role": db_user.role,
            "student_no": db_user.student_no
        }
    }

@app.post("/courses", response_model=schemas.Course)
def create_course(course: schemas.CourseCreate, db: Session = Depends(get_db)):
    db_course = models.Course(**course.dict())
    db.add(db_course)
    db.commit()
    db.refresh(db_course)
    return db_course

@app.get("/courses", response_model=List[schemas.Course])
def get_courses(db: Session = Depends(get_db)):
    return db.query(models.Course).all()

@app.post("/attendance/session", response_model=schemas.AttendanceSession)
def create_session(course_id: int, db: Session = Depends(get_db)):
    qr_data = str(uuid.uuid4())
    db_session = models.AttendanceSession(course_id=course_id, qr_data=qr_data)
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return db_session

@app.post("/attendance/scan")
def scan_qr_code(scan_data: schemas.AttendanceRecordCreate, db: Session = Depends(get_db)):
    session = db.query(models.AttendanceSession).filter(
        models.AttendanceSession.qr_data == scan_data.qr_data,
        models.AttendanceSession.is_active == True
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Invalid or expired QR code")
    
    existing_record = db.query(models.AttendanceRecord).filter(
        models.AttendanceRecord.session_id == session.id,
        models.AttendanceRecord.student_id == scan_data.student_id
    ).first()
    
    if existing_record:
        return {"message": "Attendance already recorded"}

    new_record = models.AttendanceRecord(
        session_id=session.id,
        student_id=scan_data.student_id
    )
    db.add(new_record)
    db.commit()
    return {"message": "Attendance recorded successfully"}

@app.get("/attendance/session/{session_id}/records")
def get_session_records(session_id: int, db: Session = Depends(get_db)):
    records = db.query(models.AttendanceRecord).filter(models.AttendanceRecord.session_id == session_id).all()
    result = []
    for r in records:
        student = db.query(models.User).filter(models.User.id == r.student_id).first()
        result.append({
            "record_id": r.id,
            "student_name": student.name if student else "Unknown",
            "student_no": student.student_no if student else "Unknown",
            "timestamp": r.timestamp,
            "status": r.status
        })
    return result
