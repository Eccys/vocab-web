import React, { useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import AOS from 'aos';
import { useAuth } from './services/AuthContext';
import { SpacedRepetitionProvider } from './services/SpacedRepetitionContext';

// Pages
import HomePage from './pages/HomePage';
import WordOfDayPage from './pages/WordOfDayPage';
import QuizPage from './pages/QuizPage';
import MigrationPage from './pages/MigrationPage';
import StatisticsPage from './pages/StatisticsPage';
import SavedWordsPage from './pages/SavedWordsPage';

// Import AOS script for animations
import 'aos/dist/aos.css';

// Initialize AOS animation library outside of the component
AOS.init({
  duration: 800,
  easing: 'ease-in-out',
  once: true,
  mirror: false
});

const App: React.FC = () => {
  // Get auth context for debugging
  const { currentUser, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Log auth state changes for debugging
  useEffect(() => {
    console.log("App component auth state changed:", { 
      isAuthenticated, 
      hasUser: !!currentUser,
      userId: currentUser?.uid || 'no-user'
    });
  }, [isAuthenticated, currentUser?.uid]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const redirectPath = params.get('p');
    const redirectQuery = params.get('q');

    if (redirectPath) {
      let fullPath = redirectPath;
      if (redirectQuery) {
        fullPath += `?${redirectQuery.replace(/~and~/g, '&')}`;
      }
      navigate(fullPath, { replace: true });
    }
  }, [location, navigate]);
  
  return (
    <SpacedRepetitionProvider>
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/word-of-day" element={<WordOfDayPage />} />
      <Route path="/quiz" element={<QuizPage />} />
      <Route path="/data-migration" element={<MigrationPage />} />
      <Route path="/statistics" element={<StatisticsPage />} />
      <Route path="/saved-words" element={<SavedWordsPage />} />
    </Routes>
    </SpacedRepetitionProvider>
  );
};

export default App; 