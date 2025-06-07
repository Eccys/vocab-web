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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChange((user) => {
      setCurrentUser(user);
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

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext; 