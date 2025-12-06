"""
Enhanced OCR Service with OpenAI GPT-4 Vision
Extracts text from images with high accuracy
Fixed issues:
- Better error handling
- Improved prompts
- More robust JSON parsing
"""
import base64
import json
import re
from typing import Dict, List, Optional
from openai import OpenAI
from pathlib import Path


class EnhancedOCRService:
    def __init__(self, api_key: str):
        """Initialize OCR service with OpenAI API key"""
        if not api_key:
            raise ValueError("OpenAI API key is required for OCR service")
        
        self.client = OpenAI(api_key=api_key)
        self.model = "gpt-4o"
        print("✅ OCR Service initialized with GPT-4o")
    
    def encode_image(self, image_path: str) -> str:
        """Convert image to base64"""
        try:
            with open(image_path, "rb") as image_file:
                return base64.b64encode(image_file.read()).decode('utf-8')
        except Exception as e:
            print(f"Error encoding image {image_path}: {str(e)}")
            raise
    
    def extract_ground_truth(self, image_paths: List[str]) -> Dict:
        """Extract ground truth from answer key images"""
        prompt = """You are an expert at extracting exam answer keys from images.

Extract the following from this answer key:
1. Question numbers (Q1, Q2, Q3, etc.)
2. Question type (mcq, descriptive, ordering, etc.)
3. Correct answers
4. Marks for each question

For MCQ: Extract the correct option (A, B, C, D)
For Descriptive: Extract key concepts and model answer
For Ordering: Extract the correct sequence

Return ONLY valid JSON in this exact format:
{
  "Q1": {
    "type": "mcq",
    "marks": 2,
    "question_text": "Question text here",
    "ground_truth": {
      "correct_answer": "A"
    }
  },
  "Q2": {
    "type": "descriptive",
    "marks": 5,
    "question_text": "Explain...",
    "ground_truth": {
      "model_answer": "Complete answer",
      "key_concepts": ["concept1", "concept2"]
    }
  },
  "Q3": {
    "type": "ordering",
    "marks": 3,
    "question_text": "Arrange in order...",
    "ground_truth": {
      "correct_sequence": ["A", "B", "C", "D"]
    }
  }
}

IMPORTANT: Return ONLY the JSON object, no explanation or markdown."""
        
        all_questions = {}
        
        for img_path in image_paths:
            try:
                base64_image = self.encode_image(img_path)
                
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": prompt},
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": f"data:image/jpeg;base64,{base64_image}",
                                        "detail": "high"
                                    }
                                }
                            ]
                        }
                    ],
                    max_tokens=2000,
                    temperature=0.1
                )
                
                content = response.choices[0].message.content
                questions = self._parse_json_response(content)
                all_questions.update(questions)
                print(f"✅ Extracted {len(questions)} questions from {Path(img_path).name}")
                
            except Exception as e:
                print(f"❌ Error extracting from {img_path}: {str(e)}")
        
        return all_questions
    
    def extract_student_answers(self, image_paths: List[str]) -> Dict:
        """Extract student answers from answer sheet images"""
        prompt = """You are an expert at extracting student answers from exam papers.

Extract EVERY answer the student has written:
1. Identify question numbers (Q1, Q2, etc.)
2. Extract the student's answer for each question
3. For MCQ: Extract the selected option (A, B, C, D)
4. For written answers: Extract the complete text accurately
5. If answer is crossed out, note it but still extract

Be EXTREMELY careful with:
- Handwriting recognition
- Option letters (A/B/C/D)
- Numbers and sequences
- Circled or highlighted answers

Return ONLY valid JSON in this format:
{
  "Q1": "A",
  "Q2": "Complete written answer here",
  "Q3": "C",
  "Q4": "Detailed explanation..."
}

IMPORTANT: Return ONLY the JSON object, no explanation or markdown."""
        
        all_answers = {}
        
        for img_path in image_paths:
            try:
                base64_image = self.encode_image(img_path)
                
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": prompt},
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": f"data:image/jpeg;base64,{base64_image}",
                                        "detail": "high"
                                    }
                                }
                            ]
                        }
                    ],
                    max_tokens=2000,
                    temperature=0.1
                )
                
                content = response.choices[0].message.content
                answers = self._parse_json_response(content)
                all_answers.update(answers)
                print(f"✅ Extracted {len(answers)} answers from {Path(img_path).name}")
                
            except Exception as e:
                print(f"❌ Error extracting from {img_path}: {str(e)}")
        
        return all_answers
    
    def _parse_json_response(self, response: str) -> Dict:
        """Parse JSON from GPT response with error handling"""
        try:
            # Remove markdown code blocks
            response = re.sub(r'```json\s*|\s*```', '', response).strip()
            
            # Try direct parsing
            return json.loads(response)
        except json.JSONDecodeError as e:
            print(f"JSON decode error: {str(e)}")
            
            # Try to extract JSON using regex
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                try:
                    return json.loads(json_match.group())
                except:
                    pass
            
            print(f"Failed to parse response: {response[:200]}...")
            return {}
    
    def detect_question_type(self, question_text: str, ground_truth: Dict) -> str:
        """Auto-detect question type"""
        text_lower = question_text.lower()
        
        # Check ground truth structure
        if "correct_answer" in ground_truth:
            answer = str(ground_truth["correct_answer"]).strip().upper()
            if re.match(r'^[A-D]$', answer):
                return "mcq"
        
        if "correct_sequence" in ground_truth:
            return "ordering"
        
        # Check question text
        if any(word in text_lower for word in ["arrange", "order", "sequence"]):
            return "ordering"
        
        if any(word in text_lower for word in ["explain", "describe", "discuss", "define"]):
            return "descriptive"
        
        if any(word in text_lower for word in ["calculate", "compute", "solve"]):
            return "mathematical"
        
        return "descriptive"  # Default
