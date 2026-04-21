from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class UserBase(BaseModel):
    name: str
    email: str
    role: str
    student_no: Optional[str] = None
    department: Optional[str] = None

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    email: str
    password: str

class CourseBase(BaseModel):
    code: str
    name: str
    teacher_id: int

class Course(CourseBase):
    id: int
    class Config:
        from_attributes = True

class SessionBase(BaseModel):
    course_id: int
    qr_data: str
    pin: str

class Session(SessionBase):
    id: int
    date: datetime
    is_active: bool
    class Config:
        from_attributes = True

class AttendanceCreate(BaseModel):
    qr_data: str
    student_id: int

class AttendanceRecord(BaseModel):
    student_name: str
    student_no: str
    timestamp: datetime
