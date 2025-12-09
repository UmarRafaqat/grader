import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { FileText, Upload, BarChart3, UserCheck, Home } from 'lucide-react';
import Dashboard from './components/Dashboard';
import GroundTruthUpload from './components/GroundTruthUpload';
import StudentPaperUpload from './components/StudentPaperUpload';
import Results from './components/Results';
import TeacherReview from './components/TeacherReview';
import './styles/index.css';
import './styles/App.css';

function App() {
  return (
    <Router>
      <div className="app">
        <nav>
          <div className="nav-container">
            <div className="logo">
              <FileText size={28} />
              <span>IntelliGrader</span>
            </div>
            <ul>
              <li>
                <NavLink to="/" end>
                  <Home size={20} />
                  <span>Dashboard</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/upload-ground-truth">
                  <Upload size={20} />
                  <span>Answer Key</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/upload-student">
                  <FileText size={20} />
                  <span>Student Papers</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/results">
                  <BarChart3 size={20} />
                  <span>Results</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/review">
                  <UserCheck size={20} />
                  <span>Teacher Review</span>
                </NavLink>
              </li>
            </ul>
          </div>
        </nav>
        
        <main>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/upload-ground-truth" element={<GroundTruthUpload />} />
            <Route path="/upload-student" element={<StudentPaperUpload />} />
            <Route path="/results" element={<Results />} />
            <Route path="/review" element={<TeacherReview />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;