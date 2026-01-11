/**
 * RENTAL TAX AI - GOOGLE APPS SCRIPT
 * 
 * SETUP:
 * 1. Go to script.google.com and create a new project
 * 2. Paste this entire code
 * 3. Save the project
 * 4. Select "setup" from the dropdown and click Run
 * 5. Authorize the permissions when prompted
 * 6. Go to Deploy > New Deployment
 * 7. Select "Web app" as type
 * 8. Set "Execute as" to "Me"
 * 9. Set "Who has access" to "Anyone"
 * 10. Click Deploy and copy the URL
 * 11. Paste the URL in the app's Cloud Config settings
 */

const TRANS_SHEET = 'Transactions';
const INVOICE_SHEET = 'Invoices';
const PROP_SHEET = 'Properties';

function getOrCreateSpreadsheet() {
  const props = PropertiesService.getScriptProperties();
  let spreadsheetId = props.getProperty('SPREADSHEET_ID');
  let spreadsheet;
  
  if (spreadsheetId) {
    try {
      spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    } catch (e) {
      spreadsheetId = null;
    }
  }
  
  if (!spreadsheetId) {
    spreadsheet = SpreadsheetApp.create('Rental Property Tax Data');
    spreadsheetId = spreadsheet.getId();
    props.setProperty('SPREADSHEET_ID', spreadsheetId);
    
    // Initialize Transactions sheet
    const tSheet = spreadsheet.getSheetByName('Sheet1');
    tSheet.setName(TRANS_SHEET);
    tSheet.getRange('A1:I1').setValues([['id', 'date', 'description', 'propertyId', 'category', 'amount', 'tag', 'status', 'matchedInvoiceId']]);
    tSheet.getRange('A1:I1').setFontWeight('bold').setBackground('#f3f4f6');
    tSheet.setFrozenRows(1);
    
    // Initialize Invoices sheet
    const iSheet = spreadsheet.insertSheet(INVOICE_SHEET);
    iSheet.getRange('A1:G1').setValues([['id', 'date', 'vendor', 'amount', 'description', 'status', 'matchedTransactionId']]);
    iSheet.getRange('A1:G1').setFontWeight('bold').setBackground('#f3f4f6');
    iSheet.setFrozenRows(1);
    
    // Initialize Properties sheet
    const pSheet = spreadsheet.insertSheet(PROP_SHEET);
    pSheet.getRange('A1:D1').setValues([['id', 'name', 'address', 'keywords']]);
    pSheet.getRange('A1:D1').setFontWeight('bold').setBackground('#f3f4f6');
    pSheet.setFrozenRows(1);
    
    // Trigger Drive permission
    DriveApp.getRootFolder();
  }
  
  return spreadsheet;
}

// Run this first to authorize
function setup() {
  const ss = getOrCreateSpreadsheet();
  Logger.log("✅ Authorized! Spreadsheet created at: " + ss.getUrl());
  Logger.log("Now deploy this as a Web App with 'Anyone' access.");
}

// Handle GET requests - Read data
function doGet(e) {
  try {
    const spreadsheet = getOrCreateSpreadsheet();
    
    const response = {
      transactions: readSheet(spreadsheet, TRANS_SHEET, ['id', 'date', 'description', 'propertyId', 'category', 'amount', 'tag', 'status', 'matchedInvoiceId']),
      invoices: readSheet(spreadsheet, INVOICE_SHEET, ['id', 'date', 'vendor', 'amount', 'description', 'status', 'matchedTransactionId']),
      properties: readSheet(spreadsheet, PROP_SHEET, ['id', 'name', 'address', 'keywords']),
      lastSync: new Date().toISOString()
    };
    
    return ContentService
      .createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Handle POST requests - Write data
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const spreadsheet = getOrCreateSpreadsheet();
    
    if (data.transactions) {
      updateSheet(spreadsheet, TRANS_SHEET, data.transactions, 
        ['id', 'date', 'description', 'propertyId', 'category', 'amount', 'tag', 'status', 'matchedInvoiceId']);
    }
    if (data.invoices) {
      updateSheet(spreadsheet, INVOICE_SHEET, data.invoices, 
        ['id', 'date', 'vendor', 'amount', 'description', 'status', 'matchedTransactionId']);
    }
    if (data.properties) {
      updateSheet(spreadsheet, PROP_SHEET, data.properties, 
        ['id', 'name', 'address', 'keywords']);
    }
    
    return ContentService
      .createTextOutput(JSON.stringify({ success: true, timestamp: new Date().toISOString() }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Read sheet data into array of objects
function readSheet(ss, name, headers) {
  const sheet = ss.getSheetByName(name);
  if (!sheet) return [];
  
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  
  const data = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  
  return data.map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      let val = row[i];
      // Parse numbers
      if (h === 'amount' && typeof val === 'string') {
        val = parseFloat(val) || 0;
      }
      // Handle empty strings
      if (val === '') val = null;
      obj[h] = val;
    });
    return obj;
  }).filter(obj => obj.id); // Filter out empty rows
}

// Update sheet with new data
function updateSheet(ss, name, data, headers) {
  let sheet = ss.getSheetByName(name);
  
  // Create sheet if it doesn't exist
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#f3f4f6');
    sheet.setFrozenRows(1);
  }
  
  // Clear existing data (keep headers)
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, headers.length).clear();
  }
  
  // Write new data
  if (data && data.length > 0) {
    const rows = data.map(item => headers.map(h => {
      const val = item[h];
      if (val === null || val === undefined) return '';
      if (typeof val === 'object') return JSON.stringify(val);
      return val;
    }));
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
  
  // Auto-resize columns
  sheet.autoResizeColumns(1, headers.length);
}
