import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import '../styles/Hero.css';

// Sample words for the animated word card
const wordsList = [
  {
    word: 'Chiaroscuro',
    type: 'noun',
    pronunciation: 'kee-ah-roh-SKYOOR-oh',
    definition: 'A visual effect created by strong contrasts between light and dark'
  },
  {
    word: 'Ephemeral',
    type: 'adjective',
    pronunciation: 'ih-FEM-er-ul',
    definition: 'Lasting for a very short time'
  },
  {
    word: 'Serendipity',
    type: 'noun',
    pronunciation: 'ser-uhn-DIP-i-tee',
    definition: 'The occurrence of events by chance in a happy or beneficial way'
  },
  {
    word: 'Mellifluous',
    type: 'adjective',
    pronunciation: 'muh-LIF-loo-us',
    definition: 'Sweet or musical; pleasant to hear'
  },
  {
    word: 'Ubiquitous',
    type: 'adjective',
    pronunciation: 'yoo-BIK-wuh-tus',
    definition: 'Present, appearing, or found everywhere'
  }
];

const Hero: React.FC = () => {
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimating(true);
      
      // Change word after animation starts
      setTimeout(() => {
        setCurrentWordIndex((prevIndex) => (prevIndex + 1) % wordsList.length);
        
        // Reset animation
        setTimeout(() => {
          setIsAnimating(false);
        }, 500);
      }, 500);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const currentWord = wordsList[currentWordIndex];

  return (
    <section className="hero" id="hero">
      <div className="container hero-container">
        <div className="hero-content" data-aos="fade-right">
          <h1>Boost Your Vocabulary. Now. <span className="gradient-text">Press Play</span></h1>
          <p className="subtitle">Press play to get started. Or see today's word. Android app available.</p>
          <div className="cta-buttons">
            <Link to="/quiz" className="primary-btn play-now-btn" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
              <span>Play Now</span>
            </Link>
            <Link to="/word-of-day" className="secondary-btn">See Today's Word</Link>
          </div>
        </div>

        <div className="hero-image" data-aos="fade-up">
          <div className="phone-mockup">
            <div className="phone-frame">
              <div className="app-screenshot">
                <div className="app-content">
                  <div className={`word-card ${isAnimating ? 'animate' : ''}`}>
                    <h3>Today's Word</h3>
                    <h2>{currentWord.word.toLowerCase()}</h2>
                    <p><span className="pronunciation">{currentWord.pronunciation}</span></p>
                    <p className="definition">{currentWord.definition}</p>
                    <div className="bookmark-button">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero; 