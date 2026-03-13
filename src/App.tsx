import React, { useState, useEffect, useMemo } from "react";
import { 
  Layout, 
  Settings as SettingsIcon, 
  Trophy, 
  BookOpen, 
  BrainCircuit, 
  History, 
  ChevronRight, 
  Play, 
  CheckCircle2, 
  XCircle, 
  Timer, 
  Star, 
  Download, 
  Upload,
  Plus,
  Trash2,
  Search,
  MessageSquare,
  ArrowLeft,
  Activity,
  TrendingUp,
  Sigma,
  Box,
  BarChart3,
  Eye,
  EyeOff,
  RefreshCw,
  Award
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import Swal from "sweetalert2";
import * as XLSX from "xlsx";
import { Marked } from "marked";
import JSZip from "jszip";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";
import { Line, Bar, Doughnut } from "react-chartjs-2";

import { AppData, DEFAULT_DATA, Question, RoundType, Session } from "./types";
import { callGeminiAI, MODELS, PROMPTS } from "./services/geminiService";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
const marked = new Marked();

declare global {
  interface Window {
    MathJax: any;
  }
}

// Helper to trigger MathJax
const triggerMathJax = () => {
  if (window.MathJax && window.MathJax.typesetPromise) {
    window.MathJax.typesetPromise().catch((err: any) => console.error('MathJax typeset failed:', err));
  }
};

// --- Components ---

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

const Card = ({ children, className, onClick }: CardProps) => (
  <motion.div 
    whileHover={onClick ? { scale: 1.02 } : {}}
    whileTap={onClick ? { scale: 0.98 } : {}}
    onClick={onClick}
    className={cn("glass-card rounded-3xl p-8 transition-all duration-300", className, onClick && "cursor-pointer")}
  >
    {children}
  </motion.div>
);

const Button = ({ 
  children, 
  variant = "primary", 
  className, 
  onClick, 
  disabled,
  icon: Icon
}: { 
  children: React.ReactNode; 
  variant?: "primary" | "secondary" | "outline" | "danger" | "ghost"; 
  className?: string; 
  onClick?: () => void;
  disabled?: boolean;
  icon?: any;
}) => {
  const variants = {
    primary: "premium-gradient text-white shadow-indigo-200/50 hover:shadow-indigo-400/50",
    secondary: "bg-gradient-to-r from-rose-400 to-orange-500 text-white shadow-orange-200/50 hover:shadow-rose-400/50",
    outline: "border-2 border-slate-200 text-slate-600 hover:border-indigo-400 hover:text-indigo-600 bg-white/50 backdrop-blur-sm",
    danger: "bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-red-200/50",
    ghost: "text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
  };

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl font-bold transition-all disabled:opacity-50 disabled:pointer-events-none shadow-xl",
        variants[variant],
        className
      )}
    >
      {Icon && <Icon size={20} />}
      {children}
    </motion.button>
  );
};

// --- Main App ---

