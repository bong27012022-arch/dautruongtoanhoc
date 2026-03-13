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
  subjects: { id: string; name: string; icon: string; questionsCount: number; grade: 10 | 11 | 12 }[];
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
    // Lớp 10
    { id: "10-1", name: "Mệnh đề & Tập hợp", icon: "Activity", questionsCount: 15, grade: 10 },
    { id: "10-2", name: "Bất phương trình bậc nhất hai ẩn", icon: "TrendingUp", questionsCount: 12, grade: 10 },
    { id: "10-3", name: "Hàm số & Đồ thị", icon: "Activity", questionsCount: 20, grade: 10 },
    { id: "10-4", name: "Tam thức bậc hai", icon: "Sigma", questionsCount: 15, grade: 10 },
    { id: "10-5", name: "Đại số tổ hợp", icon: "BarChart3", questionsCount: 18, grade: 10 },
    { id: "10-6", name: "Vector & Hệ thức lượng", icon: "Box", questionsCount: 25, grade: 10 },
    { id: "10-7", name: "Phương pháp tọa độ trong mặt phẳng", icon: "Play", questionsCount: 20, grade: 10 },
    { id: "10-8", name: "Xác suất lớp 10", icon: "BarChart3", questionsCount: 15, grade: 10 },

    // Lớp 11
    { id: "11-1", name: "Hàm số lượng giác", icon: "Activity", questionsCount: 20, grade: 11 },
    { id: "11-2", name: "Dãy số & Cấp số cộng/nhân", icon: "TrendingUp", questionsCount: 15, grade: 11 },
    { id: "11-3", name: "Giới hạn & Hàm số liên tục", icon: "Activity", questionsCount: 18, grade: 11 },
    { id: "11-4", name: "Đạo hàm", icon: "Sigma", questionsCount: 25, grade: 11 },
    { id: "11-5", name: "Quan hệ song song", icon: "Box", questionsCount: 15, grade: 11 },
    { id: "11-6", name: "Quan hệ vuông góc", icon: "Box", questionsCount: 20, grade: 11 },
    { id: "11-7", name: "Xác suất lớp 11", icon: "BarChart3", questionsCount: 15, grade: 11 },

    // Lớp 12
    { id: "12-1", name: "Ứng dụng đạo hàm khảo sát hàm số", icon: "Activity", questionsCount: 30, grade: 12 },
    { id: "12-2", name: "Nguyên hàm & Tích phân", icon: "Sigma", questionsCount: 25, grade: 12 },
    { id: "12-3", name: "Hàm số mũ & Logarit", icon: "TrendingUp", questionsCount: 20, grade: 12 },
    { id: "12-4", name: "Khối đa diện & Thể tích", icon: "Box", questionsCount: 15, grade: 12 },
    { id: "12-5", name: "Toạ độ trong không gian (Oxyz)", icon: "Play", questionsCount: 25, grade: 12 },
    { id: "12-6", name: "Xác suất lớp 12", icon: "BarChart3", questionsCount: 15, grade: 12 },
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
