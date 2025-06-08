import React, { useState, useEffect } from 'react';
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
  originalWord?: WordWithSpacedRepetition;
}

const WordQuizGame: React.FC = () => {
  // States for the quiz
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);
  const [showExampleFor, setShowExampleFor] = useState<number | null>(null);
  const [usedWords, setUsedWords] = useState<Set<string>>(new Set());
  const [answeredCount, setAnsweredCount] = useState(0);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [responseStartTime, setResponseStartTime] = useState<number>(0);
  const [currentWord, setCurrentWord] = useState<WordWithSpacedRepetition | null>(null);

  // Get auth context
  const { isAuthenticated } = useAuth();
  
  // Get spaced repetition context
  const { service, words, isLoading, error: srError } = useSpacedRepetition();

  // Shuffle array (Fisher-Yates algorithm)
  const shuffleArray = <T,>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  // Setup quiz when context data is loaded
  useEffect(() => {
    if (!isLoading && words.length > 0) {
      setupQuiz();
    }
  }, [isLoading, words.length]);

  // Get random words excluding used ones and the current word
  const getRandomWords = (count: number, excludeWord?: string): WordWithSpacedRepetition[] => {
    const availableWords = words.filter(
      word => (!excludeWord || word.word !== excludeWord) && 
              !usedWords.has(word.word)
    );
    
    if (availableWords.length < count) {
      // If we don't have enough unused words, just exclude the current word
      return shuffleArray(words.filter(word => !excludeWord || word.word !== excludeWord))
        .slice(0, count);
    }
    
    return shuffleArray(availableWords).slice(0, count);
  };

  // Setup quiz with new question and answers
  const setupQuiz = () => {
    // Get a new word using the spaced repetition service
    const quizWords = service.selectWordsForQuiz(1);
    
    if (quizWords.length === 0) {
      console.error('No words available for quiz');
      return;
    }
    
    const selectedWord = quizWords[0];
    setCurrentWord(selectedWord);
    
    console.log(`Setting up quiz for word: ${selectedWord.word}`);
    
    // Reset states for the new quiz
    setShowHint(false);
    setHintUsed(false);
    setShowExampleFor(null);
    setResponseStartTime(Date.now());

    // Choose which synonym to use as the correct answer (randomly)
    // Or use the word itself if no synonyms are available
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
      
      correctWord = selectedWord[`synonym${synonymIndex}` as keyof WordWithSpacedRepetition] as string;
      correctDefinition = selectedWord[`synonym${synonymIndex}Definition` as keyof WordWithSpacedRepetition] as string;
      correctExample = selectedWord[`synonym${synonymIndex}ExampleSentence` as keyof WordWithSpacedRepetition] as string;
    } else {
      // No synonyms, use the word itself
      correctWord = selectedWord.word;
      correctDefinition = selectedWord.definition;
      correctExample = selectedWord.exampleSentence;
    }

    // Add current word to used set
    const newUsedWords = new Set(usedWords);
    newUsedWords.add(selectedWord.word);
    setUsedWords(newUsedWords);

    // Get 3 random incorrect words for options
    const incorrectWords = getRandomWords(3, selectedWord.word);
    
    // Create answer options
    let answerOptions: Answer[] = [
      {
        word: correctWord,
        definition: correctDefinition,
        exampleSentence: correctExample || 'No example available',
        isCorrect: true,
        originalWord: selectedWord
      },
      ...incorrectWords.map(word => ({
        word: word.word,
        definition: word.definition,
        exampleSentence: word.exampleSentence || 'No example available',
        isCorrect: false,
        originalWord: word
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
      const newWords = getRandomWords(4 - finalAnswers.length, selectedWord.word);
      
      for (const word of newWords) {
        if (!wordSet.has(word.word) && finalAnswers.length < 4) {
          wordSet.add(word.word);
          finalAnswers.push({
            word: word.word,
            definition: word.definition,
            exampleSentence: word.exampleSentence || 'No example available',
            isCorrect: false,
            originalWord: word
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
      
      // Calculate response time
      const responseTimeMs = Date.now() - responseStartTime;
      
      if (currentWord && answers[index]) {
        // Get whether the answer was correct
        const isCorrect = answers[index].isCorrect;
        
        // Update word stats in the spaced repetition service
        service.updateWordStats(
          currentWord,
          isCorrect,
          responseTimeMs,
          hintUsed
        );
        
        console.log(`Answer recorded: ${isCorrect ? 'correct' : 'incorrect'}, time: ${responseTimeMs}ms, hint: ${hintUsed}`);
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
    // Don't show sign-in modal if user is already authenticated
    if (answeredCount === 5 && !isAuthenticated) {
      setShowSignInModal(true);
    } else {
      setupQuiz();
    }
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

  if (isLoading) {
    return <div className="quiz-loading">Loading quiz questions...</div>;
  }

  if (srError) {
    return <div className="quiz-error">{srError}</div>;
  }
  
  if (!currentWord) {
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
              <p><strong>Hint:</strong> {currentWord.exampleSentence || 'No example available'}</p>
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