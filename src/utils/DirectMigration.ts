import { getApp } from 'firebase/app';
import { getFirestoreInstance } from '../services/FirestoreConfig';

/**
 * Direct Firestore API call to work around client connectivity issues
 * This uses the REST API directly instead of the client SDK
 */
async function directFirestoreCall(
  path: string, 
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET', 
  body?: any
) {
  try {
    // Get already initialized app
    const app = getApp();
    const projectId = app.options.projectId;
    
    if (!projectId) {
      throw new Error('No project ID found in Firebase config');
    }
    
    // Create proper URL for Firestore REST API
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`;
    console.log(`Making direct Firestore ${method} request to ${path}`);
    
    // Get auth token from current user
    const idToken = localStorage.getItem('firebase_token');
    
    // Set up headers
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    // Add auth token if available
    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
    }
    
    // Make the request
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    
    if (!response.ok) {
      // Parse error response
      const errorData = await response.json();
      console.error(`Firestore API error (${response.status}):`, errorData);
      throw new Error(`Firestore API error (${response.status}): ${JSON.stringify(errorData, null, 2)}`);
    }
    
    // Return the parsed response
    return await response.json();
  } catch (error) {
    console.error('Direct Firestore API call failed:', error);
    throw error;
  }
}

/**
 * Fetch all user's words using direct Firestore API
 */
export async function fetchAllWords(userId: string) {
  try {
    const result = await directFirestoreCall(`users/${userId}/words`);
    console.log('Fetched words directly:', result);
    
    // Extract words from Firestore response format
    const words: Record<string, any> = {};
    
    if (result.documents && Array.isArray(result.documents)) {
      result.documents.forEach((doc: any) => {
        // Extract document ID (last part of name)
        const nameParts = doc.name.split('/');
        const docId = nameParts[nameParts.length - 1];
        
        // Extract fields and convert from Firestore format to plain JS
        const fields: Record<string, any> = {};
        
        if (doc.fields) {
          Object.entries(doc.fields).forEach(([key, value]: [string, any]) => {
            // Convert Firestore value format to plain JS
            if (value.stringValue !== undefined) {
              fields[key] = value.stringValue;
            } else if (value.integerValue !== undefined) {
              fields[key] = parseInt(value.integerValue, 10);
            } else if (value.doubleValue !== undefined) {
              fields[key] = parseFloat(value.doubleValue);
            } else if (value.booleanValue !== undefined) {
              fields[key] = value.booleanValue;
            } else if (value.timestampValue !== undefined) {
              fields[key] = new Date(value.timestampValue).toISOString();
            } else if (value.arrayValue !== undefined) {
              fields[key] = (value.arrayValue.values || []).map((v: any) => v.stringValue || v.integerValue || v);
            }
          });
        }
        
        words[docId] = fields;
      });
    } else {
      console.log('No words found or unexpected response format');
    }
    
    return words;
  } catch (error) {
    console.error('Failed to fetch words:', error);
    throw error;
  }
}

/**
 * Update user document with consolidated words using direct Firestore API
 */
export async function updateUserDocument(userId: string, words: Record<string, any>) {
  try {
    // Prepare data in Firestore format
    const data = {
      fields: {
        words: {
          mapValue: {
            fields: {}
          }
        },
        lastUpdated: {
          stringValue: new Date().toISOString()
        }
      }
    };
    
    // Convert words to Firestore format
    Object.entries(words).forEach(([wordId, wordData]) => {
      const wordFields: Record<string, any> = {};
      
      Object.entries(wordData).forEach(([key, value]) => {
        if (typeof value === 'string') {
          wordFields[key] = { stringValue: value };
        } else if (typeof value === 'number') {
          if (Number.isInteger(value)) {
            wordFields[key] = { integerValue: value.toString() };
          } else {
            wordFields[key] = { doubleValue: value };
          }
        } else if (typeof value === 'boolean') {
          wordFields[key] = { booleanValue: value };
        }
      });
      
      (data.fields.words.mapValue.fields as any)[wordId] = {
        mapValue: {
          fields: wordFields
        }
      };
    });
    
    // Update user document with PATCH (merge)
    const result = await directFirestoreCall(`users/${userId}`, 'PATCH', data);
    console.log('Updated user document directly:', result);
    return result;
  } catch (error) {
    console.error('Failed to update user document:', error);
    throw error;
  }
}

/**
 * Directly migrate words using REST API
 */
export async function directMigrateWords(
  userId: string,
  onProgress?: (progress: number, status: string) => void
): Promise<{ success: boolean; message: string; totalWords?: number }> {
  console.log(`Starting direct migration for user: ${userId}`);
  onProgress?.(10, 'Initializing direct migration...');
  
  try {
    // 1. Initialize Firestore for additional operations if needed
    await getFirestoreInstance();
    
    // 2. Fetch all words
    onProgress?.(20, 'Fetching your vocabulary words...');
    const words = await fetchAllWords(userId);
    const wordCount = Object.keys(words).length;
    
    if (wordCount === 0) {
      return {
        success: false,
        message: 'No vocabulary words found to migrate.'
      };
    }
    
    // 3. Update user document with all words
    onProgress?.(70, `Consolidating ${wordCount} words...`);
    await updateUserDocument(userId, words);
    
    // 4. Success!
    onProgress?.(100, 'Migration complete!');
    return {
      success: true,
      message: `Successfully migrated ${wordCount} words.`,
      totalWords: wordCount
    };
  } catch (error: any) {
    console.error('Direct migration failed:', error);
    return {
      success: false,
      message: error.message || 'Unknown error during migration'
    };
  }
} 