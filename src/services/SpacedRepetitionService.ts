import { getFirestoreInstance } from './FirestoreConfig';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// Word with spaced repetition data
export interface WordWithSpacedRepetition {
  word: string;
  definition: string;
  exampleSentence?: string;
  category?: string;
  synonym1?: string;
  synonym1Definition?: string;
  synonym1ExampleSentence?: string;
  synonym2?: string;
  synonym2Definition?: string;
  synonym2ExampleSentence?: string;
  synonym3?: string;
  synonym3Definition?: string;
  synonym3ExampleSentence?: string;
  
  // Spaced repetition fields
  easeFactor: number;
  interval: number; // in days
  repetitionCount: number;
  lastReviewDate: number; // timestamp in ms
  nextReviewDate: number; // timestamp in ms
  timesReviewed: number;
  correctCount: number;
  incorrectCount: number;
}

// Word data as stored in Firestore map
interface FirestoreWordData {
  definition?: string;
  exampleSentence?: string;
  category?: string;
  synonym1?: string;
  synonym1Definition?: string;
  synonym1ExampleSentence?: string;
  synonym2?: string;
  synonym2Definition?: string;
  synonym2ExampleSentence?: string;
  synonym3?: string;
  synonym3Definition?: string;
  synonym3ExampleSentence?: string;
  easeFactor?: number;
  interval?: number;
  repetitionCount?: number;
  lastReviewed?: number;
  nextReviewDate?: number;
  timesReviewed?: number;
  timesCorrect?: number;
  quality?: number;
  isBookmarked?: boolean;
  lastUpdated?: number;
}

// Quality score constants
export const QUALITY_SCORE = {
  COMPLETE_FAIL: 0,
  INCORRECT_NO_SUCCESS: 1,
  INCORRECT_PREVIOUS_SUCCESS: 2,
  CORRECT_SLOW: 3,
  CORRECT_MEDIUM: 4,
  CORRECT_FAST: 5,
};

// Response time thresholds in ms
const RESPONSE_TIME = {
  FAST: 3000,   // less than 3s is fast
  MEDIUM: 5000, // 3-5s is medium
  SLOW: 30000,  // >5s is slow (cap at 30s to handle distractions)
};

export class SpacedRepetitionService {
  private userId: string | null = null;
  private words: WordWithSpacedRepetition[] = [];
  private wordsMap: Record<string, FirestoreWordData> = {};
  private isLoaded = false;
  private pendingChanges: Record<string, FirestoreWordData> = {};
  private lastSyncTime = 0;
  private syncTimer: NodeJS.Timeout | null = null;
  private settings = {
    enabled: true,
  };

