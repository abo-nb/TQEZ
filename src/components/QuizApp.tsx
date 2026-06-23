import React, { useState, useMemo, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Brain, CheckCircle2, XCircle, AlertCircle, RefreshCw, Layers, BookOpen, BarChart2, RotateCcw } from 'lucide-react';
import { Question, SM2Progress } from '../types';
import { calculateNextSM2, initSM2Progress } from '../lib/sm2';
import { allSubjects, subjectList } from '../question_bank';
import { cn } from '../lib/utils';
import StatsOverview from './StatsOverview';

// 获取下一题的逻辑 (结合过滤器与 SM-2)

function getNextQuestion(
  questions: Question[], 
  progress: Record<string, SM2Progress>, 
  currentId?: string
): Question | null {
  if (questions.length === 0) return null;

  const now = Date.now();

  // 1. 获取所有到期复习的题目 (优先复习)
  const dueQuestions = questions.filter(q => {
    const p = progress[q.id];
    return p && p.nextReviewDate <= now && q.id !== currentId;
  });

  if (dueQuestions.length > 0) {
    // 根据 nextReviewDate 升序排序，越早应该复习的排越前
    dueQuestions.sort((a, b) => progress[a.id].nextReviewDate - progress[b.id].nextReviewDate);
    return dueQuestions[0];
  }

  // 2. 如果没有到期复习的题目，挑选还没做过的新题
  const unseenQuestions = questions.filter(q => !progress[q.id]);
  if (unseenQuestions.length > 0) {
    return unseenQuestions[Math.floor(Math.random() * unseenQuestions.length)];
  }

  // 3. 全都做过了且没有到期的，挑选正确率最低的进行加强 (并且不是当前这题)
  const sorted = questions.slice().sort((a, b) => {
    const pA = progress[a.id];
    const pB = progress[b.id];
    const accA = pA.attempts === 0 ? 0 : pA.correctCount / pA.attempts;
    const accB = pB.attempts === 0 ? 0 : pB.correctCount / pB.attempts;
    return accA - accB;
  });

  const candidates = sorted.filter(q => q.id !== currentId);
  if (candidates.length === 0) return sorted[0]; // 如果只有一题可选
  
  // 从表现最差的前3名中随机抽
  const poolSize = Math.min(3, candidates.length);
  return candidates[Math.floor(Math.random() * poolSize)];
}

