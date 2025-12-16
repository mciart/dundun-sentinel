import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import StatusPage from './pages/StatusPage';
import AdminPage from './pages/AdminPage';
import LoginPage from './pages/LoginPage';
import SettingsPage from './pages/SettingsPage';
import WebsiteSettingsPage from './pages/WebsiteSettingsPage';
import IncidentsPage from './pages/IncidentsPage';
import { getToken, api } from './utils/api';
import { HistoryProvider } from './context/HistoryContext';

function App() {
  const [adminPath, setAdminPath] = useState('admin');
  const [pathLoaded, setPathLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    const isDark = saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  useEffect(() => {
    api.getAdminPath()
      .then(data => {
        if (data.path) {
          setAdminPath(data.path);
        }
      })
      .catch(() => {})
      .finally(() => setPathLoaded(true));
  }, []);

  if (!pathLoaded) {
    return null;
  }

  return (
    <HistoryProvider>
    <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true
        }}
      >
        <Routes>
        <Route path="/" element={<StatusPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/incidents" element={<IncidentsPage />} />
        <Route 
          path={`/${adminPath}`}
          element={
            getToken() ? (
              <AdminPage />
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />
        <Route 
          path="/settings" 
          element={
            getToken() ? (
              <SettingsPage />
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />
        <Route 
          path="/website-settings" 
          element={
            getToken() ? (
              <WebsiteSettingsPage />
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />
      </Routes>
    </BrowserRouter>
    </HistoryProvider>
  );
}

export default App;
