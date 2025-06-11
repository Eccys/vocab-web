import React, { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import AOS from 'aos';
import { useAuth } from './services/AuthContext';

// Pages
import HomePage from './pages/HomePage';
import WordOfDayPage from './pages/WordOfDayPage';
import QuizPage from './pages/QuizPage';
import MigrationPage from './pages/MigrationPage';

// Import AOS script for animations
import 'aos/dist/aos.css';

// Initialize AOS animation library outside of the component
AOS.init({
  duration: 800,
  easing: 'ease-in-out',
  once: false,
  mirror: true
});

const App: React.FC = () => {
  // Get auth context for debugging
  const { currentUser, isAuthenticated } = useAuth();
  
  // Log auth state changes for debugging
  useEffect(() => {
    console.log("App component auth state changed:", { 
      isAuthenticated, 
      hasUser: !!currentUser,
      userId: currentUser?.uid || 'no-user'
    });
  }, [isAuthenticated, currentUser?.uid]);
  
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/word-of-day" element={<WordOfDayPage />} />
      <Route path="/quiz" element={<QuizPage />} />
      <Route path="/data-migration" element={<MigrationPage />} />
    </Routes>
  );
};

export default App; 