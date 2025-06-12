/// <reference types="vite/client" />
import dailyWords from '../../public/dailywords.json';
import words from '../../public/words.json';

// Dictionary and Thesaurus API service
// This service handles all interactions with the Merriam-Webster APIs

const safeFetchAndParseJson = async (url: string) => {
  try {
    const response = await fetch(url);
    // Don't throw for "Not Found" or other non-200 responses that might have a body
    if (!response.ok) {
        const errorText = await response.text();
        console.warn(`API request failed with status ${response.status}: ${errorText}`, `URL: ${url}`);
        // Mimic API behavior for suggestions, which is an array of strings
        return [errorText || `HTTP error! status: ${response.status}`];
    }
    const text = await response.text();
    if (!text) {
        return []; // Nothing found, return empty array as per API for no results
    }
    try {
        return JSON.parse(text);
    } catch (e) {
        console.warn(`API returned non-JSON response: "${text}"`, `URL: ${url}`);
        // This case handles things like "Invalid API key" which is returned as plain text
        // The existing logic often checks `typeof data[0] === 'string'`, so this fits.
        return [text];
    }
  } catch (networkError) {
      console.error("Network error when fetching from API:", networkError, `URL: ${url}`);
      return []; // Return empty array on network errors
  }
};

// API Keys from Environment Variables
const DICTIONARY_API_KEY = import.meta.env.VITE_DICTIONARY_API_KEY;
const THESAURUS_API_KEY = import.meta.env.VITE_THESAURUS_API_KEY;

// Cache to track used words and prevent repetition
const usedWordsCache: Set<string> = new Set();
const MAX_CACHE_SIZE = 100;

// Add a word to the used words cache
const addToUsedWordsCache = (word: string) => {
  usedWordsCache.add(word.toLowerCase());
  // Keep cache size under control
  if (usedWordsCache.size > MAX_CACHE_SIZE) {
    const iterator = usedWordsCache.values();
    for (let i = 0; i < 20; i++) { // Remove 20 oldest items
      const next = iterator.next();
      if (next.done) break;
      usedWordsCache.delete(next.value);
    }
  }
};

// Check if a word has been recently used
const hasBeenUsedRecently = (word: string): boolean => {
  return usedWordsCache.has(word.toLowerCase());
};

// Thesaurus API
export const getSynonyms = async (word: string): Promise<string[]> => {
  try {
    const data = await safeFetchAndParseJson(
      `https://www.dictionaryapi.com/api/v3/references/thesaurus/json/${word}?key=${THESAURUS_API_KEY}`
    );
    
    // Check if we got valid results
    if (!data || data.length === 0 || typeof data[0] === 'string') {
      console.warn('No synonym results found for:', word);
      return [];
    }
    
    // Extract synonyms from the API response
    // The API returns an array of entries, and each entry has a 'meta' field containing 'syns'
    const synonyms: string[] = [];
    data.forEach((entry: any) => {
      if (entry.meta && entry.meta.syns && entry.meta.syns.length > 0) {
        entry.meta.syns.forEach((synGroup: string[]) => {
          synonyms.push(...synGroup);
        });
      }
    });
    
    return [...new Set(synonyms)]; // Return unique synonyms
  } catch (error) {
    console.error('Error fetching synonyms:', error);
    return [];
  }
};

// Get random words of the same part of speech from the local words.json
export const getRandomWordsOfSamePartOfSpeech = async (
  partOfSpeech: string,
  count: number = 3
): Promise<string[]> => {
  const normalizedPos = partOfSpeech.toLowerCase();
  const pos = normalizedPos === 'adj' ? 'adjective' :
              normalizedPos === 'adv' ? 'adverb' :
              normalizedPos === 'v' ? 'verb' : normalizedPos;

  // Filter words from the local JSON by the normalized part of speech
  const filteredWords = words
    .filter(word => word.category.toLowerCase() === pos)
    .map(word => word.word)
    .filter(word => !hasBeenUsedRecently(word)); // Exclude recently used words

  // If we don't have enough, use the fallback
  if (filteredWords.length < count) {
    const fallbackWords = getFallbackWords(partOfSpeech, count);
    return shuffleArray(fallbackWords).slice(0, count);
  }

  // Shuffle and get the required number of words
  const selectedWords = shuffleArray(filteredWords).slice(0, count);
  
  // Add to cache
  selectedWords.forEach(addToUsedWordsCache);

  return selectedWords;
};

