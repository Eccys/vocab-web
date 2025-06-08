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

  // Set up the auth state listener
  useEffect(() => {
    console.log("Setting up auth state listener...");
    const unsubscribe = onAuthStateChange((user) => {
      console.log("Auth state changed:", user ? "User signed in" : "No user");
      setCurrentUser(user);
      setLoading(false);
    });

    // Check for current user on mount
    getCurrentUser().then(user => {
      if (user && !currentUser) {
        console.log("Found existing user session on mount:", user.uid);
        setCurrentUser(user);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

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