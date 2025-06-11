import { initializeApp, deleteApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider, 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  AuthError,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';

// Get the current hostname to determine the correct authDomain
const hostname = window.location.hostname;
const isLocalhost = hostname === 'localhost';
const isProduction = hostname === 'vocab.ecys.xyz';

console.log(`Firebase initializing for environment: ${isLocalhost ? 'localhost' : isProduction ? 'production' : 'other'}`);

// Firebase configuration
// We'll load this directly instead of using env vars to avoid TypeScript errors
const firebaseConfig = {
  apiKey: "AIzaSyAxfuOo8DaQCR9kVBkFfjl6gr7NgH_ygaQ",
  authDomain: "vocabulary-boost.firebaseapp.com", // Updated to correct Firebase project
  projectId: "vocabulary-boost",
  storageBucket: "vocabulary-boost.firebasestorage.app",
  messagingSenderId: "399691916210",
  appId: "1:399691916210:android:3772621ec42cd9b6bfbaab"
};

// This function will load the actual config from google-services.json at runtime
const loadFirebaseConfig = async () => {
  try {
    const response = await fetch('/google-services.json');
    if (response.ok) {
      const data = await response.json();
      // Extract the configuration from google-services.json format
      const projectInfo = data.project_info;
      const clientInfo = data.client[0].client_info;
      const apiKey = data.client[0].api_key[0].current_key;
      
      // Always use the Firebase domain for auth - this is critical for OAuth redirect
      const authDomain = `${projectInfo.project_id}.firebaseapp.com`;
      
      const config = {
        apiKey,
        authDomain,
        projectId: projectInfo.project_id,
        storageBucket: projectInfo.storage_bucket,
        messagingSenderId: projectInfo.project_number,
        appId: clientInfo.mobilesdk_app_id
      };
      
      console.log('Loaded Firebase config:', { ...config, apiKey: '***HIDDEN***' });
      return config;
    }
    console.log('Could not load google-services.json, using default config');
    return firebaseConfig; // Fall back to default if file not found
  } catch (error) {
    console.error('Error loading Firebase config:', error);
    return firebaseConfig; // Fall back to default config
  }
};

// Initialize Firebase with async IIFE to ensure we only initialize once
const googleProvider = new GoogleAuthProvider();

// Configure Google provider
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Add scopes if needed
googleProvider.addScope('profile');
googleProvider.addScope('email');

// First, load the configuration
let app;
let auth;

// Initialize Firebase and set up auth persistence
const initializeFirebaseApp = async () => {
  try {
    // Try to load the config first
    const config = await loadFirebaseConfig();
    
    // Initialize once with the proper config
    app = initializeApp(config);
    auth = getAuth(app);
    
    // Set persistent auth state to LOCAL (persists even when browser is closed)
    try {
      await setPersistence(auth, browserLocalPersistence);
      console.log('Firebase auth persistence set to LOCAL');
    } catch (error) {
      console.error('Error setting auth persistence:', error);
    }
    
    // Set auth.useDeviceLanguage() to use the default browser language
    auth.useDeviceLanguage();
    
    // Only initialize Firestore when explicitly needed
    console.log('Automatic Firestore initialization disabled');
    
    return { app, auth };
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
    
    // Fall back to default config if loading fails
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    
    // Set persistent auth state to LOCAL (persists even when browser is closed)
    try {
      await setPersistence(auth, browserLocalPersistence);
      console.log('Firebase auth persistence set to LOCAL (fallback)');
    } catch (error) {
      console.error('Error setting auth persistence:', error);
    }
    
    // Set auth.useDeviceLanguage() to use the default browser language
    auth.useDeviceLanguage();
    
    console.log('Automatic Firestore initialization disabled');
    
    return { app, auth };
  }
};

// Initialize Firebase and get the auth instance
const firebaseInitPromise = initializeFirebaseApp();

// Helper function to get the initialized auth
const getInitializedAuth = async () => {
  const { auth: initializedAuth } = await firebaseInitPromise;
  return initializedAuth;
};

// Helper function to format auth errors for better debugging
const formatAuthError = (error: any) => {
  const authError = error as AuthError;
  return {
    code: authError.code,
    message: authError.message,
    customData: authError.customData,
    name: authError.name,
    stack: authError.stack
  };
};

// Sign in with Google - using popup for all environments
export const signInWithGoogle = async () => {
  try {
    console.log('Opening Google sign-in popup...');
    
    // Always use the same provider setup
    const provider = googleProvider;
    
    // Get the initialized auth
    const initializedAuth = await getInitializedAuth();
    
    // Use popup for all environments
    const result = await signInWithPopup(initializedAuth, provider);
    console.log('Google sign-in successful:', {
      uid: result.user.uid,
      email: result.user.email,
      displayName: result.user.displayName,
      authInstance: initializedAuth.name
    });
    return result.user;
  } catch (error) {
    console.error('Error signing in with Google:', formatAuthError(error));
    throw error;
  }
};

// Sign in with email and password
export const signInWithEmail = async (email: string, password: string) => {
  try {
    // Get the initialized auth
    const initializedAuth = await getInitializedAuth();
    
    const result = await signInWithEmailAndPassword(initializedAuth, email, password);
    console.log('Email sign-in successful:', result.user);
    return result.user;
  } catch (error) {
    console.error('Error signing in with email:', formatAuthError(error));
    throw error;
  }
};

// Create a new user with email and password
export const createUserWithEmail = async (email: string, password: string) => {
  try {
    // Get the initialized auth
    const initializedAuth = await getInitializedAuth();
    
    const result = await createUserWithEmailAndPassword(initializedAuth, email, password);
    console.log('User created successfully:', result.user);
    return result.user;
  } catch (error) {
    console.error('Error creating user:', formatAuthError(error));
    throw error;
  }
};

// Sign out
export const signOutUser = async () => {
  try {
    // Get the initialized auth
    const initializedAuth = await getInitializedAuth();
    
    await signOut(initializedAuth);
    console.log('User signed out successfully');
  } catch (error) {
    console.error('Error signing out:', formatAuthError(error));
    throw error;
  }
};

// Get current user
export const getCurrentUser = async (): Promise<User | null> => {
  // Get the initialized auth
  const initializedAuth = await getInitializedAuth();
  return initializedAuth.currentUser;
};

// Listen for auth state changes
export const onAuthStateChange = (callback: (user: User | null) => void) => {
  // Since this is called early during app initialization, we need to handle the promise
  firebaseInitPromise.then(({ auth: initializedAuth }) => {
    return onAuthStateChanged(initializedAuth, (user) => {
      console.log("Firebase auth state changed:", {
        authenticated: !!user,
        userId: user?.uid || 'none',
        email: user?.email || 'none'
      });
      callback(user);
    });
  });
  
  // Return a no-op unsubscribe function in case the promise hasn't resolved yet
  return () => {};
};

export default firebaseInitPromise; // Export the promise to allow waiting for initialization 