import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, FileText, Users, AlertCircle, Upload, UserCheck } from 'lucide-react';
import { checkHealth, getExams } from '../services/api';

export default function Dashboard() {
  const navigate = useNavigate();
  const [backendStatus, setBackendStatus] = useState({ status: 'checking', message: '' });
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkBackendAndLoadExams();
  }, []);

  const checkBackendAndLoadExams = async () => {
    setLoading(true);
    
    try {
      const health = await checkHealth();
      setBackendStatus({
        status: 'online',
        message: `${health.message} (v${health.version})`,
      });
      
      const examsData = await getExams();
      setExams(examsData);
    } catch (error) {
      setBackendStatus({
        status: 'offline',
        message: 'Backend server is not running. Please start it with: python main.py',
      });
    } finally {
      setLoading(false);
    }
  };

  const stats = [
    {
      title: 'Exams Available',
      value: exams.length,
      icon: FileText,
      description: 'Answer keys uploaded',
    },
    
    {
      title: 'Question Types',
      value: '7+',
      icon: Users,
      description: 'MCQ, Descriptive, Math, Code',
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Grading System</p>
      </div>

      {/* Backend Status */}
      <div className={`status-banner ${backendStatus.status}`}>
        <AlertCircle size={20} />
        <div>
          <strong>Backend Status: {backendStatus.status.toUpperCase()}</strong>
          <p style={{ margin: 0, fontSize: '0.875rem' }}>{backendStatus.message}</p>
        </div>
        {backendStatus.status === 'offline' && (
          <button onClick={checkBackendAndLoadExams} className="btn-secondary btn-sm">
            Retry Connection
          </button>
        )}
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="stat-card">
              <div className="stat-icon">
                <Icon size={24} />
              </div>
              <div className="stat-content">
                <div className="stat-value">{stat.value}</div>
                <div className="stat-title">{stat.title}</div>
                <div className="stat-description">{stat.description}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <h2>Quick Actions</h2>
        <div className="action-grid">
          <button 
            className="action-card"
            onClick={() => navigate('/upload-ground-truth')}
          >
            <Upload size={32} />
            <h3>Upload Answer Key</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0 }}>
              Configure questions and grading criteria
            </p>
          </button>
          
          <button 
            className="action-card"
            onClick={() => navigate('/upload-student')}
          >
            <FileText size={32} />
            <h3>Upload Student Papers</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0 }}>
              Submit answer sheets for grading
            </p>
          </button>
          
          <button 
            className="action-card"
            onClick={() => navigate('/results')}
          >
            <Activity size={32} />
            <h3>View Results</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0 }}>
              Check student scores and analysis
            </p>
          </button>
          
          <button 
            className="action-card"
            onClick={() => navigate('/review')}
          >
            <UserCheck size={32} />
            <h3>Teacher Review</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0 }}>
              Review and edit AI grading
            </p>
          </button>
        </div>
      </div>

      {/* Exams List */}
      {exams.length > 0 && (
        <div className="exams-section">
          <h2>Available Exams</h2>
          <div className="exams-list">
            {exams.map((exam) => (
              <div key={exam.id} className="exam-card">
                <div className="exam-header">
                  <FileText size={20} />
                  <h3>{exam.exam_name}</h3>
                </div>
                <div className="exam-details">
                  <div className="exam-stat">
                    <span className="label">Questions</span>
                    <span className="value">{exam.questions_count}</span>
                  </div>
                  <div className="exam-stat">
                    <span className="label">Total Marks</span>
                    <span className="value">{exam.total_marks}</span>
                  </div>
                  <div className="exam-stat">
                    <span className="label">Submissions</span>
                    <span className="value">{exam.submissions_count || 0}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
    </div>
  );
}