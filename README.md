# AI-Powered Grading System

Automated exam grading system using GPT-4o for intelligent assessment across multiple question types.

## Features

- AI-powered grading with detailed reasoning
- 6 question types: MCQ, Fill-in-Blank, Descriptive, Ordering, Programming, Mathematical
- OCR extraction using GPT-4 Vision
- PostgreSQL database for persistence
- Teacher review and grade override
- REST API with FastAPI
- React frontend interface

## Prerequisites

- Python 3.11+
- Podman or Docker with Compose
- OpenAI API key
- 8GB RAM recommended
- 10GB disk space

## Quick Start

```bash
# 1. Extract the archive
unzip ai-grading-system.zip
cd ai-grading-system

# 2. Configure API key
echo "OPENAI_API_KEY=your-key-here" > backend/.env

# 3. Start services
podman-compose up -d

# 4. Wait 30 seconds for database initialization

# 5. Access application
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
# Frontend: http://localhost:3000
```

## Project Structure

```
ai-grading-system/
├── backend/                    # Python FastAPI backend
│   ├── ai_grading_engine.py   # AI grading logic
│   ├── main.py                # FastAPI application
│   ├── database.py            # PostgreSQL operations
│   ├── models.py              # Pydantic models
│   ├── ocr_service.py         # OCR with GPT-4 Vision
│   ├── requirements.txt       # Python dependencies
│   ├── Dockerfile             # Backend container
│   └── .env                   # Environment variables
├── frontend/                   # React frontend (optional)
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── services/          # API client
│   │   └── styles/            # CSS files
│   ├── Dockerfile
│   └── package.json
├── podman-compose.yml         # Container orchestration
├── test_system.py             # Automated tests
└── README.md                  # This file
```

## Question Types and Grading

### 1. MCQ (Multiple Choice)
AI compares student's answer with correct option. Reasoning explains whether the selected option matches and why.

### 2. Fill-in-the-Blank
AI checks semantic similarity with acceptable answers, considering synonyms and minor spelling variations. Reasoning shows which answer matched.

### 3. Descriptive/Essay
AI grades on 4 criteria:
- Concept Coverage (40%): Identifies required concepts present/missing
- Accuracy (30%): Checks factual correctness
- Completeness (20%): Evaluates thoroughness
- Clarity (10%): Assesses organization

Reasoning lists found/missing concepts and explains each criterion's evaluation.

### 4. Ordering/Sequence
AI compares position-by-position with correct order. Partial credit: (correct_positions / total) x max_marks. Reasoning shows detailed sequence comparison.

### 5. Programming
AI grades on 4 criteria:
- Correctness (50%): Traces code logic, checks output
- Logic (20%): Evaluates algorithm soundness
- Code Quality (15%): Checks readability and conventions
- Efficiency (15%): Assesses time/space complexity

Reasoning includes code review, test case results, and identified bugs.

### 6. Mathematical
AI grades on 4 criteria:
- Final Answer (40%): Checks if answer is correct
- Method (30%): Evaluates approach used
- Steps (20%): Verifies intermediate steps
- Notation (10%): Checks proper mathematical symbols

Reasoning explains solution analysis and partial credit for correct method.

## API Endpoints

```
POST /api/upload-ground-truth      # Upload answer key
POST /api/upload-student-papers    # Upload student papers
POST /api/grade-paper/{id}         # Grade submission
GET  /api/results/{id}             # Get results (by submission or student ID)
GET  /api/review/{id}              # Get detailed review
PUT  /api/edit-grade/{id}/{q_id}   # Edit grade
GET  /api/exams                    # List all exams
GET  /api/health                   # Health check
```

## Example Ground Truth Format

```json
{
  "Q1": {
    "type": "mcq",
    "marks": 2,
    "question_text": "What is photosynthesis?",
    "ground_truth": {
      "correct_answer": "A"
    }
  },
  "Q2": {
    "type": "descriptive",
    "marks": 5,
    "question_text": "Explain photosynthesis.",
    "ground_truth": {
      "model_answer": "Photosynthesis is the process...",
      "key_concepts": ["light energy", "chlorophyll", "oxygen"]
    }
  },
  "Q3": {
    "type": "programming",
    "marks": 10,
    "question_text": "Write a function to reverse a string.",
    "ground_truth": {
      "expected_output": "olleh",
      "test_cases": [
        {"input": "hello", "output": "olleh"}
      ]
    }
  },
  "Q4": {
    "type": "mathematical",
    "marks": 5,
    "question_text": "Solve: 2x + 5 = 13",
    "ground_truth": {
      "correct_answer": "4",
      "solution_steps": ["2x = 8", "x = 4"]
    }
  }
}
```

## Configuration

### Environment Variables (backend/.env)

```bash
# Required
OPENAI_API_KEY=your-openai-api-key

# Database (default values)
DATABASE_URL=postgresql://grading_user:grading_pass@db:5432/grading_db
POSTGRES_DB=grading_db
POSTGRES_USER=grading_user
POSTGRES_PASSWORD=grading_pass
```

## Testing

```bash
# Run automated test suite
python3 test_system.py

# Test health endpoint
curl http://localhost:8000/api/health

# Test grading
curl http://localhost:8000/api/grade-paper/1
```

## Database Operations

```bash
# Connect to database
podman exec -it grading_db psql -U grading_user -d grading_db

# Backup database
podman exec grading_db pg_dump -U grading_user grading_db > backup.sql

# Restore database
cat backup.sql | podman exec -i grading_db psql -U grading_user -d grading_db

# View logs
podman-compose logs -f backend
```

## Troubleshooting

### Backend not starting
```bash
# Check logs
podman logs grading_backend

# Verify API key is set
podman exec grading_backend env | grep OPENAI

# Restart services
podman-compose restart
```

### Database connection issues
```bash
# Check database status
podman exec grading_db pg_isready -U grading_user

# Restart database
podman restart grading_db
sleep 30
podman restart grading_backend
```

### OCR not working
- Verify OPENAI_API_KEY is set correctly
- Check API key has access to GPT-4o and GPT-4 Vision
- Review logs: `podman logs grading_backend`

## System Architecture

```
Student Paper (Images)
    |
    v
OCR Extraction (GPT-4 Vision)
    |
    v
Answer Preprocessing
    |
    v
AI Grading (GPT-4o)
    |
    v
Detailed Reasoning + Score
    |
    v
Database Storage
    |
    v
Professor Review Interface
```

## Cost Estimate

- OCR (GPT-4 Vision): approximately $0.01 per page
- Grading (GPT-4o): approximately $0.005 per question
- Total per student (10 questions, 3 pages): approximately $0.08

## Security Notes

- Change default database password in production
- Never commit .env file with real API keys
- Use HTTPS in production
- Implement authentication for production use
- Regular database backups recommended

## Development

### Backend Development
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend Development
```bash
cd frontend
npm install
npm run dev
```

## License

MIT License

## Support

For issues or questions:
1. Check logs: `podman-compose logs`
2. Review API docs: http://localhost:8000/docs
3. Test health: `curl http://localhost:8000/api/health`
4. Run test suite: `python3 test_system.py`
# intelligrader
