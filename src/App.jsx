import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Context
import { AuthProvider } from './context/AuthContext';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ExecutionList from './pages/ExecutionList';
import ExecutionCreate from './pages/ExecutionCreate';
import ExecutionUpload from './pages/ExecutionUpload';
import ExecutionValidate from './pages/ExecutionValidate';
import ExecutionDetail from './pages/ExecutionDetail';
import ReportView from './pages/ReportView';
import ReportsList from './pages/ReportsList';
import InteractiveTesting from './pages/InteractiveTesting';

// Components
import PrivateRoute from './components/PrivateRoute';
import Layout from './components/Layout';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            path="/*"
            element={
              <PrivateRoute>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/executions" element={<ExecutionList />} />
                    <Route path="/executions/create" element={<ExecutionCreate />} />
                    <Route path="/executions/create/upload" element={<ExecutionUpload />} />
                    <Route path="/executions/create/validate" element={<ExecutionValidate />} />
                    <Route path="/executions/:id" element={<ExecutionDetail />} />
                    <Route path="/reports" element={<ReportsList />} />
                    <Route path="/reports/:id" element={<ReportView />} />
                    <Route path="/validate-criteria" element={<InteractiveTesting />} />
                    <Route path="/testing" element={<Navigate to="/validate-criteria" replace />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Layout>
              </PrivateRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
