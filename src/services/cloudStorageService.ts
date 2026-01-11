import { Transaction, Invoice, Property } from '../types';

export interface CloudData {
  transactions: Transaction[];
  invoices: Invoice[];
  properties: Property[];
  lastSync?: string;
  timestamp?: string;
}

/**
 * Load data FROM Google Sheets (GET request)
 * GAS handles GET requests well - we can read the response
 */
export const loadFromCloud = async (url: string): Promise<CloudData | null> => {
  try {
    console.log('[Cloud] Loading from:', url);
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow'
    });
    
    if (!response.ok) {
      throw new Error(`Cloud fetch failed: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('[Cloud] Loaded data:', data);
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    localStorage.setItem('last_cloud_load', new Date().toISOString());
    return data;
    
  } catch (error) {
    console.error('[Cloud] Load Error:', error);
    return null;
  }
};

/**
 * Save data TO Google Sheets (POST request)
 * Uses no-cors mode because GAS redirects POST requests
 * We assume success if no network error occurs
 */
export const syncToCloud = async (url: string, data: CloudData): Promise<{ success: boolean; timestamp?: string }> => {
  try {
    console.log('[Cloud] Syncing to:', url);
    console.log('[Cloud] Data:', { 
      transactions: data.transactions.length, 
      invoices: data.invoices.length, 
      properties: data.properties.length 
    });
    
    // Use no-cors to bypass CORS preflight issues with GAS redirects
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify(data)
    });
    
    // In no-cors mode, we can't read the response
    // But if we reach here without error, the request was dispatched
    const now = new Date().toISOString();
    localStorage.setItem('last_cloud_sync', now);
    console.log('[Cloud] Sync completed at:', now);
    
    return { success: true, timestamp: now };
    
  } catch (error) {
    console.error('[Cloud] Sync Error:', error);
    return { success: false };
  }
};
