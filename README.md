# UK Rental Property Tax Assistant

A web application for UK landlords to manage rental property finances, track transactions against HMRC categories, and prepare for Making Tax Digital (MTD) compliance.

## Features

- **Bank Statement Upload**: Upload CSV or PDF bank statements - AI extracts transactions automatically
- **Auto-Categorization**: Gemini AI categorizes transactions using HMRC codes
- **Property Management**: Track 4+ rental properties with keyword-based auto-tagging
- **Invoice Tracking**: Upload receipts, match to transactions, track what's missing
- **Tax Estimator**: Real-time tax liability calculation with Section 24 mortgage interest relief
- **Partner Tagging**: Split transactions between D & J for joint ownership tracking
- **Cloud Sync**: Google Sheets as database - access your data anywhere
- **MTD Ready Exports**: Export to Xero journals or MTD bridging software format

## Quick Start

### 1. Get a Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create a new API key
3. Copy the key

### 2. Set Up Google Apps Script (Cloud Sync)

1. Go to [script.google.com](https://script.google.com) and create a new project
2. Delete any default code and paste the contents of `google-apps-script.js`
3. Save the project (give it a name like "Rental Tax Sync")
4. Select **setup** from the function dropdown and click **Run**
5. Authorize the permissions when prompted
6. Go to **Deploy > New Deployment**
7. Click the gear icon and select **Web app**
8. Set **Execute as** to "Me"
9. Set **Who has access** to **Anyone**
10. Click **Deploy** and copy the URL

### 3. Deploy to Netlify

#### Option A: Deploy from GitHub
1. Push this code to a GitHub repository
2. Go to [Netlify](https://netlify.com) and sign up/login
3. Click "New site from Git"
4. Connect your GitHub repo
5. Add environment variable: `VITE_GEMINI_API_KEY` = your API key
6. Deploy!

#### Option B: Manual Deploy
1. Create `.env.local` file:
   ```
   VITE_GEMINI_API_KEY=your_api_key_here
   ```
2. Run `npm install`
3. Run `npm run build`
4. Upload the `dist` folder to Netlify (drag and drop)

### 4. Configure the App

1. Open your deployed app
2. Click the **Settings** button (gear icon)
3. Paste your Google Apps Script deployment URL
4. Click **Save & Close**
5. Try **Push to Drive** to test the connection

## Usage Guide

### Uploading Bank Statements

1. Go to **Transactions** tab
2. Drag and drop a bank statement (PDF or CSV)
3. Wait for AI to extract and categorize transactions
4. Review and adjust categories/properties as needed

### Managing Properties

1. On the **Overview** tab, click **Add Property**
2. Enter name, address, and keywords
3. Keywords help auto-match transactions (e.g., tenant names, postcodes)

### Tracking Receipts

1. Go to **Receipt Hub** tab
2. Upload receipts/invoices as images
3. AI extracts vendor, amount, date
4. System auto-matches to bank transactions
5. Check off items manually if no receipt needed

### Partner Tagging

1. Select transactions in the Transactions tab
2. Use the bulk action bar to apply **D** or **J** tags
3. View split on Dashboard

### Exporting for Tax

1. Go to **Transactions** tab
2. Click **Export** dropdown
3. Choose format:
   - **Xero Manual Journals** - Import into Xero accounting
   - **MTD Bridging Format** - For MTD-compatible software
   - **Generic CSV** - For accountants

## HMRC Categories

| Code | Category |
|------|----------|
| RENTAL_INC_001 | Rental Income |
| REPAIRS_101 | Repairs & Maintenance |
| MGMT_201 | Management Fees |
| INSUR_301 | Insurance |
| UTIL_401 | Utilities |
| COUNCIL_501 | Council Tax |
| ADVERT_501 | Advertising & Lettings |
| PROF_601 | Professional Fees |
| MORT_INT_701 | Mortgage Interest (Section 24) |
| TRAVEL_801 | Travel & Vehicle |
| MISC_901 | Miscellaneous / Office |

## Tech Stack

- React 18 + TypeScript
- Vite
- Tailwind CSS
- Google Gemini AI (OCR & categorization)
- Google Sheets (database via Apps Script)
- IndexedDB (local cache)
- Recharts (visualizations)

## Troubleshooting

### "Sync failed" error
- Check that your Apps Script is deployed with "Anyone" access
- Verify the URL ends with `/exec`
- Check the Executions log in Apps Script for errors

### AI not categorizing correctly
- Ensure your Gemini API key is valid
- Check browser console for errors
- Try a different bank statement format

### Data not appearing after Pull
- Verify data exists in your Google Sheet
- Check that column headers match expected format
- Try Push first, then Pull

## License

MIT
