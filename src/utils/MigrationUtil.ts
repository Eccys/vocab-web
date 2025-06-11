import { getFirestoreInstance } from '../services/FirestoreConfig';
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc, 
  writeBatch, 
  deleteDoc, 
  setDoc, 
  DocumentData,
  enableNetwork,
  disableNetwork,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { getUserDocument, getUserWords, checkFirestoreAvailability } from './FirestoreUtil';

/**
 * Migrates individual word documents to a single consolidated document
 * @param userId User ID to migrate data for
 * @returns The migrated data
 */
export async function migrateToSingleDocument(userId: string) {
  try {
    console.log(`Attempting to fetch words for user ID: ${userId}`);
    console.log(`Looking in collection path: users/${userId}/words`);
    
    // Check network status
    try {
      const networkStatus = await fetch('https://firestore.googleapis.com', { method: 'HEAD', mode: 'no-cors' });
      console.log('Network check to Firestore: Successful');
    } catch (error) {
      console.warn('Network check to Firestore: Failed - may be offline');
    }
    
    // Get Firestore instance
    const db = await getFirestoreInstance();
    console.log('Got Firestore instance, proceeding with migration');
    
    // 1. Get all individual word documents
    const wordsCollectionRef = collection(db, `users/${userId}/words`);
    const wordsSnapshot = await getDocs(wordsCollectionRef);
    
    console.log(`Found ${wordsSnapshot.docs.length} word documents`);
    if (wordsSnapshot.docs.length > 0) {
      console.log(`First document ID: ${wordsSnapshot.docs[0].id}`);
    } else {
      console.log(`No documents found. Checking if user document exists...`);
      const userDocRef = doc(db, `users/${userId}`);
      const userDoc = await getDoc(userDocRef);
      console.log(`User document exists: ${userDoc.exists()}`);
    }
    
    // 2. Create the consolidated structure
    const consolidatedWords: any = {
      lastUpdated: serverTimestamp(),
      words: {}
    };
    
    // 3. Loop through each document and add to the new structure
    wordsSnapshot.docs.forEach(docSnapshot => {
      const wordData = docSnapshot.data();
      const wordId = docSnapshot.id; // Assuming document ID is the word itself
      
      // Add this word to our consolidated object
      consolidatedWords.words[wordId] = {
        easeFactor: wordData.easeFactor || 2.5,
        interval: wordData.interval || 0,
        isBookmarked: wordData.isBookmarked || false,
        lastReviewed: wordData.lastReviewed || 0,
        lastUpdated: wordData.lastUpdated || 0,
        nextReviewDate: wordData.nextReviewDate || 0,
        quality: wordData.quality || 0,
        repetitionCount: wordData.repetitionCount || 0,
        timesCorrect: wordData.timesCorrect || 0,
        timesReviewed: wordData.timesReviewed || 0
      };
    });
    
    // 4. Save the consolidated data to a single document
    const wordDataDocRef = doc(db, `users/${userId}/wordData/allWords`);
    await setDoc(wordDataDocRef, consolidatedWords);
    
    console.log("Migration completed successfully!");
    
    // OPTIONAL: Return the data for verification
    return consolidatedWords;
  } catch (error) {
    console.error("Error during migration:", error);
    throw error;
  }
}

/**
 * Deletes the old individual word documents
 * CAUTION: Only call this after verifying migration success
 * @param userId User ID to delete old documents for
 */
export async function deleteOldDocuments(userId: string) {
  try {
    // Get Firestore instance
    const db = await getFirestoreInstance();
    console.log('Got Firestore instance for deletion');
    
    const batch = writeBatch(db);
    
    const wordsCollectionRef = collection(db, `users/${userId}/words`);
    const wordsSnapshot = await getDocs(wordsCollectionRef);
    
    wordsSnapshot.docs.forEach(docSnapshot => {
      batch.delete(docSnapshot.ref);
    });
    
    await batch.commit();
    console.log(`Deleted ${wordsSnapshot.docs.length} old documents`);
  } catch (error) {
    console.error("Error deleting old documents:", error);
    throw error;
  }
}

