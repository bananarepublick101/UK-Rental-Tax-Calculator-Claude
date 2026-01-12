import { Transaction, Invoice, Property } from '../types';

export interface CloudData {
  transactions: Transaction[];
  invoices: Invoice[];
  properties: Property[];
  lastSync?: string;
  timestamp?: string;
}

/**
 * Normalize date to YYYY-MM-DD format
 * Fixes timezone issues where Google Sheets returns ISO timestamps
 */
const normalizeDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '';
  // If already YYYY-MM-DD, return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  // If ISO timestamp, convert to local YYYY-MM-DD
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    // Format as YYYY-MM-DD in local timezone
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return dateStr;
  }
};

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
    
    // Normalize dates to YYYY-MM-DD format
    return {
      transactions: (data.transactions || []).map((t: Transaction) => ({
        ...t,
        date: normalizeDate(t.date)
      })),
      invoices: (data.invoices || []).map((inv: Invoice) => ({
        ...inv,
        date: normalizeDate(inv.date)
      })),
      properties: data.properties || [],
      lastSync: data.lastSync,
      timestamp: data.timestamp
    };
    
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
