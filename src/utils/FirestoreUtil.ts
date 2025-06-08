import { getFirestoreInstance } from '../services/FirestoreConfig';
import { doc, getDoc, collection, getDocs, enableNetwork } from 'firebase/firestore';

/**
 * Retry helper function for Firestore operations
 * @param operation Function to retry
 * @param maxRetries Maximum number of retries
 * @param delay Delay between retries in ms
 */
async function retry<T>(
  operation: () => Promise<T>, 
  maxRetries: number = 3, 
  delay: number = 1000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      console.log(`Attempt ${attempt} failed: ${error.message}. ${attempt < maxRetries ? 'Retrying...' : 'Max retries reached.'}`);
      
      if (attempt < maxRetries) {
        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
  }
  
  throw lastError;
}

/**
 * Get user document with retry
 */
export async function getUserDocument(userId: string) {
  const db = await getFirestoreInstance();
  
  return retry(async () => {
    console.log(`Fetching user document for ${userId}...`);
    const userDocRef = doc(db, `users/${userId}`);
    const userDoc = await getDoc(userDocRef);
    console.log(`User document exists: ${userDoc.exists()}`);
    return userDoc;
  });
}

/**
 * Get user words with retry
 */
export async function getUserWords(userId: string) {
  const db = await getFirestoreInstance();
  
  return retry(async () => {
    console.log(`Fetching words for user ${userId}...`);
    const wordsCollectionRef = collection(db, `users/${userId}/words`);
    const wordsSnapshot = await getDocs(wordsCollectionRef);
    console.log(`Found ${wordsSnapshot.docs.length} word documents`);
    return wordsSnapshot;
  });
}

/**
 * Check if Firestore is available
 */
export async function checkFirestoreAvailability(): Promise<boolean> {
  try {
    // Get the Firestore instance first
    const db = await getFirestoreInstance();
    
    // Explicitly try to enable network in case it's in offline mode
    try {
      await enableNetwork(db);
      console.log("Firestore network explicitly enabled during availability check");
    } catch (networkError) {
      console.warn("Failed to enable Firestore network during check:", networkError);
    }
    
    // Perform an actual Firestore operation to verify connectivity
    // Try to access a known collection
    const testRef = collection(db, 'system_status');
    try {
      await getDocs(testRef);
      console.log("Firestore connectivity verified with successful query");
      return true;
    } catch (queryError: any) {
      // If we get a permission error, that means we connected but don't have access
      // which is still a successful connection test
      if (queryError.code === 'permission-denied') {
        console.log("Firestore connection successful (permission error, but connectivity confirmed)");
        return true;
      }
      
      // If we're offline, try to get a different error message
      if (queryError.code === 'unavailable' || queryError.message.includes('offline')) {
        console.error("Firestore is unavailable or offline:", queryError);
        return false;
      }
      
      // Fallback check with fetch API
      try {
        await fetch('https://firestore.googleapis.com', { 
          method: 'HEAD', 
          mode: 'no-cors'
        });
        console.log("Firestore domain is reachable, assuming connectivity issues are temporary");
        return true;
      } catch (fetchError) {
        console.error("Firestore availability check completely failed:", fetchError);
        return false;
      }
    }
  } catch (error) {
    console.error('Firestore availability check failed:', error);
    return false;
  }
}

/**
 * Create a dummy document to verify write operations
 */
export async function verifyFirestoreWriteAccess(userId: string): Promise<boolean> {
  try {
    const db = await getFirestoreInstance();
    const testDocRef = doc(db, `users/${userId}/test/connectivity`);
    
    // We don't actually write anything, just verify we can get the document reference
    return !!testDocRef;
  } catch (error) {
    console.error('Firestore write access verification failed:', error);
    return false;
  }
} 