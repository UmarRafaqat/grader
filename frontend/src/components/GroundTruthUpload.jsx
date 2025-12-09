import { useState } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Plus, X, Edit2, Save, Trash2 } from 'lucide-react';
import { autoConfigureQuestions, uploadGroundTruth } from '../services/api';

export default function GroundTruthUpload() {
  const [examName, setExamName] = useState('');
  const [files, setFiles] = useState([]);
  const [questions, setQuestions] = useState({});
  const [autoConfigured, setAutoConfigured] = useState(false);
  const [configuring, setConfiguring] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [editingQuestion, setEditingQuestion] = useState(null);

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(selectedFiles);
    setAutoConfigured(false);
    setQuestions({});
  };

  const handleAutoConfigure = async (e) => {
    e.preventDefault();

    if (!examName.trim()) {
      setMessage({ type: 'error', text: 'Please enter exam name' });
      return;
    }

    if (files.length === 0) {
      setMessage({ type: 'error', text: 'Please select answer key images' });
      return;
    }

    setConfiguring(true);
    setMessage({ type: 'info', text: 'Auto-configuring questions from images...' });

    try {
      const formData = new FormData();
      formData.append('exam_name', examName.trim());
      
      files.forEach((file) => {
        formData.append('files', file);
      });

      const result = await autoConfigureQuestions(formData);
      
      const questionsWithCriteria = {};
      Object.entries(result.questions).forEach(([key, value]) => {
        let defaultCriteria = [];
        if (value.type === 'descriptive') {
          defaultCriteria = [
            { name: 'Concept Coverage', weight: 40 },
            { name: 'Accuracy', weight: 30 },
            { name: 'Completeness', weight: 20 },
            { name: 'Clarity', weight: 10 },
          ];
        } else if (value.type === 'programming') {
          defaultCriteria = [
            { name: 'Correctness', weight: 50 },
            { name: 'Logic', weight: 20 },
            { name: 'Quality', weight: 15 },
            { name: 'Efficiency', weight: 15 },
          ];
        } else if (value.type === 'mathematical') {
          defaultCriteria = [
            { name: 'Final Answer', weight: 40 },
            { name: 'Method', weight: 30 },
            { name: 'Steps', weight: 20 },
            { name: 'Notation', weight: 10 },
          ];
        }

        questionsWithCriteria[key] = {
          ...value,
          grading_criteria: defaultCriteria
        };
      });

      setQuestions(questionsWithCriteria);
      setAutoConfigured(true);
      setMessage({ type: 'success', text: `Auto-configured ${Object.keys(result.questions).length} questions` });
    } catch (error) {
      console.error('Auto-configure error:', error);
      setMessage({ 
        type: 'error', 
        text: `Auto-configuration failed: ${error.response?.data?.detail || error.message}` 
      });
    } finally {
      setConfiguring(false);
    }
  };

  // Skip auto-configure and go straight to manual entry
  const handleSkipAutoConfigure = () => {
    if (!examName.trim()) {
      setMessage({ type: 'error', text: 'Please enter exam name first' });
      return;
    }
    setAutoConfigured(true);
    setMessage({ type: 'info', text: 'Manual mode - Add questions below' });
  };

  // Add new blank question
  const addNewQuestion = () => {
    const questionId = `Q${Object.keys(questions).length + 1}`;
    setQuestions(prev => ({
      ...prev,
      [questionId]: {
        type: 'mcq',
        marks: 1,
        question_text: '',
        ground_truth: {
          correct_answer: ''
        },
        grading_criteria: []
      }
    }));
    setEditingQuestion(questionId);
  };

  // Delete question
  const deleteQuestion = (questionId) => {
    const newQuestions = { ...questions };
    delete newQuestions[questionId];
    setQuestions(newQuestions);
    if (editingQuestion === questionId) {
      setEditingQuestion(null);
    }
  };

  // Update question field
  const updateQuestion = (questionId, field, value) => {
    setQuestions(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        [field]: value
      }
    }));
  };

  // Update question ID (rename)
  const updateQuestionId = (oldId, newId) => {
    if (newId === oldId || !newId.trim()) return;
    
    const newQuestions = {};
    Object.entries(questions).forEach(([key, value]) => {
      if (key === oldId) {
        newQuestions[newId] = value;
      } else {
        newQuestions[key] = value;
      }
    });
    setQuestions(newQuestions);
    if (editingQuestion === oldId) {
      setEditingQuestion(newId);
    }
  };

  // Update ground truth based on question type
  const updateGroundTruth = (questionId, field, value) => {
    setQuestions(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        ground_truth: {
          ...prev[questionId].ground_truth,
          [field]: value
        }
      }
    }));
  };

  // Add grading criteria
  const addCriteria = (questionId) => {
    setQuestions(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        grading_criteria: [
          ...prev[questionId].grading_criteria,
          { name: '', weight: 0 }
        ]
      }
    }));
  };

  // Remove grading criteria
  const removeCriteria = (questionId, index) => {
    setQuestions(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        grading_criteria: prev[questionId].grading_criteria.filter((_, i) => i !== index)
      }
    }));
  };

  // Update grading criteria
  const updateCriteria = (questionId, index, field, value) => {
    setQuestions(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        grading_criteria: prev[questionId].grading_criteria.map((c, i) => 
          i === index ? { ...c, [field]: field === 'weight' ? parseFloat(value) || 0 : value } : c
        )
      }
    }));
  };

  const getCriteriaTotal = (criteria) => {
    return criteria.reduce((sum, c) => sum + (c.weight || 0), 0);
  };

  // When question type changes, initialize appropriate ground truth
  const handleTypeChange = (questionId, newType) => {
    const baseGroundTruth = {
      mcq: { correct_answer: '' },
      fill_in_blank: { correct_answers: [] },
      descriptive: { model_answer: '', key_concepts: [] },
      ordering: { correct_sequence: [] },
      programming: { expected_output: '', test_cases: [] },
      mathematical: { correct_answer: '', solution_steps: [] }
    };

    let newCriteria = [];
    if (newType === 'descriptive') {
      newCriteria = [
        { name: 'Concept Coverage', weight: 40 },
        { name: 'Accuracy', weight: 30 },
        { name: 'Completeness', weight: 20 },
        { name: 'Clarity', weight: 10 },
      ];
    } else if (newType === 'programming') {
      newCriteria = [
        { name: 'Correctness', weight: 50 },
        { name: 'Logic', weight: 20 },
        { name: 'Quality', weight: 15 },
        { name: 'Efficiency', weight: 15 },
      ];
    } else if (newType === 'mathematical') {
      newCriteria = [
        { name: 'Final Answer', weight: 40 },
        { name: 'Method', weight: 30 },
        { name: 'Steps', weight: 20 },
        { name: 'Notation', weight: 10 },
      ];
    }

    setQuestions(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        type: newType,
        ground_truth: baseGroundTruth[newType] || {},
        grading_criteria: newCriteria
      }
    }));
  };

  const handleUpload = async () => {
    if (Object.keys(questions).length === 0) {
      setMessage({ type: 'error', text: 'Please add at least one question' });
      return;
    }

    // Validate all questions
    for (const [qId, config] of Object.entries(questions)) {
      if (!config.marks || config.marks <= 0) {
        setMessage({ type: 'error', text: `${qId}: Marks must be greater than 0` });
        return;
      }
      
      const requiresCriteria = ['descriptive', 'programming', 'mathematical'];
      if (requiresCriteria.includes(config.type) && config.grading_criteria && config.grading_criteria.length > 0) {
        const total = getCriteriaTotal(config.grading_criteria);
        if (total !== 100) {
          setMessage({ 
            type: 'error', 
            text: `${qId}: Grading criteria weights must sum to 100% (currently ${total}%)` 
          });
          return;
        }
      }
    }

    setUploading(true);
    setMessage({ type: 'info', text: 'Uploading ground truth...' });

    try {
      const totalMarks = Object.values(questions).reduce((sum, q) => sum + (parseFloat(q.marks) || 0), 0);
      
      const formData = new FormData();
      formData.append('exam_name', examName.trim());
      formData.append('questions', JSON.stringify(questions));
      formData.append('total_marks', totalMarks.toString());

      const result = await uploadGroundTruth(formData);
      
      setMessage({ 
        type: 'success', 
        text: `Ground truth uploaded successfully! Exam ID: ${result.exam_id}` 
      });
      
      // Reset form after 2 seconds
      setTimeout(() => {
        setExamName('');
        setFiles([]);
        setQuestions({});
        setAutoConfigured(false);
        setEditingQuestion(null);
        setMessage({ type: '', text: '' });
      }, 2000);
    } catch (error) {
      console.error('Upload error:', error);
      setMessage({ 
        type: 'error', 
        text: `Upload failed: ${error.response?.data?.detail || error.message}` 
      });
    } finally {
      setUploading(false);
    }
  };

  // Render ground truth editor based on question type
  const renderGroundTruthEditor = (qId, config) => {
    const { type, ground_truth } = config;

    switch (type) {
      case 'mcq':
        return (
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Correct Answer (A, B, C, D, etc.)</label>
            <input
              type="text"
              value={ground_truth.correct_answer || ''}
              onChange={(e) => updateGroundTruth(qId, 'correct_answer', e.target.value.toUpperCase())}
              placeholder="e.g., A"
              maxLength="1"
            />
          </div>
        );

      case 'fill_in_blank':
        return (
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Correct Answers (comma-separated)</label>
            <input
              type="text"
              value={(ground_truth.correct_answers || []).join(', ')}
              onChange={(e) => updateGroundTruth(qId, 'correct_answers', e.target.value.split(',').map(s => s.trim()))}
              placeholder="e.g., answer1, answer2, answer3"
            />
          </div>
        );

      case 'descriptive':
        return (
          <>
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label>Model Answer</label>
              <textarea
                value={ground_truth.model_answer || ''}
                onChange={(e) => updateGroundTruth(qId, 'model_answer', e.target.value)}
                placeholder="Enter the ideal answer..."
                rows="3"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Key Concepts (comma-separated)</label>
              <input
                type="text"
                value={(ground_truth.key_concepts || []).join(', ')}
                onChange={(e) => updateGroundTruth(qId, 'key_concepts', e.target.value.split(',').map(s => s.trim()))}
                placeholder="e.g., polymorphism, inheritance, encapsulation"
              />
            </div>
          </>
        );

      case 'ordering':
        return (
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Correct Sequence (comma-separated)</label>
            <input
              type="text"
              value={(ground_truth.correct_sequence || []).join(', ')}
              onChange={(e) => updateGroundTruth(qId, 'correct_sequence', e.target.value.split(',').map(s => s.trim()))}
              placeholder="e.g., A, B, C, D"
            />
          </div>
        );

      case 'programming':
        return (
          <>
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label>Expected Output</label>
              <textarea
                value={ground_truth.expected_output || ''}
                onChange={(e) => updateGroundTruth(qId, 'expected_output', e.target.value)}
                placeholder="Enter expected program output..."
                rows="2"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Test Cases (JSON format)</label>
              <textarea
                value={JSON.stringify(ground_truth.test_cases || [], null, 2)}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    updateGroundTruth(qId, 'test_cases', parsed);
                  } catch (err) {
                    // Invalid JSON, don't update
                  }
                }}
                placeholder='[{"input": "5", "output": "120"}]'
                rows="3"
              />
            </div>
          </>
        );

      case 'mathematical':
        return (
          <>
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label>Correct Answer</label>
              <input
                type="text"
                value={ground_truth.correct_answer || ''}
                onChange={(e) => updateGroundTruth(qId, 'correct_answer', e.target.value)}
                placeholder="e.g., 42 or x = 5"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Solution Steps (comma-separated)</label>
              <input
                type="text"
                value={(ground_truth.solution_steps || []).join(', ')}
                onChange={(e) => updateGroundTruth(qId, 'solution_steps', e.target.value.split(',').map(s => s.trim()))}
                placeholder="e.g., Step 1, Step 2, Step 3"
              />
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Upload Answer Key</h1>
        <p>Configure ground truth for exam grading</p>
      </div>

      {message.text && (
        <div className={`message message-${message.type}`}>
          <AlertCircle size={20} />
          <span>{message.text}</span>
        </div>
      )}

      {!autoConfigured && (
        <form onSubmit={handleAutoConfigure}>
          <div className="form-section">
            <h3>Exam Information</h3>
            
            <div className="form-group">
              <label>Exam Name</label>
              <input
                type="text"
                value={examName}
                onChange={(e) => setExamName(e.target.value)}
                placeholder="e.g., Midterm Exam - Data Structures"
                required
              />
            </div>
          </div>

          <div className="form-section">
            <h3>Answer Key Images (Optional)</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.875rem' }}>
              Upload images to auto-extract questions, or skip to add questions manually
            </p>
            <div className="file-upload-area">
              <Upload size={48} />
              <p><strong>Click to upload</strong> or drag and drop</p>
              <p className="text-muted">PNG, JPG up to 10MB each</p>
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
                    <FileText size={20} />
                    <span className="file-item-name">{file.name}</span>
                    <CheckCircle size={20} style={{ color: 'var(--success)' }} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2rem' }}>
            {files.length > 0 && (
              <button
                type="submit"
                disabled={configuring}
                className="btn-primary btn-lg"
              >
                {configuring ? (
                  <>
                    <div className="loading" />
                    Auto-Configuring...
                  </>
                ) : (
                  <>
                    <FileText size={20} />
                    Auto-Configure Questions
                  </>
                )}
              </button>
            )}
            
            <button
              type="button"
              onClick={handleSkipAutoConfigure}
              className="btn-secondary btn-lg"
            >
              <Edit2 size={20} />
              Add Questions Manually
            </button>
          </div>
        </form>
      )}

      {autoConfigured && (
        <>
          <div className="form-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3>Question Configuration</h3>
              <button
                type="button"
                onClick={addNewQuestion}
                className="btn-primary btn-sm"
              >
                <Plus size={16} />
                Add Question
              </button>
            </div>
            
            {Object.keys(questions).length === 0 && (
              <div className="empty-state">
                <FileText size={48} />
                <h3>No Questions Yet</h3>
                <p>Click "Add Question" to create your first question</p>
              </div>
            )}

            {Object.entries(questions).map(([qId, config]) => (
              <div key={qId} style={{ 
                marginBottom: '1.5rem', 
                padding: '1.5rem',
                background: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)'
              }}>
                {/* Question Header */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '1rem' 
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                    {editingQuestion === qId ? (
                      <input
                        type="text"
                        value={qId}
                        onChange={(e) => updateQuestionId(qId, e.target.value)}
                        style={{ 
                          width: '120px',
                          padding: '0.5rem',
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-sm)',
                          color: 'var(--text-primary)'
                        }}
                      />
                    ) : (
                      <strong style={{ color: 'var(--text-primary)', fontSize: '1.125rem' }}>{qId}</strong>
                    )}
                    
                    <span style={{ 
                      padding: '0.25rem 0.75rem',
                      background: 'var(--bg-secondary)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.875rem',
                      color: 'var(--text-secondary)'
                    }}>
                      {config.type} • {config.marks} marks
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {editingQuestion === qId ? (
                      <button
                        type="button"
                        onClick={() => setEditingQuestion(null)}
                        className="btn-success btn-sm"
                      >
                        <Save size={16} />
                        Save
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditingQuestion(qId)}
                        className="btn-secondary btn-sm"
                      >
                        <Edit2 size={16} />
                        Edit
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => deleteQuestion(qId)}
                      className="btn-secondary btn-sm"
                      style={{ color: 'var(--danger)' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Editing Mode */}
                {editingQuestion === qId && (
                  <div style={{ 
                    padding: '1rem',
                    background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '1rem'
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '1rem', marginBottom: '1rem' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Type</label>
                        <select
                          value={config.type}
                          onChange={(e) => handleTypeChange(qId, e.target.value)}
                        >
                          <option value="mcq">MCQ</option>
                          <option value="fill_in_blank">Fill in Blank</option>
                          <option value="descriptive">Descriptive</option>
                          <option value="ordering">Ordering</option>
                          <option value="programming">Programming</option>
                          <option value="mathematical">Mathematical</option>
                        </select>
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Marks</label>
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={config.marks}
                          onChange={(e) => updateQuestion(qId, 'marks', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Question Text</label>
                        <input
                          type="text"
                          value={config.question_text || ''}
                          onChange={(e) => updateQuestion(qId, 'question_text', e.target.value)}
                          placeholder="Enter the question..."
                        />
                      </div>
                    </div>

                    {/* Ground Truth Editor */}
                    <div style={{ 
                      padding: '1rem',
                      background: 'var(--bg-tertiary)',
                      borderRadius: 'var(--radius-sm)',
                      marginBottom: '1rem'
                    }}>
                      <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 600 }}>
                        Ground Truth / Correct Answer
                      </label>
                      {renderGroundTruthEditor(qId, config)}
                    </div>

                    {/* Grading Criteria for Descriptive */}
                    {['descriptive', 'programming', 'mathematical'].includes(config.type) && (
                      <div className="criteria-builder">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                          <h4>Grading Criteria</h4>
                          <button
                            type="button"
                            onClick={() => addCriteria(qId)}
                            className="btn-secondary btn-sm"
                          >
                            <Plus size={16} />
                            Add Criterion
                          </button>
                        </div>

                        {config.grading_criteria.map((criterion, index) => (
                          <div key={index} className="criteria-item">
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label>Criterion Name</label>
                              <input
                                type="text"
                                value={criterion.name}
                                onChange={(e) => updateCriteria(qId, index, 'name', e.target.value)}
                                placeholder="e.g., Concept Coverage"
                              />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label>Weight (%)</label>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={criterion.weight}
                                onChange={(e) => updateCriteria(qId, index, 'weight', e.target.value)}
                                placeholder="0"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => removeCriteria(qId, index)}
                              className="btn-secondary btn-sm"
                              style={{ marginTop: '1.5rem' }}
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ))}

                        {config.grading_criteria.length > 0 && (
                          <div className={`criteria-total ${getCriteriaTotal(config.grading_criteria) === 100 ? 'valid' : 'invalid'}`}>
                            Total Weight: {getCriteriaTotal(config.grading_criteria)}%
                            {getCriteriaTotal(config.grading_criteria) === 100 ? ' ✓' : ' (must be 100%)'}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* View Mode */}
                {editingQuestion !== qId && (
                  <>
                    {config.question_text && (
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                        {config.question_text}
                      </p>
                    )}

                    {config.type === 'mcq' && config.ground_truth?.correct_answer && (
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        <strong>Correct Answer:</strong> {config.ground_truth.correct_answer}
                      </div>
                    )}

                    {config.type === 'ordering' && config.ground_truth?.correct_sequence && (
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        <strong>Correct Sequence:</strong> {config.ground_truth.correct_sequence.join(' → ')}
                      </div>
                    )}

                    {['descriptive', 'programming', 'mathematical'].includes(config.type) && config.grading_criteria && config.grading_criteria.length > 0 && (
                      <div style={{ 
                        marginTop: '0.5rem',
                        padding: '0.75rem',
                        background: 'var(--bg-secondary)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.875rem'
                      }}>
                        <strong>Grading Criteria:</strong>
                        <div style={{ marginTop: '0.5rem' }}>
                          {config.grading_criteria.map((c, i) => (
                            <div key={i}>{c.name}: {c.weight}%</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2rem', gap: '1rem' }}>
            <button
              type="button"
              onClick={() => {
                setAutoConfigured(false);
                setQuestions({});
                setEditingQuestion(null);
              }}
              className="btn-secondary btn-lg"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading || Object.keys(questions).length === 0}
              className="btn-success btn-lg"
            >
              {uploading ? (
                <>
                  <div className="loading" />
                  Uploading...
                </>
              ) : (
                <>
                  <CheckCircle size={20} />
                  Upload Ground Truth
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}