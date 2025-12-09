from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import List, Optional
from contextlib import asynccontextmanager
import os
import json
import shutil
from pathlib import Path
from dotenv import load_dotenv
from datetime import datetime

# Load environment variables
load_dotenv()

# Import local modules
from models import QuestionConfig, GroundTruthCreate, SubmissionCreate, GradeEdit
from database import Database
from ai_grading_engine import AIGradingEngine
from ocr_service import EnhancedOCRService

# Global instances
db = None
grading_engine = None
ocr_service = None

# Upload directory
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)


def initialize_services():
    """Initialize services with API key and database"""
    global grading_engine, ocr_service, db
    
    api_key = os.getenv("OPENAI_API_KEY")
    
    if not api_key:
        print("\n" + "="*60)
        print("⚠️  WARNING: OPENAI_API_KEY not set!")
        print("="*60)
        print("AI grading and OCR features will not work.")
        print("Please add your OpenAI API key to backend/.env file:")
        print("OPENAI_API_KEY=your-key-here")
        print("="*60 + "\n")
    
    # Initialize database
    try:
        db = Database()
        if db.is_connected():
            print("✅ Database connected successfully")
        else:
            print("❌ Database connection failed")
    except Exception as e:
        print(f"❌ Database initialization error: {str(e)}")
        db = None
    
    # Initialize AI services
    if api_key:
        try:
            grading_engine = AIGradingEngine(api_key)
            ocr_service = EnhancedOCRService(api_key)
            print("✅ AI services initialized successfully")
        except Exception as e:
            print(f"❌ AI services initialization error: {str(e)}")
            grading_engine = None
            ocr_service = None
    else:
        grading_engine = None
        ocr_service = None
    
    print("\n" + "="*60)
    print("SERVICE STATUS:")
    print(f"  Database: {'✅ Active' if db and db.is_connected() else '❌ Inactive'}")
    print(f"  AI Grading: {'✅ Active' if grading_engine else '❌ Inactive'}")
    print(f"  OCR Service: {'✅ Active' if ocr_service else '❌ Inactive'}")
    print("="*60 + "\n")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    print("\n🚀 Starting AI Grading System...")
    initialize_services()
    yield
    print("\n👋 Shutting down...")


# Create FastAPI app
app = FastAPI(
    title="AI Grading System",
    version="2.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# ENDPOINTS
# ============================================================================

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "online",
        "message": "AI Grading System is running",
        "version": "2.0",
        "timestamp": datetime.now().isoformat()
    }


@app.get("/api/health")
async def health():
    """Detailed health check"""
    return {
        "status": "healthy",
        "services": {
            "grading_engine": "active" if grading_engine else "inactive",
            "ocr_service": "active" if ocr_service else "inactive",
            "database": "active" if (db and db.is_connected()) else "inactive"
        },
        "timestamp": datetime.now().isoformat()
    }


@app.post("/api/auto-configure")
async def auto_configure(
    exam_name: str = Form(...),
    files: List[UploadFile] = File(...)
):
    """Auto-configure questions from images using GPT-4 Vision"""
    if not ocr_service:
        raise HTTPException(
            status_code=503, 
            detail="OCR service not available. Please configure OPENAI_API_KEY in backend/.env file."
        )
    
    try:
        file_paths = []
        for file in files:
            file_path = UPLOAD_DIR / f"temp_{file.filename}"
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            file_paths.append(str(file_path))
        
        # Extract ground truth with auto-config
        questions_dict = ocr_service.extract_ground_truth(file_paths)
        
        # Cleanup temp files
        for path in file_paths:
            try:
                os.remove(path)
            except:
                pass
        
        return {
            "success": True,
            "questions": questions_dict,
            "exam_name": exam_name
        }
    except Exception as e:
        print(f"Auto-configure error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Auto-configure failed: {str(e)}")


