#!/usr/bin/env python3
"""
Test Script for AI Grading System
Run this to verify your deployment
"""
import requests
import json
import sys
from datetime import datetime

API_BASE = "http://localhost:8000"

def print_section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")

def test_health():
    """Test health endpoint"""
    print_section("Testing Health Endpoint")
    try:
        response = requests.get(f"{API_BASE}/")
        print(f"✅ Status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        return True
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False

def test_detailed_health():
    """Test detailed health endpoint"""
    print_section("Testing Detailed Health")
    try:
        response = requests.get(f"{API_BASE}/api/health")
        print(f"✅ Status: {response.status_code}")
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        # Check services
        services = data.get('services', {})
        all_active = all(v == 'active' for v in services.values())
        if all_active:
            print("\n✅ All services are active!")
        else:
            print("\n⚠️  Some services are inactive:")
            for service, status in services.items():
                if status != 'active':
                    print(f"  - {service}: {status}")
        return all_active
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False

def test_create_exam():
    """Test creating a ground truth"""
    print_section("Testing Ground Truth Upload")
    
    config = {
        "Q1": {
            "type": "mcq",
            "marks": 2,
            "question_text": "What is 2+2?",
            "ground_truth": {
                "correct_answer": "A"
            }
        },
        "Q2": {
            "type": "mcq",
            "marks": 2,
            "question_text": "What is the capital of France?",
            "ground_truth": {
                "correct_answer": "B"
            }
        },
        "Q3": {
            "type": "descriptive",
            "marks": 5,
            "question_text": "Explain photosynthesis",
            "ground_truth": {
                "model_answer": "Photosynthesis is the process by which plants convert light energy into chemical energy",
                "key_concepts": ["light energy", "chemical energy", "plants", "chlorophyll"]
            }
        }
    }
    
    try:
        # Create a minimal file object (empty file for manual entry)
        files = {'files': ('manual.txt', b'', 'text/plain')}
        data = {
            'exam_name': f'Test Exam {datetime.now().strftime("%Y%m%d_%H%M%S")}',
            'config': json.dumps(config)
        }
        
        response = requests.post(
            f"{API_BASE}/api/upload-ground-truth",
            files=files,
            data=data
        )
        
        print(f"✅ Status: {response.status_code}")
        result = response.json()
        print(f"Response: {json.dumps(result, indent=2)}")
        
        if result.get('success'):
            print(f"\n✅ Exam created successfully!")
            print(f"   Exam ID: {result.get('exam_id')}")
            print(f"   Total Marks: {result.get('total_marks')}")
            return result.get('exam_id')
        else:
            print(f"\n❌ Failed to create exam")
            return None
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

def test_list_exams():
    """Test listing exams"""
    print_section("Testing List Exams")
    try:
        response = requests.get(f"{API_BASE}/api/exams")
        print(f"✅ Status: {response.status_code}")
        exams = response.json()
        
        if exams:
            print(f"\nFound {len(exams)} exam(s):")
            for exam in exams:
                print(f"\n  Exam ID: {exam['id']}")
                print(f"  Name: {exam['exam_name']}")
                print(f"  Questions: {exam['questions_count']}")
                print(f"  Total Marks: {exam['total_marks']}")
                print(f"  Submissions: {exam.get('submissions_count', 0)}")
            return exams[0]['id'] if exams else None
        else:
            print("\n⚠️  No exams found")
            return None
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return None

def test_upload_student_paper(exam_id):
    """Test uploading student paper"""
    print_section("Testing Student Paper Upload")
    
    if not exam_id:
        print("❌ No exam ID provided")
        return None
    
    try:
        # Create test files (empty for now)
        files = [
            ('files', ('student_paper.txt', b'Test paper content', 'text/plain'))
        ]
        data = {
            'exam_id': str(exam_id),
            'student_id': f'TEST{datetime.now().strftime("%H%M%S")}'
        }
        
        response = requests.post(
            f"{API_BASE}/api/upload-student-papers",
            files=files,
            data=data
        )
        
        print(f"✅ Status: {response.status_code}")
        result = response.json()
        print(f"Response: {json.dumps(result, indent=2)}")
        
        if result.get('success'):
            print(f"\n✅ Paper uploaded successfully!")
            print(f"   Submission ID: {result.get('submission_id')}")
            print(f"   Student ID: {result.get('student_id')}")
            return result.get('submission_id')
        else:
            print(f"\n❌ Failed to upload paper")
            return None
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

def test_grade_paper(submission_id):
    """Test grading a paper"""
    print_section("Testing Paper Grading")
    
    if not submission_id:
        print("❌ No submission ID provided")
        return False
    
    try:
        response = requests.post(f"{API_BASE}/api/grade-paper/{submission_id}")
        print(f"✅ Status: {response.status_code}")
        result = response.json()
        print(f"Response: {json.dumps(result, indent=2)}")
        
        if result.get('success'):
            print(f"\n✅ Paper graded successfully!")
            print(f"   Total Score: {result.get('total_score')}/{result.get('total_max')}")
            print(f"   Percentage: {result.get('percentage')}%")
            return True
        else:
            print(f"\n❌ Failed to grade paper")
            return False
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_get_results(submission_id):
    """Test getting results"""
    print_section("Testing Get Results")
    
    if not submission_id:
        print("❌ No submission ID provided")
        return False
    
    try:
        response = requests.get(f"{API_BASE}/api/results/{submission_id}")
        print(f"✅ Status: {response.status_code}")
        result = response.json()
        print(f"\nSubmission ID: {result.get('submission_id')}")
        print(f"Student ID: {result.get('student_id')}")
        print(f"Total Score: {result.get('total_score')}/{result.get('total_max')}")
        print(f"Percentage: {result.get('percentage')}%")
        
        print(f"\nQuestion-by-Question Results:")
        for r in result.get('results', []):
            print(f"\n  {r['question_id']}: {r['score']}/{r['max_score']}")
            print(f"  Reasoning: {r['reasoning'][:100]}...")
        
        return True
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False

def run_all_tests():
    """Run all tests in sequence"""
    print("\n" + "="*60)
    print("  AI GRADING SYSTEM - TEST SUITE")
    print("="*60)
    
    results = {
        'health': False,
        'detailed_health': False,
        'create_exam': False,
        'list_exams': False,
        'upload_paper': False,
        'grade_paper': False,
        'get_results': False
    }
    
    # Test 1: Health check
    results['health'] = test_health()
    if not results['health']:
        print("\n❌ Basic health check failed. Is the server running?")
        return
    
    # Test 2: Detailed health
    results['detailed_health'] = test_detailed_health()
    
    # Test 3: Create exam
    exam_id = test_create_exam()
    results['create_exam'] = exam_id is not None
    
    # Test 4: List exams
    listed_exam_id = test_list_exams()
    results['list_exams'] = listed_exam_id is not None
    
    # Use created exam or listed exam
    exam_id = exam_id or listed_exam_id
    
    if exam_id:
        # Test 5: Upload student paper
        submission_id = test_upload_student_paper(exam_id)
        results['upload_paper'] = submission_id is not None
        
        if submission_id:
            # Test 6: Grade paper
            results['grade_paper'] = test_grade_paper(submission_id)
            
            # Test 7: Get results
            if results['grade_paper']:
                results['get_results'] = test_get_results(submission_id)
    
    # Summary
    print_section("TEST SUMMARY")
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, passed_test in results.items():
        status = "✅ PASS" if passed_test else "❌ FAIL"
        print(f"{status} - {test_name.replace('_', ' ').title()}")
    
    print(f"\n{'='*60}")
    print(f"  Results: {passed}/{total} tests passed")
    print(f"{'='*60}\n")
    
    if passed == total:
        print("🎉 All tests passed! System is working correctly.")
        sys.exit(0)
    else:
        print("⚠️  Some tests failed. Check the output above for details.")
        sys.exit(1)

if __name__ == "__main__":
    run_all_tests()
