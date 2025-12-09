import { useState } from 'react';
import { Search, Brain, Edit, Save, X, CheckCircle, AlertCircle } from 'lucide-react';
import { getReview, editGrade } from '../services/api';

export default function TeacherReview() {
  const [searchId, setSearchId] = useState('');
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [editData, setEditData] = useState({ score: '', comment: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleSearch = async () => {
    if (!searchId.trim()) {
      setMessage({ type: 'error', text: 'Please enter submission ID or student ID' });
      return;
    }

    setLoading(true);
    setMessage({ type: 'info', text: 'Loading review...' });
    setReview(null);

    try {
      const data = await getReview(searchId.trim());
      setReview(data);
      setMessage({ type: '', text: '' });
    } catch (error) {
      console.error('Search error:', error);
      setMessage({ 
        type: 'error', 
        text: error.response?.status === 404 
          ? 'Submission not found. Check the ID and try again.' 
          : `Failed to load review: ${error.response?.data?.detail || error.message}` 
      });
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (result) => {
    setEditingQuestion(result.question_id);
    setEditData({
      score: result.score.toString(),
      comment: result.teacher_comment || result.breakdown?.teacher_comment || '',
    });
  };

  const cancelEdit = () => {
    setEditingQuestion(null);
    setEditData({ score: '', comment: '' });
  };

  const saveEdit = async (questionId, maxScore) => {
    const newScore = parseFloat(editData.score);

    if (isNaN(newScore) || newScore < 0 || newScore > maxScore) {
      setMessage({ 
        type: 'error', 
        text: `Score must be between 0 and ${maxScore}` 
      });
      return;
    }

    setSaving(true);
    setMessage({ type: 'info', text: 'Saving changes...' });

    try {
      await editGrade(
        review.submission.id,
        questionId,
        newScore,
        editData.comment
      );

      const updatedResults = review.results.map(r => {
        if (r.question_id === questionId) {
          return {
            ...r,
            score: newScore,
            teacher_comment: editData.comment,
          };
        }
        return r;
      });

      const newTotalScore = updatedResults.reduce((sum, r) => sum + r.score, 0);

      setReview({
        ...review,
        results: updatedResults,
        total_score: newTotalScore,
      });

      setEditingQuestion(null);
      setEditData({ score: '', comment: '' });
      setMessage({ type: 'success', text: 'Grade updated successfully!' });

      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      console.error('Save error:', error);
      setMessage({ 
        type: 'error', 
        text: `Failed to save: ${error.response?.data?.detail || error.message}` 
      });
    } finally {
      setSaving(false);
    }
  };

  const totalScore = review ? review.results.reduce((sum, r) => sum + r.score, 0) : 0;
  const totalMax = review ? review.results.reduce((sum, r) => sum + r.max_score, 0) : 0;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Teacher Review</h1>
        <p>Review and edit grades with AI insights</p>
      </div>

      {message.text && (
        <div className={`message message-${message.type}`}>
          <AlertCircle size={20} />
          <span>{message.text}</span>
        </div>
      )}

      <div className="search-group">
        <div className="form-section">
          <h3>Load Submission</h3>
          <div style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: '1.5' }}>
              <strong style={{ color: 'var(--text-primary)' }}>You can search using:</strong><br />
              • <strong>Submission ID</strong> (number): 1, 2, 3, etc.<br />
              • <strong>Student ID</strong> (alphanumeric): MSDS24068, MSCS745239, etc.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label>Submission ID or Student ID</label>
              <input
                type="text"
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="e.g., 1 or MSDS24068"
              />
              <p className="helper-text">Enter submission ID or student ID</p>
            </div>
            <button
              onClick={handleSearch}
              disabled={loading}
              className="btn-primary"
            >
              {loading ? (
                <>
                  <div className="loading" />
                  Loading...
                </>
              ) : (
                <>
                  <Search size={20} />
                  Load
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {review && (
        <>
          <div className="review-summary">
            <h3>Review for Submission #{review.submission.id}</h3>
            <div className="total-score">
              {totalScore.toFixed(2)} / {totalMax}
            </div>
            <p>Student ID: {review.submission.student_id}</p>
            <p>Exam: {review.ground_truth.exam_name}</p>
          </div>

          <div className="review-questions">
            {review.results.map((result, index) => (
              <div key={index} className="review-card">
                <h4>{result.question_id} ({result.max_score} marks)</h4>

                <div className="ai-reasoning">
                  <h5>
                    <Brain size={16} />
                    AI Grading Analysis
                  </h5>
                  <div style={{ 
                    background: 'var(--bg-tertiary)', 
                    padding: '1rem', 
                    borderRadius: '8px',
                    whiteSpace: 'pre-line',
                    fontSize: '0.875rem',
                    lineHeight: '1.6',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)'
                  }}>
                    {result.reasoning}
                  </div>
                  {result.breakdown && (
                    <div style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>Details:</strong>
                      <div style={{ 
                        background: 'var(--bg-tertiary)', 
                        padding: '0.75rem', 
                        borderRadius: '4px',
                        marginTop: '0.5rem',
                        border: '1px solid var(--border-color)'
                      }}>
                        {result.breakdown.selected && (
                          <p style={{ margin: '0.25rem 0', color: 'var(--text-primary)' }}>
                            <strong>Student selected:</strong> {result.breakdown.selected}
                          </p>
                        )}
                        {result.breakdown.correct && (
                          <p style={{ margin: '0.25rem 0', color: 'var(--text-primary)' }}>
                            <strong>Correct answer:</strong> {result.breakdown.correct}
                          </p>
                        )}
                        {result.breakdown.match !== undefined && (
                          <p style={{ margin: '0.25rem 0', color: 'var(--text-primary)' }}>
                            <strong>Match:</strong> {result.breakdown.match ? '✓ Yes' : '✗ No'}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  padding: '1rem',
                  background: 'var(--bg-tertiary)',
                  borderRadius: '8px',
                  marginTop: '1rem',
                  border: '1px solid var(--border-color)'
                }}>
                  <div style={{ color: 'var(--text-primary)' }}>
                    <strong>Current Score:</strong> {result.score} / {result.max_score}
                  </div>
                  {editingQuestion !== result.question_id && (
                    <button
                      onClick={() => startEdit(result)}
                      className="btn-secondary btn-sm"
                    >
                      <Edit size={16} />
                      Edit Grade
                    </button>
                  )}
                </div>

                {editingQuestion === result.question_id && (
                  <div className="edit-section">
                    <h5>Edit Grade</h5>
                    <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '1rem', marginBottom: '1rem' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>New Score</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max={result.max_score}
                          value={editData.score}
                          onChange={(e) => setEditData({ ...editData, score: e.target.value })}
                          placeholder="0"
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Teacher Comment (Optional)</label>
                        <textarea
                          value={editData.comment}
                          onChange={(e) => setEditData({ ...editData, comment: e.target.value })}
                          placeholder="Add your comment..."
                          rows="2"
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => saveEdit(result.question_id, result.max_score)}
                        disabled={saving}
                        className="btn-success btn-sm"
                      >
                        {saving ? (
                          <>
                            <div className="loading" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save size={16} />
                            Save
                          </>
                        )}
                      </button>
                      <button
                        onClick={cancelEdit}
                        disabled={saving}
                        className="btn-secondary btn-sm"
                      >
                        <X size={16} />
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {result.teacher_comment && editingQuestion !== result.question_id && (
                  <div className="teacher-comment">
                    <h5>
                      <CheckCircle size={16} />
                      Teacher Comment
                    </h5>
                    <p>{result.teacher_comment}</p>
                  </div>
                )}
                
                {result.breakdown?.teacher_comment && editingQuestion !== result.question_id && (
                  <div className="teacher-comment">
                    <h5>
                      <CheckCircle size={16} />
                      Teacher Comment
                    </h5>
                    <p>{result.breakdown.teacher_comment}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {!review && !loading && !message.text && (
        <div className="empty-state">
          <Brain size={48} />
          <h3>No Submission Loaded</h3>
          <p>Enter a submission ID or student ID to review and edit grades</p>
        </div>
      )}
    </div>
  );
}