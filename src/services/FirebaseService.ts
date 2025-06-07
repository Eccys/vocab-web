import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';

// Firebase configuration
// We'll load this directly instead of using env vars to avoid TypeScript errors
const firebaseConfig = {
  apiKey: "AIzaSyDummyKeyForPlaceholder",
  authDomain: "vocab-web-app.firebaseapp.com",
  projectId: "vocab-web-app",
  storageBucket: "vocab-web-app.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890"
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
      
      return {
        apiKey,
        authDomain: `${projectInfo.project_id}.firebaseapp.com`,
        databaseURL: projectInfo.firebase_url,
        projectId: projectInfo.project_id,
        storageBucket: projectInfo.storage_bucket,
        messagingSenderId: projectInfo.project_number,
        appId: clientInfo.mobilesdk_app_id
      };
    }
    return firebaseConfig; // Fall back to default if file not found
  } catch (error) {
    console.error('Error loading Firebase config:', error);
    return firebaseConfig; // Fall back to default config
  }
};

// Initialize Firebase
let app = initializeApp(firebaseConfig);
let auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Try to load the actual configuration
loadFirebaseConfig().then(config => {
  // Reinitialize Firebase with the loaded config
  app = initializeApp(config, 'vocab-web-app');
  auth = getAuth(app);
}).catch(error => {
  console.error('Failed to initialize Firebase with loaded config:', error);
});

// Sign in with Google
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Error signing in with Google: ', error);
    throw error;
  }
};

// Sign in with email and password
export const signInWithEmail = async (email: string, password: string) => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (error) {
    console.error('Error signing in with email: ', error);
    throw error;
  }
};

// Create a new user with email and password
export const createUserWithEmail = async (email: string, password: string) => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (error) {
    console.error('Error creating user: ', error);
    throw error;
  }
};

// Sign out
export const signOutUser = async () => {
  try {
    await signOut(auth);
    console.log('User signed out successfully');
  } catch (error) {
    console.error('Error signing out: ', error);
    throw error;
  }
};

// Get current user
export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

// Listen for auth state changes
export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

export default auth; 