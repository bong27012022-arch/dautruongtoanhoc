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

    // Generate mock questions for demo if none exist
    const mockQuestions: Question[] = [
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
        content: "Tính đạo hàm của hàm số $y = \\ln(x^2 + 1)$.",
        options: ["A. $\\frac{1}{x^2+1}$", "B. $\\frac{2x}{x^2+1}$", "C. $\\frac{x}{x^2+1}$", "D. $2x(x^2+1)$"],
        correctAnswer: 1,
        explanation: "$y' = \\frac{(x^2+1)'}{x^2+1} = \\frac{2x}{x^2+1}$.",
        difficulty: "Trung bình",
        topic: "Mũ & Logarit"
      },
      {
        id: "q3",
        content: "Trong không gian Oxyz, cho mặt phẳng $(P): 2x - y + 2z - 3 = 0$. Khoảng cách từ điểm $M(1, 2, -1)$ đến mặt phẳng $(P)$ là:",
        options: ["A. 1", "B. 5/3", "C. 2", "D. 3"],
        correctAnswer: 1,
        explanation: "$d(M, P) = \\frac{|2(1) - (2) + 2(-1) - 3|}{\\sqrt{2^2 + (-1)^2 + 2^2}} = \\frac{|-5|}{3} = 5/3$.",
        difficulty: "Khó",
        topic: "Hình học không gian"
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

    if (isCorrect) {
      points = 10;
      if (starUsed) points *= 2;
      setGameScore(prev => prev + points);
    } else if (starUsed) {
      setGameScore(prev => prev - 10);
    }

    setTimeout(() => {
      if (currentQuestionIndex < gameQuestions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
        setSelectedAnswer(null);
        setIsAnswering(false);
        setTimeLeft(30);
        setStarUsed(false);
        
        // Advance rounds logic for demo
        if (currentQuestionIndex === 1) setCurrentRound(RoundType.TANG_TOC);
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
      correctAnswers: gameQuestions.filter((_, i) => i === 0).length, // Placeholder
      timeSpent,
      roundResults: [
        { round: RoundType.KHOI_DONG, score: gameScore }
      ]
    };

    setData(prev => ({
      ...prev,
      sessions: [newSession, ...prev.sessions],
      progress: {
        ...prev.progress,
        totalAttempts: prev.progress.totalAttempts + 1,
        averageScore: (prev.progress.averageScore * prev.progress.totalAttempts + gameScore) / (prev.progress.totalAttempts + 1)
      }
    }));

    setIsGameActive(false);
    Swal.fire({
      title: "Hoàn thành!",
      text: `Bạn đạt được ${gameScore} điểm trong ${timeSpent} giây.`,
      icon: "success",
      confirmButtonText: "Tuyệt vời"
    }).then(() => setView("dashboard"));
  };

  // --- Views ---

  const DashboardView = () => {
    const stats = useMemo(() => {
      const last7Days = data.sessions.slice(0, 7).reverse();
      return {
        labels: last7Days.map(s => s.date),
        data: last7Days.map(s => s.score)
      };
    }, [data.sessions]);

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

        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-900">Chủ đề ôn luyện</h2>
            <Button variant="ghost" className="text-blue-600">Xem tất cả</Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {data.subjects.map((sub) => {
              const Icon = ({ Activity, TrendingUp, Sigma, Box, BarChart3 } as any)[sub.icon] || BookOpen;
              return (
                <motion.div 
                  key={sub.id} 
                  layoutId={sub.id}
                  onClick={() => handleStartGame(sub.id)}
                  whileHover={{ y: -8, scale: 1.02 }}
                  className={cn(
                    "glass-card rounded-3xl p-8 transition-all cursor-pointer group",
                    "hover:border-indigo-200 hover:bg-indigo-50/50"
                  )}
                >
                  <div className="w-14 h-14 rounded-2xl premium-gradient text-white flex items-center justify-center mb-6 shadow-lg shadow-indigo-200/50 group-hover:rotate-6 transition-transform">
                    <Icon size={28} />
                  </div>
                  <h4 className="font-extrabold text-slate-800 text-lg mb-2">{sub.name}</h4>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-500">{sub.questionsCount} câu hỏi</span>
                    <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 opacity-0 group-hover:opacity-100 transition-all">
                      <ChevronRight size={18} />
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

  const GameView = () => {
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

  const HistoryView = () => (
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

  const TutorView = () => {
    const [query, setQuery] = useState("");
    const [chat, setChat] = useState<{ role: "user" | "ai"; text: string }[]>([]);
    const [loading, setLoading] = useState(false);

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

  const SettingsView = () => (
    <div className="max-w-3xl mx-auto space-y-10 animate-in slide-in-from-top-6 duration-500">
      <div>
        <h2 className="text-3xl font-black text-slate-900 mb-2">Cài đặt hệ thống</h2>
        <p className="text-slate-500">Cấu hình trải nghiệm học tập theo ý bạn</p>
      </div>
      
      <Card className="space-y-10">
        <div className="space-y-4">
          <label className="block text-sm font-black text-slate-400 uppercase tracking-widest">Gemini API Key</label>
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

  const PlanView = () => {
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
              <GameView />
            </motion.div>
          ) : (
            <motion.div 
              key={view} 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {view === "dashboard" && <DashboardView />}
              {view === "plan" && <PlanView />}
              {view === "history" && <HistoryView />}
              {view === "tutor" && <TutorView />}
              {view === "settings" && <SettingsView />}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
