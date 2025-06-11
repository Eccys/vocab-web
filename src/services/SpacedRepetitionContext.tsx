import React, { createContext, useContext, useState, useEffect } from 'react';
import { SpacedRepetitionService, WordWithSpacedRepetition } from './SpacedRepetitionService';
import { useAuth } from './AuthContext';

// Define the context type
interface SpacedRepetitionContextType {
  service: SpacedRepetitionService;
  words: WordWithSpacedRepetition[];
  isLoading: boolean;
  error: string | null;
  refreshWords: () => Promise<WordWithSpacedRepetition[]>;
  forceRefreshFromFirestore: () => Promise<WordWithSpacedRepetition[]>;
  setIsLoading: (loading: boolean) => void;
}

// Create the context with default values
const SpacedRepetitionContext = createContext<SpacedRepetitionContextType>({
  service: new SpacedRepetitionService(),
  words: [],
  isLoading: false,
  error: null,
  refreshWords: async () => [],
  forceRefreshFromFirestore: async () => [],
  setIsLoading: () => {}
});

// Custom hook to use the context
export const useSpacedRepetition = () => useContext(SpacedRepetitionContext);

// Provider component
export const SpacedRepetitionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [service] = useState<SpacedRepetitionService>(() => new SpacedRepetitionService());
  const [words, setWords] = useState<WordWithSpacedRepetition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currentUser, isAuthenticated } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Load words when the component mounts or when user changes
  useEffect(() => {
    // Define an async function to handle initialization
    const initializeData = async () => {
      if (isRefreshing) {
        console.log("Refresh already in progress, skipping.");
        return;
      }
      setIsRefreshing(true);

      try {
        console.log('SpacedRepetitionProvider: initializing data');
        console.log(`Auth state: isAuthenticated=${isAuthenticated}, userId=${currentUser?.uid || 'none'}`);
        
        // Set loading state
        setIsLoading(true);
        
        // If we have a user, ensure auth is fully resolved before proceeding
        if (currentUser) {
          console.log(`Setting user ID in SpacedRepetitionService: ${currentUser.uid}`);
          
          // Add a small delay to ensure auth state is fully propagated
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Double-check authentication state after delay
          const { getCurrentUser } = await import('./FirebaseService');
          const verifiedUser = await getCurrentUser();
          
          if (verifiedUser) {
            console.log(`Verified user after delay: ${verifiedUser.email} (${verifiedUser.uid})`);
            service.setUserId(currentUser.uid);
          } else {
            console.warn('No verified user after delay, using anonymous mode');
          }
        } else {
          console.log('No current user, using anonymous mode');
        }
        
        // Load the words
        console.log('Loading words...');
        const loadedWords = await service.loadWords();
        console.log(`Loaded ${loadedWords.length} words in SpacedRepetitionContext`);
        
        // If authenticated, explicitly force a refresh from Firestore
        if (currentUser) {
          console.log('User is authenticated, forcing refresh from Firestore');
          const refreshedWords = await service.refreshFromFirestore(true);
          console.log(`After Firestore refresh: ${refreshedWords.length} words`);
          setWords(refreshedWords);
        } else {
          setWords(loadedWords);
        }
        
        setError(null);
      } catch (err) {
        console.error('Error loading words:', err);
        setError('Failed to load words. Please try again later.');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    };
    
    // Call the async initialization function
    initializeData();
    
  }, [currentUser, service, isAuthenticated]);
  
  // Function to refresh words
  const refreshWords = async (): Promise<WordWithSpacedRepetition[]> => {
    try {
      setIsLoading(true);
      console.log('Refreshing words...');
      const refreshedWords = await service.loadWords();
      console.log(`Refreshed ${refreshedWords.length} words`);
      setWords(refreshedWords);
      setError(null);
      return refreshedWords;
    } catch (err) {
      console.error('Error refreshing words:', err);
      setError('Failed to refresh words.');
      return words;
    } finally {
      setIsLoading(false);
    }
  };

  // Function to force refresh from Firestore
  const forceRefreshFromFirestore = async (): Promise<WordWithSpacedRepetition[]> => {
    try {
      setIsLoading(true);
      console.log('Forcing refresh from Firestore');
      const refreshedWords = await service.refreshFromFirestore(true);
      console.log(`Force refreshed ${refreshedWords.length} words from Firestore`);
      setWords(refreshedWords);
      setError(null);
      return refreshedWords;
    } catch (err) {
      console.error('Error force refreshing from Firestore:', err);
      setError('Failed to refresh data from Firestore.');
      return words;
    } finally {
      setIsLoading(false);
    }
  };

  // Context value
  const value = {
    service,
    words,
    isLoading,
    error,
    refreshWords,
    forceRefreshFromFirestore,
    setIsLoading
  };

  return (
    <SpacedRepetitionContext.Provider value={value}>
      {children}
    </SpacedRepetitionContext.Provider>
  );
}; 