@app.post("/api/upload-ground-truth")
async def upload_ground_truth(
    exam_name: str = Form(...),
    questions: str = Form(...),
    total_marks: str = Form(...)
):
    """Upload ground truth (answer key)"""
    try:
        questions_dict = json.loads(questions)
        total_marks_float = float(total_marks)
        
        # Store in database
        exam_id = db.add_ground_truth(exam_name, questions_dict, total_marks_float)
        
        return {
            "success": True,
            "exam_id": exam_id,
            "exam_name": exam_name,
            "total_marks": total_marks_float,
            "questions_count": len(questions_dict)
        }
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid configuration format: {str(e)}")
    except Exception as e:
        print(f"Error uploading ground truth: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/exams")
async def get_exams():
    """Get all exams with submission counts"""
    try:
        exams = db.get_all_ground_truths()
        return [
            {
                "id": exam.id,
                "exam_name": exam.exam_name,
                "total_marks": exam.total_marks,
                "questions_count": len(exam.questions),
                "upload_time": exam.upload_time.isoformat(),
                "submissions_count": db.count_submissions_for_exam(exam.id)
            }
            for exam in exams
        ]
    except Exception as e:
        print(f"Error getting exams: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/upload-student-papers")
async def upload_student_papers(
    exam_id: int = Form(...),
    student_id: str = Form(...),
    files: List[UploadFile] = File(...)
):
    """Upload student papers"""
    try:
        # Verify exam exists
        ground_truth = db.get_ground_truth(exam_id)
        if not ground_truth:
            raise HTTPException(status_code=404, detail="Exam not found")
        
        # Save files
        file_paths = []
        for file in files:
            file_path = UPLOAD_DIR / f"student_{student_id}_{file.filename}"
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            file_paths.append(str(file_path))
        
        # Extract answers using OCR
        extracted_answers = {}
        if ocr_service:
            try:
                extracted_answers = ocr_service.extract_student_answers(file_paths)
                print(f"✅ OCR extracted answers: {list(extracted_answers.keys())}")
            except Exception as e:
                print(f"⚠️  OCR extraction failed: {str(e)}")
                extracted_answers = {}
        else:
            print("⚠️  OCR service not available")
        
        # Store submission
        submission_id = db.add_submission(
            student_id=student_id,
            exam_id=exam_id,
            raw_images=file_paths,
            extracted_answers=extracted_answers
        )
        
        return {
            "success": True,
            "submission_id": submission_id,
            "student_id": student_id,
            "exam_id": exam_id,
            "message": "Paper uploaded successfully. Ready to grade."
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error uploading student papers: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/grade-paper/{submission_id}")
async def grade_paper(submission_id: int):
    """Grade a student paper"""
    try:
        # Check if grading engine is available
        if not grading_engine:
            raise HTTPException(
                status_code=503,
                detail="AI grading service not available. Please configure OPENAI_API_KEY in backend/.env"
            )
        
        # Get submission
        submission = db.get_submission(submission_id)
        if not submission:
            raise HTTPException(status_code=404, detail="Submission not found")
        
        # Get ground truth
        ground_truth = db.get_ground_truth(submission.exam_id)
        if not ground_truth:
            raise HTTPException(status_code=404, detail="Ground truth not found")
        
        # Grade submission
        results = grading_engine.grade_submission(
            ground_truth.questions,
            submission.extracted_answers
        )
        
        # Store results
        db.add_results(submission_id, results)
        
        # Calculate totals
        total_score = sum(r["score"] for r in results)
        total_max = sum(r["max_score"] for r in results)
        percentage = round((total_score / total_max * 100), 2) if total_max > 0 else 0
        
        return {
            "success": True,
            "submission_id": submission_id,
            "total_score": round(total_score, 2),
            "total_max": total_max,
            "percentage": percentage,
            "results": results
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error grading paper: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/results/{submission_id_or_student_id}")
async def get_results(submission_id_or_student_id: str):
    """Get results by submission ID or student ID"""
    try:
        submission = None
        
        # Try as submission ID first
        if submission_id_or_student_id.isdigit():
            submission_id = int(submission_id_or_student_id)
            submission = db.get_submission(submission_id)
        
        # Try as student ID
        if not submission:
            submission = db.get_submission_by_student_id(submission_id_or_student_id)
        
        if not submission:
            raise HTTPException(
                status_code=404, 
                detail=f"No submission found for ID: {submission_id_or_student_id}"
            )
        
        # Get results
        results = db.get_results(submission.id)
        if not results:
            raise HTTPException(
                status_code=404, 
                detail="Submission found but not graded yet. Please grade the paper first."
            )
        
        # Calculate totals
        total_score = sum(r["score"] for r in results)
        total_max = sum(r["max_score"] for r in results)
        percentage = round((total_score / total_max * 100), 2) if total_max > 0 else 0
        
        return {
            "submission_id": submission.id,
            "student_id": submission.student_id,
            "exam_id": submission.exam_id,
            "total_score": round(total_score, 2),
            "total_max": total_max,
            "percentage": percentage,
            "results": results
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting results: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/review/{submission_id_or_student_id}")
async def get_review(submission_id_or_student_id: str):
    """Get detailed review for teacher"""
    try:
        submission = None
        
        # Try as submission ID first
        if submission_id_or_student_id.isdigit():
            submission_id = int(submission_id_or_student_id)
            submission = db.get_submission(submission_id)
        
        # Try as student ID
        if not submission:
            submission = db.get_submission_by_student_id(submission_id_or_student_id)
        
        if not submission:
            raise HTTPException(
                status_code=404, 
                detail=f"No submission found for ID: {submission_id_or_student_id}"
            )
        
        ground_truth = db.get_ground_truth(submission.exam_id)
        results = db.get_results(submission.id)
        edits = db.get_grade_edits(submission.id)
        
        # Apply grade edits to results
        if results and edits:
            edits_dict = {e["question_id"]: e for e in edits}
            for result in results:
                if result["question_id"] in edits_dict:
                    edit = edits_dict[result["question_id"]]
                    result["score"] = edit["edited_score"]
                    result["teacher_comment"] = edit["teacher_comment"]
        
        return {
            "submission": {
                "id": submission.id,
                "student_id": submission.student_id,
                "exam_id": submission.exam_id,
                "submission_time": submission.submission_time.isoformat()
            },
            "ground_truth": {
                "exam_name": ground_truth.exam_name,
                "total_marks": ground_truth.total_marks
            },
            "results": results or [],
            "edits": edits
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting review: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/edit-grade/{submission_id}/{question_id}")
async def edit_grade(
    submission_id: int,
    question_id: str,
    new_score: float = Form(...),
    teacher_comment: str = Form("")
):
    """Edit a grade"""
    try:
        # Get current results
        results = db.get_results(submission_id)
        if not results:
            raise HTTPException(status_code=404, detail="Results not found")
        
        # Find the question result
        original_score = None
        for result in results:
            if result["question_id"] == question_id:
                original_score = result["score"]
                break
        
        if original_score is None:
            raise HTTPException(status_code=404, detail="Question not found")
        
        # Create edit record
        edit = {
            "submission_id": submission_id,
            "question_id": question_id,
            "original_score": original_score,
            "edited_score": new_score,
            "teacher_comment": teacher_comment,
            "edited_at": datetime.now()
        }
        
        # Add edit
        db.add_grade_edit(edit)
        
        # Update the result in database
        for i, result in enumerate(results):
            if result["question_id"] == question_id:
                results[i]["score"] = new_score
                if teacher_comment:
                    results[i]["teacher_comment"] = teacher_comment
                break
        
        db.update_results(submission_id, results)
        
        return {
            "success": True,
            "message": "Grade updated successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error editing grade: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# Run server
if __name__ == "__main__":
    import uvicorn
    print("\n🚀 Starting AI Grading System...")
    print("📚 API Documentation: http://localhost:8000/docs")
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)