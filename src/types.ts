export enum RoundType {
  KHOI_DONG = "Khởi động",
  TANG_TOC = "Tăng tốc",
  DONG_DOI = "Đồng đội",
  VUOT_CHUONG_NGAI_VAT = "Vượt chướng ngại vật",
  VE_DICH = "Về đích"
}

export interface Question {
  id: string;
  content: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  difficulty: "Dễ" | "Trung bình" | "Khó";
  topic: string;
}

export interface Session {
  id: string;
  date: string;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  timeSpent: number;
  roundResults: {
    round: RoundType;
    score: number;
  }[];
}

export interface AppData {
  subjects: { id: string; name: string; icon: string; questionsCount: number }[];
  questions: Question[];
  sessions: Session[];
  progress: {
    totalAttempts: number;
    averageScore: number;
    streakDays: number;
    weakTopics: string[];
  };
  settings: {
    theme: "light" | "dark";
    soundEnabled: boolean;
    autoSave: boolean;
    apiKey: string;
    selectedModel: string;
  };
}

export const DEFAULT_DATA: AppData = {
  subjects: [
    { id: "1", name: "Hàm số & Đồ thị", icon: "Activity", questionsCount: 15 },
    { id: "2", name: "Mũ & Logarit", icon: "TrendingUp", questionsCount: 12 },
    { id: "3", name: "Nguyên hàm & Tích phân", icon: "Sigma", questionsCount: 10 },
    { id: "4", name: "Hình học không gian", icon: "Box", questionsCount: 8 },
    { id: "5", name: "Xác suất & Thống kê", icon: "BarChart3", questionsCount: 20 },
  ],
  questions: [],
  sessions: [],
  progress: {
    totalAttempts: 0,
    averageScore: 0,
    streakDays: 0,
    weakTopics: [],
  },
  settings: {
    theme: "light",
    soundEnabled: true,
    autoSave: true,
    apiKey: "",
    selectedModel: "gemini-1.5-flash",
  },
};
