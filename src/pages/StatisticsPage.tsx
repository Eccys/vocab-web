import React, { useState, useEffect } from 'react';
import { useSpacedRepetition } from '../services/SpacedRepetitionContext';
import { WordWithSpacedRepetition } from '../services/SpacedRepetitionService';
import Header from '../components/Header';
import { motion, useSpring, useInView } from 'framer-motion';
import { GraduationCap, Target, BookOpenCheck } from 'lucide-react';
import WordListModal from '../components/WordListModal';
import '../styles/StatisticsPage.css';

// Animated number component
const AnimatedNumber = ({ value }: { value: number }) => {
  const ref = React.useRef(null);
  const isInView = useInView(ref, { once: true });
  const spring = useSpring(0, {
    damping: 20,
    stiffness: 100,
    mass: 1,
  });

  useEffect(() => {
    if (isInView) {
      spring.set(value);
    }
  }, [spring, isInView, value]);

  useEffect(() => {
    // Round the value for display
    return spring.on("change", (latest) => {
      if (ref.current) {
        (ref.current as HTMLElement).textContent = Math.round(latest).toString();
      }
    });
  }, [spring]);

  return <span ref={ref}>0</span>;
};

// Stat Card component
const StatCard = ({ icon, label, value, index, onClick }: { icon: React.ReactNode, label: string, value: number, index: number, onClick: () => void }) => (
  <motion.div
    className="stat-card"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: index * 0.1 }}
    onClick={onClick}
    style={{ cursor: 'pointer' }}
  >
    <div className="stat-header">
      <div className="stat-icon">{icon}</div>
      <h2 className="stat-label">{label}</h2>
    </div>
    <p className="stats-page-value">
      <AnimatedNumber value={value} />
    </p>
  </motion.div>
);

const StatisticsPage: React.FC = () => {
  const { words, isLoading } = useSpacedRepetition();
  const [stats, setStats] = useState({
    mastered: [] as WordWithSpacedRepetition[],
    toReview: [] as WordWithSpacedRepetition[],
    studied: [] as WordWithSpacedRepetition[],
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState<{ title: string; words: WordWithSpacedRepetition[] }>({ title: '', words: [] });

  useEffect(() => {
    if (!isLoading && words.length > 0) {
      const reviewedWords = words.filter(w => w.timesReviewed > 0);
      const masteredWords = reviewedWords.filter(w => (w.timesCorrect / w.timesReviewed) >= 0.9 || w.repetitionCount >= 3);
      const toReviewWords = reviewedWords.filter(w => !masteredWords.some(mw => mw.word === w.word));
      
      setStats({
        mastered: masteredWords,
        toReview: toReviewWords,
        studied: reviewedWords,
      });
    }
  }, [isLoading, words]);

  const handleCardClick = (category: 'mastered' | 'toReview' | 'studied', title: string) => {
    setModalContent({ title, words: stats[category] });
    setIsModalOpen(true);
  };

  const statItems = [
    { key: 'mastered', icon: <GraduationCap size={28} />, label: 'Mastered', value: stats.mastered.length },
    { key: 'toReview', icon: <Target size={28} />, label: 'To Review', value: stats.toReview.length },
    { key: 'studied', icon: <BookOpenCheck size={28} />, label: 'Words Studied', value: stats.studied.length },
  ];

  return (
    <>
      <Header variant="app" />
      <main className="statistics-page">
        <div className="container">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            Your Progress
          </motion.h1>
          {isLoading ? (
            <p style={{color: '#fff'}}>Loading statistics...</p>
          ) : (
            <div className="stats-grid">
              {statItems.map((item, index) => (
                <StatCard
                  key={item.label}
                  icon={item.icon}
                  label={item.label}
                  value={item.value}
                  index={index}
                  onClick={() => handleCardClick(item.key as 'mastered' | 'toReview' | 'studied', item.label)}
                />
              ))}
            </div>
          )}
        </div>
      </main>
      <WordListModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalContent.title}
        words={modalContent.words}
      />
    </>
  );
};

export default StatisticsPage; 