export default function QuizApp() {
  const [selectedSubject, setSelectedSubject] = useState<string>(subjectList[0] || '');
  const [selectedChapter, setSelectedChapter] = useState<string>('all');
  
  // 同步 subjectList 的变更到 selectedSubject (避免用户删除了题库但下拉框仍处于失效的科目)
  useEffect(() => {
    if (subjectList.length > 0 && !subjectList.includes(selectedSubject)) {
      setSelectedSubject(subjectList[0]);
    }
  }, [subjectList, selectedSubject]);

  // 当前科目的所有题目
  const subjectQuestions = useMemo(() => allSubjects[selectedSubject] || [], [selectedSubject]);
  
  // 提取章节列表
  const chapters = useMemo(() => {
    const chs = new Set<string>();
    subjectQuestions.forEach(q => chs.add(q.chapter));
    return Array.from(chs);
  }, [subjectQuestions]);

  // 根据章节过滤后的题目
  const filteredQuestions = useMemo(() => {
    if (selectedChapter === 'all') return subjectQuestions;
    return subjectQuestions.filter(q => q.chapter === selectedChapter);
  }, [subjectQuestions, selectedChapter]);

  // SM-2 进度记录: {[题号]: 进度信息}
  const [progress, setProgress] = useState<Record<string, SM2Progress>>(() => {
    const saved = localStorage.getItem('sm2_progress');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem('sm2_progress', JSON.stringify(progress));
  }, [progress]);
  
  // 题目状态
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);

  // 计算当前上下文的进度
  const currentContextStats = useMemo(() => {
    let attempted = 0;
    let correct = 0;
    let attempts = 0;

    filteredQuestions.forEach(q => {
      const p = progress[q.id];
      if (p) {
        attempted++;
        correct += p.correctCount;
        attempts += p.attempts;
      }
    });

    const progressPercent = filteredQuestions.length > 0 ? (attempted / filteredQuestions.length * 100).toFixed(1) : '0';
    const accuracy = attempts > 0 ? (correct / attempts * 100).toFixed(1) : '0';

    return { total: filteredQuestions.length, attempted, progressPercent, accuracy };
  }, [filteredQuestions, progress]);

  // 初始化或当过滤条件改变时，重新挑选题目
  useEffect(() => {
    setCurrentQuestion(getNextQuestion(filteredQuestions, progress));
    setSelectedOptionIds([]);
    setIsRevealed(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredQuestions]);

  const handleSelectOption = (id: string) => {
    if (isRevealed || !currentQuestion) return;

    if (currentQuestion.type === 'single') {
      setSelectedOptionIds([id]);
    } else {
      setSelectedOptionIds(prev => 
        prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
      );
    }
  };

  const handleRevealOrNext = () => {
    if (!currentQuestion) return;

    // 如果还没有作答且没有揭晓答案，阻挡
    if (selectedOptionIds.length === 0 && !isRevealed) {
      return; 
    }

    if (isRevealed) {
      // 切换到下一题
      const nextQ = getNextQuestion(filteredQuestions, progress, currentQuestion.id);
      setCurrentQuestion(nextQ);
      setSelectedOptionIds([]);
      setIsRevealed(false);
      return;
    }

    // 揭晓答案并计算 SM-2
    setIsRevealed(true);
    
    // 判断是否全对
    const correctOptionIds = (currentQuestion.options || []).filter(o => o.isCorrect).map(o => o.id);
    const isCorrect = 
      correctOptionIds.length === selectedOptionIds.length &&
      correctOptionIds.every(id => selectedOptionIds.includes(id));
    
    // 我们约定 rating: 全对为 4 极容易，错为 1
    const quality = isCorrect ? 4 : 1;

    setProgress(prev => {
      const p = prev[currentQuestion.id] || initSM2Progress(currentQuestion.id);
      
      const { interval, repetition, easeFactor } = calculateNextSM2(
        quality, 
        p.repetition, 
        p.easeFactor, 
        p.interval
      );

      // 下次复习时间：当前时间 + interval(天)
      const daysInMs = interval * 24 * 60 * 60 * 1000;

      return {
        ...prev,
        [currentQuestion.id]: {
          ...p,
          interval,
          repetition,
          easeFactor,
          nextReviewDate: Date.now() + daysInMs,
          attempts: p.attempts + 1,
          correctCount: p.correctCount + (isCorrect ? 1 : 0)
        }
      };
    });
  };

  const handleResetProgress = () => {
    if (window.confirm('确定要清空所有的刷题记录并重新开始吗？这无法撤销。')) {
      setProgress({});
      localStorage.removeItem('sm2-progress');
      setCurrentQuestion(getNextQuestion(filteredQuestions, {}, []));
      setIsRevealed(false);
      setSelectedOptionIds([]);
    }
  };

  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center text-slate-500">
          <Brain className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>当前分类下没有题目</p>
        </div>
      </div>
    );
  }

  // 是否回答正确
  const correctOptionIds = (currentQuestion.options || []).filter(o => o.isCorrect).map(o => o.id);
  const isCorrectAnswered = correctOptionIds.length === selectedOptionIds.length &&
      correctOptionIds.every(id => selectedOptionIds.includes(id));

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto space-y-6">
        
        {/* Header / Selectors */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-center space-x-2 text-indigo-600 font-semibold mb-2 sm:mb-0 shrink-0">
            <Brain className="w-5 h-5" />
            <span>智能刷题中心</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto items-stretch sm:items-center">
            <div className="relative">
              <BookOpen className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                value={selectedSubject}
                onChange={e => setSelectedSubject(e.target.value)}
                className="pl-9 pr-8 py-2 w-full text-sm bg-slate-50 border border-slate-200 rounded-lg appearance-none outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium text-slate-700"
              >
                {subjectList.map(subj => (
                  <option key={subj} value={subj}>{subj}</option>
                ))}
              </select>
            </div>
            <div className="relative">
              <Layers className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                value={selectedChapter}
                onChange={e => setSelectedChapter(e.target.value)}
                className="pl-9 pr-8 py-2 w-full text-sm bg-slate-50 border border-slate-200 rounded-lg appearance-none outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium text-slate-700 max-w-[200px] truncate"
              >
                <option value="all">所有章节</option>
                {chapters.map(ch => (
                  <option key={ch} value={ch}>{ch}</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => setIsStatsOpen(true)}
              className="flex items-center justify-center space-x-1 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium transition-colors"
            >
              <BarChart2 className="w-4 h-4" />
              <span>统计</span>
            </button>
            <button
              onClick={handleResetProgress}
              className="flex items-center justify-center space-x-1 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-sm font-medium transition-colors"
              title="重置学习进度"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Current Context Progress Bar */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex justify-between items-center text-sm font-semibold text-slate-600 mb-2">
            <span>当前题库进度: {currentContextStats.attempted} / {currentContextStats.total}</span>
            <span>正确率: {currentContextStats.accuracy}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
            <div 
              className="bg-indigo-500 h-2.5 transition-all duration-500" 
              style={{ width: `${currentContextStats.progressPercent}%` }}
            ></div>
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-100">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-block px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold uppercase tracking-wider">
                {currentQuestion.chapter} · {currentQuestion.questionNumber}
              </span>
              <span className={cn(
                "inline-block px-3 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider",
                currentQuestion.type === 'multiple' ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
              )}>
                {currentQuestion.type === 'multiple' ? '多选题' : '单选题'}
              </span>
            </div>

            <div className="prose prose-slate max-w-none 
              [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-4 
              [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mb-3 
              [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-slate-800 [&_h3]:mb-3
              [&_p]:text-slate-600 [&_p]:mb-4 [&_p]:leading-relaxed
              [&_pre]:bg-slate-800 [&_pre]:text-slate-100 [&_pre]:p-4 [&_pre]:rounded-xl [&_pre]:overflow-x-auto
              [&_code]:bg-slate-100 [&_code]:text-indigo-600 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md [&_code]:text-sm
            ">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  img: ({node, ...props}) => (
                    <span className="block my-4">
                      <img 
                        {...props} 
                        alt={props.alt || "题图"} 
                        className="max-w-full rounded-lg shadow-sm border border-slate-200" 
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          // 避免无限循环
                          if (!target.src.includes('placehold.co')) {
                            target.src = `https://placehold.co/600x400?text=${encodeURIComponent('图片缺失: ' + (props.alt || ''))}`;
                          }
                        }} 
                      />
                    </span>
                  )
                }}
              >
                {(currentQuestion.content || '').replace(/(#+)([^#\s])/g, '$1 $2')}
              </ReactMarkdown>
            </div>
            
            {currentQuestion.imageUrl && (
              <div className="mt-4 rounded-xl overflow-hidden border border-slate-200">
                <img src={currentQuestion.imageUrl} alt="题图" className="w-full object-cover" />
              </div>
            )}
          </div>

          {/* Options */}
          <div className="space-y-3">
            {(currentQuestion.options || []).map(option => {
              const isSelected = selectedOptionIds.includes(option.id);
              
              let optionClass = "border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/50";
              let icon = null;

              if (isRevealed) {
                if (option.isCorrect) {
                  // 正确选项始终高亮为绿色
                  optionClass = "border-green-500 bg-green-50 text-green-800 ring-1 ring-green-500";
                  icon = <CheckCircle2 className="w-5 h-5 text-green-600 ml-auto" />;
                } else if (isSelected && !option.isCorrect) {
                  // 选错了的选项高亮为红色
                  optionClass = "border-red-500 bg-red-50 text-red-800 ring-1 ring-red-500";
                  icon = <XCircle className="w-5 h-5 text-red-600 ml-auto" />;
                } else {
                  // 错的但没有选
                  optionClass = "border-slate-100 bg-slate-50 text-slate-400 opacity-60";
                }
              } else if (isSelected) {
                optionClass = "border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50 text-indigo-900";
              }

              return (
                <button
                  key={option.id}
                  onClick={() => handleSelectOption(option.id)}
                  disabled={isRevealed}
                  className={cn(
                    "w-full text-left p-4 rounded-xl border-2 transition-all duration-200 flex items-center gap-3",
                    optionClass
                  )}
                >
                  <div className={cn(
                    "w-5 h-5 border-2 flex items-center justify-center shrink-0",
                    currentQuestion.type === 'multiple' ? "rounded-md" : "rounded-full",
                    isSelected 
                      ? (isRevealed && !option.isCorrect ? "bg-red-500 border-red-500" : "bg-indigo-500 border-indigo-500") 
                      : "border-slate-300"
                  )}>
                    {isSelected && <div className={cn(
                      "bg-white",
                      currentQuestion.type === 'multiple' ? "w-2.5 h-2.5 rounded-sm" : "w-2 h-2 rounded-full"
                    )} />}
                  </div>
                  <div className="flex-1 font-medium prose prose-slate prose-sm max-w-none [&_p]:m-0 [&_code]:bg-slate-100 [&_code]:text-indigo-600 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md [&_code]:text-xs">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {option.content || ''}
                    </ReactMarkdown>
                  </div>
                  {icon}
                </button>
              );
            })}
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100">
            <button
              onClick={handleRevealOrNext}
              disabled={!isRevealed && selectedOptionIds.length === 0}
              className={cn(
                "w-full py-4 px-6 rounded-xl font-semibold text-white shadow-sm transition-all duration-200 flex items-center justify-center space-x-2",
                isRevealed 
                  ? "bg-slate-800 hover:bg-slate-900 shadow-slate-200" 
                  : "bg-amber-500 hover:bg-amber-600 shadow-amber-200 disabled:opacity-50 disabled:hover:bg-amber-500"
              )}
            >
              {isRevealed ? (
                <>
                  <span>下一题</span>
                  <RefreshCw className="w-5 h-5" />
                </>
              ) : (
                <>
                  <span>看答案</span>
                  <AlertCircle className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </div>
        
        {/* Feedback Display (Only during reveal) */}
        {isRevealed && (
          <div className={cn(
            "p-4 rounded-xl flex items-start space-x-3 text-sm transition-all shadow-sm",
            isCorrectAnswered
              ? "bg-green-50 text-green-800 border-green-200 border"
              : "bg-amber-50 text-amber-800 border-amber-200 border"
          )}>
            <Brain className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-base mb-1">
                {isCorrectAnswered
                  ? "回答正确！" 
                  : "回答错误。"}
              </p>
              <p className="opacity-80">
                系统已使用 SM-2 算法调整此题的记忆曲线。
                {isCorrectAnswered 
                  ? "下次复习间隔已延长。" 
                  : "稍后将增加此题的复习频率以增强记忆！"}
              </p>
            </div>
          </div>
        )}
        
        {isStatsOpen && (
          <StatsOverview 
            progress={progress} 
            onClose={() => setIsStatsOpen(false)} 
          />
        )}
      </div>
    </div>
  );
}
