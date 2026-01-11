import { Transaction, Invoice, TaxYear, Property } from '../types';

const DB_NAME = 'RentalTaxDB';
const DB_VERSION = 2;
const STORE_TRANSACTIONS = 'transactions';
const STORE_INVOICES = 'invoices';
const STORE_SETTINGS = 'settings';
const STORE_PROPERTIES = 'properties';

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error("IndexedDB error:", event);
      reject("Error opening database");
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains(STORE_TRANSACTIONS)) {
        db.createObjectStore(STORE_TRANSACTIONS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_INVOICES)) {
        db.createObjectStore(STORE_INVOICES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_PROPERTIES)) {
        db.createObjectStore(STORE_PROPERTIES, { keyPath: 'id' });
      }
    };
  });
};

export const saveTransactions = async (transactions: Transaction[]) => {
  const db = await initDB();
  const tx = db.transaction(STORE_TRANSACTIONS, 'readwrite');
  const store = tx.objectStore(STORE_TRANSACTIONS);
  
  await new Promise((resolve) => {
    const clearRequest = store.clear();
    clearRequest.onsuccess = resolve;
  });

  transactions.forEach(t => store.put(t));
  
  return new Promise<void>((resolve) => {
    tx.oncomplete = () => resolve();
  });
};

export const loadTransactions = async (): Promise<Transaction[]> => {
  const db = await initDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_TRANSACTIONS, 'readonly');
    const store = tx.objectStore(STORE_TRANSACTIONS);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
  });
};

export const saveInvoices = async (invoices: Invoice[]) => {
  const db = await initDB();
  const tx = db.transaction(STORE_INVOICES, 'readwrite');
  const store = tx.objectStore(STORE_INVOICES);
  
  await new Promise((resolve) => {
    const clearRequest = store.clear();
    clearRequest.onsuccess = resolve;
  });

  invoices.forEach(inv => store.put(inv));
  
  return new Promise<void>((resolve) => {
    tx.oncomplete = () => resolve();
  });
};

export const loadInvoices = async (): Promise<Invoice[]> => {
  const db = await initDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_INVOICES, 'readonly');
    const store = tx.objectStore(STORE_INVOICES);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
  });
};

export const saveProperties = async (properties: Property[]) => {
  const db = await initDB();
  const tx = db.transaction(STORE_PROPERTIES, 'readwrite');
  const store = tx.objectStore(STORE_PROPERTIES);
  
  await new Promise((resolve) => {
    const clearRequest = store.clear();
    clearRequest.onsuccess = resolve;
  });

  properties.forEach(p => store.put(p));
  
  return new Promise<void>((resolve) => {
    tx.oncomplete = () => resolve();
  });
};

export const loadProperties = async (): Promise<Property[]> => {
  const db = await initDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_PROPERTIES, 'readonly');
    const store = tx.objectStore(STORE_PROPERTIES);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
  });
};

export const saveTaxYear = async (year: TaxYear) => {
  const db = await initDB();
  const tx = db.transaction(STORE_SETTINGS, 'readwrite');
  const store = tx.objectStore(STORE_SETTINGS);
  store.put({ key: 'taxYear', value: year });
};

export const loadTaxYear = async (): Promise<TaxYear | null> => {
  const db = await initDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_SETTINGS, 'readonly');
    const store = tx.objectStore(STORE_SETTINGS);
    const request = store.get('taxYear');
    request.onsuccess = () => resolve(request.result?.value || null);
  });
};
