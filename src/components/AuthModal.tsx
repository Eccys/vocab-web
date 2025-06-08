import React, { useState, useEffect } from 'react';
import { useAuth } from '../services/AuthContext';
import EmailSignIn from './EmailSignIn';
import '../styles/AuthModal.css';
import ReactDOM from 'react-dom';

interface AuthModalProps {
  onSuccess: () => void;
  onCancel: () => void;
  isOpen: boolean;
}

const AuthModal: React.FC<AuthModalProps> = ({ onSuccess, onCancel, isOpen }) => {
  const [showEmailSignIn, setShowEmailSignIn] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  
  const { signIn, currentUser } = useAuth();

  // Monitor authentication state to auto-close modal when user is authenticated
  useEffect(() => {
    if (currentUser && isOpen) {
      console.log("User authenticated, closing modal");
      onSuccess();
    }
  }, [currentUser, isOpen, onSuccess]);

  // Handle Google sign-in
  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    setAuthError(null);
    
    try {
      console.log("Attempting Google sign-in...");
      const user = await signIn.withGoogle();
      console.log("Google sign-in result:", user);
      
      if (user) {
        console.log("Sign-in successful, closing modal");
        onSuccess();
      }
    } catch (error: any) {
      console.error("Google sign-in error:", error);
      setAuthError(error.message || 'Failed to sign in with Google');
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle showing email sign-in form
  const handleShowEmailSignIn = () => {
    setShowEmailSignIn(true);
  };

  // Handle email sign-in cancel
  const handleEmailSignInCancel = () => {
    setShowEmailSignIn(false);
  };

  // Handle successful email auth
  const handleEmailAuthSuccess = () => {
    setShowEmailSignIn(false);
    onSuccess();
  };

  if (!isOpen) return null;
  
  // Use a portal to render the modal outside of the header
  return ReactDOM.createPortal(
    <div className="modal-overlay">
      <div className="sign-in-modal">
        {showEmailSignIn ? (
          <EmailSignIn 
            onSuccess={handleEmailAuthSuccess} 
            onCancel={handleEmailSignInCancel} 
          />
        ) : (
          <>
            <h2>Save Your Progress</h2>
            <p>Sign in to track your learning progress and save your stats!</p>
            
            {authError && <div className="auth-error">{authError}</div>}
            
            <div className="sign-in-options">
              <button 
                className="google-sign-in" 
                onClick={handleGoogleSignIn}
                disabled={authLoading}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512" width="20" height="20">
                  <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"/>
                </svg>
                {authLoading ? 'Signing in...' : 'Sign in with Google'}
              </button>
              <button 
                className="email-sign-in"
                onClick={handleShowEmailSignIn}
                disabled={authLoading}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="20" height="20">
                  <path fill="currentColor" d="M48 64C21.5 64 0 85.5 0 112c0 15.1 7.1 29.3 19.2 38.4L236.8 313.6c11.4 8.5 27 8.5 38.4 0L492.8 150.4c12.1-9.1 19.2-23.3 19.2-38.4c0-26.5-21.5-48-48-48H48zM0 176V384c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V176L294.4 339.2c-22.8 17.1-54 17.1-76.8 0L0 176z"/>
                </svg>
                Sign in with Email
              </button>
              <button 
                className="skip-sign-in" 
                onClick={onCancel}
                disabled={authLoading}
              >
                No thanks, continue as guest
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
};

export default AuthModal; 