export async function migrateWordsToUserDocument(userId: string, 
  onProgress?: (progress: number, status: string) => void
): Promise<{success: boolean, message: string, totalWords?: number}> {
  try {
    console.log(`Attempting to fetch words for user ID: ${userId}`);
    
    // Enhanced Firestore connectivity checks
    onProgress?.(5, "Checking Firestore connectivity...");
    
    // Get the Firestore instance first
    const db = await getFirestoreInstance();
    
    // Try toggling network state to reset any stale connections
    try {
      console.log("Explicitly toggling network to reset connection state");
      await disableNetwork(db);
      console.log("Network disabled temporarily");
      await new Promise(resolve => setTimeout(resolve, 1000)); // Brief pause
      await enableNetwork(db);
      console.log("Network re-enabled");
    } catch (networkError) {
      console.warn("Network toggle failed:", networkError);
      // Continue anyway
    }
    
    // Verify Firestore connectivity
    const isAvailable = await checkFirestoreAvailability();
    if (!isAvailable) {
      return { 
        success: false, 
        message: "Cannot connect to Firestore. Please check your internet connection and try again." 
      };
    }
    
    console.log("Got Firestore instance, proceeding with migration");
    
    // DEBUG: Test firestore basic operations
    try {
      // Try to access a system collection first
      const testRef = collection(db, 'system');
      try {
        await getDocs(testRef);
        console.log("System collection access successful");
      } catch (testError) {
        console.log("System collection access failed (expected if permissions set correctly)");
        // This is expected to fail with permission error
      }
      
      // Try to create a temporary document in the user's space to test write access
      const testDocRef = doc(db, `users/${userId}/debug/connectivity_test`);
      try {
        await setDoc(testDocRef, { 
          timestamp: new Date().toISOString(),
          connectionTest: true
        });
        console.log("Write test successful");
        // Clean up test document
        await deleteDoc(testDocRef);
      } catch (writeError) {
        console.error("Write test failed:", writeError);
        return {
          success: false,
          message: "Could not write to Firestore. Check your permissions."
        };
      }
    } catch (testError) {
      console.error("Firestore connectivity tests failed:", testError);
    }
    
    // Get all words from user's words collection
    onProgress?.(10, "Retrieving your vocabulary words...");
    
    try {
      const wordsSnapshot = await getUserWords(userId);
      const wordsCount = wordsSnapshot.docs.length;
      
      console.log(`Found ${wordsCount} word documents`);
      
      if (wordsCount === 0) {
        console.log("No documents found. Checking if user document exists...");
        
        // Check if the user already has the migrated document
        const userDocSnapshot = await getUserDocument(userId);
        
        if (userDocSnapshot.exists() && userDocSnapshot.data().words) {
          const existingWords = userDocSnapshot.data().words;
          console.log(`User already has a consolidated document with ${Object.keys(existingWords).length} words`);
          return { 
            success: true, 
            message: `Your data is already migrated with ${Object.keys(existingWords).length} words.`,
            totalWords: Object.keys(existingWords).length 
          };
        }
        
        return { 
          success: false, 
          message: "No vocabulary words found to migrate." 
        };
      }
      
      // Build the consolidated words object
      onProgress?.(30, `Processing ${wordsCount} vocabulary words...`);
      
      const words: Record<string, DocumentData> = {};
      
      wordsSnapshot.docs.forEach((doc, index) => {
        const word = doc.data();
        words[doc.id] = word;
        
        // Update progress periodically
        if (index % 10 === 0) {
          const progressPercent = Math.floor(30 + (index / wordsCount) * 40);
          onProgress?.(progressPercent, `Processing word ${index + 1} of ${wordsCount}...`);
        }
      });
      
      // Get the user document reference
      const userDocRef = doc(db, `users/${userId}`);
      
      try {
        // Get the user document first to preserve other fields
        onProgress?.(75, "Retrieving your user profile...");
        const userDocSnapshot = await getDoc(userDocRef);
        
        // Create or update the user document with the words
        onProgress?.(85, "Saving consolidated data...");
        
        let userData: DocumentData = {};
        
        if (userDocSnapshot.exists()) {
          userData = userDocSnapshot.data();
        }
        
        // Add the words to the user document
        await setDoc(userDocRef, {
          ...userData,
          words,
          lastUpdated: new Date().toISOString(),
        });
        
        onProgress?.(90, "Cleaning up old data...");
        
        // Now delete the individual word documents
        let deleted = 0;
        const batchSize = 20; // Firestore allows 500 operations per batch, but we'll use a smaller number
        
        // Use batching for better performance
        for (let i = 0; i < wordsSnapshot.docs.length; i += batchSize) {
          const batch = writeBatch(db);
          
          for (let j = 0; j < batchSize && i + j < wordsSnapshot.docs.length; j++) {
            const docRef = wordsSnapshot.docs[i + j].ref;
            batch.delete(docRef);
          }
          
          await batch.commit();
          deleted += Math.min(batchSize, wordsSnapshot.docs.length - i);
          
          const progressPercent = Math.floor(90 + (deleted / wordsCount) * 10);
          onProgress?.(progressPercent, `Deleted ${deleted} of ${wordsCount} old documents...`);
        }
        
        console.log(`Successfully migrated ${wordsCount} words to user document and deleted old documents.`);
        
        onProgress?.(100, "Migration complete!");
        
        return { 
          success: true, 
          message: `Successfully migrated ${wordsCount} words.`,
          totalWords: wordsCount 
        };
      } catch (error: any) {
        console.error("Error updating user document:", error);
        return { 
          success: false, 
          message: `Error updating user document: ${error.message || "Unknown error"}` 
        };
      }
    } catch (error: any) {
      console.error("Error fetching user words:", error);
      
      // Attempt to create a minimal user document even if we can't read words
      if (error.message.includes("offline")) {
        try {
          const userDocRef = doc(db, `users/${userId}`);
          await setDoc(userDocRef, {
            lastAttemptedMigration: new Date().toISOString(),
            connectionStatus: "offline during migration"
          }, { merge: true });
          console.log("Created minimal user document during offline state");
        } catch (writeError) {
          console.error("Failed to create minimal document:", writeError);
        }
      }
      
      return { 
        success: false, 
        message: `Error fetching your vocabulary words: ${error.message || "Unknown error"}` 
      };
    }
    
  } catch (error: any) {
    console.error("Error during migration:", error);
    return { 
      success: false, 
      message: `Migration failed: ${error.message || "Unknown error"}` 
    };
  }
} 