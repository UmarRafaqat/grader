"""
Pydantic models for API validation
Fixed for Pydantic V2
"""
from pydantic import BaseModel, Field
from typing import Dict, List, Any, Optional
from datetime import datetime


class QuestionConfig(BaseModel):
    """Question configuration model"""
    type: str = Field(..., description="Question type: mcq, descriptive, ordering")
    marks: float = Field(..., description="Maximum marks for this question")
    question_text: Optional[str] = Field("", description="Question text")
    ground_truth: Dict[str, Any] = Field(..., description="Ground truth data")
    
    class Config:
        json_schema_extra = {
            "example": {
                "type": "mcq",
                "marks": 2.0,
                "question_text": "What is the capital of France?",
                "ground_truth": {
                    "correct_answer": "A"
                }
            }
        }


class GroundTruthCreate(BaseModel):
    """Ground truth creation model"""
    exam_name: str = Field(..., description="Name of the exam")
    questions: Dict[str, QuestionConfig] = Field(..., description="Questions configuration")
    total_marks: float = Field(..., description="Total marks for the exam")


class SubmissionCreate(BaseModel):
    """Submission creation model"""
    student_id: str = Field(..., description="Student ID")
    exam_id: int = Field(..., description="Exam ID")


class GradeEdit(BaseModel):
    """Grade edit model"""
    submission_id: int = Field(..., description="Submission ID")
    question_id: str = Field(..., description="Question ID")
    new_score: float = Field(..., description="New score")
    teacher_comment: Optional[str] = Field("", description="Teacher comment")


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    message: str
    version: str
    timestamp: str


class ExamResponse(BaseModel):
    """Exam response model"""
    id: int
    exam_name: str
    questions_count: int
    total_marks: float
    upload_time: datetime
    submissions_count: int


class SubmissionResponse(BaseModel):
    """Submission response model"""
    id: int
    student_id: str
    exam_id: int
    submission_time: datetime


class ResultResponse(BaseModel):
    """Result response model"""
    question_id: str
    score: float
    max_score: float
    reasoning: str
    breakdown: Optional[Dict[str, Any]] = None
    similarity_score: Optional[float] = None


class GradingResponse(BaseModel):
    """Grading response model"""
    success: bool
    submission_id: int
    total_score: float
    total_max: float
    percentage: float
    results: List[Dict[str, Any]]


class ReviewResponse(BaseModel):
    """Review response model"""
    submission: Dict[str, Any]
    ground_truth: Dict[str, Any]
    results: List[Dict[str, Any]]
    edits: List[Dict[str, Any]]
