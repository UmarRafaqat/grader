"""
Answer Preprocessing Module
Cleans and normalizes student answers before AI grading
"""
import re
from typing import Dict, List, Any


class AnswerPreprocessor:
    """Preprocesses student answers for different question types"""
    
    @staticmethod
    def preprocess_mcq(answer: str) -> Dict[str, Any]:
        """
        Preprocess MCQ answers
        Extracts option letter and normalizes format
        """
        # Remove extra spaces
        answer = answer.strip()
        
        # Convert to uppercase
        answer = answer.upper()
        
        # Extract option letter (A-H)
        option_match = re.search(r'\b([A-H])\b', answer)
        extracted_option = option_match.group(1) if option_match else ""
        
        return {
            "raw_answer": answer,
            "extracted_option": extracted_option,
            "confidence": "high" if option_match else "low",
            "preprocessing_notes": "Extracted single letter option" if option_match else "No clear option found"
        }
    
    @staticmethod
    def preprocess_fill_in_blank(answer: str) -> Dict[str, Any]:
        """
        Preprocess fill-in-the-blank answers
        Removes stopwords and normalizes text
        """
        # Clean and normalize
        answer = answer.strip()
        
        # Split into words
        words = answer.split()
        
        # Remove common stopwords
        stopwords = {'a', 'an', 'the', 'is', 'are', 'was', 'were', 'in', 'on', 'at', 'to', 'for'}
        key_words = [w for w in words if w.lower() not in stopwords]
        
        # Remove punctuation for comparison
        import string
        cleaned = answer.translate(str.maketrans('', '', string.punctuation))
        
        return {
            "raw_answer": answer,
            "cleaned_answer": cleaned,
            "key_words": key_words,
            "word_count": len(words),
            "preprocessing_notes": f"Extracted {len(key_words)} key words"
        }
    
    @staticmethod
    def preprocess_descriptive(answer: str) -> Dict[str, Any]:
        """
        Preprocess descriptive/essay answers
        Performs sentence segmentation and statistical analysis
        """
        # Clean answer
        answer = answer.strip()
        
        # Sentence segmentation
        sentences = re.split(r'[.!?]+', answer)
        sentences = [s.strip() for s in sentences if s.strip()]
        
        # Word tokenization
        words = re.findall(r'\b\w+\b', answer.lower())
        
        # Calculate statistics
        word_count = len(words)
        sentence_count = len(sentences)
        avg_sentence_length = word_count / sentence_count if sentence_count > 0 else 0
        
        # Extract key terms (words longer than 4 chars)
        key_terms = [w for w in words if len(w) > 4]
        unique_terms = list(set(key_terms))
        
        # Classify length
        if word_count < 50:
            length_category = "short"
        elif word_count < 150:
            length_category = "medium"
        else:
            length_category = "long"
        
        return {
            "raw_answer": answer,
            "sentences": sentences,
            "word_count": word_count,
            "sentence_count": sentence_count,
            "avg_sentence_length": round(avg_sentence_length, 2),
            "key_terms": unique_terms[:20],
            "answer_length": length_category,
            "preprocessing_notes": f"Analyzed {sentence_count} sentences, {word_count} words"
        }
    
    @staticmethod
    def preprocess_ordering(answer: str) -> Dict[str, Any]:
        """
        Preprocess ordering/sequence answers
        Extracts sequence and removes duplicates
        """
        # Extract sequence of letters or numbers
        sequence = re.findall(r'\b([A-H0-9])\b', answer.upper())
        
        # Filter out numbers if letters are present
        if any(c.isalpha() for c in sequence):
            sequence = [c for c in sequence if c.isalpha()]
        
        # Remove duplicates while preserving order
        seen = set()
        unique_sequence = []
        for item in sequence:
            if item not in seen:
                seen.add(item)
                unique_sequence.append(item)
        
        return {
            "raw_answer": answer,
            "extracted_sequence": unique_sequence,
            "sequence_length": len(unique_sequence),
            "has_duplicates": len(sequence) != len(unique_sequence),
            "preprocessing_notes": f"Extracted sequence of {len(unique_sequence)} items"
        }
    
    @staticmethod
    def preprocess_programming(code: str) -> Dict[str, Any]:
        """
        Preprocess programming code
        Detects language and extracts code features
        """
        code = code.strip()
        
        # Count lines
        lines = [line for line in code.split('\n') if line.strip()]
        
        # Detect language (simple heuristics)
        language = "unknown"
        if "def " in code or "import " in code:
            language = "python"
        elif "function " in code or "const " in code or "let " in code:
            language = "javascript"
        elif "public class" in code or "public static void" in code:
            language = "java"
        elif "#include" in code:
            language = "c/c++"
        
        # Extract function names
        functions = re.findall(r'def\s+(\w+)\s*\(', code)
        if not functions:
            functions = re.findall(r'function\s+(\w+)\s*\(', code)
        
        # Check for code features
        has_comments = '#' in code or '//' in code or '/*' in code
        has_loops = any(kw in code for kw in ['for', 'while', 'loop'])
        has_conditionals = any(kw in code for kw in ['if', 'else', 'elif', 'switch'])
        
        return {
            "raw_code": code,
            "line_count": len(lines),
            "detected_language": language,
            "functions_defined": functions,
            "has_comments": has_comments,
            "has_loops": has_loops,
            "has_conditionals": has_conditionals,
            "preprocessing_notes": f"Detected {language}, {len(lines)} lines of code"
        }
    
    @staticmethod
    def preprocess_mathematical(answer: str) -> Dict[str, Any]:
        """
        Preprocess mathematical answers
        Extracts numbers, operators, and final answer
        """
        answer = answer.strip()
        
        # Extract numbers
        numbers = re.findall(r'-?\d+\.?\d*', answer)
        
        # Extract mathematical operators
        operators = re.findall(r'[+\-*/=<>]', answer)
        
        # Check for equations
        has_equation = '=' in answer
        
        # Extract final answer
        final_answer = None
        if '=' in answer:
            parts = answer.split('=')
            final_answer = parts[-1].strip()
            number_match = re.search(r'-?\d+\.?\d*', final_answer)
            if number_match:
                final_answer = number_match.group()
        
        # Extract equation lines
        lines = [line.strip() for line in answer.split('\n') if line.strip()]
        equations = [line for line in lines if '=' in line]
        
        return {
            "raw_answer": answer,
            "numbers_found": numbers,
            "operators_found": operators,
            "has_equation": has_equation,
            "final_answer": final_answer,
            "equation_lines": equations,
            "steps_shown": len(equations),
            "preprocessing_notes": f"Found {len(numbers)} numbers, {len(operators)} operators"
        }
    
    @classmethod
    def preprocess(cls, answer: str, question_type: str) -> Dict[str, Any]:
        """
        Route to appropriate preprocessing method based on question type
        """
        if question_type == "mcq":
            return cls.preprocess_mcq(answer)
        elif question_type == "fill_in_blank":
            return cls.preprocess_fill_in_blank(answer)
        elif question_type == "descriptive":
            return cls.preprocess_descriptive(answer)
        elif question_type in ["ordering", "sequence"]:
            return cls.preprocess_ordering(answer)
        elif question_type == "programming":
            return cls.preprocess_programming(answer)
        elif question_type == "mathematical":
            return cls.preprocess_mathematical(answer)
        else:
            return {
                "raw_answer": answer,
                "preprocessing_notes": "No preprocessing applied"
            }