export interface WordData {
  word: string;
  type: string;
  pronunciation: string;
  definition: string;
  example: string;
  synonyms: string[];
  antonyms: string[];
}

const getDayOfYear = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = (now.getTime() - start.getTime()) + ((start.getTimezoneOffset() - now.getTimezoneOffset()) * 60 * 1000);
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
};

export const getWordOfTheDay = async (): Promise<WordData> => {
  const dayOfYear = getDayOfYear();
  const index = (dayOfYear - 1) % dailyWords.length;
  const dailyWord = dailyWords[index];

  try {
    const data = await safeFetchAndParseJson(`https://www.dictionaryapi.com/api/v3/references/thesaurus/json/${dailyWord.word}?key=${THESAURUS_API_KEY}`);

    let synonyms: string[] = [];
    let antonyms: string[] = [];

    if (data && data.length > 0) {
      const entry = data[0];
      if (entry.meta && entry.meta.syns && entry.meta.syns.length > 0) {
        synonyms = entry.meta.syns.flat().slice(0, 5);
      }
      if (entry.meta && entry.meta.ants && entry.meta.ants.length > 0) {
        antonyms = entry.meta.ants.flat().slice(0, 5);
      }
    }
    
    return {
      word: dailyWord.word,
      type: dailyWord.category,
      pronunciation: dailyWord.pronunciation,
      definition: dailyWord.meaning,
      example: dailyWord.example,
      synonyms,
      antonyms,
    };
  } catch (error) {
    console.error("Failed to fetch word data from Merriam-Webster API:", error);
    return {
      word: dailyWord.word,
      type: dailyWord.category,
      pronunciation: dailyWord.pronunciation,
      definition: dailyWord.meaning,
      example: dailyWord.example,
      synonyms: [],
      antonyms: []
    };
  }
};

export const getPreviousWords = (days: number = 5): { word: string }[] => {
  const previousWords: { word: string }[] = [];
  const dayOfYear = getDayOfYear();
  const totalWords = dailyWords.length;

  for (let i = 1; i <= days; i++) {
    const pastDayOfYear = dayOfYear - i;
    // Handle wrapping around the year and the array
    // The modulo operator in JS handles negative numbers correctly for this purpose
    const index = ((pastDayOfYear - 1) % totalWords + totalWords) % totalWords;
    if (dailyWords[index]) {
      previousWords.push({ word: dailyWords[index].word });
    }
  }
  return previousWords;
};

