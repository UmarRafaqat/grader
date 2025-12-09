from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, JSON, Text, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
from typing import Dict, List, Optional, Any
import os
import json

Base = declarative_base()


class GroundTruth(Base):
    __tablename__ = "ground_truths"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    exam_name = Column(String(255), nullable=False)
    upload_time = Column(DateTime, default=datetime.now)
    questions = Column(JSON, nullable=False)
    total_marks = Column(Float, nullable=False)


class Submission(Base):
    __tablename__ = "submissions"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(String(100), nullable=False, index=True)
    exam_id = Column(Integer, nullable=False, index=True)
    submission_time = Column(DateTime, default=datetime.now)
    raw_images = Column(JSON, nullable=False)
    extracted_answers = Column(JSON, nullable=False)


class Result(Base):
    __tablename__ = "results"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    submission_id = Column(Integer, nullable=False, index=True)
    question_id = Column(String(50), nullable=False)
    score = Column(Float, nullable=False)
    max_score = Column(Float, nullable=False)
    reasoning = Column(Text, nullable=False)
    breakdown = Column(JSON, nullable=True)
    similarity_score = Column(Float, nullable=True)


class GradeEdit(Base):
    __tablename__ = "grade_edits"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    submission_id = Column(Integer, nullable=False, index=True)
    question_id = Column(String(50), nullable=False)
    original_score = Column(Float, nullable=False)
    edited_score = Column(Float, nullable=False)
    teacher_comment = Column(Text, nullable=True)
    edited_at = Column(DateTime, default=datetime.now)
    edited_by = Column(String(100), default="teacher")


