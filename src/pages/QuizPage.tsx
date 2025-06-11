import React from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import BackToTop from '../components/BackToTop';
import WordQuizGame from '../components/WordQuizGame';
import { SpacedRepetitionProvider } from '../services/SpacedRepetitionContext';
import '../styles/WordQuizGame.css';

const QuizPage: React.FC = () => {
  return (
    <>
      <Header />
      <main className="quiz-page-container">
        <SpacedRepetitionProvider>
        <WordQuizGame />
        </SpacedRepetitionProvider>
      </main>
      <Footer />
      <BackToTop />
    </>
  );
};

export default QuizPage; 