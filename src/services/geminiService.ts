import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface ReceiptData {
  merchant_name: string;
  company_reg_no: string;
  address: string;
  phone: string;
  invoice_no: string;
  date: string;
  time: string;
  items: Array<{
    item: string;
    qty: number;
    unit_price: number;
    line_total: number;
  }>;
  subtotal: number;
  discount: number;
  tax: number;
  service_charge: number;
  rounding: number;
  grand_total: number;
  payment_method: string;
  change: number;
  doc_type: "Receipt" | "Invoice" | "Credit Note" | "Expense";
  category: string;
  confidence_score: number;
  tags: string[];
}

export async function performOCR(base64Image: string, mimeType: string): Promise<ReceiptData> {
  const prompt = `
    Act as a receipt OCR specialist for Malaysian receipts. 
    Extract data from this receipt image into a JSON format. 
    Malaysian receipts often contain SST/GST details, service charges, and specific date formats (DD/MM/YYYY).
    
    Important: Return ONLY the JSON object.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        { text: prompt },
        {
          inlineData: {
            data: base64Image.split(",")[1] || base64Image,
            mimeType: mimeType
          }
        }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          merchant_name: { type: Type.STRING },
          company_reg_no: { type: Type.STRING, description: "e.g., 123456-X" },
          address: { type: Type.STRING },
          phone: { type: Type.STRING },
          invoice_no: { type: Type.STRING },
          date: { type: Type.STRING, description: "YYYY-MM-DD format" },
          time: { type: Type.STRING },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                item: { type: Type.STRING },
                qty: { type: Type.NUMBER },
                unit_price: { type: Type.NUMBER },
                line_total: { type: Type.NUMBER }
              },
              required: ["item", "qty", "unit_price", "line_total"]
            }
          },
          subtotal: { type: Type.NUMBER },
          discount: { type: Type.NUMBER },
          tax: { type: Type.NUMBER },
          service_charge: { type: Type.NUMBER },
          rounding: { type: Type.NUMBER },
          grand_total: { type: Type.NUMBER },
          payment_method: { type: Type.STRING },
          change: { type: Type.NUMBER },
          doc_type: { 
            type: Type.STRING, 
            description: 'One of: "Receipt", "Invoice", "Credit Note", "Expense"' 
          },
          category: { type: Type.STRING },
          confidence_score: { type: Type.NUMBER, description: "between 0 and 1" }
        },
        required: ["merchant_name", "grand_total", "date"]
      }
    }
  });

  const text = response.text || "";
  
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse OCR result:", text);
    throw new Error("OCR failed to generate valid JSON");
  }
}
