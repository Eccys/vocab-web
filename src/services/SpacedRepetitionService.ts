// Basic interface for word data with spaced repetition fields
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
  interval: number;
  repetitionCount: number;
  lastReviewed: number;
  nextReviewDate: number;
  timesReviewed: number;
  timesCorrect: number;
  isBookmarked?: boolean;
}

// Stats interface
export interface UserStats {
  wordsLearned: number;
  dayStreak: number;
  savedWordsCount: number;
}

// Settings interface
export interface SpacedRepetitionSettings {
  enabled?: boolean;
  [key: string]: any; // Allow other settings in the future
}

// Simple service class to handle spaced repetition logic
export class SpacedRepetitionService {
  private words: WordWithSpacedRepetition[] = [];
  private userId: string | null = null;
  private isLoaded = false;
  // Track words with pending changes
  private pendingChanges: Set<string> = new Set();
  // For periodic sync
  private lastSyncTime: number = Date.now();
  private questionsAnsweredSinceSync: number = 0;

  constructor() {
    console.log('SpacedRepetitionService initialized');
    
    // Set up automatic sync when the page is hidden or closed
    if (typeof window !== 'undefined') {
      const handleSync = () => {
        if (this.pendingChanges.size > 0) {
          console.log(`[Sync] Triggered by page state '${document.visibilityState}'. Syncing ${this.pendingChanges.size} words.`);
          // No need to await, just fire and forget
          this.syncToFirestore();
        }
      };
      
      // Sync when tab is hidden
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          handleSync();
        }
      });
      
      // Sync as a fallback when user leaves the page
      window.addEventListener('pagehide', handleSync);
    }
  }
  
  // Set the user ID
  public setUserId(userId: string) {
    const previousId = this.userId;
    this.userId = userId;
    console.log(`Set user ID in SpacedRepetitionService: ${userId}`);
    
    // If the user ID changed, we need to handle the transition
    if (previousId && previousId !== userId) {
      console.log(`User ID changed from ${previousId} to ${userId}`);
      
      // We're changing users, so sync pending changes for previous user
      if (this.pendingChanges.size > 0) {
        console.log(`Syncing ${this.pendingChanges.size} pending changes for previous user before switching`);
        // This is one of the few cases where we sync immediately rather than on page unload
        this.syncToFirestore().then(() => {
          // Clear the pending changes after syncing for the previous user
          this.pendingChanges.clear();
        }).catch(error => {
          console.error('Error syncing data for previous user:', error);
        });
      }
      
      // Refresh from Firestore for the new user
      this.refreshFromFirestore();
    }
  }
  
  // Load words from the words.json file
  public async loadWords(): Promise<WordWithSpacedRepetition[]> {
    try {
      console.log('Loading words from words.json file');
      
      // If words are already loaded, return them
      if (this.isLoaded && this.words.length > 0) {
        console.log(`Words already loaded (${this.words.length} words)`);
        return this.words;
      }
      
      // Fetch the words from the JSON file
      const response = await fetch('/words.json');
      if (!response.ok) {
        throw new Error(`Failed to load words.json: ${response.status} ${response.statusText}`);
      }
      
      const wordsData = await response.json();
      console.log(`Loaded ${wordsData.length} words from words.json`);
      
      // Convert the JSON data to our internal format
      this.words = wordsData.map((word: any) => ({
        word: word.word,
        definition: word.definition || '',
        exampleSentence: word.exampleSentence,
        category: word.category || '',
        synonym1: word.synonym1 || '',
        synonym1Definition: word.synonym1Definition || '',
        synonym1ExampleSentence: word.synonym1ExampleSentence,
        synonym2: word.synonym2 || '',
        synonym2Definition: word.synonym2Definition || '',
        synonym2ExampleSentence: word.synonym2ExampleSentence,
        synonym3: word.synonym3 || '',
        synonym3Definition: word.synonym3Definition || '',
        synonym3ExampleSentence: word.synonym3ExampleSentence,
        
        // Initialize spaced repetition fields with defaults
        easeFactor: 2.5,
        interval: 0,
        repetitionCount: 0,
        lastReviewed: 0,
        nextReviewDate: 0,
        timesReviewed: 0,
        timesCorrect: 0,
        isBookmarked: false
      }));
      
      this.isLoaded = true;
      return this.words;
    } catch (error) {
      console.error('Error loading words:', error);
      return [];
    }
  }

  // Select words for quiz based on spaced repetition algorithm
  public selectWordsForQuiz(count: number): WordWithSpacedRepetition[] {
    if (!this.isLoaded || this.words.length === 0) {
      console.warn(`Cannot select words for quiz. Loaded: ${this.isLoaded}, Words count: ${this.words.length}`);
      return [];
    }
    
    const currentTime = Date.now();
    console.log(`Selecting words for quiz at time ${new Date(currentTime).toISOString()}`);
    console.log(`Total words available: ${this.words.length}`);
    
    // DEBUG: Print stats for each word to check nextReviewDate values
    console.debug('Word review dates (top 5):');
    this.words.slice(0, 5).forEach(word => {
      const nextReviewDate = word.nextReviewDate > 0 ? new Date(word.nextReviewDate).toISOString() : 'not set';
      const isOverdue = word.nextReviewDate > 0 && word.nextReviewDate <= currentTime;
      console.debug(`Word: ${word.word}, nextReviewDate: ${nextReviewDate}, isOverdue: ${isOverdue}, interval: ${word.interval}, timesReviewed: ${word.timesReviewed}`);
    });
    
    // 1. First priority: Overdue words
    const overdueWords = this.words
      .filter(word => {
        const isOverdue = word.nextReviewDate > 0 && word.nextReviewDate <= currentTime;
        if (isOverdue) {
          // Calculate days overdue
          const daysOverdue = (currentTime - word.nextReviewDate) / (1000 * 60 * 60 * 24);
          console.log(`Found overdue word: ${word.word}, due at ${new Date(word.nextReviewDate).toISOString()}, ${daysOverdue.toFixed(1)} days overdue`);
        }
        return isOverdue;
      })
      .map(word => {
        // Calculate overdue ratio with millisecond precision for more granular sorting
        const overdueRatio = (currentTime - word.nextReviewDate) / (Math.max(1, word.interval) * 86400000.0);
        
        console.debug(`Word ${word.word} has overdue ratio of ${overdueRatio.toFixed(4)}`);
        return { word, overdueRatio };
      })
      .sort((a, b) => {
        if (b.overdueRatio !== a.overdueRatio) {
          return b.overdueRatio - a.overdueRatio; // Primary: higher ratio first
        }
        // Tie-breaker: word that has been overdue longer (smaller nextReviewDate) comes first
        return a.word.nextReviewDate - b.word.nextReviewDate;
      })
      .map(item => item.word);
    
    if (overdueWords.length > 0) {
      console.log(`Found ${overdueWords.length} overdue words for quiz`);
      console.log('Overdue words:', overdueWords.map(w => w.word).join(', '));
      
      // If we have 3 or more overdue words, select the top 3 with highest overdue ratio
      if (overdueWords.length >= 3) {
        const top3 = overdueWords.slice(0, 3);
        console.log(`Selecting top 3 overdue words: ${top3.map(w => w.word).join(', ')}`);
        return top3;
      } else {
        // Otherwise, just return all overdue words, up to the count
        console.log(`Returning all ${overdueWords.length} overdue words`);
        return overdueWords.slice(0, count);
      }
    }
    
    // 2. Second priority: Unseen words
    const unseenWords = this.words.filter(word => {
      const isUnseen = word.timesReviewed === 0;
      if (isUnseen) {
        console.debug(`Found unseen word: ${word.word}, timesReviewed: ${word.timesReviewed}`);
      }
      return isUnseen;
    });
    
    if (unseenWords.length > 0) {
      console.log(`Found ${unseenWords.length} unseen words`);
      console.debug(`First 5 unseen words: ${unseenWords.slice(0, 5).map(w => w.word).join(', ')}`);
      return this.getRandomWords(unseenWords, Math.min(count, unseenWords.length));
    }
    
    // 3. Third priority: Word closest to becoming due
    console.log('No overdue or unseen words, selecting word with highest soon-to-be-due ratio');
    
    // Calculate "due ratio" for all words. It's negative for words not yet due.
    const allWordsWithRatio = this.words.map(word => {
      let dueRatio;
      if (word.nextReviewDate > 0) {
        // For words with a review date, calculate how close they are to being due
        dueRatio = (currentTime - word.nextReviewDate) / (Math.max(1, word.interval) * 86400000.0);
      } else {
        // For words without a valid review date (e.g., unseen), use a default low priority.
        // This is a safeguard, as unseen words should be handled by Priority 2.
        dueRatio = -100.0;
      }
      
      console.debug(`Word ${word.word} has due ratio ${dueRatio.toFixed(4)}, next review at ${new Date(word.nextReviewDate).toISOString()}`);
      return { word, dueRatio };
    })
    .sort((a, b) => {
        if (b.dueRatio !== a.dueRatio) {
          return b.dueRatio - a.dueRatio;
        }
        // Tie-breaker: word that is due sooner (smaller nextReviewDate) comes first
        return a.word.nextReviewDate - b.word.nextReviewDate;
      });
    
    // Print top 5 words by due ratio
    console.debug('Top 5 words by due ratio:');
    allWordsWithRatio.slice(0, 5).forEach(item => {
      console.debug(`Word: ${item.word.word}, ratio: ${item.dueRatio.toFixed(4)}, next review: ${new Date(item.word.nextReviewDate).toISOString()}`);
    });
    
    // Take the words with highest ratio (closest to becoming due)
    const result = allWordsWithRatio.slice(0, count).map(item => item.word);
    console.log(`Selected words with highest ratio: ${result.map(w => w.word).join(', ')}`);
    return result;
  }
  
  // Response time thresholds in ms
  private RESPONSE_TIME = {
    FAST: 3000,   // less than 3s is fast
    MEDIUM: 5000, // 3-5s is medium
    SLOW: 30000,  // >5s is slow (cap at 30s to handle distractions)
  };

  // Calculate quality score based on user's answer
  private calculateQualityScore(
    isCorrect: boolean,
    responseTimeMs: number,
    usedHint: boolean,
    repetitionCount: number
  ): number {
    // Normalize very long response times (likely user distraction)
    const normalizedResponseTime = Math.min(responseTimeMs, this.RESPONSE_TIME.SLOW);
    
    // With hint
    if (usedHint) {
      return isCorrect 
        ? 2 // With hint & correct: moderate penalty
        : 0; // With hint & incorrect: severe penalty
    }
    
    // Without hint & correct
    if (isCorrect) {
      if (normalizedResponseTime < this.RESPONSE_TIME.FAST) {
        return 5; // No hint, correct & fast: perfect recall
      } else if (normalizedResponseTime < this.RESPONSE_TIME.MEDIUM) {
        return 4; // No hint, correct & medium: good recall
      } else {
        return 3; // No hint, correct & slow: struggled but correct
      }
    }
    
    // Without hint & incorrect
    return repetitionCount > 0
      ? 2 // Had success before: learning but forgot
      : 1; // No success before: complete fail
  }

  // Get user statistics
  public getStats(): UserStats {
    if (this.words.length === 0) {
      return { wordsLearned: 0, dayStreak: 0, savedWordsCount: 0 };
    }

    const wordsLearned = this.words.filter(w => w.timesReviewed > 0).length;
    const savedWordsCount = this.words.filter(w => w.isBookmarked).length;

    // Calculate day streak
    const reviewTimestamps = this.words
      .map(w => w.lastReviewed)
      .filter(ts => ts > 0);
    
    if (reviewTimestamps.length === 0) {
      return { wordsLearned, dayStreak: 0, savedWordsCount };
    }

    const uniqueDays = [...new Set(reviewTimestamps.map(ts => new Date(ts).setHours(0, 0, 0, 0)))];
    uniqueDays.sort((a, b) => b - a);

    let streak = 0;
    if (uniqueDays.length > 0) {
      const today = new Date().setHours(0, 0, 0, 0);
      const yesterday = new Date(today).setDate(new Date(today).getDate() - 1);
      
      // Check if the most recent review was today or yesterday
      if (uniqueDays[0] === today || uniqueDays[0] === yesterday) {
        streak = 1;
        for (let i = 0; i < uniqueDays.length - 1; i++) {
          const day = uniqueDays[i];
          const prevDay = uniqueDays[i+1];
          const expectedPrevDay = new Date(day).setDate(new Date(day).getDate() - 1);
          if (prevDay === expectedPrevDay) {
            streak++;
          } else {
            break;
          }
        }
      }
    }
    
    return { wordsLearned, dayStreak: streak, savedWordsCount };
  }

  // Get saved words
  public getSavedWords(): WordWithSpacedRepetition[] {
    return this.words.filter(w => w.isBookmarked);
  }

  // Toggle bookmark status for a word
  public toggleBookmark(word: WordWithSpacedRepetition): void {
    word.isBookmarked = !word.isBookmarked;
    this.pendingChanges.add(word.word);
    console.log(`Toggled bookmark for "${word.word}" to ${word.isBookmarked}. Sync will occur on page unload.`);
  }

  // Update word stats based on user's answer
  public updateWordStats(
    word: WordWithSpacedRepetition,
    isCorrect: boolean,
    responseTimeMs: number,
    usedHint: boolean
  ): WordWithSpacedRepetition {
    // Calculate quality score (0-5)
    const qualityScore = this.calculateQualityScore(
      isCorrect, 
      responseTimeMs, 
      usedHint, 
      word.repetitionCount
    );
    
    console.log(`Updating stats for word "${word.word}" - correct: ${isCorrect}, time: ${responseTimeMs}ms, hint: ${usedHint}, quality: ${qualityScore}`);
    
    const currentTime = Date.now();
    
    // Update common stats
    word.timesReviewed = (word.timesReviewed || 0) + 1;
    word.lastReviewed = currentTime;
    
    if (isCorrect) {
      word.timesCorrect = (word.timesCorrect || 0) + 1;
    }
    
    // Calculate new ease factor using the formula:
    // adjustment = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
    const adjustment = 0.1 - (5 - qualityScore) * (0.08 + (5 - qualityScore) * 0.02);
    word.easeFactor = Math.max(1.3, (word.easeFactor || 2.5) + adjustment);
      
    // Update interval using SM-2 algorithm
    const isAnswerCorrect = qualityScore >= 3;

    if (!isAnswerCorrect) {
      // Reset interval and repetition count for incorrect answers
      word.interval = 1;
      word.repetitionCount = 0;
    } else {
      let intervalMultiplier = word.easeFactor;

      // Give a bonus for correctly answering a very overdue item
      if (word.nextReviewDate > 0 && word.nextReviewDate < currentTime) {
        const daysOverdue = (currentTime - word.nextReviewDate) / 86400000;
        const baseInterval = Math.max(1, word.interval);
        const overdueRatio = daysOverdue / baseInterval;

        // If more than 25% overdue, apply a bonus multiplier to the interval
        if (overdueRatio > 0.25) {
          const bonus = Math.min(1 + overdueRatio * 0.5, 1.5); // Cap bonus at 50%
          intervalMultiplier *= bonus;
          console.log(`[Update] Word "${word.word}" was ${overdueRatio.toFixed(1)}% overdue. Applying interval bonus of ${bonus.toFixed(2)}x.`);
        }
      }

      // Update interval based on repetition count
      if (word.repetitionCount === 0) {
        word.interval = 1; // First successful repetition
      } else if (word.repetitionCount === 1) {
        word.interval = 3; // Second successful repetition
      } else {
        word.interval = word.interval * intervalMultiplier; // Subsequent repetitions
      }
      
      // Increment repetition count
      word.repetitionCount += 1;
    }
    
    // Calculate next review date
    word.nextReviewDate = currentTime + (word.interval * 86400000);
    
    console.log(`Updated stats: easeFactor=${word.easeFactor.toFixed(2)}, interval=${word.interval.toFixed(1)}, next review in ${Math.ceil(word.interval)} days`);
    
    // Mark this word as having pending changes
    this.pendingChanges.add(word.word);
    
    // Increment answered questions count
    this.questionsAnsweredSinceSync++;

    // Check if we should sync based on user's criteria
    const now = Date.now();
    const timeSinceLastSyncMs = now - this.lastSyncTime;
    
    console.debug(`Sync check: ${this.questionsAnsweredSinceSync} questions answered, ${Math.round(timeSinceLastSyncMs / 1000)}s since last sync.`);

    // Sync if >2 questions answered and >2 minutes passed
    if (this.questionsAnsweredSinceSync > 2 && timeSinceLastSyncMs > 120000) {
      console.log(`[Sync] Periodic sync triggered: ${this.questionsAnsweredSinceSync} questions answered in ${Math.round(timeSinceLastSyncMs / 1000)}s. Syncing to Firestore...`);
      this.syncToFirestore(); // This is async, we don't need to wait for it.
    }
    
    return word;
  }
  
  // Helper to get random words - but consistent between refreshes
  private getRandomWords(wordList: WordWithSpacedRepetition[], count: number): WordWithSpacedRepetition[] {
    if (wordList.length <= count) {
      return [...wordList];
    }
    
    console.log(`DEBUG: Getting ${count} random words from list of ${wordList.length} words`);
    console.log(`DEBUG: First 3 words in input list: ${wordList.slice(0, 3).map(w => w.word).join(', ')}`);
    
    // Use proper Fisher-Yates shuffle algorithm to randomly select words
    const shuffled = [...wordList];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    const result = shuffled.slice(0, count);
    console.log(`DEBUG: Selected words: ${result.map(w => w.word).join(', ')}`);
    return result;
  }

  // Placeholder cleanup method
  public cleanup(): void {
    console.log('Cleanup called - to be implemented');
  }
  
  // Refresh data from Firestore
  public refreshFromFirestore(forceRefresh: boolean = false): Promise<WordWithSpacedRepetition[]> {
    // If no user ID, just return current words
    if (!this.userId) {
      console.warn('No user ID set, not refreshing from Firestore');
      return Promise.resolve(this.words);
    }
    
    console.log(`EXPLICITLY refreshing from Firestore for user ${this.userId}`);
    return this.fetchUserDataFromFirestore(forceRefresh);
  }
  
  // Fetch user data from Firestore and merge with local words
  private async fetchUserDataFromFirestore(forceRefresh: boolean = false): Promise<WordWithSpacedRepetition[]> {
    try {
      // Import Firestore functions dynamically to avoid circular dependencies
      const { getFirestoreInstance } = await import('./FirestoreConfig');
      const { doc, getDoc, getDocFromServer } = await import('firebase/firestore');
      const { getAuth } = await import('firebase/auth');
      
      console.log(`FETCHING DATA FROM FIRESTORE for user ${this.userId}`);
      
      // Check user authentication
      const auth = getAuth();
      const currentUser = auth.currentUser;
      console.log(`AUTHENTICATION CHECK: ${currentUser?.email || 'No user'} (ID: ${currentUser?.uid || 'none'})`);
      
      // First, make sure we have loaded the base words
      if (!this.isLoaded) {
        console.log('Base words not loaded yet, loading them first');
        await this.loadWords();
      }
      
      // Get Firestore instance
      const db = await getFirestoreInstance();
      
      // Get the user document with cache busting if forceRefresh is true
      const userDocRef = doc(db, `users/${this.userId}`);
      console.log(`Getting user document for ${this.userId} from Firestore (force refresh: ${forceRefresh})`);
      
      let userDoc;
      if (forceRefresh) {
        // Import additional functions when needed
        const { getFirestore, connectFirestoreEmulator, CACHE_SIZE_UNLIMITED, enableNetwork } = await import('firebase/firestore');
        
        // Make sure network is enabled for this request
        try {
          await enableNetwork(db);
          console.log('Explicitly enabled network for Firestore refresh');
        } catch (err) {
          console.warn('Error enabling network for Firestore:', err);
        }
        
        // Get fresh data from the server
        userDoc = await getDocFromServer(userDocRef);
        console.log('Got fresh document from Firestore server');
      } else {
        // Normal get (can use cache)
        userDoc = await getDoc(userDocRef);
      }
      
      if (!userDoc.exists()) {
        console.warn('User document not found in Firestore');
        return this.words;
      }
      
      const userData = userDoc.data();
      
      // Check if the user has words stored in the document
      if (!userData?.words || typeof userData.words !== 'object') {
        console.warn('No words map found in user document');
        return this.words;
      }
      
      console.log(`Found ${Object.keys(userData.words).length} words in Firestore for user ${this.userId}`);
      
      // Debug: Check some of the words in Firestore
      const wordKeys = Object.keys(userData.words);
      console.debug('=== SAMPLE WORD DATA FROM FIRESTORE ===');
      for (let i = 0; i < Math.min(5, wordKeys.length); i++) {
        const wordKey = wordKeys[i];
        const wordData = userData.words[wordKey];
        console.debug(`RAW FIRESTORE WORD [${wordKey}]:`, JSON.stringify(wordData, null, 2));
        
        // Check for critical fields and format
        console.debug(`[${wordKey}] Field check:
        - nextReviewDate: ${wordData.nextReviewDate || 'MISSING'} ${wordData.nextReviewDate ? new Date(wordData.nextReviewDate).toISOString() : ''}
        - lastReviewed: ${wordData.lastReviewed || 'MISSING'} ${wordData.lastReviewed ? new Date(wordData.lastReviewed).toISOString() : ''}
        - timesReviewed: ${wordData.timesReviewed || 'MISSING'}
        - easeFactor: ${wordData.easeFactor || 'MISSING'}
        - interval: ${wordData.interval || 'MISSING'}`);
      }
      
      // Create a map of our local words for easy lookup
      const wordMap = new Map<string, WordWithSpacedRepetition>();
      this.words.forEach(word => {
        wordMap.set(word.word, word);
      });
      
      // Update our local words with the Firestore data
      let updatedCount = 0;
      let overdueCount = 0;
      const currentTime = Date.now();
      
      for (const wordKey of wordKeys) {
        const firestoreWordData = userData.words[wordKey];
        
        // Check that the data looks valid
        if (!firestoreWordData || typeof firestoreWordData !== 'object') {
          console.warn(`Invalid data for word "${wordKey}" in Firestore, skipping`);
          continue;
        }
        
        // Find our local word
        const localWord = wordMap.get(wordKey);
        if (!localWord) {
          console.warn(`Word "${wordKey}" found in Firestore but not in local words, skipping`);
          continue;
        }
        
        // Update our local word with the Firestore data
        updatedCount++;
        
        // IMPORTANT: Log every detail for debugging
        console.debug(`
UPDATING WORD "${wordKey}" FROM FIRESTORE:
- easeFactor: ${firestoreWordData.easeFactor}
- interval: ${firestoreWordData.interval}
- repetitionCount: ${firestoreWordData.repetitionCount}
- timesReviewed: ${firestoreWordData.timesReviewed}
- timesCorrect: ${firestoreWordData.timesCorrect}
- isBookmarked: ${firestoreWordData.isBookmarked}
- lastReviewed: ${firestoreWordData.lastReviewed} (${firestoreWordData.lastReviewed ? new Date(firestoreWordData.lastReviewed).toISOString() : 'not set'})
- lastReviewDate: ${firestoreWordData.lastReviewed} (${firestoreWordData.lastReviewed ? new Date(firestoreWordData.lastReviewed).toISOString() : 'not set'})
- nextReviewDate: ${firestoreWordData.nextReviewDate} (${firestoreWordData.nextReviewDate ? new Date(firestoreWordData.nextReviewDate).toISOString() : 'not set'})
        `);
        
        // Store pre-update values for debugging
        const originalLocalWord = { ...localWord };
        
        // Map fields with potential different names (trying both versions of field names)
        // Direct assignment (ensuring types match)
        if (typeof firestoreWordData.easeFactor === 'number') localWord.easeFactor = firestoreWordData.easeFactor;
        if (typeof firestoreWordData.interval === 'number') localWord.interval = firestoreWordData.interval;
        if (typeof firestoreWordData.repetitionCount === 'number') localWord.repetitionCount = firestoreWordData.repetitionCount;
        
        // Fix field name mismatches - check for new names first, then fall back to old names
        if (typeof firestoreWordData.timesReviewed === 'number') localWord.timesReviewed = firestoreWordData.timesReviewed;
        
        // Correct Count: prefer 'timesCorrect', fallback to 'correctCount'
        if (typeof firestoreWordData.timesCorrect === 'number') {
          localWord.timesCorrect = firestoreWordData.timesCorrect;
        } else if (typeof firestoreWordData.correctCount === 'number') {
          localWord.timesCorrect = firestoreWordData.correctCount;
        }

        // Last Review Date: prefer 'lastReviewed', fallback to 'lastReviewDate'
        if (typeof firestoreWordData.lastReviewed === 'number' && firestoreWordData.lastReviewed > 0) {
          localWord.lastReviewed = firestoreWordData.lastReviewed;
        } else if (typeof firestoreWordData.lastReviewed === 'number' && firestoreWordData.lastReviewed > 0) {
          localWord.lastReviewed = firestoreWordData.lastReviewed;
        }
        
        // Handle nextReviewDate - if it's 0 but we have lastReviewDate and interval, calculate it
        if (typeof firestoreWordData.nextReviewDate === 'number') {
          if (firestoreWordData.nextReviewDate > 0) {
            localWord.nextReviewDate = firestoreWordData.nextReviewDate;
          } else if (localWord.lastReviewed > 0 && localWord.interval > 0) {
            // Calculate nextReviewDate if it's missing but we have lastReviewed and interval
            const intervalMs = localWord.interval * 24 * 60 * 60 * 1000; // Convert days to ms
            localWord.nextReviewDate = localWord.lastReviewed + intervalMs;
            console.log(`Calculated nextReviewDate for "${wordKey}" as ${new Date(localWord.nextReviewDate).toISOString()}`);
          }
        }
        
        if (typeof firestoreWordData.isBookmarked === 'boolean') localWord.isBookmarked = firestoreWordData.isBookmarked;
        
        // Compare the original and updated values
        console.debug(`COMPARISON FOR "${wordKey}":
        - Original: nextReviewDate=${originalLocalWord.nextReviewDate} (${originalLocalWord.nextReviewDate > 0 ? new Date(originalLocalWord.nextReviewDate).toISOString() : 'not set'}), timesReviewed=${originalLocalWord.timesReviewed}
        - Updated: nextReviewDate=${localWord.nextReviewDate} (${localWord.nextReviewDate > 0 ? new Date(localWord.nextReviewDate).toISOString() : 'not set'}), timesReviewed=${localWord.timesReviewed}
        - Changed: ${JSON.stringify(localWord) !== JSON.stringify(originalLocalWord)}`);
        
        // Check if this word is overdue
        if (localWord.nextReviewDate > 0 && localWord.nextReviewDate <= currentTime) {
          overdueCount++;
          console.debug(`OVERDUE WORD: ${wordKey}, nextReviewDate: ${new Date(localWord.nextReviewDate).toISOString()}`);
        }
      }
      
      console.log(`Updated ${updatedCount} words with Firestore data, found ${overdueCount} overdue words`);
      
      // After updating words, display stats about what we found
      let overdueWordsList = this.words.filter(w => w.nextReviewDate > 0 && w.nextReviewDate <= currentTime);
      console.log(`FOUND ${overdueWordsList.length} OVERDUE WORDS IN TOTAL:`);
      for (const word of overdueWordsList.slice(0, 10)) {
        const overdueDays = (currentTime - word.nextReviewDate) / (1000 * 60 * 60 * 24);
        const overdueRatio = overdueDays / Math.max(1, word.interval);
        console.debug(`OVERDUE: ${word.word}, due: ${new Date(word.nextReviewDate).toISOString()}, days overdue: ${overdueDays.toFixed(1)}, ratio: ${overdueRatio.toFixed(2)}`);
      }
      
      let unseenWordsList = this.words.filter(w => w.timesReviewed === 0);
      console.log(`FOUND ${unseenWordsList.length} UNSEEN WORDS`);
      
      // Make sure isLoaded is set to true
      this.isLoaded = true;
      
      // Return the updated words array
      console.log(`Successfully updated words with Firestore data for user ${this.userId}`);
      return this.words;
    } catch (error) {
      console.error('ERROR fetching user data from Firestore:', error);
      return this.words; // Return current words in case of error
    }
  }
  
  // We don't need to schedule syncs since we only sync on page unload
  
  // Sync pending changes to Firestore
  public async syncToFirestore(): Promise<void> {
    // If no user ID or no pending changes, skip sync
    if (!this.userId || this.pendingChanges.size === 0) {
      console.log('[Sync] Skipped. No user or no pending changes.');
      return;
    }
    
    console.log(`[Sync] Starting sync of ${this.pendingChanges.size} words to Firestore for user ${this.userId}`);
    
    try {
      // Import Firestore functions dynamically to avoid circular dependencies
      const { getFirestoreInstance } = await import('./FirestoreConfig');
      const { doc, setDoc, getDoc, updateDoc } = await import('firebase/firestore');
      
      // Get Firestore instance
      const db = await getFirestoreInstance();
      
      // Get the user document reference
      const userDocRef = doc(db, `users/${this.userId}`);
      
      // Check if the user document exists
      const userDoc = await getDoc(userDocRef);
      
      // Create an object with the updated words
      const updates: Record<string, any> = {};
      
      // Find words with pending changes
      for (const wordKey of this.pendingChanges) {
        const word = this.words.find(w => w.word === wordKey);
        if (!word) continue;
        
        console.log(`[Sync] Word "${wordKey}" payload:`, {
          easeFactor: word.easeFactor,
          interval: word.interval,
          repetitionCount: word.repetitionCount,
          lastReviewed: word.lastReviewed,
          nextReviewDate: word.nextReviewDate,
          timesReviewed: word.timesReviewed,
          timesCorrect: word.timesCorrect,
        });
        
        // CRITICAL: Use consistent field names matching the app's data model
        updates[`words.${word.word}`] = {
          easeFactor: word.easeFactor,
          interval: word.interval,
          repetitionCount: word.repetitionCount,
          lastReviewed: word.lastReviewed,     // UNIFIED
          nextReviewDate: word.nextReviewDate,
          timesReviewed: word.timesReviewed,
          timesCorrect: word.timesCorrect,       // UNIFIED
          isBookmarked: word.isBookmarked || false,
          word: word.word, // Also store the word itself
          updatedAt: Date.now(),
        };
      }

      if (Object.keys(updates).length === 0) {
        console.log('[Sync] No updates to send, aborting.');
        return;
      }

      console.log('[Sync] Full payload to be sent to Firestore:', updates);
      
      // If the user document doesn't exist, create it
      if (!userDoc.exists()) {
        await setDoc(userDocRef, { 
          words: {}, // Initialize empty words object
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
        console.log(`Created new user document for user ${this.userId}`);
      }
      
      // Update the user document with the new word data
      await updateDoc(userDocRef, updates);
      
      console.log(`[Sync] SUCCESS: Synced ${Object.keys(updates).length} words to Firestore.`);
      
      // Clear pending changes
      this.pendingChanges.clear();
      
      // Reset periodic sync counters
      this.lastSyncTime = Date.now();
      this.questionsAnsweredSinceSync = 0;
      
      // Successfully synced
    } catch (error) {
      console.error('[Sync] FAILURE: Error syncing to Firestore:', error);
      // Keep the pending changes for next attempt
    }
  }

  // Debug Firestore connection
  public async debugFirestoreConnection(): Promise<boolean> {
    console.log('DEBUGGING FIRESTORE CONNECTION');
    
    try {
      // Import Firestore functions dynamically to avoid circular dependencies
      const { getFirestoreInstance } = await import('./FirestoreConfig');
      const { doc, getDoc, collection, getDocs } = await import('firebase/firestore');
      const { getAuth } = await import('firebase/auth');
      
      if (!this.userId) {
        console.error('No user ID set, cannot debug Firestore connection');
        return false;
      }
      
      // Get current auth state
      const auth = getAuth();
      const currentUser = auth.currentUser;
      
      console.log(`Logged in user: ${currentUser ? currentUser.email : 'No user'} (ID: ${currentUser?.uid || 'none'})`);
      console.log(`SpacedRepetition service user ID: ${this.userId}`);
      
      if (currentUser?.email === 'wow@gmail.com') {
        console.log('VERIFIED: Logged in as wow@gmail.com');
      } else {
        console.warn('WARNING: Not logged in as wow@gmail.com');
      }
      
      // Get Firebase project info
      try {
        const { getApp } = await import('firebase/app');
        const app = getApp();
        console.log(`Firebase app name: ${app.name}`);
        console.debug(`Firebase options:`, JSON.stringify(app.options, null, 2));
      } catch (err) {
        console.error('Error getting Firebase app info:', err);
      }
      
      // Get Firestore instance
      const db = await getFirestoreInstance();
      console.log('Successfully got Firestore instance');
      
      // Try to enable network
      try {
        const { enableNetwork } = await import('firebase/firestore');
        await enableNetwork(db);
        console.log('Successfully enabled network');
      } catch (err) {
        console.warn('Error enabling network:', err);
      }
      
      // Check if user document exists
      const userDocRef = doc(db, `users/${this.userId}`);
      console.log(`Checking if user document exists for ${this.userId}`);
      
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        console.error('User document does not exist in Firestore');
        return false;
      }
      
      console.log('User document exists in Firestore');
      
      // Get user document data
      const userData = userDoc.data();
      console.log(`User document data keys: ${Object.keys(userData).join(', ')}`);
      
      // Check if words collection exists
      if (!userData?.words || typeof userData.words !== 'object') {
        console.error('No words map found in user document');
        return false;
      }
      
      const wordKeys = Object.keys(userData.words);
      console.log(`Found ${wordKeys.length} words in Firestore`);
      
      // Count words with valid nextReviewDate
      let wordWithValidNextReviewDate = 0;
      
      // Print sample of words
      for (let i = 0; i < Math.min(10, wordKeys.length); i++) {
        const wordKey = wordKeys[i];
        const wordData = userData.words[wordKey];
        
        // Check if this word has a valid nextReviewDate
        if (wordData.nextReviewDate && wordData.nextReviewDate > 0) {
          wordWithValidNextReviewDate++;
          console.debug(`Word [${wordKey}] HAS VALID nextReviewDate: ${new Date(wordData.nextReviewDate).toISOString()}`);
        } else {
          console.debug(`Word [${wordKey}] has NO valid nextReviewDate`);
        }
        
        console.debug(`WORD DATA [${wordKey}]:`, JSON.stringify(wordData, null, 2));
      }
      
      console.log(`Found ${wordWithValidNextReviewDate} words with valid nextReviewDate out of ${wordKeys.length} total`);
      
      return true;
    } catch (error) {
      console.error('Error debugging Firestore connection:', error);
      return false;
    }
  }

  // Set application settings
  public setSettings(settings: SpacedRepetitionSettings): void {
    console.log('Updating SpacedRepetition settings:', settings);
    // In the future, we could store these settings and adjust behavior
    // Currently, we just log them
  }

  // Direct debug function to check specific word in Firestore
  public async debugSpecificWord(wordToDebug: string): Promise<any> {
    if (!this.userId) {
      console.error(`No user ID set, cannot debug word: ${wordToDebug}`);
      return null;
    }
    
    try {
      console.log(`DEBUGGING SPECIFIC WORD IN FIRESTORE: "${wordToDebug}" for user ${this.userId}`);
      
      // Import Firestore functions dynamically
      const { getFirestoreInstance } = await import('./FirestoreConfig');
      const { doc, getDoc } = await import('firebase/firestore');
      const { getAuth } = await import('firebase/auth');
      
      // Check auth state
      const auth = getAuth();
      console.log(`Current auth user: ${auth.currentUser?.email || 'none'} (${auth.currentUser?.uid || 'none'})`);
      
      // Get Firestore instance
      const db = await getFirestoreInstance();
      
      // Try to enable network
      try {
        const { enableNetwork } = await import('firebase/firestore');
        await enableNetwork(db);
        console.log('Network explicitly enabled for Firestore');
      } catch (err) {
        console.warn('Error enabling network:', err);
      }
      
      // Get the user document
      const userDocRef = doc(db, `users/${this.userId}`);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        console.error(`User document does not exist for ${this.userId}`);
        return null;
      }
      
      const userData = userDoc.data();
      
      // Check if words map exists
      if (!userData?.words) {
        console.error('No words map found in user document');
        return null;
      }
      
      // Get the specific word
      const wordData = userData.words[wordToDebug];
      
      if (!wordData) {
        console.error(`Word "${wordToDebug}" not found in Firestore`);
        
        // Check if there might be a case issue
        const allWordKeys = Object.keys(userData.words);
        const similarWords = allWordKeys.filter(key => 
          key.toLowerCase() === wordToDebug.toLowerCase()
        );
        
        if (similarWords.length > 0) {
          console.warn(`Found similar words with different case: ${similarWords.join(', ')}`);
          return userData.words[similarWords[0]];
        }
        
        return null;
      }
      
      console.log(`FOUND WORD "${wordToDebug}" IN FIRESTORE:`, JSON.stringify(wordData, null, 2));
      
      // Compare with local word
      const localWord = this.words.find(w => w.word === wordToDebug);
      if (localWord) {
        console.log(`LOCAL WORD DATA:`, JSON.stringify({
          word: localWord.word,
          nextReviewDate: localWord.nextReviewDate,
          lastReviewed: localWord.lastReviewed,
          timesReviewed: localWord.timesReviewed,
          easeFactor: localWord.easeFactor,
          interval: localWord.interval
        }, null, 2));
      } else {
        console.warn(`Word "${wordToDebug}" not found in local words`);
      }
      
      return wordData;
    } catch (error) {
      console.error(`Error debugging word "${wordToDebug}":`, error);
      return null;
    }
  }

  // Debug function to identify field mapping issues
  public async debugFieldMapping(): Promise<void> {
    if (!this.userId) {
      console.warn('[Debug] No user ID set, cannot debug field mapping');
      return;
    }
    
    // This is a debug function, we need to get firestore instance
    const { getFirestore, doc, getDoc } = await import('firebase/firestore');
    const firestore = getFirestore();
    
    const userDocRef = doc(firestore, 'users', this.userId);
    
    try {
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        const wordsData = userData.words;
        
        if (wordsData && Object.keys(wordsData).length > 0) {
          const firstWordKey = Object.keys(wordsData)[0];
          const firstWordData = wordsData[firstWordKey];
          
          console.log(`[Debug] Field mapping for word '${firstWordKey}':`, firstWordData);
          
          // Define expected fields
          const expectedFields: (keyof WordWithSpacedRepetition)[] = [
            'word', 'definition', 'exampleSentence', 'category',
            'synonym1', 'synonym1Definition', 'synonym1ExampleSentence',
            'synonym2', 'synonym2Definition', 'synonym2ExampleSentence',
            'synonym3', 'synonym3Definition', 'synonym3ExampleSentence',
            'easeFactor', 'interval', 'repetitionCount', 'lastReviewed',
            'nextReviewDate', 'timesReviewed', 'timesCorrect', 'isBookmarked'
          ];
          
          // Check for missing or extra fields
          const actualFields = Object.keys(firstWordData);
          const missingFields = expectedFields.filter(f => !actualFields.includes(f));
          const extraFields = actualFields.filter(f => !expectedFields.includes(f as any));
          
          if (missingFields.length > 0) {
            console.warn(`[Debug] Missing fields: ${missingFields.join(', ')}`);
          } else {
            console.log('[Debug] All expected fields are present.');
          }
          
          if (extraFields.length > 0) {
            console.warn(`[Debug] Extra/unexpected fields: ${extraFields.join(', ')}`);
          }
          
        } else {
          console.log('[Debug] No words found for this user in Firestore.');
        }
      } else {
        console.log('[Debug] No user document found.');
      }
    } catch (error) {
      console.error('[Debug] Error during field mapping debug:', error);
    }
  }
} 