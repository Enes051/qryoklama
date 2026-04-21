from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime, timedelta, timezone
from .database import Base

TRT = timezone(timedelta(hours=3))

def get_now():
    return datetime.now(TRT)

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    email = Column(String, unique=True, index=True)
    password = Column(String)
    role = Column(String)
    
    __mapper_args__ = {
        'polymorphic_identity': 'user',
        'polymorphic_on': role
    }

    def get_role_label(self):
        return "Genel Kullanici"

class StudentUser(User):
    student_no = Column(String, unique=True, index=True, nullable=True)
    
    __mapper_args__ = {
        'polymorphic_identity': 'student',
    }

    def get_role_label(self):
        return f"Ogrenci No: {self.student_no}"

class TeacherUser(User):
    department = Column(String, nullable=True)
    
    __mapper_args__ = {
        'polymorphic_identity': 'teacher',
    }

    def get_role_label(self):
        return f"Departman: {self.department}"

class Course(Base):
    __tablename__ = "courses"
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True)
    name = Column(String)
    teacher_id = Column(Integer, ForeignKey("users.id"))
    teacher = relationship("TeacherUser")

class Session(Base):
    __tablename__ = "sessions"
    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"))
    date = Column(DateTime, default=get_now)
    qr_data = Column(String, unique=True, index=True)
    pin = Column(String)
    is_active = Column(Boolean, default=True)
    course = relationship("Course")

class Attendance(Base):
    __tablename__ = "attendance"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"))
    student_id = Column(Integer, ForeignKey("users.id"))
    timestamp = Column(DateTime, default=get_now)
    session = relationship("Session")
    student = relationship("StudentUser")
