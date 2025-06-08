import { getFirestore, enableIndexedDbPersistence, initializeFirestore as createFirestore, connectFirestoreEmulator, CACHE_SIZE_UNLIMITED, enableNetwork } from 'firebase/firestore';
import { getApp } from 'firebase/app';

// Global variables for tracking instance and initialization state
let firestoreInstance: any = null;
let isInitializing = false;
let initializationPromise: Promise<any> | null = null;

/**
 * Get the Firestore instance with persistence enabled
 * Uses singleton pattern to avoid multiple initializations
 */
export async function getFirestoreInstance() {
  // If we already have an instance, return it
  if (firestoreInstance !== null) {
    console.log("Firestore already initialized, reusing instance");
    return firestoreInstance;
  }
  
  // If initialization is in progress, wait for it to complete
  if (isInitializing && initializationPromise) {
    console.log("Firestore initialization in progress, waiting...");
    return initializationPromise;
  }
  
  // Start initialization
  isInitializing = true;
  
  initializationPromise = new Promise(async (resolve, reject) => {
    try {
      // Get the Firebase app instance
      const app = getApp();
      
      // Log project info for debugging
      console.log("Initializing Firestore with project:", app.options.projectId);
      console.log("Auth domain:", app.options.authDomain);
      
      // Initialize Firestore with settings for better offline support
      firestoreInstance = createFirestore(app, {
        cacheSizeBytes: CACHE_SIZE_UNLIMITED
      });
      
      try {
        // Enable IndexedDB persistence for offline capability
        await enableIndexedDbPersistence(firestoreInstance);
        console.log("Firestore persistence enabled successfully");
      } catch (error: any) {
        // Handle persistence errors (still allow the app to continue)
        if (error.code === 'failed-precondition') {
          console.warn(
            "Firestore persistence could not be enabled because multiple tabs are open. " +
            "Offline persistence will not work."
          );
        } else if (error.code === 'unimplemented') {
          console.warn(
            "Firestore persistence not enabled because this browser doesn't support required features."
          );
        } else {
          console.warn("Error enabling Firestore persistence:", error);
        }
      }
      
      // Explicitly enable network
      try {
        await enableNetwork(firestoreInstance);
        console.log("Firestore network explicitly enabled");
      } catch (networkError) {
        console.warn("Failed to enable Firestore network:", networkError);
      }
      
      // Connect to emulator if in local dev environment
      if (window.location.hostname === 'localhost') {
        try {
          // Check if we should connect to emulator (could use env vars here)
          const useEmulator = false; // Set to true to use emulator
          
          if (useEmulator) {
            connectFirestoreEmulator(firestoreInstance, 'localhost', 8080);
            console.log("Connected to Firestore emulator");
          }
        } catch (emulatorError) {
          console.warn("Failed to connect to Firestore emulator:", emulatorError);
        }
      }
      
      resolve(firestoreInstance);
    } catch (error) {
      console.error("Failed to initialize Firestore:", error);
      // Reset flags to allow retry
      isInitializing = false;
      initializationPromise = null;
      reject(error);
    } finally {
      // Reset initialization flag
      isInitializing = false;
    }
  });
  
  return initializationPromise;
}

/**
 * Initialize Firestore
 */
export async function initializeFirestore() {
  try {
    const db = await getFirestoreInstance();
    console.log("Firestore initialized successfully, project:", db.app.options.projectId);
    return db;
  } catch (error) {
    console.error("Error initializing Firestore:", error);
    throw error;
  }
}

/**
 * Verify Firestore connectivity
 */
export async function verifyFirestoreConnectivity(): Promise<boolean> {
  try {
    // First, check if we can reach the Firestore domain
    const networkCheckPromise = fetch('https://firestore.googleapis.com', { 
      method: 'HEAD',
      mode: 'no-cors' 
    });
    
    // Set a timeout
    const timeoutPromise = new Promise<Response>((_, reject) => {
      setTimeout(() => reject(new Error('Network check timeout')), 5000);
    });
    
    // Race the network check against the timeout
    await Promise.race([networkCheckPromise, timeoutPromise]);
    
    // If we get here, network is reachable
    console.log("Network check passed, getting Firestore instance");
    
    // Try to get the Firestore instance
    await getFirestoreInstance();
    
    return true;
  } catch (error) {
    console.error("Firestore connectivity check failed:", error);
    return false;
  }
} 