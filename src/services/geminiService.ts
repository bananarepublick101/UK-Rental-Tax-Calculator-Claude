import { GoogleGenerativeAI } from "@google/generative-ai";
import { HMRCCategory, CategoryLabels, Property } from "../types";

// Initialize with API key from environment
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(API_KEY);

// Use Gemini 1.5 Flash for speed and cost efficiency
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// Helper to extract JSON from responses
const robustJsonParse = (text: string) => {
  try {
    // Remove markdown code blocks if present
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    const cleanJson = jsonMatch ? jsonMatch[0] : cleaned;
    return JSON.parse(cleanJson);
  } catch (e) {
    console.error("Failed to parse JSON from AI response:", text);
    return {};
  }
};

export const categorizeTransaction = async (
  description: string, 
  amount: number, 
  properties: Property[] = []
): Promise<{ category: HMRCCategory; propertyId?: string; confidence: number; reasoning?: string }> => {
  try {
    const isIncome = amount > 0;
    const context = isIncome ? "This is a credit (income)." : "This is a debit (expense).";
    
    const propertyContext = properties.length > 0 
      ? `Here are the user's properties. Try to match the transaction description to a property based on Name, Address, or Keywords.
         ${properties.map(p => `- ID: ${p.id}, Name: "${p.name}", Keywords: "${p.keywords || ''}", Address: "${p.address}"`).join('\n')}
         If the description contains any tenant name, address part, or keyword associated with a property, assign its ID.`
      : "No properties defined yet.";

    const prompt = `Act as a UK Property Tax Assistant. 
Analyze this bank transaction description: "${description}".
${context}

${propertyContext}

Map it to exactly one of the following HMRC categories:
${Object.entries(CategoryLabels).map(([k, v]) => `${k}: ${v}`).join(', ')}.

Rules:
- If clearly rental income (rent payment, tenant name), use RENTAL_INC_001
- If mortgage interest payment, use MORT_INT_701
- If insurance premium, use INSUR_301
- If letting agent/property management fee, use MGMT_201
- If repairs/maintenance/tradesperson, use REPAIRS_101
- If council tax, use COUNCIL_501
- If utilities (gas, electric, water), use UTIL_401
- If legal/accountant fees, use PROF_601
- If advertising/lettings fees, use ADVERT_501
- If travel related, use TRAVEL_801
- If unclear, use UNCATEGORIZED

Respond ONLY with valid JSON in this exact format:
{
  "category": "HMRC_CATEGORY_CODE",
  "propertyId": "property_id_or_empty_string",
  "confidence": 0.0_to_1.0,
  "reasoning": "brief explanation"
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    const parsed = robustJsonParse(text);
    
    return {
      category: (parsed.category as HMRCCategory) || HMRCCategory.UNCATEGORIZED,
      propertyId: parsed.propertyId || undefined,
      confidence: parsed.confidence || 0.5,
      reasoning: parsed.reasoning
    };
  } catch (error) {
    console.error("Gemini Categorization Error:", error);
    return { category: HMRCCategory.UNCATEGORIZED, confidence: 0 };
  }
};

export const parseInvoiceImage = async (
  base64Data: string, 
  mimeType: string = 'image/jpeg'
): Promise<{ date: string; vendor: string; amount: number; description: string }> => {
  try {
    const base64Clean = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
    
    const prompt = `Extract details from this invoice/receipt image.
Return ONLY valid JSON with these fields:
{
  "date": "YYYY-MM-DD format",
  "vendor": "supplier/vendor name",
  "amount": numeric_total_amount,
  "description": "brief description of goods/services"
}`;

    const result = await model.generateContent([
      { text: prompt },
      {
        inlineData: {
          mimeType: mimeType,
          data: base64Clean
        }
      }
    ]);
    
    const response = await result.response;
    const text = response.text();
    return robustJsonParse(text);
  } catch (error) {
    console.error("Gemini Invoice OCR Error:", error);
    throw new Error("Failed to parse invoice.");
  }
};

export const parseBankStatement = async (
  fileData: string, 
  mimeType: string
): Promise<{ date: string; description: string; amount: number }[]> => {
  try {
    let prompt: string;
    let content: any[];
    
    if (mimeType === 'text/csv' || mimeType === 'text/plain' || fileData.startsWith('Date,') || fileData.includes('\t')) {
      // CSV/Text data
      prompt = `Extract bank transactions from this data.
Return ONLY a valid JSON object with a "transactions" array.
Each transaction should have: date (YYYY-MM-DD), description (string), amount (number - negative for expenses/debits, positive for income/credits).

DATA:
${fileData}

Response format:
{
  "transactions": [
    {"date": "2024-01-15", "description": "RENT FROM TENANT", "amount": 1200.00},
    {"date": "2024-01-16", "description": "BRITISH GAS", "amount": -85.50}
  ]
}`;
      content = [{ text: prompt }];
    } else {
      // Image/PDF data
      const base64Clean = fileData.includes(',') ? fileData.split(',')[1] : fileData;
      prompt = `Extract all transaction rows from this bank statement image.
Return ONLY a valid JSON object with a "transactions" array.
Each transaction should have: date (YYYY-MM-DD), description (string), amount (number - negative for expenses/debits/withdrawals, positive for income/credits/deposits).

Response format:
{
  "transactions": [
    {"date": "2024-01-15", "description": "RENT FROM TENANT", "amount": 1200.00},
    {"date": "2024-01-16", "description": "BRITISH GAS", "amount": -85.50}
  ]
}`;
      content = [
        { text: prompt },
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Clean
          }
        }
      ];
    }

    const result = await model.generateContent(content);
    const response = await result.response;
    const text = response.text();
    const parsed = robustJsonParse(text);
    
    return parsed.transactions || [];
  } catch (error) {
    console.error("Gemini Bank Statement Parse Error:", error);
    throw new Error("Failed to parse bank statement.");
  }
};
