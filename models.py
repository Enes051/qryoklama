from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
import datetime
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String)
    role = Column(String) # 'student', 'teacher', 'admin'
    
    student_no = Column(String, unique=True, index=True, nullable=True)
    department = Column(String, nullable=True)

class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    course_code = Column(String, unique=True, index=True)
    course_name = Column(String)
    teacher_id = Column(Integer, ForeignKey("users.id"))
    
    teacher = relationship("User")
    sessions = relationship("AttendanceSession", back_populates="course")

class AttendanceSession(Base):
    __tablename__ = "attendance_sessions"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"))
    date = Column(DateTime, default=datetime.datetime.utcnow)
    qr_data = Column(String, unique=True, index=True)
    is_active = Column(Boolean, default=True)

    course = relationship("Course", back_populates="sessions")
    records = relationship("AttendanceRecord", back_populates="session")

class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("attendance_sessions.id"))
    student_id = Column(Integer, ForeignKey("users.id"))
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    status = Column(String, default="Present")

    session = relationship("AttendanceSession", back_populates="records")
    student = relationship("User")