class Database:
    def __init__(self):
        """Initialize database connection"""
        db_url = os.getenv(
            "DATABASE_URL",
            "postgresql://grading_user:grading_pass@db:5432/grading_db"
        )
        
        print(f"Connecting to database: {db_url.split('@')[1] if '@' in db_url else 'local'}")
        
        try:
            self.engine = create_engine(db_url, pool_pre_ping=True)
            Base.metadata.create_all(self.engine)
            
            Session = sessionmaker(bind=self.engine)
            self.session = Session()
            
            print("✅ Database tables created/verified")
        except Exception as e:
            print(f"❌ Database connection error: {str(e)}")
            raise
    
    def is_connected(self) -> bool:
        """Check database connection"""
        try:
            # Use text() for raw SQL
            self.session.execute(text("SELECT 1"))
            return True
        except Exception as e:
            print(f"Database connection check failed: {str(e)}")
            return False
    
    # Ground Truth operations
    def add_ground_truth(self, exam_name: str, questions: Dict, total_marks: float) -> int:
        """Add ground truth"""
        try:
            gt = GroundTruth(
                exam_name=exam_name,
                questions=questions,
                total_marks=total_marks
            )
            self.session.add(gt)
            self.session.commit()
            print(f"✅ Added ground truth: {exam_name} (ID: {gt.id})")
            return gt.id
        except Exception as e:
            self.session.rollback()
            print(f"❌ Error adding ground truth: {str(e)}")
            raise
    
    def get_ground_truth(self, gt_id: int) -> Optional[GroundTruth]:
        """Get ground truth by ID"""
        try:
            return self.session.query(GroundTruth).filter_by(id=gt_id).first()
        except Exception as e:
            print(f"Error getting ground truth: {str(e)}")
            return None
    
    def get_all_ground_truths(self) -> List[GroundTruth]:
        """Get all ground truths"""
        try:
            return self.session.query(GroundTruth).order_by(GroundTruth.upload_time.desc()).all()
        except Exception as e:
            print(f"Error getting all ground truths: {str(e)}")
            return []
    
    def count_submissions_for_exam(self, exam_id: int) -> int:
        """Count submissions for an exam"""
        try:
            return self.session.query(Submission).filter_by(exam_id=exam_id).count()
        except Exception as e:
            print(f"Error counting submissions: {str(e)}")
            return 0
    
    # Submission operations
    def add_submission(self, student_id: str, exam_id: int, 
                      raw_images: List[str], extracted_answers: Dict) -> int:
        """Add student submission"""
        try:
            submission = Submission(
                student_id=student_id,
                exam_id=exam_id,
                raw_images=raw_images,
                extracted_answers=extracted_answers
            )
            self.session.add(submission)
            self.session.commit()
            print(f"✅ Added submission: Student {student_id}, Exam {exam_id} (ID: {submission.id})")
            return submission.id
        except Exception as e:
            self.session.rollback()
            print(f"❌ Error adding submission: {str(e)}")
            raise
    
    def get_submission(self, submission_id: int) -> Optional[Submission]:
        """Get submission by ID"""
        try:
            return self.session.query(Submission).filter_by(id=submission_id).first()
        except Exception as e:
            print(f"Error getting submission: {str(e)}")
            return None
    
    def get_submission_by_student_id(self, student_id: str) -> Optional[Submission]:
        """Get most recent submission by student ID (case-insensitive)"""
        try:
            return self.session.query(Submission).filter(
                Submission.student_id.ilike(student_id)
            ).order_by(Submission.submission_time.desc()).first()
        except Exception as e:
            print(f"Error getting submission by student ID: {str(e)}")
            return None
    
    # Results operations
    def add_results(self, submission_id: int, results: List[Dict]):
        """Add grading results"""
        try:
            for result_data in results:
                result = Result(
                    submission_id=submission_id,
                    question_id=result_data["question_id"],
                    score=result_data["score"],
                    max_score=result_data["max_score"],
                    reasoning=result_data["reasoning"],
                    breakdown=result_data.get("breakdown"),
                    similarity_score=result_data.get("similarity_score")
                )
                self.session.add(result)
            self.session.commit()
            print(f"✅ Added {len(results)} results for submission {submission_id}")
        except Exception as e:
            self.session.rollback()
            print(f"❌ Error adding results: {str(e)}")
            raise
    
    def get_results(self, submission_id: int) -> Optional[List[Dict]]:
        """Get results by submission ID"""
        try:
            results = self.session.query(Result).filter_by(submission_id=submission_id).all()
            if not results:
                return None
            
            return [
                {
                    "question_id": r.question_id,
                    "score": r.score,
                    "max_score": r.max_score,
                    "reasoning": r.reasoning,
                    "breakdown": r.breakdown,
                    "similarity_score": r.similarity_score
                }
                for r in results
            ]
        except Exception as e:
            print(f"Error getting results: {str(e)}")
            return None
    
    def update_results(self, submission_id: int, results: List[Dict]):
        """Update results"""
        try:
            # Delete old results
            self.session.query(Result).filter_by(submission_id=submission_id).delete()
            # Add updated results
            self.add_results(submission_id, results)
            print(f"✅ Updated results for submission {submission_id}")
        except Exception as e:
            self.session.rollback()
            print(f"❌ Error updating results: {str(e)}")
            raise
    
    # Grade edit operations
    def add_grade_edit(self, edit: Dict):
        """Add teacher grade edit"""
        try:
            grade_edit = GradeEdit(
                submission_id=edit["submission_id"],
                question_id=edit["question_id"],
                original_score=edit["original_score"],
                edited_score=edit["edited_score"],
                teacher_comment=edit.get("teacher_comment", ""),
                edited_at=edit.get("edited_at", datetime.now())
            )
            self.session.add(grade_edit)
            self.session.commit()
            print(f"✅ Added grade edit for submission {edit['submission_id']}, question {edit['question_id']}")
        except Exception as e:
            self.session.rollback()
            print(f"❌ Error adding grade edit: {str(e)}")
            raise
    
    def get_grade_edits(self, submission_id: int) -> List[Dict]:
        """Get all grade edits for a submission"""
        try:
            edits = self.session.query(GradeEdit).filter_by(submission_id=submission_id).all()
            return [
                {
                    "question_id": e.question_id,
                    "original_score": e.original_score,
                    "edited_score": e.edited_score,
                    "teacher_comment": e.teacher_comment,
                    "edited_at": e.edited_at.isoformat() if e.edited_at else None
                }
                for e in edits
            ]
        except Exception as e:
            print(f"Error getting grade edits: {str(e)}")
            return []