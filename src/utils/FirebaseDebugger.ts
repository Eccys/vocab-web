import { getFirestoreInstance } from '../services/FirestoreConfig';
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc
} from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

/**
 * Comprehensive Firebase configuration checker
 * This utility helps diagnose common Firebase setup issues
 */
export async function checkFirebaseConfiguration(): Promise<{
  success: boolean;
  issues: string[];
  details: Record<string, any>;
}> {
  const issues: string[] = [];
  const details: Record<string, any> = {};

  try {
    console.log("Starting comprehensive Firebase configuration check...");
    
    // 1. Fetch Firebase version
    try {
      // @ts-ignore - Get firebase package version if available
      const firebase = await import('firebase/app');
      details.firebaseVersion = firebase.SDK_VERSION || 'Unknown';
      console.log(`Firebase SDK version: ${details.firebaseVersion}`);
    } catch (error) {
      issues.push("Could not determine Firebase SDK version");
      console.error("Firebase version check failed:", error);
    }
    
    // 2. Check API key and authentication
    try {
      const auth = getAuth();
      details.apiKey = auth.app.options.apiKey ? 
        `${auth.app.options.apiKey.substring(0, 6)}...` : 'Not configured';
      details.authDomain = auth.app.options.authDomain || 'Not configured';
      
      console.log(`Using API key: ${details.apiKey} and authDomain: ${details.authDomain}`);
      
      // Try anonymous sign-in to verify auth is working
      try {
        console.log("Testing anonymous authentication...");
        const anonymousAuth = await signInAnonymously(auth);
        details.anonymousAuthWorking = true;
        console.log("Anonymous authentication successful");
      } catch (authError: any) {
        details.anonymousAuthWorking = false;
        issues.push(`Authentication failed: ${authError.message}`);
        console.error("Authentication test failed:", authError);
      }
    } catch (error: any) {
      issues.push(`Auth configuration issue: ${error.message}`);
      console.error("Auth check failed:", error);
    }
    
    // 3. Check Firestore project and permissions
    try {
      console.log("Testing Firestore configuration...");
      const db = await getFirestoreInstance();
      details.projectId = db.app.options.projectId || 'Not configured';
      
      console.log(`Firestore project ID: ${details.projectId}`);
      
      // Try a read operation
      try {
        console.log("Testing Firestore read access...");
        const testCollection = collection(db, 'system_info');
        await getDocs(testCollection);
        details.firestoreReadAccess = true;
        console.log("Firestore read test passed");
      } catch (readError: any) {
        // Permission denied is okay - means Firestore is responding
        if (readError.code === 'permission-denied') {
          details.firestoreReadAccess = 'permission-denied';
          console.log("Firestore read test got permission error (expected with proper security rules)");
        } else {
          details.firestoreReadAccess = false;
          issues.push(`Firestore read issue: ${readError.message}`);
          console.error("Firestore read test failed:", readError);
        }
      }
      
      // Try a debug write operation
      const testPath = `debug/test_${Date.now()}`;
      try {
        console.log(`Testing Firestore write access to ${testPath}...`);
        const testDoc = doc(db, testPath);
        await setDoc(testDoc, { 
          timestamp: Date.now(),
          test: true 
        });
        details.firestoreWriteAccess = true;
        console.log("Firestore write test passed");
        
        // Clean up test document
        await deleteDoc(testDoc);
        console.log("Cleaned up test document");
      } catch (writeError: any) {
        details.firestoreWriteAccess = false;
        issues.push(`Firestore write issue: ${writeError.message}`);
        console.error("Firestore write test failed:", writeError);
      }
    } catch (error: any) {
      issues.push(`Firestore configuration issue: ${error.message}`);
      console.error("Firestore check failed:", error);
    }
    
    // 4. Check network connectivity
    try {
      console.log("Testing network connectivity to Firebase services...");
      const firebaseApis = [
        'https://firestore.googleapis.com',
        'https://www.googleapis.com',
        'https://identitytoolkit.googleapis.com'
      ];
      
      const connectivityResults = await Promise.all(
        firebaseApis.map(async (url) => {
          try {
            const response = await fetch(url, { 
              method: 'HEAD',
              mode: 'no-cors',
              cache: 'no-cache'
            });
            return { url, success: true };
          } catch (error) {
            return { url, success: false, error };
          }
        })
      );
      
      details.networkConnectivity = connectivityResults;
      
      const failedConnections = connectivityResults.filter(r => !r.success);
      if (failedConnections.length > 0) {
        issues.push(`Network connectivity issues with: ${failedConnections.map(f => f.url).join(', ')}`);
        console.error("Network connectivity issues:", failedConnections);
      } else {
        console.log("Network connectivity tests passed");
      }
    } catch (error) {
      issues.push("Network connectivity check failed");
      console.error("Network connectivity check error:", error);
    }
    
    console.log("Firebase configuration check completed");
    
    return {
      success: issues.length === 0,
      issues,
      details
    };
  } catch (error: any) {
    console.error("Firebase configuration check encountered an error:", error);
    issues.push(`Unexpected error: ${error.message}`);
    
    return {
      success: false,
      issues,
      details
    };
  }
}

/**
 * Checks if the Firebase project is properly configured
 */
export async function checkProjectConfiguration(userId?: string): Promise<string> {
  try {
    const results = await checkFirebaseConfiguration();
    
    if (results.success) {
      return "Firebase configuration appears to be working correctly.";
    }
    
    // Generate a helpful message based on the issues found
    let message = "Firebase configuration issues detected:\n";
    
    results.issues.forEach(issue => {
      message += `- ${issue}\n`;
    });
    
    // Add helpful suggestions
    message += "\nPossible solutions:\n";
    
    // Authentication issues
    if (!results.details.anonymousAuthWorking) {
      message += "- Check if your API key has domain restrictions that block localhost\n";
      message += "- Verify that your Firebase project has Authentication enabled\n";
    }
    
    // Firestore issues
    if (results.details.firestoreReadAccess === false) {
      message += "- Ensure Firestore is enabled in your Firebase console\n";
      message += "- Check your Firestore security rules to allow read access\n";
    }
    
    // Network issues
    if (results.details.networkConnectivity && 
        results.details.networkConnectivity.some(r => !r.success)) {
      message += "- Check if your network blocks access to Google APIs\n";
      message += "- Verify that your firewall allows HTTPS connections to *.googleapis.com\n";
    }
    
    return message;
  } catch (error: any) {
    return `Error checking Firebase configuration: ${error.message}`;
  }
} 