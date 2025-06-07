import React, { useState, useEffect } from 'react';
import '../styles/WordQuizGame.css';
import { useAuth } from '../services/AuthContext';
import EmailSignIn from './EmailSignIn';

interface Word {
  word: string;
  definition: string;
  exampleSentence: string;
  synonym1: string;
  synonym1Definition: string;
  synonym1ExampleSentence: string;
  synonym2: string;
  synonym2Definition: string;
  synonym2ExampleSentence: string;
  synonym3: string;
  synonym3Definition: string;
  synonym3ExampleSentence: string;
  category: string;
}

interface Answer {
  word: string;
  definition: string;
  exampleSentence: string;
  isCorrect: boolean;
}

const WordQuizGame: React.FC = () => {
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);
  const [showExampleFor, setShowExampleFor] = useState<number | null>(null);
  const [usedWords, setUsedWords] = useState<Set<string>>(new Set());
  const [answeredCount, setAnsweredCount] = useState(0);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [showEmailSignIn, setShowEmailSignIn] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Get auth context
  const { signIn, isAuthenticated } = useAuth();

  // Shuffle array (Fisher-Yates algorithm)
  const shuffleArray = <T,>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  // Load words from JSON file
  useEffect(() => {
    const fetchWords = async () => {
      try {
        const response = await fetch('/words.json');
        if (!response.ok) {
          throw new Error('Failed to fetch words');
        }
        const data = await response.json();
        // Shuffle the words array to randomize questions
        setWords(shuffleArray(data));
        setLoading(false);
      } catch (err) {
        setError('Failed to load word list. Please try again later.');
        setLoading(false);
      }
    };

    fetchWords();
  }, []);

  // Setup quiz when words are loaded
  useEffect(() => {
    if (words.length > 0) {
      setupQuiz(currentWordIndex);
    }
  }, [words, currentWordIndex]);

  // Get random words excluding used ones and the current word
  const getRandomWords = (count: number, excludeWord: string): Word[] => {
    const availableWords = words.filter(
      word => word.word !== excludeWord && 
              !usedWords.has(word.word) && 
              word.category === words[currentWordIndex].category
    );
    
    if (availableWords.length < count) {
      // If we don't have enough unused words, just exclude the current word
      return shuffleArray(words.filter(word => word.word !== excludeWord))
        .slice(0, count);
    }
    
    return shuffleArray(availableWords).slice(0, count);
  };

  // Setup quiz with new question and answers
  const setupQuiz = (wordIndex: number) => {
    if (wordIndex >= words.length) {
      setError('You have completed all available words!');
      return;
    }

    const currentWord = words[wordIndex];
    setShowHint(false);
    setHintUsed(false);
    setShowExampleFor(null);

    // Choose which synonym to use as the correct answer (randomly)
    const synonymIndex = Math.floor(Math.random() * 3) + 1;
    const correctSynonym = currentWord[`synonym${synonymIndex}` as keyof Word] as string;
    const correctDefinition = currentWord[`synonym${synonymIndex}Definition` as keyof Word] as string;
    const correctExample = currentWord[`synonym${synonymIndex}ExampleSentence` as keyof Word] as string;

    // Add current word to used set
    const newUsedWords = new Set(usedWords);
    newUsedWords.add(currentWord.word);
    setUsedWords(newUsedWords);

    // Get 3 random incorrect words for options
    const incorrectWords = getRandomWords(3, currentWord.word);
    
    // Create answer options
    let answerOptions: Answer[] = [
      {
        word: correctSynonym,
        definition: correctDefinition,
        exampleSentence: correctExample,
        isCorrect: true
      },
      ...incorrectWords.map(word => ({
        word: word.word,
        definition: word.definition,
        exampleSentence: word.exampleSentence,
        isCorrect: false
      }))
    ];

    // Shuffle the answers
    answerOptions = shuffleArray(answerOptions);
    
    // Make sure there are no duplicates in the answer options
    const wordSet = new Set<string>();
    const finalAnswers: Answer[] = [];
    
    for (const option of answerOptions) {
      if (!wordSet.has(option.word)) {
        wordSet.add(option.word);
        finalAnswers.push(option);
      }
    }
    
    // If we lost some answers due to duplicates, add more random words
    while (finalAnswers.length < 4) {
      const newWords = getRandomWords(4 - finalAnswers.length, currentWord.word);
      
      for (const word of newWords) {
        if (!wordSet.has(word.word) && finalAnswers.length < 4) {
          wordSet.add(word.word);
          finalAnswers.push({
            word: word.word,
            definition: word.definition,
            exampleSentence: word.exampleSentence,
            isCorrect: false
          });
        }
      }
    }
    
    setAnswers(finalAnswers);
    setSelectedAnswer(null);
  };

  // Handle answer selection
  const handleAnswerClick = (index: number) => {
    if (selectedAnswer !== null) {
      // If an answer is already selected, show the definition for the clicked answer
      setShowExampleFor(showExampleFor === index ? null : index);
    } else {
      // First time selecting an answer
      setSelectedAnswer(index);
      setAnsweredCount(prevCount => prevCount + 1);
    }
  };

  // Handle hint button click
  const handleHintClick = () => {
    setShowHint(true);
    setHintUsed(true);
  };

  // Move to next question
  const handleNextQuestion = () => {
    // Don't show sign-in modal if user is already authenticated
    if (answeredCount === 5 && !isAuthenticated) {
      setShowSignInModal(true);
    } else {
      setCurrentWordIndex(prevIndex => prevIndex + 1);
    }
  };

  // Handle continuing without sign-in
  const handleContinueWithoutSignIn = () => {
    setShowSignInModal(false);
    setCurrentWordIndex(prevIndex => prevIndex + 1);
  };

  // Handle Google sign-in
  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      await signIn.withGoogle();
      setShowSignInModal(false);
      setCurrentWordIndex(prevIndex => prevIndex + 1);
    } catch (error: any) {
      setAuthError(error.message || 'Failed to sign in with Google');
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle showing email sign-in form
  const handleShowEmailSignIn = () => {
    setShowEmailSignIn(true);
  };

  // Handle successful authentication
  const handleAuthSuccess = () => {
    setShowEmailSignIn(false);
    setShowSignInModal(false);
    setCurrentWordIndex(prevIndex => prevIndex + 1);
  };

  // Handle email sign-in cancel
  const handleEmailSignInCancel = () => {
    setShowEmailSignIn(false);
  };

  // Handle example click
  const handleExampleClick = (index: number) => {
    setShowExampleFor(showExampleFor === index ? null : index);
  };

  if (loading) {
    return <div className="quiz-loading">Loading quiz questions...</div>;
  }

  if (error) {
    return <div className="quiz-error">{error}</div>;
  }

  const currentWord = words[currentWordIndex];

  return (
    <div className="word-quiz-game">
      {showSignInModal && (
        <div className="modal-overlay">
          <div className="sign-in-modal">
            {showEmailSignIn ? (
              <EmailSignIn 
                onSuccess={handleAuthSuccess} 
                onCancel={handleEmailSignInCancel} 
              />
            ) : (
              <>
                <h2>Save Your Progress</h2>
                <p>Sign in to track your learning progress and save your stats!</p>
                
                {authError && <div className="auth-error">{authError}</div>}
                
                <div className="sign-in-options">
                  <button 
                    className="google-sign-in" 
                    onClick={handleGoogleSignIn}
                    disabled={authLoading}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512" width="20" height="20">
                      <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"/>
                    </svg>
                    {authLoading ? 'Signing in...' : 'Sign in with Google'}
                  </button>
                  <button 
                    className="email-sign-in"
                    onClick={handleShowEmailSignIn}
                    disabled={authLoading}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="20" height="20">
                      <path fill="currentColor" d="M48 64C21.5 64 0 85.5 0 112c0 15.1 7.1 29.3 19.2 38.4L236.8 313.6c11.4 8.5 27 8.5 38.4 0L492.8 150.4c12.1-9.1 19.2-23.3 19.2-38.4c0-26.5-21.5-48-48-48H48zM0 176V384c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V176L294.4 339.2c-22.8 17.1-54 17.1-76.8 0L0 176z"/>
                    </svg>
                    Sign in with Email
                  </button>
                  <button 
                    className="skip-sign-in" 
                    onClick={handleContinueWithoutSignIn}
                    disabled={authLoading}
                  >
                    No thanks, continue as guest
                  </button>
                </div>
                <p className="sign-in-note">We'll never post without your permission.</p>
              </>
            )}
          </div>
        </div>
      )}

      <div className="quiz-container">
        <div className="question-section">
          <h2 className="question-word">{currentWord.word}</h2>
          {selectedAnswer !== null && (
            <p className="word-definition">{currentWord.definition}</p>
          )}
          <p className="question-prompt">Which word is a synonym for this?</p>
          
          {showHint && (
            <div className="hint-box">
              <p><strong>Hint:</strong> {currentWord.exampleSentence}</p>
            </div>
          )}
          
          {!showHint && !selectedAnswer && (
            <button 
              className={`hint-button ${hintUsed ? 'used' : ''}`} 
              onClick={handleHintClick}
              disabled={hintUsed}
              aria-label="Show hint"
            >
              <img src="/images/lightbulb-solid.svg" alt="Hint" />
            </button>
          )}
        </div>
        
        <div className="answers-section">
          {answers.map((answer, index) => (
            <div 
              key={index} 
              className="answer-container"
              style={{ '--index': index } as React.CSSProperties}
            >
              <button
                className={`answer-button ${
                  selectedAnswer !== null
                    ? answer.isCorrect
                      ? 'correct'
                      : selectedAnswer === index
                        ? 'incorrect'
                        : ''
                    : ''
                }`}
                onClick={() => handleAnswerClick(index)}
              >
                {answer.word}
              </button>
              
              {(selectedAnswer !== null || showExampleFor === index) && (
                <div className="answer-details">
                  <p className="answer-definition">{answer.definition}</p>
                  {showExampleFor === index ? (
                    <p className="example-sentence">{answer.exampleSentence}</p>
                  ) : (
                    <button 
                      className="example-button"
                      onClick={() => handleExampleClick(index)}
                    >
                      Example
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        
        {selectedAnswer !== null && (
          <button className="next-button" onClick={handleNextQuestion}>
            Next
          </button>
        )}
      </div>
    </div>
  );
};

export default WordQuizGame; 