import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Award, CheckCircle, XCircle, AlertCircle, FileText } from 'lucide-react';
import { getResults } from '../services/api';

export default function Results() {
  const [searchParams] = useSearchParams();
  const [searchId, setSearchId] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    const idFromUrl = searchParams.get('id');
    if (idFromUrl) {
      setSearchId(idFromUrl);
      performSearch(idFromUrl);
    }
  }, [searchParams]);

  const performSearch = async (id) => {
    if (!id || !id.trim()) {
      setMessage({ type: 'error', text: 'Please enter submission ID or student ID' });
      return;
    }

    setLoading(true);
    setMessage({ type: 'info', text: 'Loading results...' });
    setResults(null);

    try {
      const data = await getResults(id.trim());
      setResults(data);
      setMessage({ type: '', text: '' });
    } catch (error) {
      console.error('Search error:', error);
      
      if (error.response?.status === 404) {
        const detail = error.response?.data?.detail || '';
        if (detail.includes('Not graded yet')) {
          setMessage({ 
            type: 'warning', 
            text: 'Paper found but not graded yet. Please click "Grade Paper" from Student Papers tab.' 
          });
        } else {
          setMessage({ 
            type: 'error', 
            text: `No results found for ID "${id}". Make sure the paper is uploaded and graded.` 
          });
        }
      } else {
        setMessage({ 
          type: 'error', 
          text: `Failed to load results: ${error.response?.data?.detail || error.message}` 
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    performSearch(searchId);
  };

  const getLetterGrade = (percentage) => {
    if (percentage >= 90) return 'A+';
    if (percentage >= 85) return 'A';
    if (percentage >= 80) return 'A-';
    if (percentage >= 75) return 'B+';
    if (percentage >= 70) return 'B';
    if (percentage >= 65) return 'B-';
    if (percentage >= 60) return 'C+';
    if (percentage >= 55) return 'C';
    if (percentage >= 50) return 'C-';
    if (percentage >= 45) return 'D';
    return 'F';
  };

  const getScoreColor = (percentage) => {
    if (percentage >= 80) return 'excellent';
    if (percentage >= 60) return 'good';
    if (percentage >= 40) return 'average';
    return 'poor';
  };

  const getResultClass = (score, maxScore) => {
    const percentage = (score / maxScore) * 100;
    if (percentage === 100) return 'correct';
    if (percentage > 0) return 'partial';
    return 'incorrect';
  };

  const stats = results ? {
    correct: results.results.filter(r => r.score === r.max_score).length,
    partial: results.results.filter(r => r.score > 0 && r.score < r.max_score).length,
    incorrect: results.results.filter(r => r.score === 0).length,
    total: results.results.length,
  } : null;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Results</h1>
        <p>Check grading results and scores</p>
      </div>

      {message.text && (
        <div className={`message message-${message.type}`}>
          <AlertCircle size={20} />
          <span>{message.text}</span>
        </div>
      )}

      <div className="search-group">
        <div className="form-section">
          <h3>Search Results</h3>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label>Submission ID or Student ID</label>
              <input
                type="text"
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="e.g., 1, MSDS24068, MSCS745239"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={loading}
              className="btn-primary"
            >
              {loading ? (
                <>
                  <div className="loading" />
                  Searching...
                </>
              ) : (
                <>
                  <Search size={20} />
                  Search
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {results && (
        <>
          <div className="score-summary">
            <Award size={48} style={{ color: '#f59e0b', marginBottom: '1rem' }} />
            <div className={`score-large ${getScoreColor(results.percentage)}`}>
              {results.total_score} / {results.total_max}
            </div>
            <div className="letter-grade">
              Grade: {getLetterGrade(results.percentage)} ({results.percentage}%)
            </div>

            <div className="summary-details">
              <div className="summary-item">
                <div className="label">Student ID</div>
                <div className="value">{results.student_id}</div>
              </div>
              <div className="summary-item">
                <div className="label">Submission ID</div>
                <div className="value">{results.submission_id}</div>
              </div>
              <div className="summary-item">
                <div className="label">Exam ID</div>
                <div className="value">{results.exam_id}</div>
              </div>
              <div className="summary-item">
                <div className="label">Questions</div>
                <div className="value">{results.results.length}</div>
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>Question-by-Question Breakdown</h3>
            <div className="results-list">
              {results.results.map((result, index) => {
                const resultClass = getResultClass(result.score, result.max_score);
                return (
                  <div key={index} className={`result-card ${resultClass}`}>
                    <div className="result-header">
                      <h4>
                        <FileText size={20} />
                        {result.question_id}
                      </h4>
                      <div className={`result-score ${resultClass}`}>
                        {resultClass === 'correct' && <CheckCircle size={20} />}
                        {resultClass === 'incorrect' && <XCircle size={20} />}
                        {resultClass === 'partial' && <AlertCircle size={20} />}
                        {result.score} / {result.max_score}
                      </div>
                    </div>

                    <div className="answer-section">
                      <strong>AI Grading Analysis</strong>
                      <div style={{ 
                        background: 'var(--bg-tertiary)', 
                        padding: '1rem', 
                        borderRadius: '8px',
                        marginTop: '0.5rem',
                        whiteSpace: 'pre-line',
                        fontSize: '0.875rem',
                        lineHeight: '1.6',
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-primary)'
                      }}>
                        {result.reasoning}
                      </div>
                    </div>

                    {result.breakdown && (
                      <div className="answer-section">
                        <strong>Breakdown</strong>
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                          {Object.entries(result.breakdown).map(([key, value]) => (
                            <div key={key} style={{ marginBottom: '0.25rem' }}>
                              <strong>{key}:</strong> {JSON.stringify(value)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {stats && (
            <div className="statistics-grid">
              <div className="stat-box">
                <div className="number" style={{ color: '#16a34a' }}>{stats.correct}</div>
                <div className="label">Correct Answers</div>
              </div>
              <div className="stat-box">
                <div className="number" style={{ color: '#f59e0b' }}>{stats.partial}</div>
                <div className="label">Partial Credit</div>
              </div>
              <div className="stat-box">
                <div className="number" style={{ color: '#dc2626' }}>{stats.incorrect}</div>
                <div className="label">Incorrect</div>
              </div>
              <div className="stat-box">
                <div className="number" style={{ color: '#2563eb' }}>{stats.total}</div>
                <div className="label">Total Questions</div>
              </div>
            </div>
          )}
        </>
      )}

      {!results && !loading && !message.text && (
        <div className="empty-state">
          <FileText size={48} />
          <h3>No Results Yet</h3>
          <p>Enter a submission ID or student ID to view results</p>
        </div>
      )}
    </div>
  );
}