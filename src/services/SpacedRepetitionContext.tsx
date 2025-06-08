import React, { createContext, useContext, useState, useEffect } from 'react';
import { SpacedRepetitionService, WordWithSpacedRepetition } from './SpacedRepetitionService';
import { useAuth } from './AuthContext';

interface SpacedRepetitionContextType {
  service: SpacedRepetitionService;
  words: WordWithSpacedRepetition[];
  isLoading: boolean;
  error: string | null;
  refreshWords: () => Promise<WordWithSpacedRepetition[]>;
}

const SpacedRepetitionContext = createContext<SpacedRepetitionContextType>({
  service: new SpacedRepetitionService(),
  words: [],
  isLoading: true,
  error: null,
  refreshWords: async () => []
});

export const useSpacedRepetition = () => useContext(SpacedRepetitionContext);

export const SpacedRepetitionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [service] = useState<SpacedRepetitionService>(() => new SpacedRepetitionService());
  const [words, setWords] = useState<WordWithSpacedRepetition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currentUser } = useAuth();

  // Load words when user changes
  useEffect(() => {
    if (currentUser) {
      setIsLoading(true);
      setError(null);
      
      service.setUserId(currentUser.uid);
      service.loadWords()
        .then(words => {
          setWords(words);
          setIsLoading(false);
        })
        .catch(err => {
          console.error('Error loading spaced repetition words:', err);
          setError('Failed to load words. Please try again.');
          setIsLoading(false);
        });
    } else {
      setWords([]);
    }

    // Cleanup function
    return () => {
      service.cleanup();
    };
  }, [currentUser, service]);

  // Function to refresh words from Firestore
  const refreshWords = async (): Promise<WordWithSpacedRepetition[]> => {
    try {
      setIsLoading(true);
      
      // Sync any pending changes first
      await service.syncChanges();
      
      // Then load fresh data
      const refreshedWords = await service.loadWords();
      setWords(refreshedWords);
      setError(null);
      
      return refreshedWords;
    } catch (err) {
      console.error('Error refreshing words:', err);
      setError('Failed to refresh words data.');
      return words; // Return current words on error
    } finally {
      setIsLoading(false);
    }
  };

  const value = {
    service,
    words,
    isLoading,
    error,
    refreshWords
  };

  return (
    <SpacedRepetitionContext.Provider value={value}>
      {children}
    </SpacedRepetitionContext.Provider>
  );
}; 