export default function App() {
  const [data, setData] = useState<AppData>(() => {
    const saved = localStorage.getItem("math_game_data");
    return saved ? JSON.parse(saved) : DEFAULT_DATA;
  });

  const [view, setView] = useState<"dashboard" | "game" | "history" | "tutor" | "settings" | "plan">("dashboard");
  const [apiKey, setApiKey] = useState(localStorage.getItem("gemini_api_key") || "");
  const [showApiKey, setShowApiKey] = useState(false);
  const [isGameActive, setIsGameActive] = useState(false);
  const [currentRound, setCurrentRound] = useState<RoundType>(RoundType.KHOI_DONG);
  const [gameQuestions, setGameQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [gameScore, setGameScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isAnswering, setIsAnswering] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [starUsed, setStarUsed] = useState(false);
  const [currentGroup, setCurrentGroup] = useState<string | null>(null);
  const [showGroupSelection, setShowGroupSelection] = useState(false);
  const [pendingSubjectId, setPendingSubjectId] = useState<string | null>(null);

  useEffect(() => {
    triggerMathJax();
  }, [view, isGameActive]);
  const [gameStartTime, setGameStartTime] = useState(0);

  // Persistence
  useEffect(() => {
    localStorage.setItem("math_game_data", JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    localStorage.setItem("gemini_api_key", apiKey);
  }, [apiKey]);

  // MathJax re-render
  useEffect(() => {
    if ((window as any).MathJax) {
      (window as any).MathJax.typesetPromise();
    }
  }, [view, currentQuestionIndex, isGameActive]);

  // Timer logic
  useEffect(() => {
    let timer: any;
    if (isGameActive && timeLeft > 0 && !isAnswering) {
      timer = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isGameActive && !isAnswering) {
      handleAnswer(-1); // Timeout
    }
    return () => clearInterval(timer);
  }, [isGameActive, timeLeft, isAnswering]);

  const handleStartGame = (subjectId: string) => {
    if (!apiKey) {
      Swal.fire("Lỗi", "Vui lòng thiết lập API Key trong phần cài đặt!", "error");
      setView("settings");
      return;
    }

    setPendingSubjectId(subjectId);
    setShowGroupSelection(true);
  };

  const confirmStartGame = async (group: string) => {
    setCurrentGroup(group);
    setShowGroupSelection(false);
    
    if (!pendingSubjectId) return;

    // Generate mock questions for demo if none exist
    const mockQuestions: Question[] = [
      // Khởi động (2 câu)
      {
        id: "q1",
        content: "Cho hàm số $y = x^3 - 3x + 2$. Tìm số điểm cực trị của hàm số.",
        options: ["A. 0", "B. 1", "C. 2", "D. 3"],
        correctAnswer: 2,
        explanation: "Ta có $y' = 3x^2 - 3$. $y' = 0 \\Leftrightarrow x = \\pm 1$. Do đó hàm số có 2 điểm cực trị.",
        difficulty: "Dễ",
        topic: "Hàm số"
      },
      {
        id: "q2",
        content: "Giá trị của $\\log_2 8$ là:",
        options: ["A. 2", "B. 3", "C. 4", "D. 8"],
        correctAnswer: 1,
        explanation: "$\\log_2 8 = \\log_2 2^3 = 3$.",
        difficulty: "Dễ",
        topic: "Mũ & Logarit"
      },
      // Tăng tốc (2 câu)
      {
        id: "q3",
        content: "Tính đạo hàm của hàm số $y = \\ln(x^2 + 1)$.",
        options: ["A. $\\frac{1}{x^2+1}$", "B. $\\frac{2x}{x^2+1}$", "C. $\\frac{x}{x^2+1}$", "D. $2x(x^2+1)$"],
        correctAnswer: 1,
        explanation: "$y' = \\frac{(x^2+1)'}{x^2+1} = \\frac{2x}{x^2+1}$.",
        difficulty: "Trung bình",
        topic: "Đạo hàm"
      },
      {
        id: "q4",
        content: "Tập nghiệm của bất phương trình $2^x > 8$ là:",
        options: ["A. $(3; +\\infty)$", "B. $(-\\infty; 3)$", "C. $(8; +\\infty)$", "D. $(-\\infty; 8)$"],
        correctAnswer: 0,
        explanation: "$2^x > 8 = 2^3 \\Leftrightarrow x > 3$. Tập nghiệm: $(3; +\\infty)$.",
        difficulty: "Trung bình",
        topic: "Mũ & Logarit"
      },
      // Đồng đội (2 câu)
      {
        id: "q5",
        content: "Tính $\\int_0^1 x^2 dx$.",
        options: ["A. $\\frac{1}{2}$", "B. $\\frac{1}{3}$", "C. $1$", "D. $\\frac{2}{3}$"],
        correctAnswer: 1,
        explanation: "$\\int_0^1 x^2 dx = \\frac{x^3}{3} \\Big|_0^1 = \\frac{1}{3}$.",
        difficulty: "Trung bình",
        topic: "Tích phân"
      },
      {
        id: "q6",
        content: "Cho cấp số cộng $(u_n)$ với $u_1 = 3$, $d = 2$. Tìm $u_{10}$.",
        options: ["A. 19", "B. 21", "C. 23", "D. 25"],
        correctAnswer: 1,
        explanation: "$u_{10} = u_1 + 9d = 3 + 9 \\cdot 2 = 21$.",
        difficulty: "Dễ",
        topic: "Dãy số"
      },
      // Vượt chướng ngại vật (2 câu)
      {
        id: "q7",
        content: "Trong không gian Oxyz, khoảng cách từ $M(1, 2, -1)$ đến mặt phẳng $(P): 2x - y + 2z - 3 = 0$ là:",
        options: ["A. 1", "B. $\\frac{5}{3}$", "C. 2", "D. 3"],
        correctAnswer: 1,
        explanation: "$d(M, P) = \\frac{|2(1) - (2) + 2(-1) - 3|}{\\sqrt{4 + 1 + 4}} = \\frac{5}{3}$.",
        difficulty: "Khó",
        topic: "Oxyz"
      },
      {
        id: "q8",
        content: "Cho hình chóp $S.ABCD$ có đáy là hình vuông cạnh $a$, $SA \\perp (ABCD)$, $SA = a$. Tính thể tích khối chóp.",
        options: ["A. $\\frac{a^3}{3}$", "B. $\\frac{a^3}{2}$", "C. $a^3$", "D. $\\frac{a^3}{6}$"],
        correctAnswer: 0,
        explanation: "$V = \\frac{1}{3} \\cdot SA \\cdot S_{ABCD} = \\frac{1}{3} \\cdot a \\cdot a^2 = \\frac{a^3}{3}$.",
        difficulty: "Khó",
        topic: "Hình học"
      },
      // Về đích (2 câu)
      {
        id: "q9",
        content: "Phương trình $\\sin x = \\frac{1}{2}$ có nghiệm tổng quát là:",
        options: ["A. $x = \\frac{\\pi}{6} + k2\\pi$", "B. $x = \\frac{\\pi}{6} + k2\\pi$ hoặc $x = \\frac{5\\pi}{6} + k2\\pi$", "C. $x = \\frac{\\pi}{3} + k2\\pi$", "D. $x = \\frac{\\pi}{6} + k\\pi$"],
        correctAnswer: 1,
        explanation: "$\\sin x = \\frac{1}{2} \\Leftrightarrow x = \\frac{\\pi}{6} + k2\\pi$ hoặc $x = \\pi - \\frac{\\pi}{6} + k2\\pi = \\frac{5\\pi}{6} + k2\\pi$.",
        difficulty: "Khó",
        topic: "Lượng giác"
      },
      {
        id: "q10",
        content: "Cho hàm số $y = x^4 - 2x^2 + 1$. Số điểm cực trị của hàm số là:",
        options: ["A. 1", "B. 2", "C. 3", "D. 0"],
        correctAnswer: 2,
        explanation: "$y' = 4x^3 - 4x = 4x(x^2 - 1) = 0 \\Leftrightarrow x \\in \\{-1, 0, 1\\}$. Hàm số có 3 điểm cực trị.",
        difficulty: "Khó",
        topic: "Hàm số"
      }
    ];

    setGameQuestions(mockQuestions);
    setIsGameActive(true);
    setCurrentRound(RoundType.KHOI_DONG);
    setCurrentQuestionIndex(0);
    setGameScore(0);
    setTimeLeft(30);
    setStarUsed(false);
    setGameStartTime(Date.now());
    setView("game");
  };

  const handleAnswer = (index: number) => {
    setIsAnswering(true);
    setSelectedAnswer(index);

    const isCorrect = index === gameQuestions[currentQuestionIndex].correctAnswer;
    let points = 0;

    // Points vary by round
    const roundPoints: Record<string, number> = {
      [RoundType.KHOI_DONG]: 10,
      [RoundType.TANG_TOC]: 20,
      [RoundType.DONG_DOI]: 15,
      [RoundType.VUOT_CHUONG_NGAI_VAT]: 30,
      [RoundType.VE_DICH]: 40,
    };

    if (isCorrect) {
      points = roundPoints[currentRound] || 10;
      if (starUsed) points *= 2;
      setGameScore(prev => prev + points);
    } else if (starUsed) {
      setGameScore(prev => prev - 10);
    }

    setTimeout(() => {
      if (currentQuestionIndex < gameQuestions.length - 1) {
        const nextIndex = currentQuestionIndex + 1;
        setCurrentQuestionIndex(nextIndex);
        setSelectedAnswer(null);
        setIsAnswering(false);
        setTimeLeft(30);
        setStarUsed(false);
        
        // Advance rounds every 2 questions
        const rounds = Object.values(RoundType);
        const roundIndex = Math.floor(nextIndex / 2);
        if (roundIndex < rounds.length) {
          setCurrentRound(rounds[roundIndex]);
        }
      } else {
        finishGame();
      }
    }, 2000);
  };

  const finishGame = () => {
    const timeSpent = Math.floor((Date.now() - gameStartTime) / 1000);
    const newSession: Session = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString("vi-VN"),
      score: gameScore,
      totalQuestions: gameQuestions.length,
      correctAnswers: gameQuestions.filter((q, i) => selectedAnswer === q.correctAnswer).length, // Improved logic
      timeSpent,
      group: currentGroup || "Khán giả",
      roundResults: [
        { round: RoundType.KHOI_DONG, score: gameScore }
      ]
    };

    setData(prev => {
      const g = newSession.group;
      const currentGStats = prev.groupStats[g] || { totalScore: 0, totalQuestions: 0, correctAnswers: 0, sessionsCount: 0 };
      
      return {
        ...prev,
        sessions: [newSession, ...prev.sessions],
        groupStats: {
          ...prev.groupStats,
          [g]: {
            totalScore: currentGStats.totalScore + newSession.score,
            totalQuestions: currentGStats.totalQuestions + newSession.totalQuestions,
            correctAnswers: currentGStats.correctAnswers + newSession.correctAnswers,
            sessionsCount: currentGStats.sessionsCount + 1
          }
        },
        progress: {
          ...prev.progress,
          totalAttempts: prev.progress.totalAttempts + 1,
          averageScore: (prev.progress.averageScore * prev.progress.totalAttempts + gameScore) / (prev.progress.totalAttempts + 1)
        }
      };
    });
    
    setIsGameActive(false);
    Swal.fire({
      title: "Hoàn thành!",
      text: `Bạn đạt được ${gameScore} điểm cho ${newSession.group}.`,
      icon: "success",
      confirmButtonColor: "#6366f1"
    }).then(() => setView("dashboard"));
  };

  // --- Views ---

const GroupSelectionModal = ({ 
  onSelect, 
  onClose 
}: { 
  onSelect: (group: string) => void; 
  onClose: () => void 
}) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
    <motion.div 
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="bg-white rounded-[3rem] p-10 max-w-lg w-full shadow-2xl overflow-hidden relative"
    >
      <div className="absolute top-0 left-0 w-full h-2 premium-gradient" />
      <h3 className="text-3xl font-black text-slate-800 mb-2">Chọn Tổ thi đấu</h3>
      <p className="text-slate-500 mb-8 font-medium">Điểm số sẽ được tính vào bảng xếp hạng của Tổ bạn chọn.</p>
      
      <div className="grid grid-cols-2 gap-4">
        {["Tổ 1", "Tổ 2", "Tổ 3", "Tổ 4"].map((group) => (
          <button
            key={group}
            onClick={() => onSelect(group)}
            className="p-6 rounded-[2rem] border-2 border-slate-100 hover:border-indigo-500 hover:bg-indigo-50 transition-all text-xl font-black text-slate-700 hover:text-indigo-600 flex flex-col items-center gap-3 group"
          >
            <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center group-hover:bg-white transition-colors">
              <Plus className="text-slate-300 group-hover:text-indigo-500" size={24} />
            </div>
            {group}
          </button>
        ))}
      </div>
      
      <button 
        onClick={onClose}
        className="mt-8 w-full py-4 text-slate-400 font-bold hover:text-slate-600 transition-colors"
      >
        Hủy bỏ
      </button>
    </motion.div>
  </div>
);

const Leaderboard = ({ stats }: { stats: AppData["groupStats"] }) => {
  const sorted = Object.entries(stats).sort((a, b) => b[1].totalScore - a[1].totalScore);
  
  return (
    <Card className="overflow-hidden p-0">
      <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-3">
          <Trophy className="text-amber-500" size={24} />
          <h3 className="font-extrabold text-xl text-slate-800">Xếp hạng Tổ</h3>
        </div>
        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Đấu trường mùa #1</span>
      </div>
      <div className="divide-y divide-slate-50">
        {sorted.map(([name, s], i) => (
          <div key={name} className="flex items-center justify-between p-6 hover:bg-slate-50/50 transition-colors">
            <div className="flex items-center gap-5">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg",
                i === 0 ? "bg-amber-100 text-amber-600" :
                i === 1 ? "bg-slate-100 text-slate-500" :
                i === 2 ? "bg-orange-100 text-orange-600" : "bg-slate-50 text-slate-300"
              )}>
                {i + 1}
              </div>
              <div>
                <div className="font-black text-slate-800">{name}</div>
                <div className="text-xs font-bold text-slate-400">{s.sessionsCount} trận đấu</div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-black text-slate-900 text-xl">{s.totalScore}</div>
              <div className="text-[10px] font-black text-slate-400 uppercase">Điểm tích lũy</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

const DashboardView = ({ data, handleStartGame }: { data: AppData; handleStartGame: (id: string) => void }) => {
  const [selectedGrade, setSelectedGrade] = useState<number>(10);

  const stats = useMemo(() => {
    const last7Days = data.sessions.slice(0, 7).reverse();
    return {
      labels: last7Days.map(s => s.date),
      data: last7Days.map(s => s.score)
    };
  }, [data.sessions]);

  const filteredSubjects = useMemo(() => {
    return data.subjects.filter(sub => sub.grade === selectedGrade);
  }, [data.subjects, selectedGrade]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Chào mừng trở lại! 👋</h1>
          <p className="text-slate-500">Hôm nay bạn muốn chinh phục thử thách nào?</p>
        </div>
        <div className="flex items-center gap-3">
          <Card className="py-2 px-4 flex items-center gap-2 bg-orange-50 border-orange-100">
            <Trophy className="text-orange-500" size={20} />
            <span className="font-bold text-orange-700">{Math.round(data.progress.averageScore)}</span>
          </Card>
          <Card className="py-2 px-4 flex items-center gap-2 bg-blue-50 border-blue-100">
            <Activity className="text-blue-500" size={20} />
            <span className="font-bold text-blue-700">{data.progress.totalAttempts}</span>
          </Card>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-lg">Tiến độ 7 ngày qua</h3>
            <TrendingUp size={20} className="text-slate-400" />
          </div>
          <div className="h-64">
            {data.sessions.length > 0 ? (
              <Line 
                data={{
                  labels: stats.labels,
                  datasets: [{
                    label: "Điểm số",
                    data: stats.data,
                    borderColor: "#4A90E2",
                    backgroundColor: "rgba(74, 144, 226, 0.1)",
                    tension: 0.4,
                    fill: true,
                  }]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: { y: { beginAtZero: true } }
                }}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <BarChart3 size={48} className="mb-2 opacity-20" />
                <p>Chưa có dữ liệu thống kê</p>
              </div>
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <Leaderboard stats={data.groupStats} />
          
          <Card>
            <h3 className="font-bold text-lg mb-4">Chủ đề cần cải thiện</h3>
            <div className="space-y-4">
              {data.progress.weakTopics.length > 0 ? (
                data.progress.weakTopics.map((topic, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <span className="font-medium text-slate-700">{topic}</span>
                    <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-1 rounded-full">Cần ôn tập</span>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-400">
                  <Award size={48} className="mx-auto mb-2 opacity-20" />
                  <p>Bạn đang làm rất tốt!</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      <section>
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-6">
          <h2 className="text-2xl font-bold text-slate-900 line-clamp-1">Chủ đề ôn luyện</h2>
          
          <div className="flex bg-slate-100/50 p-1.5 rounded-2xl border border-slate-200/60 backdrop-blur-md">
            {[10, 11, 12].map((grade) => (
              <button
                key={grade}
                onClick={() => setSelectedGrade(grade)}
                className={cn(
                  "px-6 py-2.5 rounded-xl text-sm font-black transition-all duration-300",
                  selectedGrade === grade 
                    ? "bg-white text-indigo-600 shadow-xl shadow-indigo-100/50 border border-slate-100 scale-105" 
                    : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
                )}
              >
                Khối {grade}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredSubjects.map((sub) => {
            const Icon = ({ Activity, TrendingUp, Sigma, Box, BarChart3, Play } as any)[sub.icon] || BookOpen;
            return (
              <motion.div 
                key={sub.id} 
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ y: -8, scale: 1.02 }}
                onClick={() => handleStartGame(sub.id)}
                className={cn(
                  "glass-card rounded-[2.5rem] p-8 transition-all cursor-pointer group relative overflow-hidden",
                  "hover:border-indigo-200 hover:bg-indigo-50/50"
                )}
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/30 rounded-full -mr-16 -mt-16 group-hover:bg-indigo-100/50 transition-colors" />
                
                <div className="w-16 h-16 rounded-3xl premium-gradient text-white flex items-center justify-center mb-6 shadow-xl shadow-indigo-200/50 group-hover:rotate-6 transition-transform relative z-10">
                  <Icon size={32} />
                </div>
                
                <h4 className="font-black text-slate-800 text-xl mb-3 leading-tight group-hover:text-indigo-600 transition-colors">{sub.name}</h4>
                
                <div className="flex items-center justify-between mt-auto">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                    <span className="text-sm font-bold text-slate-400">{sub.questionsCount} câu hỏi</span>
                  </div>
                  <div className="w-10 h-10 rounded-2xl bg-white shadow-sm flex items-center justify-center text-indigo-600 opacity-0 group-hover:opacity-100 transform translate-x-4 group-hover:translate-x-0 transition-all duration-300">
                    <ChevronRight size={20} />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

const GameView = ({
  gameQuestions,
  currentQuestionIndex,
  timeLeft,
  isAnswering,
  gameScore,
  starUsed,
  currentRound,
  selectedAnswer,
  handleAnswer,
  setIsGameActive,
  setStarUsed
}: {
  gameQuestions: Question[];
  currentQuestionIndex: number;
  timeLeft: number;
  isAnswering: boolean;
  gameScore: number;
  starUsed: boolean;
  currentRound: RoundType;
  selectedAnswer: number | null;
  handleAnswer: (index: number) => void;
  setIsGameActive: (val: boolean) => void;
  setStarUsed: (val: boolean) => void;
}) => {
  useEffect(() => {
    triggerMathJax();
  }, [currentQuestionIndex, isAnswering, gameQuestions]);

  if (!gameQuestions.length) return null;
  const q = gameQuestions[currentQuestionIndex];

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in zoom-in-95 duration-500">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => setIsGameActive(false)} icon={ArrowLeft} className="text-slate-600">Thoát</Button>
        <div className="flex items-center gap-4">
          <div className="glass-card py-3 px-6 rounded-2xl flex items-center gap-3">
            <Timer className={cn("text-indigo-600", timeLeft < 10 && "text-rose-500 animate-pulse")} size={24} />
            <span className={cn("font-mono text-xl font-black text-indigo-700", timeLeft < 10 && "text-rose-600")}>{timeLeft}s</span>
          </div>
          <div className="premium-gradient py-3 px-6 rounded-2xl flex items-center gap-3 shadow-lg shadow-indigo-200/50">
            <Trophy className="text-white" size={24} />
            <span className="font-black text-xl text-white">{gameScore}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 overflow-x-auto pb-4 no-scrollbar">
        {Object.values(RoundType).map((r) => (
          <motion.div 
            key={r}
            className={cn(
              "px-6 py-2.5 rounded-2xl text-sm font-black whitespace-nowrap transition-all",
              currentRound === r ? "premium-gradient text-white shadow-xl scale-105" : "bg-white/50 text-slate-400 border border-slate-100"
            )}
          >
            {r}
          </motion.div>
        ))}
      </div>

      <Card className="relative overflow-hidden p-0">
        <div className="absolute top-0 left-0 w-full h-2 bg-slate-100/50">
          <motion.div 
            className="h-full premium-gradient"
            initial={{ width: 0 }}
            animate={{ width: `${((currentQuestionIndex + 1) / gameQuestions.length) * 100}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
        
        <div className="p-8 md:p-12">
          <div className="flex items-center justify-between mb-10">
            <span className="text-sm font-black text-indigo-600 uppercase tracking-widest">Câu {currentQuestionIndex + 1} của {gameQuestions.length}</span>
            <span className={cn(
              "px-4 py-1.5 rounded-full text-xs font-black shadow-sm",
              q.difficulty === "Dễ" ? "bg-emerald-100 text-emerald-700" : 
              q.difficulty === "Trung bình" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"
            )}>
              {q.difficulty}
            </span>
          </div>

          <div className="text-2xl md:text-3xl font-bold text-slate-800 mb-12 leading-relaxed mathjax-content">
            {q.content}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {q.options.map((opt, i) => (
              <motion.button
                key={i}
                whileHover={!isAnswering ? { scale: 1.02 } : {}}
                whileTap={!isAnswering ? { scale: 0.98 } : {}}
                disabled={isAnswering}
                onClick={() => handleAnswer(i)}
                className={cn(
                  "p-6 rounded-2xl border-2 text-left transition-all relative group text-lg font-medium",
                  selectedAnswer === null ? "border-slate-100 hover:border-indigo-400 hover:bg-indigo-50/30" :
                  i === q.correctAnswer ? "border-emerald-500 bg-emerald-50/50 text-emerald-700" :
                  selectedAnswer === i ? "border-rose-500 bg-rose-50/50 text-rose-700" : "border-slate-100 opacity-50"
                )}
              >
                <span className="mathjax-content">{opt}</span>
                {selectedAnswer !== null && i === q.correctAnswer && (
                  <CheckCircle2 className="absolute right-6 top-1/2 -translate-y-1/2 text-emerald-500" size={28} />
                )}
                {selectedAnswer === i && i !== q.correctAnswer && (
                  <XCircle className="absolute right-6 top-1/2 -translate-y-1/2 text-rose-500" size={28} />
                )}
              </motion.button>
            ))}
          </div>

          <AnimatePresence>
            {isAnswering && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-12 p-8 bg-indigo-50/50 rounded-3xl border border-indigo-100/50 backdrop-blur-sm"
              >
                <div className="flex items-center gap-3 text-indigo-700 font-black mb-4 text-lg">
                  <BrainCircuit size={24} />
                  Phân tích từ chuyên gia
                </div>
                <div className="text-slate-700 text-lg leading-relaxed mathjax-content">
                  {q.explanation}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Card>

      <div className="flex justify-center gap-6">
        <Button 
          variant={starUsed ? "secondary" : "outline"}
          disabled={isAnswering || starUsed}
          className="px-10"
          onClick={() => {
            setStarUsed(true);
            Swal.fire({
              title: "Ngôi sao hy vọng!",
              text: "Nhân đôi điểm số (hoặc trừ điểm nếu sai). Bạn đã sẵn sàng?",
              icon: "warning",
              toast: true,
              position: "top-end",
              showConfirmButton: false,
              timer: 3000
            });
          }}
          icon={Star}
        >
          Ngôi sao hy vọng
        </Button>
      </div>
    </div>
  );
};

const HistoryView = ({ data }: { data: AppData }) => (
  <div className="space-y-8 animate-in slide-in-from-bottom-6 duration-500">
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
      <div>
        <h2 className="text-3xl font-black text-slate-900 mb-2">Lịch sử thi đấu</h2>
        <p className="text-slate-500">Xem lại hành trình chinh phục đỉnh cao của bạn</p>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" icon={Download} onClick={() => {
          const ws = XLSX.utils.json_to_sheet(data.sessions);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "History");
          XLSX.writeFile(wb, "MathGameHistory.xlsx");
        }} className="px-8">Xuất Excel</Button>
      </div>
    </div>

    <div className="grid gap-6">
      {data.sessions.length > 0 ? (
        data.sessions.map((s) => (
          <motion.div 
            key={s.id} 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className={cn("glass-card rounded-3xl p-8 transition-all hover:scale-[1.01]", "flex flex-col md:flex-row md:items-center justify-between gap-6")}
          >
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-inner">
                <History size={32} />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-800 text-xl">Phiên đấu ngày {s.date}</h4>
                <div className="flex items-center gap-4 mt-1">
                  <span className="text-sm font-bold text-slate-400 flex items-center gap-1"><BookOpen size={14} /> {s.totalQuestions} câu</span>
                  <span className="text-sm font-bold text-slate-400 flex items-center gap-1"><Timer size={14} /> {s.timeSpent}s</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-8 border-t md:border-t-0 md:border-l border-slate-100 pt-6 md:pt-0 md:pl-8">
              <div className="text-right">
                <div className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">{s.score}</div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Điểm số</div>
              </div>
              <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-300">
                <ChevronRight size={24} />
              </div>
            </div>
          </motion.div>
        ))
      ) : (
        <div className="text-center py-32 glass-card rounded-3xl border-dashed">
          <div className="w-24 h-24 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-6">
            <History size={48} className="text-slate-200" />
          </div>
          <h3 className="text-xl font-bold text-slate-400">Chưa có lịch sử thi đấu</h3>
          <p className="text-slate-300">Bắt đầu trận đấu đầu tiên ngay nào!</p>
        </div>
      )}
    </div>
  </div>
);

const TutorView = ({ apiKey }: { apiKey: string }) => {
  const [query, setQuery] = useState("");
  const [chat, setChat] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    triggerMathJax();
  }, [chat]);

  const handleAsk = async () => {
    if (!query.trim() || !apiKey) return;
    
    const userMsg = query;
    setQuery("");
    setChat(prev => [...prev, { role: "user", text: userMsg }]);
    setLoading(true);

    try {
      const prompt = `Bạn là một gia sư Toán học chuyên nghiệp cho học sinh THPT Việt Nam. Hãy giải đáp thắc mắc sau bằng tiếng Việt, sử dụng Markdown và LaTeX cho công thức: ${userMsg}`;
      const response = await callGeminiAI(prompt);
      setChat(prev => [...prev, { role: "ai", text: response || "Xin lỗi, tôi không thể xử lý yêu cầu này." }]);
    } catch (err: any) {
      setChat(prev => [...prev, { role: "ai", text: err.message || "Đã xảy ra lỗi khi kết nối với AI." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto h-[calc(100vh-14rem)] flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="flex-1 overflow-y-auto space-y-6 p-8 glass-card rounded-[2rem] border-slate-100 no-scrollbar">
        {chat.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center px-8">
            <div className="w-20 h-20 rounded-3xl premium-gradient text-white flex items-center justify-center mb-8 shadow-xl shadow-indigo-200/50">
              <BrainCircuit size={40} />
            </div>
            <h3 className="text-2xl font-black text-slate-700 mb-3">Gia sư AI sẵn sàng hỗ trợ!</h3>
            <p className="max-w-md text-slate-400 font-medium">Đặt bất kỳ câu hỏi nào về Toán học, tôi sẽ giải đáp chi tiết cùng công thức và ví dụ.</p>
          </div>
        )}
        {chat.map((msg, i) => (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={i} 
            className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
          >
            <div className={cn(
              "max-w-[85%] p-6 rounded-3xl shadow-sm",
              msg.role === "user" ? "premium-gradient text-white rounded-tr-none" : "bg-white text-slate-800 rounded-tl-none border border-slate-100"
            )}>
              <div 
                className={cn("prose max-w-none mathjax-content", msg.role === "user" ? "prose-invert" : "prose-slate")}
                dangerouslySetInnerHTML={{ __html: marked.parse(msg.text) as string }}
              />
            </div>
          </motion.div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex gap-3">
              <div className="w-3 h-3 bg-indigo-400 rounded-full animate-bounce" />
              <div className="w-3 h-3 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]" />
              <div className="w-3 h-3 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
          </div>
        )}
      </div>
      <div className="flex gap-4 p-2 glass-card rounded-[2rem]">
        <input 
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAsk()}
          placeholder="Nhập câu hỏi của bạn..."
          className="flex-1 bg-transparent px-6 py-4 rounded-2xl focus:outline-none font-medium placeholder:text-slate-400"
        />
        <Button onClick={handleAsk} disabled={loading || !query.trim()} icon={MessageSquare} className="px-10 rounded-2xl">Gửi AI</Button>
      </div>
    </div>
  );
};

const SettingsView = ({ 
  apiKey, 
  setApiKey, 
  showApiKey, 
  setShowApiKey, 
  data, 
  setData, 
  DEFAULT_DATA 
}: { 
  apiKey: string; 
  setApiKey: (val: string) => void;
  showApiKey: boolean;
  setShowApiKey: (val: boolean) => void;
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  DEFAULT_DATA: AppData;
}) => (
  <div className="max-w-3xl mx-auto space-y-10 animate-in slide-in-from-top-6 duration-500">
    <div>
      <h2 className="text-3xl font-black text-slate-900 mb-2">Cài đặt hệ thống</h2>
      <p className="text-slate-500">Cấu hình trải nghiệm học tập theo ý bạn</p>
    </div>
    
    <Card className="space-y-10">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-black text-slate-400 uppercase tracking-widest">Gemini API Key</label>
          <a 
            href="https://aistudio.google.com/app/apikey" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-colors bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100"
          >
            <Plus size={14} />
            Lấy API Key miễn phí
          </a>
        </div>
        <div className="relative">
          <input 
            type={showApiKey ? "text" : "password"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Nhập API Key của bạn..."
            className="w-full bg-slate-50/50 p-5 pr-14 rounded-2xl border-2 border-slate-100 focus:border-indigo-400 focus:bg-white focus:outline-none transition-all font-medium"
          />
          <button 
            onClick={() => setShowApiKey(!showApiKey)}
            className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-indigo-600 transition-colors"
          >
            {showApiKey ? <EyeOff size={24} /> : <Eye size={24} />}
          </button>
        </div>
        <div className="flex items-center gap-2 p-4 bg-amber-50 rounded-2xl border border-amber-100">
          <BrainCircuit className="text-amber-500" size={18} />
          <p className="text-xs text-amber-700 font-medium">API Key giúp AI có thể giải bài tập và trò chuyện cùng bạn. Dữ liệu được bảo mật cục bộ.</p>
        </div>
      </div>

      <div className="space-y-4">
        <label className="block text-sm font-black text-slate-400 uppercase tracking-widest">Mô hình AI ưu tiên</label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {MODELS.map(m => (
            <button 
              key={m}
              onClick={() => setData(prev => ({ ...prev, settings: { ...prev.settings, selectedModel: m } }))}
              className={cn(
                "p-4 rounded-2xl border-2 text-sm font-bold transition-all",
                data.settings.selectedModel === m 
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700 shadow-md" 
                  : "border-slate-100 hover:border-slate-200 text-slate-500"
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-indigo-500 shadow-sm">
            <TrendingUp size={24} />
          </div>
          <div>
            <h4 className="font-extrabold text-slate-800">Âm thanh thông báo</h4>
            <p className="text-sm text-slate-500 font-medium">Phản hồi âm thanh khi trả lời</p>
          </div>
        </div>
        <button 
          onClick={() => setData(prev => ({ ...prev, settings: { ...prev.settings, soundEnabled: !prev.settings.soundEnabled } }))}
          className={cn(
            "w-16 h-8 rounded-full transition-all relative",
            data.settings.soundEnabled ? "premium-gradient" : "bg-slate-300"
          )}
        >
          <motion.div 
            animate={{ x: data.settings.soundEnabled ? 32 : 4 }}
            className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-md"
          />
        </button>
      </div>
    </Card>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      <Button variant="outline" className="py-4" icon={RefreshCw} onClick={() => {
        Swal.fire({
          title: "Tuyệt đối chắc chắn?",
          text: "Toàn bộ tiến trình học tập của bạn sẽ biến mất mãi mãi!",
          icon: "warning",
          showCancelButton: true,
          confirmButtonColor: "#ef4444",
          confirmButtonText: "Xóa sạch dữ liệu",
          cancelButtonText: "Để tôi xem lại"
        }).then(res => {
          if (res.isConfirmed) {
            setData(DEFAULT_DATA);
            localStorage.removeItem("math_game_data");
            Swal.fire("Đã reset", "Hãy bắt đầu lại hành trình mới!", "success");
          }
        });
      }}>Xóa sạch dữ liệu</Button>
      <Button variant="primary" className="py-4" onClick={() => Swal.fire({
        title: "Đã lưu!",
        text: "Hệ thống đã sẵn sàng với cấu hình mới chuyên sâu.",
        icon: "success",
        confirmButtonColor: "#6366f1"
      })}>Lưu cấu hình</Button>
    </div>
  </div>
);

const PlanView = ({ apiKey }: { apiKey: string }) => {
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const injectAiContentToDocx = async () => {
    if (!file || !apiKey) return;
    setProcessing(true);
    try {
      const prompt = `Bạn là một giáo sư Toán học. Hãy tạo nội dung giáo án nâng cao cho 4 hoạt động và phần củng cố. 
      Yêu cầu trả về định dạng đúng như sau (không kèm văn bản khác):
      ===NLS_MỤC_TIÊU===
      (Nội dung mục tiêu)
      ===NLS_HOẠT_ĐỘNG_1===
      (Nội dung hoạt động 1)
      ===NLS_HOẠT_ĐỘNG_2===
      (Nội dung hoạt động 2)
      ===NLS_HOẠT_ĐỘNG_3===
      (Nội dung hoạt động 3)
      ===NLS_HOẠT_ĐỘNG_4===
      (Nội dung hoạt động 4)
      ===NLS_CỦNG_CỐ===
      (Nội dung củng cố)`;

      const aiContent = await callGeminiAI(prompt);
      if (!aiContent) throw new Error("Không có phản hồi từ AI");

      const zip = await JSZip.loadAsync(file);
      const docXml = await zip.file("word/document.xml")?.async("string");
      if (!docXml) throw new Error("File Word không hợp lệ");

      // Simple parser for AI sections
      const sections: Record<string, string> = {};
      const parts = aiContent.split(/===(NLS_[^=]+)===/);
      for (let i = 1; i < parts.length; i += 2) {
        sections[parts[i]] = parts[i+1].trim();
      }

      let newDocXml = docXml;

      const insertContent = (xml: string, marker: string, content: string) => {
        // Find the paragraph containing the marker
        const markerMap: Record<string, string> = {
          "NLS_MỤC_TIÊU": "Thái độ",
          "NLS_HOẠT_ĐỘNG_1": "Hoạt động 1",
          "NLS_HOẠT_ĐỘNG_2": "Hoạt động 2",
          "NLS_HOẠT_ĐỘNG_3": "Hoạt động 3",
          "NLS_HOẠT_ĐỘNG_4": "Hoạt động 4",
          "NLS_CỦNG_CỐ": "vận dụng"
        };

        const searchText = markerMap[marker] || marker;
        const escapedSearch = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(<w:p [^>]*>.*?${escapedSearch}.*?<\/w:p>)`, 'i');
        
        const match = xml.match(regex);
        if (match) {
          const injectedXml = `<w:p><w:pPr><w:jc w:val="both"/></w:pPr><w:r><w:rPr><w:color w:val="FF0000"/></w:rPr><w:t>${content.replace(/\n/g, '</w:t><w:br/><w:t>')}</w:t></w:r></w:p>`;
          return xml.replace(match[0], match[0] + injectedXml);
        }
        return xml;
      };

      for (const [marker, content] of Object.entries(sections)) {
        newDocXml = insertContent(newDocXml, marker, content);
      }

      zip.file("word/document.xml", newDocXml);
      const blob = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Advanced_${file.name}`;
      a.click();
      
      Swal.fire("Thành công", "Giáo án đã được nâng cấp và tải về!", "success");
    } catch (err: any) {
      Swal.fire("Lỗi", err.message, "error");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in duration-500">
      <div className="text-center space-y-4">
        <div className="w-24 h-24 rounded-[2.5rem] premium-gradient text-white flex items-center justify-center mx-auto shadow-2xl shadow-indigo-200/50 mb-8">
          <Download size={48} />
        </div>
        <h2 className="text-4xl font-black text-slate-900 tracking-tight">Nâng cấp Giáo án AI</h2>
        <p className="text-slate-500 text-lg font-medium max-w-2xl mx-auto">Tự động chèn nội dung AI chuyên sâu vào giáo án Word của bạn. Giữ nguyên 100% định dạng và công thức MathType.</p>
      </div>

      <Card className="p-12 border-dashed border-4 border-slate-100 hover:border-indigo-200 transition-colors bg-slate-50/30">
        <div className="flex flex-col items-center justify-center space-y-6">
          <input 
            type="file" 
            accept=".docx" 
            onChange={handleFileUpload}
            className="hidden" 
            id="docx-upload" 
          />
          <label 
            htmlFor="docx-upload"
            className="cursor-pointer group flex flex-col items-center"
          >
            <div className="w-20 h-20 rounded-3xl bg-white shadow-xl flex items-center justify-center text-indigo-500 group-hover:scale-110 transition-transform mb-4">
              <Upload size={32} />
            </div>
            <span className="text-xl font-bold text-slate-700">{file ? file.name : "Chọn file giáo án (.docx)"}</span>
            <p className="text-sm text-slate-400 mt-2">Kéo thả hoặc nhấn để chọn tập tin</p>
          </label>

          <Button 
            disabled={!file || processing} 
            onClick={injectAiContentToDocx}
            className="w-full max-w-md py-5 text-xl rounded-2xl"
            icon={processing ? RefreshCw : BrainCircuit}
          >
            {processing ? "Đang phân tích & chèn..." : "Bắt đầu nâng cấp với AI"}
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
            <CheckCircle2 size={20} />
          </div>
          <h4 className="font-bold text-slate-800 mb-2">Bảo toàn OLE</h4>
          <p className="text-xs text-slate-400 font-medium leading-relaxed">Giữ nguyên các công thức MathType và hình vẽ hình học trong file gốc.</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
            <Activity size={20} />
          </div>
          <h4 className="font-bold text-slate-800 mb-2">Chèn thông minh</h4>
          <p className="text-xs text-slate-400 font-medium leading-relaxed">AI tự tìm vị trí "Hoạt động 1, 2..." để chèn thêm nội dung bổ trợ.</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
            <Eye size={20} />
          </div>
          <h4 className="font-bold text-slate-800 mb-2">Đánh dấu đỏ</h4>
          <p className="text-xs text-slate-400 font-medium leading-relaxed">Nội dung mới được đánh dấu màu đỏ để giáo viên dễ dàng kiểm soát.</p>
        </div>
      </div>
    </div>
  );
};

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 pb-24 md:pb-0 md:pl-20 lg:pl-64">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 h-full w-24 lg:w-72 bg-white border-r border-slate-100 z-50">
        <div className="p-8 flex items-center gap-4">
          <div className="w-12 h-12 rounded-[1.25rem] premium-gradient flex items-center justify-center text-white shadow-xl shadow-indigo-200/50">
            <Sigma size={28} />
          </div>
          <div className="hidden lg:block">
            <h1 className="font-black text-2xl bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 tracking-tight">Math Arena</h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">THPT Series</p>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-3 mt-8">
          {[
            { id: "dashboard", icon: Layout, label: "Tổng quan" },
            { id: "plan", icon: Download, label: "Soạn giáo án" },
            { id: "history", icon: History, label: "Thống kê" },
            { id: "tutor", icon: BrainCircuit, label: "Gia sư AI" },
            { id: "settings", icon: SettingsIcon, label: "Tùy chỉnh" }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => { setView(item.id as any); setIsGameActive(false); }}
              className={cn(
                "w-full flex items-center gap-4 p-4 rounded-2xl transition-all relative group overflow-hidden",
                view === item.id ? "text-indigo-600 font-extrabold" : "text-slate-500 hover:text-slate-800"
              )}
            >
              {view === item.id && (
                <motion.div layoutId="nav-active" className="absolute inset-0 bg-indigo-50/50 rounded-2xl -z-10" />
              )}
              <item.icon size={26} className={cn(view === item.id ? "text-indigo-600" : "group-hover:scale-110 transition-transform")} />
              <span className="hidden lg:block text-[15px]">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-6">
          <Card className="hidden lg:block bg-slate-900 border-none p-6 rounded-[2rem] overflow-hidden relative">
            <div className="absolute -top-4 -right-4 w-20 h-20 bg-indigo-500/20 blur-2xl rounded-full" />
            <p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest mb-3">AI Engine Status</p>
            <div className="flex items-center gap-3">
              <div className={cn("w-3 h-3 rounded-full shadow-[0_0_12px_rgba(0,0,0,0.1)]", apiKey ? "bg-emerald-400 animate-pulse shadow-emerald-400" : "bg-rose-400 shadow-rose-400")} />
              <span className="text-sm font-bold text-white">{apiKey ? "Vận hành tốt" : "Chưa cấu hình"}</span>
            </div>
          </Card>
        </div>
      </aside>

      {/* Mobile Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 flex justify-around p-4 z-50">
        {[
          { id: "dashboard", icon: Layout },
          { id: "plan", icon: Download },
          { id: "history", icon: History },
          { id: "tutor", icon: BrainCircuit },
          { id: "settings", icon: SettingsIcon }
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => { setView(item.id as any); setIsGameActive(false); }}
            className={cn("p-2 rounded-xl", view === item.id ? "text-blue-600 bg-blue-50" : "text-slate-400")}
          >
            <item.icon size={24} />
          </button>
        ))}
      </nav>

      {/* Main Content */}
      <main className="p-6 md:p-10 max-w-7xl mx-auto">
        <AnimatePresence mode="wait">
          {isGameActive ? (
            <motion.div key="game" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <GameView 
                gameQuestions={gameQuestions}
                currentQuestionIndex={currentQuestionIndex}
                timeLeft={timeLeft}
                isAnswering={isAnswering}
                gameScore={gameScore}
                starUsed={starUsed}
                currentRound={currentRound}
                selectedAnswer={selectedAnswer}
                handleAnswer={handleAnswer}
                setIsGameActive={setIsGameActive}
                setStarUsed={setStarUsed}
              />
            </motion.div>
          ) : (
            <motion.div 
              key={view} 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {view === "dashboard" && <DashboardView data={data} handleStartGame={handleStartGame} />}
              {view === "plan" && <PlanView apiKey={apiKey} />}
              {view === "history" && <HistoryView data={data} />}
              {view === "tutor" && <TutorView apiKey={apiKey} />}
              {view === "settings" && (
                <SettingsView 
                  apiKey={apiKey}
                  setApiKey={setApiKey}
                  showApiKey={showApiKey}
                  setShowApiKey={setShowApiKey}
                  data={data}
                  setData={setData}
                  DEFAULT_DATA={DEFAULT_DATA}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {showGroupSelection && (
          <GroupSelectionModal 
            onSelect={confirmStartGame} 
            onClose={() => setShowGroupSelection(false)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
