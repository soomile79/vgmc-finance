
import { GoogleGenAI, Type } from "@google/genai";

// Strictly initialize with named parameter and process.env.API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const geminiService = {
  analyzeTextEntry: async (text: string) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `다음 텍스트에서 헌금 내역을 추출해줘: "${text}". 캐나다 달러($) 기준이야. 
      추출 항목: 이름(또는 번호), 금액, 종류(십일조, 감사, 주일 등), 그리고 감사제목/메모(예: 생일감사, 범사감사 등). 
      금액은 숫자만 추출하고, 메모가 없으면 빈 문자열로 해줘.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              nameOrNumber: { type: Type.STRING },
              amount: { type: Type.NUMBER },
              code: { type: Type.STRING },
              note: { type: Type.STRING },
            },
            required: ["nameOrNumber", "amount"]
          }
        }
      }
    });
    // Use .text property directly as it returns the string output.
    return JSON.parse(response.text || '[]');
  },

  generateInsights: async (records: any[]) => {
    const summary = JSON.stringify(records);
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `다음 헌금 데이터를 분석해서 짧은 요약과 감사 문구를 작성해줘 (단위는 $): ${summary}`,
    });
    return response.text;
  }
};
