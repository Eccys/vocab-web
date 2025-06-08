import React, { useState, useEffect } from 'react';
import { useAuth } from '../services/AuthContext';
import { migrateWordsToUserDocument } from '../utils/MigrationUtil';
import { checkFirestoreAvailability } from '../utils/FirestoreUtil';
import '../styles/DataMigration.css';
import { getFirestoreInstance } from '../services/FirestoreConfig';
import { enableNetwork } from 'firebase/firestore';
import { checkProjectConfiguration } from '../utils/FirebaseDebugger';
import { directMigrateWords } from '../utils/DirectMigration';
import { getAuth, getIdToken } from 'firebase/auth';

const DataMigration: React.FC = () => {
  const { currentUser, isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);
  const [status, setStatus] = useState<string>('');
  const [isFirestoreAvailable, setIsFirestoreAvailable] = useState<boolean | null>(null);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const [isDiagnosing, setIsDiagnosing] = useState<boolean>(false);
  const [diagnosticResults, setDiagnosticResults] = useState<string>('');

  useEffect(() => {
    // Check Firestore availability when component mounts
    const checkAvailability = async () => {
      try {
        const available = await checkFirestoreAvailability();
        setIsFirestoreAvailable(available);
        if (!available) {
          setError('Cannot connect to Firestore. Please check your internet connection and try again.');
        }
      } catch (err) {
        console.error('Error checking Firestore availability:', err);
        setIsFirestoreAvailable(false);
        setError('Error connecting to Firestore. Please try again later.');
      }
    };
    
    if (isAuthenticated && currentUser) {
      checkAvailability();
    }
  }, [isAuthenticated, currentUser]);

  const handleReconnect = async () => {
    setIsReconnecting(true);
    setError('');
    setStatus('Attempting to reconnect to Firestore...');
    
    try {
      // Get Firestore instance
      const db = await getFirestoreInstance();
      
      // Explicitly enable network
      await enableNetwork(db);
      console.log("Network connectivity explicitly enabled");
      
      // Check if it worked
      const available = await checkFirestoreAvailability();
      setIsFirestoreAvailable(available);
      
      if (available) {
        setMessage('Successfully reconnected to Firestore! You can now try migration.');
        setError('');
      } else {
        setError('Still unable to connect to Firestore. Please check your internet connection.');
      }
    } catch (err: any) {
      console.error('Error during reconnection attempt:', err);
      setError(`Reconnection failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsReconnecting(false);
      setStatus('');
    }
  };

  const handleDiagnostics = async () => {
    setIsDiagnosing(true);
    setDiagnosticResults('');
    setStatus('Running Firebase configuration diagnostics...');
    
    try {
      const results = await checkProjectConfiguration(currentUser?.uid);
      setDiagnosticResults(results);
    } catch (err: any) {
      console.error('Error running diagnostics:', err);
      setDiagnosticResults(`Error running diagnostics: ${err.message || 'Unknown error'}`);
    } finally {
      setIsDiagnosing(false);
      setStatus('');
    }
  };

  const handleMigration = async () => {
    if (!currentUser) {
      setError('You must be logged in to migrate data.');
      return;
    }
    
    // Reset states
    setIsLoading(true);
    setMessage('');
    setError('');
    setProgress(0);
    setStatus('Preparing migration...');
    
    try {
      // Store Firebase token for API calls
      try {
        const auth = getAuth();
        if (auth.currentUser) {
          const token = await getIdToken(auth.currentUser);
          localStorage.setItem('firebase_token', token);
          console.log('Firebase token stored for API calls');
        }
      } catch (tokenError) {
        console.error('Error getting auth token:', tokenError);
      }
      
      // Track progress and status
      const onProgress = (progressValue: number, statusText: string) => {
        setProgress(progressValue);
        setStatus(statusText);
      };
      
      console.log('Starting direct migration for user:', currentUser.uid);
      // Use direct migration approach
      const result = await directMigrateWords(currentUser.uid, onProgress);
      
      if (result.success) {
        setMessage(result.message);
      } else {
        setError(result.message);
      }
    } catch (err: any) {
      console.error('Migration error:', err);
      setError(`Migration failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
      // Reset progress after a delay to show completion
      setTimeout(() => {
        setProgress(0);
        setStatus('');
      }, 3000);
    }
  };

  if (!isAuthenticated || !currentUser) {
    return (
      <div className="data-migration-container">
        <div className="migration-card">
          <h2>Data Migration</h2>
          <p className="error-message">You must be logged in to use this feature.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="data-migration-container">
      <div className="migration-card">
        <h2>Data Migration Tool</h2>
        
        <div className="migration-info">
          <p>
            This tool will consolidate your vocabulary words into a more efficient format.
            This can significantly improve app performance by reducing the number of database operations.
          </p>
          
          {isFirestoreAvailable === false && (
            <div className="network-warning">
              <h3>Network Issue Detected</h3>
              <p>
                You appear to be offline or having connection issues with our database.
                Please check your internet connection and try again.
              </p>
              <div className="button-group">
                <button 
                  className="reconnect-button"
                  onClick={handleReconnect}
                  disabled={isReconnecting}
                >
                  {isReconnecting ? 'Reconnecting...' : 'Reconnect to Firestore'}
                </button>
                <button 
                  className="diagnostic-button"
                  onClick={handleDiagnostics}
                  disabled={isDiagnosing}
                >
                  {isDiagnosing ? 'Running Diagnostics...' : 'Run Diagnostics'}
                </button>
              </div>
            </div>
          )}
          
          {diagnosticResults && (
            <div className="diagnostic-results">
              <h3>Diagnostic Results</h3>
              <pre>{diagnosticResults}</pre>
            </div>
          )}
          
          <div className="migration-benefits">
            <h3>Benefits:</h3>
            <ul>
              <li>Faster app loading time</li>
              <li>Reduced data usage</li>
              <li>Better offline support</li>
            </ul>
          </div>
          
          <div className="migration-notes">
            <h3>Important Notes:</h3>
            <ul>
              <li>Migration typically takes less than a minute</li>
              <li>Your data will not be lost</li>
              <li>You only need to do this once</li>
            </ul>
          </div>
        </div>
        
        {isLoading && (
          <div className="migration-progress">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="status-text">{status}</p>
          </div>
        )}
        
        {message && <p className="success-message">{message}</p>}
        {error && <p className="error-message">{error}</p>}
        
        <div className="action-buttons">
          <button 
            className="migrate-button"
            onClick={handleMigration}
            disabled={isLoading}
          >
            {isLoading ? 'Migrating...' : 'Start Migration'}
          </button>
          
          {isFirestoreAvailable !== false && (
            <button 
              className="diagnostic-button secondary"
              onClick={handleDiagnostics}
              disabled={isDiagnosing || isLoading}
            >
              {isDiagnosing ? 'Running Diagnostics...' : 'Run Firebase Diagnostics'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DataMigration; 