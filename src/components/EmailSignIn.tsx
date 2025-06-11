import React, { useState } from 'react';
import { useAuth } from '../services/AuthContext';
import '../styles/EmailSignIn.css';

interface EmailSignInProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const EmailSignIn: React.FC<EmailSignInProps> = ({ onSuccess, onCancel }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { signIn, signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        // Handle login
        const user = await signIn.withEmail(email, password);
        if (user) {
          onSuccess();
        } else {
          setError('Failed to sign in. Please check your credentials.');
        }
      } else {
        // Handle sign up
        if (password !== confirmPassword) {
          setError('Passwords do not match');
          setLoading(false);
          return;
        }

        const user = await signUp(email, password);
        if (user) {
          onSuccess();
        } else {
          setError('Failed to create account. Email may already be in use.');
        }
      }
    } catch (error: any) {
      setError(error.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="email-sign-in-container">
      <button className="back-button" onClick={onCancel}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
          <path fill="currentColor" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
        </svg>
        Back
      </button>
      
      <h2>{isLogin ? 'Sign In' : 'Create Account'}</h2>
      
      {error && <div className="auth-error">{error}</div>}
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>
        
        {!isLogin && (
          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
        )}
        
        <button 
          type="submit" 
          className="submit-button"
          disabled={loading}
        >
          {loading ? 'Processing...' : isLogin ? 'Sign In' : 'Sign Up'}
        </button>
      </form>
      
      <div className="auth-toggle">
        {isLogin ? "Don't have an account? " : "Already have an account? "}
        <button 
          className="toggle-button" 
          onClick={() => {
            setIsLogin(!isLogin);
            setError('');
          }}
        >
          {isLogin ? 'Sign Up' : 'Sign In'}
        </button>
      </div>
    </div>
  );
};

export default EmailSignIn; 