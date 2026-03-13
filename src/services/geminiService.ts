import { GoogleGenAI } from "@google/genai";

export const MODELS = [
  "gemini-2.0-flash-exp",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
];

export async function callGeminiAI(prompt: string, modelIndex = 0): Promise<string | null> {
  const apiKey = localStorage.getItem("gemini_api_key");
  if (!apiKey) {
    return null;
  }

  try {
    const genAI = new GoogleGenAI({ apiKey });
    const modelName = MODELS[modelIndex];
    
    const response = await genAI.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        temperature: 0.7,
        maxOutputTokens: 4096,
      },
    });

    return response.text || "";
  } catch (error: any) {
    console.error(`Error with model ${MODELS[modelIndex]}:`, error);
    
    // Check for rate limit or other retryable errors
    if (modelIndex < MODELS.length - 1) {
      console.log(`Retrying with fallback model: ${MODELS[modelIndex + 1]}`);
      return callGeminiAI(prompt, modelIndex + 1);
    }
    
    // Detailed error reporting for the UI
    let errorMessage = "Đã xảy ra lỗi khi kết nối với AI.";
    if (error.message?.includes("RESOURCE_EXHAUSTED")) {
      errorMessage = "Hết hạn mức AI (Quota exceeded). Vui lòng thử lại sau hoặc đổi API Key.";
    } else if (error.message?.includes("API_KEY_INVALID")) {
      errorMessage = "API Key không hợp lệ. Vui lòng kiểm tra lại trong phần Cài đặt.";
    } else if (error.message) {
      errorMessage = `Lỗi AI: ${error.message}`;
    }
    
    throw new Error(errorMessage);
  }
}

export const PROMPTS = {
  generateQuestion: (topic: string, difficulty: string) => `
    Hãy tạo 1 câu hỏi trắc nghiệm Toán học THPT (chương trình Kết nối tri thức) về chủ đề "${topic}" với độ khó "${difficulty}".
    Yêu cầu trả về định dạng JSON như sau:
    {
      "content": "Nội dung câu hỏi (có thể chứa LaTeX)",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "correctAnswer": 0,
      "explanation": "Giải thích chi tiết tại sao chọn đáp án đó",
      "topic": "${topic}",
      "difficulty": "${difficulty}"
    }
    Lưu ý: Chỉ trả về JSON, không kèm văn bản khác.
  `,
  explainTopic: (topic: string) => `
    Hãy giải thích ngắn gọn và dễ hiểu về chủ đề Toán học: "${topic}". 
    Bao gồm các công thức quan trọng và ví dụ minh họa. Sử dụng Markdown và LaTeX.
  `
};