// Get fallback words when API fails
const getFallbackWords = (partOfSpeech: string, count: number): string[] => {
  // Large collection of varied words for each part of speech
  const fallbackWords: Record<string, string[]> = {
    noun: [
      'apple', 'banana', 'car', 'dog', 'elephant', 'fish', 'guitar', 'house', 'island', 'jacket',
      'key', 'lion', 'mountain', 'notebook', 'ocean', 'piano', 'queen', 'river', 'sunset', 'tiger',
      'umbrella', 'violin', 'window', 'xylophone', 'yacht', 'zebra', 'airport', 'beach', 'coffee', 'diamond'
    ],
    verb: [
      'accept', 'begin', 'carry', 'dance', 'enjoy', 'finish', 'grow', 'hope', 'improve', 'jump',
      'knock', 'learn', 'move', 'notice', 'open', 'paint', 'question', 'remember', 'sing', 'travel',
      'understand', 'visit', 'wait', 'yell', 'zoom', 'appreciate', 'breathe', 'celebrate', 'dream', 'explore'
    ],
    adjective: [
      'amazing', 'bold', 'calm', 'delicate', 'elegant', 'fancy', 'gentle', 'happy', 'intelligent', 'jolly',
      'kind', 'logical', 'mysterious', 'narrow', 'obvious', 'peaceful', 'quiet', 'remarkable', 'simple', 'tall',
      'unique', 'valuable', 'warm', 'young', 'zealous', 'adventurous', 'brilliant', 'charming', 'delightful', 'energetic'
    ],
    adverb: [
      'actually', 'boldly', 'calmly', 'deeply', 'easily', 'faithfully', 'gently', 'happily', 'immediately', 'joyfully',
      'kindly', 'loosely', 'mysteriously', 'nearly', 'openly', 'perfectly', 'quietly', 'rapidly', 'silently', 'truly',
      'usually', 'very', 'warmly', 'yearly', 'zealously', 'accidentally', 'briefly', 'carefully', 'deliberately', 'elegantly'
    ]
  };
  
  const normalizedPos = partOfSpeech.toLowerCase();
  const pos = normalizedPos === 'adj' || normalizedPos === 'adjective' ? 'adjective' : 
              normalizedPos === 'adv' || normalizedPos === 'adverb' ? 'adverb' : 
              normalizedPos === 'v' || normalizedPos === 'verb' ? 'verb' : 'noun';
  
  // Get words that haven't been recently used
  const wordList = fallbackWords[pos] || fallbackWords.noun;
  const unusedWords = wordList.filter(word => !hasBeenUsedRecently(word));
  
  // Use unused words if possible, otherwise fall back to the full list
  const wordsToChooseFrom = unusedWords.length >= count ? unusedWords : wordList;
  
  const selectedWords = shuffleArray(wordsToChooseFrom).slice(0, count);
  
  // Add selected words to cache
  selectedWords.forEach(addToUsedWordsCache);
  
  return selectedWords;
};

// Helper function to shuffle array
const shuffleArray = <T>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Function to get a sample quiz for a word
export const generateQuiz = async (
  word: string, 
  partOfSpeech: string
): Promise<{ options: string[], correctAnswer: string }> => {
  try {
    // Get synonyms for the word
    const synonyms = await getSynonyms(word);
    
    // Select one synonym as the correct answer (if available)
    let correctAnswer = '';
    if (synonyms.length > 0) {
      // Try to find a synonym that hasn't been used recently
      const unusedSynonyms = synonyms.filter(syn => !hasBeenUsedRecently(syn));
      
      if (unusedSynonyms.length > 0) {
        // Choose from unused synonyms
        correctAnswer = unusedSynonyms[Math.floor(Math.random() * unusedSynonyms.length)];
      } else {
        // If all synonyms have been used, just pick any
        correctAnswer = synonyms[Math.floor(Math.random() * synonyms.length)];
      }
    } else {
      // Fallback if no synonyms found
      correctAnswer = word;
    }
    
    // Add the correct answer to cache
    addToUsedWordsCache(correctAnswer);

    // Get contrasting words with the cache-busting timestamp
    const timestamp = Date.now() + Math.floor(Math.random() * 1000);
    let distractors: string[] = [];
    
    // Try to get antonyms with random timestamp to avoid caching
    const contrastingWords = await getContrastingWords(word, partOfSpeech, timestamp);
    
    if (contrastingWords.length > 0) {
      // Use 1-2 contrasting words to ensure variety
      const numContrasting = Math.min(2, contrastingWords.length);
      distractors = contrastingWords.slice(0, numContrasting);
    }
    
    // Fill remaining slots with random words
    const numNeeded = 3 - distractors.length;
    if (numNeeded > 0) {
      const randomWords = await getRandomWordsOfSamePartOfSpeech(partOfSpeech, numNeeded);
      distractors = [...distractors, ...randomWords];
    }
    
    // Filter out any accidental synonyms
    distractors = distractors.filter(distractor => 
      !synonyms.includes(distractor) && 
      distractor.toLowerCase() !== correctAnswer.toLowerCase()
    );
    
    // If we're still short on distractors, get more random words
    if (distractors.length < 3) {
      const additionalWords = await getRandomWordsOfSamePartOfSpeech(partOfSpeech, 3 - distractors.length);
      distractors = [...distractors, ...additionalWords];
    }
    
    // Ensure exactly 3 distractors
    distractors = distractors.slice(0, 3);
    
    // Add distractors to cache
    distractors.forEach(addToUsedWordsCache);
    
    // Combine and shuffle options
    const options = [correctAnswer, ...distractors];
    const shuffledOptions = shuffleArray(options);
    
    console.log("Quiz options for", word, ":", shuffledOptions);
    
    return {
      options: shuffledOptions,
      correctAnswer
    };
  } catch (error) {
    console.error('Error generating quiz:', error);
    
    // Fallback
    const fallbackWords = getFallbackWords(partOfSpeech, 3);
    const options = [word, ...fallbackWords];
    
    return {
      options: shuffleArray(options),
      correctAnswer: word
    };
  }
};

