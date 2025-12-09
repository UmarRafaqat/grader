from typing import Dict, List, Any
import re
import json
from openai import OpenAI
from answer_preprocessor import AnswerPreprocessor


class AIGradingEngine:
    
    def __init__(self, api_key: str = None):
        if not api_key:
            print("WARNING: No API key provided - AI grading will not work")
            self.client = None
            self.model = None
            self.preprocessor = None
            return
        
        self.client = OpenAI(api_key=api_key)
        self.model = "gpt-4o"
        self.preprocessor = AnswerPreprocessor()
        print("AI Grading Engine initialized with GPT-4o")
    
    def grade_mcq(self, student_answer: str, correct_answer: str, 
                  question_text: str, max_marks: float) -> Dict[str, Any]:
        
        preprocessed = self.preprocessor.preprocess_mcq(student_answer)
        
        prompt = f"""You are an expert exam grader. Grade this Multiple Choice Question.

**Question:** {question_text}
**Correct Answer:** {correct_answer}
**Student's Raw Answer:** {preprocessed['raw_answer']}
**Extracted Option:** {preprocessed['extracted_option']}

Preprocessing Info:
- Confidence: {preprocessed['confidence']}
- Notes: {preprocessed['preprocessing_notes']}

**Instructions:**
- Award full marks if extracted option matches correct answer
- Award zero marks if incorrect or unclear
- Provide clear reasoning explaining your decision

**Respond in JSON:**
{{
    "score": <number 0 to {max_marks}>,
    "reasoning": "<detailed explanation of grading decision>"
}}

Return ONLY valid JSON."""

        result = self._call_llm(prompt, max_marks)
        result["preprocessing_data"] = preprocessed
        return result
    
    def grade_fill_in_blank(self, student_answer: str, correct_answers: List[str],
                           question_text: str, max_marks: float) -> Dict[str, Any]:
        
        preprocessed = self.preprocessor.preprocess_fill_in_blank(student_answer)
        
        prompt = f"""You are an expert exam grader. Grade this Fill-in-the-Blank question.

**Question:** {question_text}
**Acceptable Answers:** {', '.join(correct_answers)}
**Student's Raw Answer:** {preprocessed['raw_answer']}
**Cleaned Answer:** {preprocessed['cleaned_answer']}
**Key Words Extracted:** {', '.join(preprocessed['key_words'])}

Preprocessing Info:
- Word Count: {preprocessed['word_count']}
- Notes: {preprocessed['preprocessing_notes']}

**Instructions:**
- Check if answer matches any acceptable answer (consider synonyms, minor typos)
- Award full marks for correct, partial for close, zero for wrong

**Respond in JSON:**
{{
    "score": <number 0 to {max_marks}>,
    "reasoning": "<explain what student wrote, if it matches, and why this score>"
}}

Return ONLY valid JSON."""

        result = self._call_llm(prompt, max_marks)
        result["preprocessing_data"] = preprocessed
        return result
    
    def grade_descriptive(self, student_answer: str, model_answer: str,
                         key_concepts: List[str], question_text: str, 
                         max_marks: float, grading_criteria: List[Dict] = None) -> Dict[str, Any]:
        
        preprocessed = self.preprocessor.preprocess_descriptive(student_answer)
        
        if grading_criteria and len(grading_criteria) > 0:
            criteria_text = "**Grading Criteria:**\n"
            for criterion in grading_criteria:
                criteria_text += f"{criterion['weight']}% - {criterion['name']}\n"
            
            criteria_instructions = "\n".join([
                f"- {criterion['name']} ({criterion['weight']}%): Evaluate this aspect"
                for criterion in grading_criteria
            ])
        else:
            criteria_text = """**Grading Criteria:**
40% - Concept Coverage
30% - Accuracy
20% - Completeness
10% - Clarity"""
            criteria_instructions = """- Concept Coverage (40%): How many required concepts covered?
- Accuracy (30%): Factually correct?
- Completeness (20%): Thorough explanation?
- Clarity (10%): Clear and organized?"""
        
        prompt = f"""You are an expert exam grader. Grade this descriptive answer.

**Question:** {question_text}
**Model Answer:** {model_answer}
**Required Concepts:** {', '.join(key_concepts)}
**Student's Answer:** {student_answer}

Preprocessing Info:
- Word Count: {preprocessed['word_count']}
- Sentence Count: {preprocessed['sentence_count']}
- Answer Length: {preprocessed['answer_length']}
- Average Sentence Length: {preprocessed['avg_sentence_length']} words
- Key Terms Found: {', '.join(preprocessed['key_terms'][:10])}
- Notes: {preprocessed['preprocessing_notes']}

{criteria_text}

**Instructions:**
{criteria_instructions}

Evaluate each criterion carefully and provide a detailed breakdown of how the student performed in each area.

**Respond in JSON:**
{{
    "score": <number 0 to {max_marks}>,
    "reasoning": "<For each criterion: (1) What the student wrote, (2) How well it meets the criterion, (3) Score contribution. Then explain final score.>"
}}

Return ONLY valid JSON."""

        result = self._call_llm(prompt, max_marks)
        result["preprocessing_data"] = preprocessed
        return result
    
    def grade_ordering(self, student_answer: str, correct_sequence: List[str],
                      question_text: str, max_marks: float) -> Dict[str, Any]:
        
        preprocessed = self.preprocessor.preprocess_ordering(student_answer)
        
        prompt = f"""You are an expert exam grader. Grade this Ordering question.

**Question:** {question_text}
**Correct Sequence:** {' -> '.join(correct_sequence)}
**Student's Raw Answer:** {student_answer}
**Extracted Sequence:** {' -> '.join(preprocessed['extracted_sequence']) if preprocessed['extracted_sequence'] else 'None found'}

Preprocessing Info:
- Sequence Length: {preprocessed['sequence_length']}
- Has Duplicates: {preprocessed['has_duplicates']}
- Notes: {preprocessed['preprocessing_notes']}

**Instructions:**
- Compare extracted sequence position-by-position with correct sequence
- Score = (correct_positions / total) x max_marks

**Respond in JSON:**
{{
    "score": <number 0 to {max_marks}>,
    "reasoning": "<(1) Student sequence, (2) Position comparison, (3) Correct count, (4) Score calculation>"
}}

Return ONLY valid JSON."""

        result = self._call_llm(prompt, max_marks)
        result["preprocessing_data"] = preprocessed
        return result
    
    def grade_programming(self, student_code: str, expected_output: str,
                         test_cases: List[Dict], question_text: str,
                         max_marks: float, grading_criteria: List[Dict] = None) -> Dict[str, Any]:
        
        preprocessed = self.preprocessor.preprocess_programming(student_code)
        
        if grading_criteria and len(grading_criteria) > 0:
            criteria_text = "**Grading Criteria:**\n"
            for criterion in grading_criteria:
                criteria_text += f"{criterion['weight']}% - {criterion['name']}\n"
            
            criteria_instructions = "\n".join([
                f"- {criterion['name']} ({criterion['weight']}%): Evaluate this aspect"
                for criterion in grading_criteria
            ])
        else:
            criteria_text = """**Criteria:**
50% - Correctness
20% - Logic
15% - Quality
15% - Efficiency"""
            criteria_instructions = """- Correctness (50%): Produces correct output?
- Logic (20%): Algorithm sound?
- Quality (15%): Clean, readable?
- Efficiency (15%): Reasonable complexity?"""
        
        prompt = f"""You are an expert programming instructor. Grade this code.

**Question:** {question_text}
**Expected Output:** {expected_output}
**Test Cases:** {json.dumps(test_cases, indent=2)}

Preprocessing Info:
- Detected Language: {preprocessed['detected_language']}
- Line Count: {preprocessed['line_count']}
- Functions Defined: {', '.join(preprocessed['functions_defined']) if preprocessed['functions_defined'] else 'None'}
- Has Comments: {preprocessed['has_comments']}
- Has Loops: {preprocessed['has_loops']}
- Has Conditionals: {preprocessed['has_conditionals']}
- Notes: {preprocessed['preprocessing_notes']}

**Student's Code:**
```
{student_code}
```

{criteria_text}

**Instructions:**
{criteria_instructions}

**Respond in JSON:**
{{
    "score": <number 0 to {max_marks}>,
    "reasoning": "<(1) Trace logic, (2) Test cases pass/fail, (3) Quality evaluation, (4) Bugs found, (5) Score breakdown>"
}}

Return ONLY valid JSON."""

        result = self._call_llm(prompt, max_marks)
        result["preprocessing_data"] = preprocessed
        return result
    
    def grade_mathematical(self, student_answer: str, correct_answer: str,
                          solution_steps: List[str], question_text: str,
                          max_marks: float, grading_criteria: List[Dict] = None) -> Dict[str, Any]:
        
        preprocessed = self.preprocessor.preprocess_mathematical(student_answer)
        
        if grading_criteria and len(grading_criteria) > 0:
            criteria_text = "**Grading Criteria:**\n"
            for criterion in grading_criteria:
                criteria_text += f"{criterion['weight']}% - {criterion['name']}\n"
            
            criteria_instructions = "\n".join([
                f"- {criterion['name']} ({criterion['weight']}%): Evaluate this aspect"
                for criterion in grading_criteria
            ])
        else:
            criteria_text = """**Criteria:**
40% - Final Answer
30% - Method
20% - Steps
10% - Notation"""
            criteria_instructions = """- Final Answer (40%): Correct?
- Method (30%): Approach correct?
- Steps (20%): Intermediate steps shown?
- Notation (10%): Proper notation?"""
        
        prompt = f"""You are an expert mathematics teacher. Grade this solution.

**Question:** {question_text}
**Correct Answer:** {correct_answer}
**Solution Steps:** {json.dumps(solution_steps, indent=2)}
**Student's Answer:** {student_answer}

Preprocessing Info:
- Final Answer Extracted: {preprocessed['final_answer'] or 'Not found'}
- Numbers Found: {', '.join(preprocessed['numbers_found'])}
- Operators Found: {', '.join(preprocessed['operators_found'])}
- Steps Shown: {preprocessed['steps_shown']}
- Has Equation: {preprocessed['has_equation']}
- Notes: {preprocessed['preprocessing_notes']}

{criteria_text}

**Instructions:**
{criteria_instructions}

**Respond in JSON:**
{{
    "score": <number 0 to {max_marks}>,
    "reasoning": "<(1) Identify answer, (2) Check correctness, (3) Evaluate method/steps, (4) Partial credit explanation, (5) Score breakdown>"
}}

Return ONLY valid JSON."""

        result = self._call_llm(prompt, max_marks)
        result["preprocessing_data"] = preprocessed
        return result
    
    def grade_question(self, question_id: str, question_config: Dict,
                      student_answer: Any) -> Dict[str, Any]:
        
        q_type = question_config.get("type", "mcq")
        max_marks = question_config.get("marks", 1.0)
        question_text = question_config.get("question_text", "")
        ground_truth = question_config.get("ground_truth", {})
        grading_criteria = question_config.get("grading_criteria", [])
        
        print(f"\nAI Grading {question_id} (Type: {q_type})")
        
        result = {"question_id": question_id, "max_score": max_marks}
        
        try:
            if q_type == "mcq":
                grading = self.grade_mcq(student_answer, ground_truth.get("correct_answer", ""), question_text, max_marks)
            elif q_type == "fill_in_blank":
                grading = self.grade_fill_in_blank(student_answer, ground_truth.get("correct_answers", []), question_text, max_marks)
            elif q_type == "descriptive":
                grading = self.grade_descriptive(
                    student_answer, 
                    ground_truth.get("model_answer", ""), 
                    ground_truth.get("key_concepts", []), 
                    question_text, 
                    max_marks,
                    grading_criteria
                )
            elif q_type in ["ordering", "sequence"]:
                grading = self.grade_ordering(student_answer, ground_truth.get("correct_sequence", []), question_text, max_marks)
            elif q_type == "programming":
                grading = self.grade_programming(
                    student_answer, 
                    ground_truth.get("expected_output", ""), 
                    ground_truth.get("test_cases", []), 
                    question_text, 
                    max_marks,
                    grading_criteria
                )
            elif q_type == "mathematical":
                grading = self.grade_mathematical(
                    student_answer, 
                    ground_truth.get("correct_answer", ""), 
                    ground_truth.get("solution_steps", []), 
                    question_text, 
                    max_marks,
                    grading_criteria
                )
            else:
                grading = self.grade_descriptive(
                    student_answer, 
                    ground_truth.get("model_answer", ""), 
                    ground_truth.get("key_concepts", []), 
                    question_text, 
                    max_marks,
                    grading_criteria
                )
            
            result.update(grading)
            print(f"Graded: {grading.get('score', 0)}/{max_marks}")
            
        except Exception as e:
            print(f"Error: {str(e)}")
            result.update({"score": 0, "reasoning": f"Grading error: {str(e)}"})
        
        return result
    
    def grade_submission(self, ground_truth_questions: Dict, extracted_answers: Dict) -> List[Dict]:
        results = []
        
        print(f"\n{'='*60}\nAI GRADING\n{'='*60}")
        
        for q_id, q_config in ground_truth_questions.items():
            if hasattr(q_config, 'dict'):
                q_config = q_config.dict()
            elif hasattr(q_config, 'model_dump'):
                q_config = q_config.model_dump()
            
            student_answer = self._find_answer(q_id, extracted_answers)
            result = self.grade_question(q_id, q_config, student_answer)
            results.append(result)
        
        print(f"{'='*60}\n")
        return results
    
    def _find_answer(self, q_id: str, answers: Dict) -> str:
        if q_id in answers:
            return answers[q_id] if isinstance(answers[q_id], str) else answers[q_id].get("answer", "")
        
        for key, val in answers.items():
            if key.lower() == q_id.lower():
                return val if isinstance(val, str) else val.get("answer", "")
        
        q_num = ''.join(filter(str.isdigit, q_id))
        if q_num:
            for key, val in answers.items():
                if ''.join(filter(str.isdigit, key)) == q_num:
                    return val if isinstance(val, str) else val.get("answer", "")
        
        return ""
    
    def _call_llm(self, prompt: str, max_marks: float) -> Dict:
        if not self.client:
            return {"score": 0, "reasoning": "AI service not available - please configure OPENAI_API_KEY"}
        
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
                max_tokens=1000
            )
            return self._parse_json(response.choices[0].message.content)
        except Exception as e:
            return {"score": 0, "reasoning": f"AI call failed: {str(e)}"}
    
    def _parse_json(self, response: str) -> Dict:
        try:
            response = re.sub(r'```json\s*|\s*```', '', response).strip()
            return json.loads(response)
        except:
            match = re.search(r'\{.*\}', response, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group())
                except:
                    pass
            return {"score": 0, "reasoning": "Failed to parse AI response"}