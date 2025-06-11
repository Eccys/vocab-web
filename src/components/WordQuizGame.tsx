import React, { useState, useEffect, useCallback } from 'react';
import '../styles/WordQuizGame.css';
import { useAuth } from '../services/AuthContext';
import { useSpacedRepetition } from '../services/SpacedRepetitionContext';
import AuthModal from './AuthModal';
import { WordWithSpacedRepetition } from '../services/SpacedRepetitionService';

interface Answer {
  word: string;
  definition: string;
  exampleSentence: string;
  isCorrect: boolean;
}

interface Word extends WordWithSpacedRepetition {
  //This interface already has all needed fields from WordWithSpacedRepetition
}

const WordQuizGame: React.FC = () => {
  // States for the quiz
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);
  const [showExampleFor, setShowExampleFor] = useState<number | null>(null);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [responseStartTime, setResponseStartTime] = useState<number>(0);
  const [currentWord, setCurrentWord] = useState<Word | null>(null);

  // Get auth and spaced repetition context. This is the single source of truth for words and loading state.
  const { isAuthenticated, loading: authLoading } = useAuth();
  const srs = useSpacedRepetition();

  // Add a new useEffect to handle auth state changes gracefully
  useEffect(() => {
    // When auth state changes, reset the current word.
    // This will trigger the setupQuiz effect to run again with the new word source from the context.
    setCurrentWord(null);
  }, [isAuthenticated]);

  // Memoize the shuffle function to avoid recreating it on every render
  const shuffleArray = useCallback(<T,>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  }, []);

  // Setup quiz with a random word
  const setupQuiz = useCallback(() => {
    let selectedWord: Word | null = null;
    let wordSource = srs.words;

    if (isAuthenticated) {
      if (srs.words.length === 0) {
        // Data is not ready, simply exit. The loading screen will remain.
        return;
      }
      wordSource = srs.words;
      // Logged-in user: use spaced repetition to select a word
      const candidateWords = srs.service.selectWordsForQuiz(3);
      if (candidateWords.length > 0) {
        const randomIndex = Math.floor(Math.random() * candidateWords.length);
        selectedWord = candidateWords[randomIndex];
      } else {
        // Fallback to a random word if no candidates
        const randomIndex = Math.floor(Math.random() * srs.words.length);
        selectedWord = srs.words[randomIndex];
      }
    } else {
      // Guest user: get a random word
      if (srs.words.length === 0) return;
      const randomIndex = Math.floor(Math.random() * srs.words.length);
      selectedWord = srs.words[randomIndex];
    }

    if (!selectedWord) {
      // Could not select a word, which can happen if words are empty.
      // Exit without changing state to prevent flicker.
      return;
    }

    setCurrentWord(selectedWord);
    
    // Reset states for the new quiz
    setShowHint(false);
    setHintUsed(false);
    setShowExampleFor(null);
    setResponseStartTime(Date.now());

    // Choose which synonym to use as the correct answer
    const hasSynonyms = selectedWord.synonym1 || selectedWord.synonym2 || selectedWord.synonym3;
    
    let correctWord: string;
    let correctDefinition: string;
    let correctExample: string | undefined;
    
    if (hasSynonyms) {
      // Find which synonyms are available
      const availableSynonyms: number[] = [];
      if (selectedWord.synonym1) availableSynonyms.push(1);
      if (selectedWord.synonym2) availableSynonyms.push(2);
      if (selectedWord.synonym3) availableSynonyms.push(3);
      
      // Randomly pick one
      const synonymIndex = availableSynonyms[Math.floor(Math.random() * availableSynonyms.length)];
      
      correctWord = selectedWord[`synonym${synonymIndex}` as keyof Word] as string;
      correctDefinition = selectedWord[`synonym${synonymIndex}Definition` as keyof Word] as string;
      correctExample = selectedWord[`synonym${synonymIndex}ExampleSentence` as keyof Word] as string;
    } else {
      // No synonyms, use the word itself
      correctWord = selectedWord.word;
      correctDefinition = selectedWord.definition;
      correctExample = selectedWord.exampleSentence;
    }

    // Generate wrong answers from other words
    const wrongAnswers: Answer[] = [];
    const wordsToExclude = new Set<string>([selectedWord.word, correctWord]);

    // 1. Prioritize words from the same category
    const sameCategoryCandidates = wordSource.filter(
      (word) => word.category === selectedWord.category && !wordsToExclude.has(word.word)
    );
    const shuffledSameCategory = shuffleArray(sameCategoryCandidates);

    for (const wrongWord of shuffledSameCategory) {
      if (wrongAnswers.length >= 3) break;
      wrongAnswers.push({
        word: wrongWord.word,
        definition: wrongWord.definition,
        exampleSentence: wrongWord.exampleSentence || 'No example available',
        isCorrect: false,
      });
      wordsToExclude.add(wrongWord.word);
    }

    // 2. If not enough, fill with words from any category to ensure we have 4 options
    if (wrongAnswers.length < 3) {
      const otherCategoryCandidates = wordSource.filter(
        (word) => !wordsToExclude.has(word.word)
      );
      const shuffledOtherCategory = shuffleArray(otherCategoryCandidates);

      for (const wrongWord of shuffledOtherCategory) {
        if (wrongAnswers.length >= 3) break;
        wrongAnswers.push({
          word: wrongWord.word,
          definition: wrongWord.definition,
          exampleSentence: wrongWord.exampleSentence || 'No example available',
          isCorrect: false,
        });
        wordsToExclude.add(wrongWord.word);
      }
    }

    // Create answer options with the correct answer
    let answerOptions: Answer[] = [
      {
        word: correctWord,
        definition: correctDefinition,
        exampleSentence: correctExample || 'No example available',
        isCorrect: true
      },
      ...wrongAnswers
    ];

    // Shuffle the answers
    answerOptions = shuffleArray(answerOptions);
    setAnswers(answerOptions);
    setSelectedAnswer(null);
  }, [shuffleArray, isAuthenticated, srs.service, srs.words]);
        
  // Initialize quiz once words are loaded, and only if no quiz is active
  useEffect(() => {
    // Only set up the quiz if data is loaded from the context and there's no word currently displayed.
    // This prevents re-running the setup unnecessarily and causing word flickering.
    if (!srs.isLoading && srs.words.length > 0 && !currentWord) {
    setupQuiz();
    }
  }, [setupQuiz, srs.isLoading, srs.words, currentWord]);

  // Handle answer selection
  const handleAnswerClick = (index: number) => {
    if (selectedAnswer !== null) {
      // If an answer is already selected, show the definition for the clicked answer
      setShowExampleFor(showExampleFor === index ? null : index);
    } else {
      // First time selecting an answer
      setSelectedAnswer(index);
      setAnsweredCount(prevCount => prevCount + 1);

      if (isAuthenticated && currentWord) {
        const isCorrect = answers[index].isCorrect;
        const responseTimeMs = Date.now() - responseStartTime;
        srs.service.updateWordStats(currentWord, isCorrect, responseTimeMs, hintUsed);
      }
    }
  };

  // Handle hint button click
  const handleHintClick = () => {
    setShowHint(true);
    setHintUsed(true);
  };

  // Move to next question
  const handleNextQuestion = () => {
    // Just setup a new quiz without showing sign-in modal
    setupQuiz();
  };

  // Handle continuing without sign-in (used by AuthModal)
  const handleContinueWithoutSignIn = () => {
    setShowSignInModal(false);
    setupQuiz();
  };

  // Handle auth success (used by AuthModal)
  const handleAuthSuccess = () => {
    setShowSignInModal(false);
    setupQuiz();
  };

  // Handle example click
  const handleExampleClick = (index: number) => {
    setShowExampleFor(showExampleFor === index ? null : index);
  };

  // Show loading state while authenticating
  if (authLoading) {
    return <div className="quiz-loading">Authenticating...</div>;
  }

  // Show loading state while fetching words from the context
  if (srs.isLoading || !currentWord) {
    return <div className="quiz-loading">Preparing quiz questions...</div>;
  }

  return (
    <div className="word-quiz-game">
      {/* Authentication Modal */}
      <AuthModal 
        isOpen={showSignInModal}
        onSuccess={handleAuthSuccess}
        onCancel={handleContinueWithoutSignIn}
      />

      <div className="quiz-container">
        <div className="question-section">
          <h2 className="question-word">{currentWord.word}</h2>
          {selectedAnswer !== null && (
            <p className="word-definition">{currentWord.definition}</p>
          )}
          <p className="question-prompt">Which word is a synonym for this?</p>
          
          {showHint && (
            <div className="hint-box">
              <p><strong>Hint:</strong> {currentWord.exampleSentence && currentWord.exampleSentence.trim() ? currentWord.exampleSentence : 'No example available'}</p>
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

export default React.memo(WordQuizGame); 