import React, { useState, useEffect } from 'react';
import '../styles/WordOfDay.css';
import WordQuiz from './WordQuiz';
import DictionaryService, { WordData } from '../services/DictionaryService';

const WordOfDay: React.FC = () => {
  const [wordData, setWordData] = useState<WordData | null>(null);
  const [previousWords, setPreviousWords] = useState<{ word: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showQuiz, setShowQuiz] = useState(false);

  useEffect(() => {
    const fetchWord = async () => {
      try {
        const data = await DictionaryService.getWordOfTheDay();
        setWordData(data);
        const prevWords = DictionaryService.getPreviousWords(5);
        setPreviousWords(prevWords);
      } catch (err) {
        setError("Failed to fetch word of the day. Please try again later.");
        console.error(err);
      }
    };

    fetchWord();
  }, []);

  // Generate Merriam-Webster dictionary URL for the current word
  const getMerriamWebsterUrl = (word: string) => {
    // Convert to lowercase and handle any spaces
    const formattedWord = word.toLowerCase().replace(/\s+/g, '-');
    return `https://www.merriam-webster.com/dictionary/${formattedWord}`;
  };
  
  // Open the quiz modal
  const handlePracticeQuiz = () => {
    setShowQuiz(true);
  };
  
  // Close the quiz modal
  const handleCloseQuiz = () => {
    setShowQuiz(false);
  };

  if (error) {
    return (
      <section className="word-of-day-section">
        <div className="container">
          <h1 className="section-title">Word of the Day</h1>
          <div className="word-of-day-card">
            <p>{error}</p>
          </div>
        </div>
      </section>
    );
  }
  
  if (!wordData) {
    return (
      <section className="word-of-day-section">
        <div className="container">
          <h1 className="section-title">Word of the Day</h1>
          <div className="word-of-day-card" style={{ alignItems: 'center', justifyContent: 'center' }}>
            <div className="loading-spinner"></div>
            <p>Loading word of the day...</p>
          </div>
        </div>
      </section>
    );
  }
  
  return (
    <section className="word-of-day-section">
      <div className="container">
        <h1 className="section-title">Word of the Day</h1>
        
        <div className="word-of-day-card loaded">
          <div className="word-header">
            <h2>{wordData.word}</h2>
            <p className="word-type"><em>{wordData.type}</em> | <span className="pronunciation">{wordData.pronunciation}</span></p>
          </div>
          
          <div className="word-content">
            <div className="definition-section">
              <h3>Definition</h3>
              <p>{wordData.definition}</p>
            </div>
            
            <div className="example-section">
              <h3>Example</h3>
              <p>"{wordData.example}"</p>
            </div>
            
            <div className="related-words">
              <div className="synonyms">
                <h3>Synonyms</h3>
                {wordData.synonyms.length > 0 ? (
                  <ul>
                    {wordData.synonyms.map((synonym, index) => (
                      <li key={index}>{synonym}</li>
                    ))}
                  </ul>
                ) : <p>No synonyms found.</p>}
              </div>
              
              <div className="antonyms">
                <h3>Antonyms</h3>
                {wordData.antonyms.length > 0 ? (
                <ul>
                  {wordData.antonyms.map((antonym, index) => (
                    <li key={index}>{antonym}</li>
                  ))}
                </ul>
                ) : <p>No antonyms found.</p>}
              </div>
            </div>
          </div>
          
          <div className="word-actions">
            <a 
              href={getMerriamWebsterUrl(wordData.word)} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="primary-btn"
            >
              View Context
            </a>
            <button className="secondary-btn" onClick={handlePracticeQuiz}>
              Practice Quiz
            </button>
          </div>
        </div>
        
        <div className="previous-words">
          <h3>Previous Words</h3>
          <div className="word-list">
            {previousWords.map((pword, index) => (
              <div className="word-item" key={index}>{pword.word}</div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Render the quiz modal when showQuiz is true */}
      {showQuiz && (
        <WordQuiz
          word={wordData.word}
          partOfSpeech={wordData.type}
          onClose={handleCloseQuiz}
        />
      )}
    </section>
  );
};

export default WordOfDay;