  constructor() {
    // Set up auto-sync before user leaves the page
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this.syncOnBeforeUnload);
    }
  }

  // Clean up event listener
  public cleanup() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this.syncOnBeforeUnload);
    }
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }
  }

  private syncOnBeforeUnload = () => {
    // Force sync when user is about to leave
    if (Object.keys(this.pendingChanges).length > 0) {
      this.syncChanges(true);
    }
  };

  // Set the current user ID
  public setUserId(userId: string) {
    this.userId = userId;
    this.loadWords(); // Load words when user ID is set
  }

  // Set settings
  public setSettings(settings: { enabled: boolean }) {
    this.settings = settings;
  }

  // Convert from Firestore map format to our internal format
  private convertToWordWithSpacedRepetition(wordId: string, data: FirestoreWordData): WordWithSpacedRepetition {
    return {
      word: wordId,
      definition: data.definition || '',
      exampleSentence: data.exampleSentence || '',
      category: data.category || '',
      synonym1: data.synonym1 || '',
      synonym1Definition: data.synonym1Definition || '',
      synonym1ExampleSentence: data.synonym1ExampleSentence || '',
      synonym2: data.synonym2 || '',
      synonym2Definition: data.synonym2Definition || '',
      synonym2ExampleSentence: data.synonym2ExampleSentence || '',
      synonym3: data.synonym3 || '',
      synonym3Definition: data.synonym3Definition || '',
      synonym3ExampleSentence: data.synonym3ExampleSentence || '',
      
      // Spaced repetition fields
      easeFactor: data.easeFactor || 2.5,
      interval: data.interval || 0,
      repetitionCount: data.repetitionCount || 0,
      lastReviewDate: data.lastReviewed || 0,
      nextReviewDate: data.nextReviewDate || 0,
      timesReviewed: data.timesReviewed || 0,
      correctCount: data.timesCorrect || 0,
      incorrectCount: (data.timesReviewed || 0) - (data.timesCorrect || 0),
    };
  }

  // Convert from our internal format to Firestore map format
  private convertToFirestoreWordData(word: WordWithSpacedRepetition): FirestoreWordData {
    return {
      definition: word.definition,
      exampleSentence: word.exampleSentence,
      category: word.category,
      synonym1: word.synonym1,
      synonym1Definition: word.synonym1Definition,
      synonym1ExampleSentence: word.synonym1ExampleSentence,
      synonym2: word.synonym2,
      synonym2Definition: word.synonym2Definition,
      synonym2ExampleSentence: word.synonym2ExampleSentence,
      synonym3: word.synonym3,
      synonym3Definition: word.synonym3Definition,
      synonym3ExampleSentence: word.synonym3ExampleSentence,
      
      // Spaced repetition fields
      easeFactor: word.easeFactor,
      interval: word.interval,
      repetitionCount: word.repetitionCount,
      lastReviewed: word.lastReviewDate,
      nextReviewDate: word.nextReviewDate,
      timesReviewed: word.timesReviewed,
      timesCorrect: word.correctCount,
      
      // Additional fields
      lastUpdated: Date.now(),
    };
  }

  // Load words from Firestore
  public async loadWords(): Promise<WordWithSpacedRepetition[]> {
    if (!this.userId) {
      console.error('User ID not set');
      return [];
    }

    try {
      console.log('Loading words for spaced repetition...');
      const db = await getFirestoreInstance();
      
      // Get the user document - words are stored directly in this document as a map
      const userDocRef = doc(db, `users/${this.userId}`);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        
        // Check if the user has words stored in the document as a map
        if (userData && userData.words && typeof userData.words === 'object') {
          this.wordsMap = userData.words;
          
          // Convert map to array format for internal use
          this.words = Object.entries(userData.words).map(
            ([wordId, wordData]) => this.convertToWordWithSpacedRepetition(wordId, wordData as FirestoreWordData)
          );
          
          console.log(`Loaded ${this.words.length} words from user document (map format)`);
        } else {
          console.log('No words map found in user document, initializing empty');
          this.words = [];
          this.wordsMap = {};
        }
      } else {
        console.log('User document does not exist, initializing empty words');
        this.words = [];
        this.wordsMap = {};
      }
      
      this.isLoaded = true;
      return this.words;
    } catch (error) {
      console.error('Error loading words:', error);
      return [];
    }
  }

  // Select words for quiz based on spaced repetition algorithm
  public selectWordsForQuiz(count: number, excludeWord?: string): WordWithSpacedRepetition[] {
    if (!this.isLoaded || this.words.length === 0) {
      console.warn('Words not loaded for spaced repetition');
      return [];
    }
    
    const currentTime = Date.now();
    
    // Filter out the word to exclude, if any
    const availableWords = excludeWord 
      ? this.words.filter(word => word.word !== excludeWord)
      : this.words;
      
    if (availableWords.length === 0) return [];
    
    if (!this.settings.enabled) {
      // If spaced repetition is disabled, select random words
      return this.getRandomWords(availableWords, count);
    }
    
    // 1. Overdue words (calculate overdue ratio)
    const overdueWords = availableWords
      .filter(word => word.nextReviewDate > 0 && word.nextReviewDate <= currentTime)
      .map(word => {
        const interval = Math.max(1, word.interval);
        const overdueRatio = (currentTime - word.nextReviewDate) / (interval * 86400000);
        return { word, overdueRatio };
      })
      .sort((a, b) => b.overdueRatio - a.overdueRatio)
      .map(item => item.word);
    
    if (overdueWords.length > 0) {
      console.log(`Found ${overdueWords.length} overdue words`);
      // Return top overdue words, or a random selection from top 3 if more than count
      if (overdueWords.length <= count) {
        return overdueWords;
      } else {
        // For better learning, select randomly from top 3 most overdue
        const topOverdue = overdueWords.slice(0, Math.min(3, overdueWords.length));
        return this.getRandomWords(topOverdue, count);
      }
    }
    
    // 2. Unseen words (if no overdue words)
    const unseenWords = availableWords.filter(word => word.timesReviewed === 0);
    
    if (unseenWords.length > 0) {
      console.log(`Found ${unseenWords.length} unseen words`);
      return this.getRandomWords(unseenWords, count);
    }
    
    // 3. Random selection (last resort)
    console.log('No overdue or unseen words, selecting randomly');
    return this.getRandomWords(availableWords, count);
  }

  // Calculate quality score based on user's answer
  public calculateQualityScore(
    isCorrect: boolean,
    responseTimeMs: number,
    usedHint: boolean,
    repetitionCount: number
  ): number {
    if (usedHint) {
      return isCorrect 
        ? QUALITY_SCORE.INCORRECT_PREVIOUS_SUCCESS // with hint & correct: 2
        : QUALITY_SCORE.COMPLETE_FAIL;             // with hint & incorrect: 0
    }
    
    if (isCorrect) {
      if (responseTimeMs < RESPONSE_TIME.FAST) {
        return QUALITY_SCORE.CORRECT_FAST;     // no hint, correct & fast: 5
      } else if (responseTimeMs < RESPONSE_TIME.MEDIUM) {
        return QUALITY_SCORE.CORRECT_MEDIUM;   // no hint, correct & medium: 4
      } else {
        return QUALITY_SCORE.CORRECT_SLOW;     // no hint, correct & slow: 3
      }
    } else {
      return repetitionCount > 0
        ? QUALITY_SCORE.INCORRECT_PREVIOUS_SUCCESS // incorrect but had success before: 2
        : QUALITY_SCORE.INCORRECT_NO_SUCCESS;      // incorrect with no previous success: 1
    }
  }

  // Update word stats based on answer
  public updateWordStats(
    word: WordWithSpacedRepetition,
    isCorrect: boolean,
    responseTimeMs: number,
    usedHint: boolean
  ): WordWithSpacedRepetition {
    const qualityScore = this.calculateQualityScore(
      isCorrect, 
      responseTimeMs, 
      usedHint, 
      word.repetitionCount
    );
    
    const currentTime = Date.now();
    
    // Update common stats
    let updatedWord = {
      ...word,
      timesReviewed: word.timesReviewed + 1,
      lastReviewDate: currentTime
    };
    
    if (isCorrect) {
      updatedWord.correctCount = (updatedWord.correctCount || 0) + 1;
    } else {
      updatedWord.incorrectCount = (updatedWord.incorrectCount || 0) + 1;
    }
    
    if (this.settings.enabled) {
      // Calculate new ease factor
      const adjustment = 0.1 - (5 - qualityScore) * (0.08 + (5 - qualityScore) * 0.02);
      const newEaseFactor = Math.max(1.3, updatedWord.easeFactor + adjustment);
      
      // Update interval using SM-2 algorithm
      let newInterval: number;
      let newRepetitionCount: number;
      
      if (!isCorrect || qualityScore < 2) {
        // Reset for incorrect answers
        newInterval = 1;
        newRepetitionCount = 0;
      } else {
        // Update for correct answers
        if (updatedWord.repetitionCount === 0) {
          newInterval = 1; // First successful repetition
        } else if (updatedWord.repetitionCount === 1) {
          newInterval = 3; // Second successful repetition
        } else {
          newInterval = updatedWord.interval * newEaseFactor; // Subsequent repetitions
        }
        newRepetitionCount = updatedWord.repetitionCount + 1;
      }
      
      // Calculate next review date
      const nextReviewDate = currentTime + (newInterval * 86400000);
      
      // Update word with spaced repetition data
      updatedWord = {
        ...updatedWord,
        easeFactor: newEaseFactor,
        interval: newInterval,
        repetitionCount: newRepetitionCount,
        nextReviewDate: nextReviewDate
      };
    }
    
    // Convert to Firestore format and save to pending changes
    this.pendingChanges[word.word] = this.convertToFirestoreWordData(updatedWord);
    
    // Update in-memory array for consistency
    const index = this.words.findIndex(w => w.word === word.word);
    if (index >= 0) {
      this.words[index] = updatedWord;
    } else {
      this.words.push(updatedWord);
    }
    
    // Schedule sync after accumulated changes or time threshold
    this.scheduleSync();
    
    return updatedWord;
  }

  // Schedule a sync to occur after delay or if threshold is reached
  private scheduleSync() {
    const changes = Object.keys(this.pendingChanges).length;
    const timeSinceLastSync = Date.now() - this.lastSyncTime;
    
    // Sync if more than 1 change and more than 2 minutes since last sync
    if (changes > 1 && timeSinceLastSync > 120000) {
      this.syncChanges();
      return;
    }
    
    // Set up delayed sync if not already scheduled
    if (this.syncTimer === null && changes > 0) {
      this.syncTimer = setTimeout(() => {
        this.syncChanges();
        this.syncTimer = null;
      }, 10000); // 10-second delay
    }
  }

  // Sync changes to Firestore
  public async syncChanges(force = false): Promise<boolean> {
    const changes = Object.keys(this.pendingChanges).length;
    
    if (changes === 0 || !this.userId) {
      return true; // Nothing to sync
    }
    
    try {
      console.log(`Syncing ${changes} word changes to Firestore...`);
      const db = await getFirestoreInstance();
      
      // Update Firestore - update the words map in the user document
      const userDocRef = doc(db, `users/${this.userId}`);
      
      // Create an update object with only the changed words
      const updateObject: Record<string, any> = {};
      
      for (const wordKey in this.pendingChanges) {
        updateObject[`words.${wordKey}`] = this.pendingChanges[wordKey];
      }
      
      await setDoc(userDocRef, updateObject, { merge: true });
      
      // Update our local map for future reference
      for (const wordKey in this.pendingChanges) {
        this.wordsMap[wordKey] = this.pendingChanges[wordKey];
      }
      
      console.log('Successfully synced word changes');
      this.pendingChanges = {};
      this.lastSyncTime = Date.now();
      
      return true;
    } catch (error) {
      console.error('Error syncing word changes:', error);
      
      // Only clear pending changes if forced (like on page unload)
      if (force) {
        this.pendingChanges = {};
      }
      
      return false;
    }
  }

  // Get random words from a list
  private getRandomWords(wordList: WordWithSpacedRepetition[], count: number): WordWithSpacedRepetition[] {
    if (wordList.length <= count) {
      return [...wordList];
    }
    
    // Fisher-Yates shuffle algorithm
    const shuffled = [...wordList];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    return shuffled.slice(0, count);
  }
} 