// Helper function to find contrasting words
const getContrastingWords = async (
  word: string, 
  partOfSpeech: string,
  timestamp: number = Date.now()
): Promise<string[]> => {
  try {
    // First try to get antonyms via the thesaurus API with cache busting
    const data = await safeFetchAndParseJson(
      `https://www.dictionaryapi.com/api/v3/references/thesaurus/json/${word}?key=${THESAURUS_API_KEY}&t=${timestamp}`
    );
    
    if (data && data.length > 0 && typeof data[0] !== 'string') {
      // Extract antonyms from the API response
      const antonyms: string[] = [];
      data.forEach((entry: any) => {
        if (entry.meta && entry.meta.ants && entry.meta.ants.length > 0) {
          entry.meta.ants.forEach((antGroup: string[]) => {
            antonyms.push(...antGroup);
          });
        }
      });
      
      // Filter out antonyms that have been used recently
      const filteredAntonyms = [...new Set(antonyms)]
        .filter(ant => !hasBeenUsedRecently(ant));
      
      // If we found antonyms, return those
      if (filteredAntonyms.length > 0) {
        // Add these to the used words cache
        filteredAntonyms.forEach(addToUsedWordsCache);
        return filteredAntonyms;
      }
    }
    
    // If no antonyms found, try contrast seeds
    const contrastSeeds = {
      noun: ['opposite', 'contrary', 'antithesis', 'difference'],
      verb: ['stop', 'prevent', 'hinder', 'cease'],
      adjective: ['contrary', 'opposite', 'different', 'disparate'],
      adverb: ['contrarily', 'oppositely', 'differently', 'disparately']
    };
    
    const normalizedPos = partOfSpeech.toLowerCase();
    const pos = normalizedPos === 'adj' || normalizedPos === 'adjective' ? 'adjective' : 
                normalizedPos === 'adv' || normalizedPos === 'adverb' ? 'adverb' : 
                normalizedPos === 'v' || normalizedPos === 'verb' ? 'verb' : 'noun';
    
    const seedList = contrastSeeds[pos as keyof typeof contrastSeeds] || contrastSeeds.noun;
    const seedWord = seedList[Math.floor(Math.random() * seedList.length)];
    
    // Get synonyms of the contrast seed word
    const relatedWords = await getSynonyms(seedWord);
    
    return relatedWords.filter(w => !hasBeenUsedRecently(w));
  } catch (error) {
    console.error('Error fetching contrasting words:', error);
    return [];
  }
};

export default {
  getSynonyms,
  getRandomWordsOfSamePartOfSpeech,
  generateQuiz,
  getWordOfTheDay,
  getPreviousWords,
}; 