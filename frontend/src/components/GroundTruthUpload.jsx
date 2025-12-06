import { useState } from 'react';
import { Upload, Plus, Trash2, Sparkles, Check, AlertCircle } from 'lucide-react';
import { uploadGroundTruth, autoConfigureQuestions } from '../services/api';

export default function GroundTruthUpload() {
  const [files, setFiles] = useState([]);
  const [examName, setExamName] = useState('');
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [autoConfiguring, setAutoConfiguring] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(selectedFiles);
    setMessage({ type: 'info', text: `${selectedFiles.length} file(s) selected` });
  };

  const handleAutoFill = async () => {
    if (files.length === 0) {
      setMessage({ type: 'error', text: 'Please select images first' });
      return;
    }

    setAutoConfiguring(true);
    setMessage({ type: 'info', text: 'Auto-detecting questions from images...' });

    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('files', file);
      });

      const result = await autoConfigureQuestions(formData);
      
      if (result.suggested_config && result.suggested_config.questions) {
        const questionsObj = result.suggested_config.questions;
        const questionsArray = Object.keys(questionsObj).map(questionId => {
          const q = questionsObj[questionId];
          
          // Handle key_concepts - convert array to comma-separated string
          let keyConcepts = '';
          if (q.ground_truth?.key_concepts) {
            if (Array.isArray(q.ground_truth.key_concepts)) {
              keyConcepts = q.ground_truth.key_concepts.join(', ');
            } else if (typeof q.ground_truth.key_concepts === 'string') {
              keyConcepts = q.ground_truth.key_concepts;
            }
          }
          
          return {
            id: questionId,
            type: q.type || 'mcq',
            marks: q.marks || 1,
            question_text: q.question_text || '',
            correct_answer: q.ground_truth?.correct_answer || 
                           q.ground_truth?.model_answer || '',
            correct_sequence: q.ground_truth?.correct_sequence || [],
            key_concepts: keyConcepts,
          };
        });
        
        setQuestions(questionsArray);
        setMessage({ 
          type: 'success', 
          text: `✅ Auto-detected ${questionsArray.length} questions! Review and edit as needed.` 
        });
      } else {
        setMessage({ type: 'warning', text: 'No questions detected. Please add manually.' });
      }
    } catch (error) {
      console.error('Auto-fill error:', error);
      setMessage({ 
        type: 'error', 
        text: `Failed to auto-detect: ${error.response?.data?.detail || error.message}` 
      });
    } finally {
      setAutoConfiguring(false);
    }
  };

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        id: `Q${questions.length + 1}`,
        type: 'mcq',
        marks: 1,
        question_text: '',
        correct_answer: '',
        correct_sequence: [],
        key_concepts: '',  // Empty string for easier form handling
      },
    ]);
  };

  const updateQuestion = (index, field, value) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };
    setQuestions(updated);
  };

  const removeQuestion = (index) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!examName.trim()) {
      setMessage({ type: 'error', text: 'Please enter exam name' });
      return;
    }

    if (questions.length === 0) {
      setMessage({ type: 'error', text: 'Please add at least one question' });
      return;
    }

    setLoading(true);
    setMessage({ type: 'info', text: 'Uploading ground truth...' });

    try {
      const formData = new FormData();
      formData.append('exam_name', examName);
      
      // Add files if available, otherwise add a minimal dummy file
      if (files.length > 0) {
        files.forEach((file) => {
          formData.append('files', file);
        });
      } else {
        // Create minimal dummy file for backend compatibility
        const dummyBlob = new Blob(['manual_entry'], { type: 'text/plain' });
        formData.append('files', dummyBlob, 'manual_entry.txt');
      }

      // Convert to backend format
      const config = {};
      questions.forEach((q) => {
        const questionConfig = {
          type: q.type,
          marks: parseFloat(q.marks) || 1,
          ground_truth: {}
        };

        // Format ground_truth based on question type
        if (q.type === 'mcq') {
          questionConfig.ground_truth = {
            correct_answer: q.correct_answer.trim()
          };
        } else if (q.type === 'ordering' || q.type === 'flowchart') {
          let sequence = [];
          if (typeof q.correct_answer === 'string' && q.correct_answer.trim()) {
            sequence = q.correct_answer
              .split(/[,\s]+/)
              .filter(s => s.trim())
              .map(s => s.trim().toUpperCase());
          } else if (Array.isArray(q.correct_sequence) && q.correct_sequence.length > 0) {
            sequence = q.correct_sequence;
          }
          questionConfig.ground_truth = {
            correct_sequence: sequence
          };
        } else if (q.type === 'descriptive') {
          let concepts = [];
          if (typeof q.key_concepts === 'string' && q.key_concepts.trim()) {
            concepts = q.key_concepts.split(',').map(k => k.trim()).filter(k => k);
          } else if (Array.isArray(q.key_concepts)) {
            concepts = q.key_concepts;
          }
          
          questionConfig.ground_truth = {
            model_answer: q.correct_answer || '',
            key_concepts: concepts
          };
        } else {
          questionConfig.ground_truth = {
            correct_answer: q.correct_answer
          };
        }

        config[q.id] = questionConfig;
      });

      console.log('📤 Uploading config:', JSON.stringify(config, null, 2));
      formData.append('config', JSON.stringify(config));

      const result = await uploadGroundTruth(formData);

      setMessage({ 
        type: 'success', 
        text: `✅ Ground truth uploaded! Exam ID: ${result.exam_id}, Total marks: ${result.total_marks}` 
      });
      
      // Reset form after 3 seconds
      setTimeout(() => {
        setExamName('');
        setFiles([]);
        setQuestions([]);
        setMessage({ type: '', text: '' });
      }, 3000);
    } catch (error) {
      console.error('Upload error:', error);
      setMessage({ 
        type: 'error', 
        text: `Upload failed: ${error.response?.data?.detail || error.message}` 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Upload Answer Key</h1>
        <p>Upload ground truth images and configure questions</p>
      </div>

      {message.text && (
        <div className={`message message-${message.type}`}>
          <AlertCircle size={20} />
          <span>{message.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Exam Name */}
        <div className="form-section">
          <h3>Exam Details</h3>
          <div className="form-group">
            <label>Exam Name *</label>
            <input
              type="text"
              value={examName}
              onChange={(e) => setExamName(e.target.value)}
              placeholder="e.g., Midterm 2024"
              required
            />
          </div>
        </div>

        {/* File Upload */}
        <div className="form-section">
          <h3>Answer Key Images (Optional)</h3>
          <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1rem' }}>
            Upload images for auto-fill, or skip this step to manually configure questions below.
          </p>
          <div className="file-upload-area">
            <Upload size={48} />
            <p><strong>Click to upload</strong> or drag and drop</p>
            <p className="text-muted">PNG, JPG up to 10MB each (optional for manual entry)</p>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: 'none' }}
              id="file-input"
            />
            <label htmlFor="file-input" className="btn-primary" style={{ marginTop: '1rem', cursor: 'pointer' }}>
              Select Images
            </label>
          </div>

          {files.length > 0 && (
            <div className="file-list">
              {files.map((file, index) => (
                <div key={index} className="file-item">
                  <span className="file-item-name">{file.name}</span>
                  <Check size={20} color="#16a34a" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Auto-Fill Button */}
        {files.length > 0 && (
          <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
            <button
              type="button"
              onClick={handleAutoFill}
              disabled={autoConfiguring}
              className="btn-primary btn-lg"
            >
              {autoConfiguring ? (
                <>
                  <div className="loading" />
                  Auto-detecting questions...
                </>
              ) : (
                <>
                  <Sparkles size={20} />
                  Auto-Fill Questions from Images
                </>
              )}
            </button>
            <p className="text-muted" style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
              Uses GPT-4 Vision to automatically extract questions
            </p>
          </div>
        )}

        {/* Questions Configuration */}
        <div className="form-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3>Questions Configuration</h3>
            <button type="button" onClick={addQuestion} className="btn-secondary">
              <Plus size={20} />
              Add Question
            </button>
          </div>

          {questions.length === 0 ? (
            <div className="empty-state">
              <AlertCircle size={48} />
              <h3>No questions configured</h3>
              <p>Use auto-fill or add questions manually</p>
            </div>
          ) : (
            <div className="questions-list">
              {questions.map((question, index) => (
                <div key={index} className="question-card">
                  <div className="question-header">
                    <h4>Question {index + 1}</h4>
                    <button
                      type="button"
                      onClick={() => removeQuestion(index)}
                      className="btn-danger btn-sm"
                    >
                      <Trash2 size={16} />
                      Remove
                    </button>
                  </div>

                  <div className="question-fields">
                    <div className="form-group">
                      <label>Question ID</label>
                      <input
                        type="text"
                        value={question.id}
                        onChange={(e) => updateQuestion(index, 'id', e.target.value)}
                        placeholder="Q1"
                      />
                    </div>

                    <div className="form-group">
                      <label>Question Type</label>
                      <select
                        value={question.type}
                        onChange={(e) => updateQuestion(index, 'type', e.target.value)}
                      >
                        <option value="mcq">Multiple Choice (MCQ)</option>
                        <option value="ordering">Ordering</option>
                        <option value="flowchart">Flowchart</option>
                        <option value="descriptive">Descriptive</option>
                        <option value="mathematical">Mathematical</option>
                        <option value="programming">Programming</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Marks</label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={question.marks}
                        onChange={(e) => updateQuestion(index, 'marks', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Question Text (Optional)</label>
                    <textarea
                      value={question.question_text}
                      onChange={(e) => updateQuestion(index, 'question_text', e.target.value)}
                      placeholder="Enter the question text..."
                      rows="2"
                    />
                  </div>

                  <div className="form-group">
                    <label>Correct Answer *</label>
                    <textarea
                      value={question.correct_answer}
                      onChange={(e) => updateQuestion(index, 'correct_answer', e.target.value)}
                      placeholder={
                        question.type === 'mcq' ? 'e.g., A' :
                        question.type === 'ordering' || question.type === 'flowchart' ? 'e.g., A,B,C,D or A B C D' :
                        'Enter the model answer'
                      }
                      rows="2"
                      required
                    />
                    <p className="helper-text">
                      {question.type === 'mcq' && 'Enter the correct option (A, B, C, or D)'}
                      {(question.type === 'ordering' || question.type === 'flowchart') && 
                       'Enter sequence separated by commas or spaces (e.g., A,B,C,D)'}
                      {question.type === 'descriptive' && 
                       'Enter the model answer for reference'}
                    </p>
                  </div>

                  {/* Key Concepts for Descriptive Questions */}
                  {question.type === 'descriptive' && (
                    <div className="form-group">
                      <label>Key Concepts (Optional)</label>
                      <textarea
                        value={typeof question.key_concepts === 'string' ? question.key_concepts : question.key_concepts.join(', ')}
                        onChange={(e) => updateQuestion(index, 'key_concepts', e.target.value)}
                        placeholder="e.g., machine learning, neural networks, deep learning"
                        rows="2"
                      />
                      <p className="helper-text">
                        Enter key concepts separated by commas. These will be used to grade the answer.
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit Button */}
        {questions.length > 0 && (
          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            <button type="submit" disabled={loading} className="btn-success btn-lg">
              {loading ? (
                <>
                  <div className="loading" />
                  Uploading...
                </>
              ) : (
                <>
                  <Check size={20} />
                  Upload Ground Truth
                </>
              )}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}