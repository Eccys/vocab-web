import React, { useState, useEffect, useRef } from 'react';
import { useSpacedRepetition } from '../services/SpacedRepetitionContext';
import { WordWithSpacedRepetition } from '../services/SpacedRepetitionService';
import Header from '../components/Header';
import { motion } from 'framer-motion';
import { Tilt } from '../components/ui/Tilt';
import { Bookmark, ArrowUpRightSquare } from 'lucide-react';
import AOS from 'aos';
import '../styles/SavedWordsPage.css';

const SavedWordCard: React.FC<{
  word: WordWithSpacedRepetition;
  onToggleBookmark: (word: WordWithSpacedRepetition) => void;
  index: number;
  isInitiallyBookmarked: boolean;
}> = ({ word, onToggleBookmark, index, isInitiallyBookmarked }) => {
  const [isBookmarked, setIsBookmarked] = useState(isInitiallyBookmarked);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsBookmarked(isInitiallyBookmarked);
  }, [isInitiallyBookmarked]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    
    const rect = cardRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    const inner = cardRef.current.querySelector('.saved-word-card-inner') as HTMLElement;
    if (inner) {
      inner.style.setProperty('--x', `${x}%`);
      inner.style.setProperty('--y', `${y}%`);
    }
  };

  const handleBookmarkClick = () => {
    onToggleBookmark(word);
    setIsBookmarked(!isBookmarked);
  };

  const merriamWebsterUrl = `https://www.merriam-webster.com/dictionary/${encodeURIComponent(word.word)}`;

  return (
    <div 
      className="saved-word-card-container"
      data-aos="fade-up"
      data-aos-delay={index * 50}
      ref={cardRef}
      onMouseMove={handleMouseMove}
    >
      <Tilt 
        className="saved-word-card"
        rotationFactor={10}
        springOptions={{
          stiffness: 300,
          damping: 15
        }}
      >
        <motion.div
          className={`saved-word-card-inner ${!isBookmarked ? 'unbookmarked' : ''}`}
          whileHover={{
            scale: 1.02,
            transition: { duration: 0.3, ease: "easeInOut" }
          }}
        >
          <div className="saved-word-card-spotlight"></div>
          <h2>{word.word}</h2>
          <p>{word.definition}</p>
          <div className="word-actions">
            <a href={merriamWebsterUrl} target="_blank" rel="noopener noreferrer" className="word-action-btn">
              <ArrowUpRightSquare />
            </a>
            <button 
              onClick={handleBookmarkClick} 
              className={`word-action-btn ${isBookmarked ? 'filled-bookmark' : 'unfilled-bookmark'}`}
            >
              <Bookmark />
            </button>
          </div>
        </motion.div>
      </Tilt>
    </div>
  );
};

const SavedWordsPage: React.FC = () => {
  const srs = useSpacedRepetition();
  const [savedWords, setSavedWords] = useState<WordWithSpacedRepetition[]>([]);

  useEffect(() => {
    if (!srs.isLoading) {
      setSavedWords(srs.service.getSavedWords());
      AOS.refresh();
    }
  }, [srs.isLoading, srs.service, srs.words]);

  const handleToggleBookmark = (wordToToggle: WordWithSpacedRepetition) => {
    srs.service.toggleBookmark(wordToToggle);
    // The component will now manage the visual state, no need to filter the list here
  };

  return (
    <>
      <Header variant="app" />
      <main className="saved-words-page">
        <div className="container">
          <h1 data-aos="fade-up">Saved Words</h1>
          {srs.isLoading ? (
            <p style={{ textAlign: 'center', color: '#fff' }}>Loading saved words...</p>
          ) : savedWords.length > 0 ? (
            <div className="saved-words-list">
              {savedWords.map((word, index) => (
                <SavedWordCard
                  key={word.word}
                  word={word}
                  onToggleBookmark={handleToggleBookmark}
                  index={index}
                  isInitiallyBookmarked={word.isBookmarked || false}
                />
              ))}
            </div>
          ) : (
            <p style={{ textAlign: 'center', color: '#fff' }}>You haven't saved any words yet.</p>
          )}
        </div>
      </main>
    </>
  );
};

export default SavedWordsPage; 