from .database import SessionLocal, engine
from . import models

models.Base.metadata.create_all(bind=engine)

def seed():
    db = SessionLocal()
    
    if db.query(models.User).first():
        return

    users = [
        models.TeacherUser(name="Peri Gunes", email="peri@uni.edu.tr", password="123", role="teacher", department="Bilgisayar Muhendlisigi"),
        models.StudentUser(name="Ufuk Bugra Sahin", email="ufuk@uni.edu.tr", password="123", role="student", student_no="20202020"),
        models.StudentUser(name="Boran Ozsoy", email="boran@uni.edu.tr", password="123", role="student", student_no="20202021"),
        models.StudentUser(name="Enes Cinipi", email="enes@uni.edu.tr", password="123", role="student", student_no="20202022")
    ]
    db.add_all(users)
    db.commit()

    teacher = db.query(models.TeacherUser).first()
    courses = [
        models.Course(code="BLG101", name="Programlamaya Giris", teacher_id=teacher.id),
        models.Course(code="MAT101", name="Matematik I", teacher_id=teacher.id)
    ]
    db.add_all(courses)
    db.commit()
    db.close()

if __name__ == "__main__":
    seed()
