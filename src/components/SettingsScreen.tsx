import React, { useState, useEffect } from 'react';
import '../styles/SettingsScreen.css';
import { useAuth } from '../services/AuthContext';

const SettingsScreen: React.FC = () => {
  // Add state for interactive elements
  const [sliderValue, setSliderValue] = useState<number>(3);
  const [spacedRepetition, setSpacedRepetition] = useState<boolean>(true);
  const [neuralProcessing, setNeuralProcessing] = useState<boolean>(false);
  const [reduceAnimations, setReduceAnimations] = useState<boolean>(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState<boolean>(false);

  const { currentUser, signOut, isAuthenticated } = useAuth();

  // Initialize settings from localStorage or defaults
  useEffect(() => {
    // Load saved settings
    const savedSpacedRepetition = localStorage.getItem('spacedRepetition');
    if (savedSpacedRepetition !== null) {
      const enabled = savedSpacedRepetition === 'true';
      setSpacedRepetition(enabled);
    }
  }, []);

  // Handle slider change
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSliderValue(parseInt(e.target.value));
  };

  // Handle sign out
  const handleSignOut = async () => {
    try {
      await signOut();
      setShowSignOutConfirm(false);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Handle spaced repetition toggle
  const handleSpacedRepetitionToggle = () => {
    const newValue = !spacedRepetition;
    setSpacedRepetition(newValue);
    
    // Save to localStorage
    localStorage.setItem('spacedRepetition', newValue.toString());
    
    console.log(`Spaced repetition ${newValue ? 'enabled' : 'disabled'}`);
  };

  return (
    <div className="settings-screen">
      {/* Authentication Section */}
      <div className="settings-section">
        <h2>Authentication</h2>
        
        {isAuthenticated ? (
          <>
        <div className="settings-item with-arrow">
          <div className="item-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="10" r="3" />
              <path d="M7 20.662V19c0-1.657 2.239-3 5-3s5 1.343 5 3v1.662" />
            </svg>
          </div>
          <div className="item-content">
            <div className="item-label">Account</div>
                <div className="item-value">{currentUser?.email || currentUser?.displayName}</div>
              </div>
              <div className="item-action">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </div>
            </div>
            
            <div className="settings-item" onClick={() => setShowSignOutConfirm(true)}>
              <div className="item-icon warning">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
              </div>
              <div className="item-content">
                <div className="item-label">Sign Out</div>
              </div>
            </div>
            
            {showSignOutConfirm && (
              <div className="confirm-dialog">
                <p>Are you sure you want to sign out?</p>
                <div className="confirm-actions">
                  <button className="confirm-yes" onClick={handleSignOut}>Yes, Sign Out</button>
                  <button className="confirm-no" onClick={() => setShowSignOutConfirm(false)}>Cancel</button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="settings-item with-arrow">
            <div className="item-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                <polyline points="10 17 15 12 10 7"></polyline>
                <line x1="15" y1="12" x2="3" y2="12"></line>
              </svg>
            </div>
            <div className="item-content">
              <div className="item-label">Sign In</div>
              <div className="item-value">Connect to save your progress</div>
          </div>
          <div className="item-action">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </div>
        </div>
        )}
      </div>
      
      {/* Learning Section */}
      <div className="settings-section">
        <h2>Learning</h2>
        
        <div className="settings-item">
          <div className="item-content">
            <div className="item-label">Spaced Repetition</div>
            <div className="item-value">Optimize word review intervals</div>
          </div>
          <div className="item-action">
            <label className="toggle">
              <input 
                type="checkbox" 
                checked={spacedRepetition}
                onChange={handleSpacedRepetitionToggle}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>
        
        <div className="settings-item">
          <div className="item-content">
            <div className="item-label-container">
              <div className="item-label">Neural Processing</div>
              <div className="item-info">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
              </div>
            </div>
          </div>
          <div className="item-action">
            <label className="toggle">
              <input 
                type="checkbox" 
                checked={neuralProcessing}
                onChange={() => setNeuralProcessing(!neuralProcessing)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>
        
        <div className="settings-item">
          <div className="item-content">
            <div className="item-label">Answer Choices</div>
            <div className="item-value">{sliderValue} wrong answers</div>
          </div>
        </div>
        
        <div className="slider-container">
          <input 
            type="range" 
            min="1" 
            max="5" 
            value={sliderValue}
            onChange={handleSliderChange} 
            className="slider" 
            style={{
              background: `linear-gradient(to right, 
                #65b4ff ${(sliderValue - 1) * 25}%, 
                #65b4ff ${(sliderValue - 1) * 25 + 5}%, 
                rgba(255, 255, 255, 0.15) ${(sliderValue - 1) * 25 + 5}%)`
            }}
          />
        </div>
        
        <div className="settings-item with-arrow">
          <div className="item-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M16 16v-3a2 2 0 0 0-4 0" />
              <line x1="8" y1="16" x2="8" y2="16" />
              <line x1="12" y1="16" x2="12" y2="16" />
              <line x1="16" y1="16" x2="16" y2="16" />
            </svg>
          </div>
          <div className="item-content">
            <div className="item-label">Daily Goal</div>
            <div className="item-value">50 words per day</div>
          </div>
          <div className="item-action">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </div>
        </div>
      </div>
      
      {/* User Experience Section */}
      <div className="settings-section">
        <h2>User Experience</h2>
        
        <div className="settings-item">
          <div className="item-content">
            <div className="item-label">Reduce Animations</div>
          </div>
          <div className="item-action">
            <label className="toggle">
              <input 
                type="checkbox" 
                checked={reduceAnimations}
                onChange={() => setReduceAnimations(!reduceAnimations)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>
        
        <div className="settings-item with-arrow">
          <div className="item-icon warning">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          </div>
          <div className="item-content">
            <div className="item-label">Reset Database</div>
            <div className="item-value">Reset to initial word set</div>
          </div>
          <div className="item-action">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsScreen; 