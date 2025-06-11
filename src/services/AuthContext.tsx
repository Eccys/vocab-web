import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { 
  signInWithGoogle, 
  signInWithEmail, 
  createUserWithEmail, 
  signOutUser, 
  getCurrentUser,
  onAuthStateChange
} from './FirebaseService';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  signIn: {
    withGoogle: () => Promise<User | null>;
    withEmail: (email: string, password: string) => Promise<User | null>;
  };
  signUp: (email: string, password: string) => Promise<User | null>;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
}

// Create a context with a default undefined value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Export the AuthProvider component
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authInitialized, setAuthInitialized] = useState<boolean>(false);

  // Set up the auth state listener
  useEffect(() => {
    let authStateUnsubscribe: () => void;
    
    const setupAuth = async () => {
      console.log("Setting up auth state listener...");
      
      // First check for current user synchronously
      try {
        const user = await getCurrentUser();
        if (user) {
          console.log("Found existing user session on initialization:", user.uid);
          setCurrentUser(user);
        }
      } catch (error) {
        console.error("Error checking current user:", error);
      }
      
      // Then set up the auth state listener for future changes
      authStateUnsubscribe = onAuthStateChange((user) => {
        console.log("Auth state changed:", user ? "User signed in" : "No user");
        setCurrentUser(user);
        setLoading(false);
        setAuthInitialized(true);
      });
    };
    
    setupAuth();
    
    // Clean up on unmount
    return () => {
      if (authStateUnsubscribe) {
        authStateUnsubscribe();
      }
    };
  }, []);

  // If user was already set in the first check, make sure loading is set to false
  useEffect(() => {
    if (currentUser && loading && !authInitialized) {
      console.log("User already authenticated, setting loading to false");
      setLoading(false);
    }
  }, [currentUser, loading, authInitialized]);

  const signIn = {
    withGoogle: async () => {
      try {
        const user = await signInWithGoogle();
        return user;
      } catch (error) {
        console.error('Error signing in with Google:', error);
        return null;
      }
    },
    withEmail: async (email: string, password: string) => {
      try {
        const user = await signInWithEmail(email, password);
        return user;
      } catch (error) {
        console.error('Error signing in with email:', error);
        return null;
      }
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      const user = await createUserWithEmail(email, password);
      return user;
    } catch (error) {
      console.error('Error signing up:', error);
      return null;
    }
  };

  const signOut = async () => {
    try {
      await signOutUser();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const value = {
    currentUser,
    loading,
    signIn,
    signUp,
    signOut,
    isAuthenticated: !!currentUser
  };
  
  // Only log on value changes
  useEffect(() => {
    console.log("AuthContext value changed:", { 
      isAuthenticated: !!currentUser, 
      hasUser: !!currentUser, 
      loading 
    });
  }, [!!currentUser, loading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Export the hook for using the auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Export the AuthContext as default
export default AuthContext; 