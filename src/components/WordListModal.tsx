import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bookmark, ArrowUpRightSquare } from 'lucide-react';
import { WordWithSpacedRepetition } from '../services/SpacedRepetitionService';
import { useSpacedRepetition } from '../services/SpacedRepetitionContext';
import '../styles/WordListModal.css';

interface WordListModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  words: WordWithSpacedRepetition[];
}

const WordListModal: React.FC<WordListModalProps> = ({ isOpen, onClose, title, words }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredWords, setFilteredWords] = useState(words);
  const { service } = useSpacedRepetition();
  const [bookmarkedWords, setBookmarkedWords] = useState<Set<string>>(
    new Set(service.getSavedWords().map(w => w.word))
  );

  useEffect(() => {
    setFilteredWords(
      words.filter(word =>
        word.word.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [searchTerm, words]);

  const handleToggleBookmark = (word: WordWithSpacedRepetition) => {
    service.toggleBookmark(word);
    const newBookmarkedWords = new Set(bookmarkedWords);
    if (newBookmarkedWords.has(word.word)) {
      newBookmarkedWords.delete(word.word);
    } else {
      newBookmarkedWords.add(word.word);
    }
    setBookmarkedWords(newBookmarkedWords);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.3, ease: "easeOut" } }}
          onClick={onClose}
        >
          <motion.div
            className="modal-content"
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1, transition: { type: 'spring', damping: 20, stiffness: 200 } }}
            exit={{ y: 50, opacity: 0, transition: { duration: 0.3, ease: "easeOut" } }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 className="modal-title">{title}</h2>
              <input
                type="text"
                placeholder="Search words..."
                className="modal-search-bar"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <button className="modal-close-btn" onClick={onClose}>
                <X size={24} />
              </button>
            </div>
            <div className="modal-word-list">
              {filteredWords.length > 0 ? (
                filteredWords.map((word, index) => (
                  <motion.div
                    key={word.word}
                    className="modal-word-item"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <div className="modal-word-details">
                      <span className="modal-word">{word.word}</span>
                      <span className="modal-definition">{word.definition}</span>
                    </div>
                    <div className="modal-word-actions">
                      <a
                        href={`https://www.merriam-webster.com/dictionary/${encodeURIComponent(word.word)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="modal-action-btn"
                      >
                        <ArrowUpRightSquare size={18} />
                      </a>
                      <button className="modal-action-btn" onClick={() => handleToggleBookmark(word)}>
                        <Bookmark size={18} fill={bookmarkedWords.has(word.word) ? 'currentColor' : 'none'} />
                      </button>
                    </div>
                  </motion.div>
                ))
              ) : (
                <p style={{ color: '#a0a0a0', textAlign: 'center', padding: '20px 0' }}>
                  No words match your search.
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default WordListModal; 