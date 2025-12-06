import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { getExams, uploadStudentPapers, gradePaper } from '../services/api';

export default function StudentPaperUpload() {
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [studentId, setStudentId] = useState('');
  const [files, setFiles] = useState([]);
  const [submissionId, setSubmissionId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [grading, setGrading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    loadExams();
  }, []);

  const loadExams = async () => {
    try {
      const data = await getExams();
      setExams(data);
    } catch (error) {
      console.error('Failed to load exams:', error);
    }
  };

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(selectedFiles);
  };

  const handleUpload = async (e) => {
    e.preventDefault();

    if (!selectedExam) {
      setMessage({ type: 'error', text: 'Please select an exam' });
      return;
    }

    if (!studentId.trim()) {
      setMessage({ type: 'error', text: 'Please enter student ID' });
      return;
    }

    if (files.length === 0) {
      setMessage({ type: 'error', text: 'Please select answer sheet images' });
      return;
    }

    setUploading(true);
    setMessage({ type: 'info', text: 'Uploading answer sheets...' });

    try {
      const formData = new FormData();
      formData.append('exam_id', selectedExam);
      formData.append('student_id', studentId.trim());
      
      files.forEach((file) => {
        formData.append('files', file);
      });

      const result = await uploadStudentPapers(formData);
      
      setSubmissionId(result.submission_id);
      setMessage({ 
        type: 'success', 
        text: `Paper uploaded successfully. Submission ID: ${result.submission_id}` 
      });
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

  const handleGrade = async () => {
    if (!submissionId) {
      setMessage({ type: 'error', text: 'Please upload paper first' });
      return;
    }

    setGrading(true);
    setMessage({ type: 'info', text: 'Grading paper... This may take 10-30 seconds.' });

    try {
      const result = await gradePaper(submissionId);
      
      setMessage({ 
        type: 'success', 
        text: `Grading complete! Score: ${result.total_score}/${result.total_max} (${result.percentage}%)` 
      });

      setTimeout(() => {
        navigate(`/results?id=${submissionId}`);
      }, 1500);
    } catch (error) {
      console.error('Grading error:', error);
      setMessage({ 
        type: 'error', 
        text: `Grading failed: ${error.response?.data?.detail || error.message}` 
      });
    } finally {
      setGrading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Upload Student Papers</h1>
        <p>Upload student answer sheets for grading</p>
      </div>

      {message.text && (
        <div className={`message message-${message.type}`}>
          <AlertCircle size={20} />
          <span>{message.text}</span>
        </div>
      )}

      <form onSubmit={handleUpload}>
        <div className="form-section">
          <h3>Student Details</h3>
          
          <div className="form-group">
            <label>Select Exam</label>
            <select
              value={selectedExam}
              onChange={(e) => setSelectedExam(e.target.value)}
              required
            >
              <option value="">Choose an exam...</option>
              {exams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.exam_name} ({exam.total_marks} marks)
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Student ID</label>
            <input
              type="text"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder="e.g., MSDS24068"
              required
            />
          </div>
        </div>

        <div className="form-section">
          <h3>Answer Sheets</h3>
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
              id="student-file-input"
            />
            <label htmlFor="student-file-input" className="btn-primary" style={{ marginTop: '1rem', cursor: 'pointer' }}>
              Select Images
            </label>
          </div>

          {files.length > 0 && (
            <div className="file-list">
              {files.map((file, index) => (
                <div key={index} className="file-item">
                  <FileText size={20} />
                  <span className="file-item-name">{file.name}</span>
                  <CheckCircle size={20} color="#16a34a" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2rem' }}>
          <button
            type="submit"
            disabled={uploading || grading}
            className="btn-primary btn-lg"
          >
            {uploading ? 'Uploading...' : 'Upload Paper'}
          </button>

          {submissionId && (
            <button
              type="button"
              onClick={handleGrade}
              disabled={uploading || grading}
              className="btn-success btn-lg"
            >
              {grading ? 'Grading...' : 'Grade Paper'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}