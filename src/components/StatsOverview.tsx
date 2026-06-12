import React, { useMemo, useState } from 'react';
import { allSubjects, subjectList } from '../question_bank';
import { SM2Progress } from '../types';
import { BarChart, List, CheckCircle, Percent, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../lib/utils';
import ReactMarkdown from 'react-markdown';

interface StatsOverviewProps {
  progress: Record<string, SM2Progress>;
  onClose: () => void;
}

export default function StatsOverview({ progress, onClose }: StatsOverviewProps) {
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);

  const subjectStats = useMemo(() => {
    return subjectList.map(subject => {
      const qs = allSubjects[subject] || [];
      let attempted = 0;
      let correctAttempts = 0;
      let totalAttempts = 0;

      const completedQuestions: Array<{id: string, text: string, accuracy: number, attempts: number}> = [];
      const unfinishedQuestions: Array<{id: string, text: string}> = [];

      qs.forEach(q => {
        const p = progress[q.id];
        if (p) {
          attempted++;
          correctAttempts += p.correctCount;
          totalAttempts += p.attempts;
          completedQuestions.push({
            id: q.id,
            text: q.content,
            accuracy: p.attempts > 0 ? Math.round((p.correctCount / p.attempts) * 100) : 0,
            attempts: p.attempts
          });
        } else {
          unfinishedQuestions.push({
            id: q.id,
            text: q.content
          });
        }
      });

      const accuracy = totalAttempts > 0 ? (correctAttempts / totalAttempts * 100).toFixed(1) : '0.0';
      const progressPercent = qs.length > 0 ? (attempted / qs.length * 100).toFixed(1) : '0.0';

      return {
        subject,
        total: qs.length,
        attempted,
        accuracy,
        progressPercent,
        completedQuestions,
        unfinishedQuestions
      };
    });
  }, [progress]);

  const globalStats = useMemo(() => {
    let totalQuestions = 0;
    let globalAttempted = 0;
    let globalCorrect = 0;
    let globalAttempts = 0;

    subjectStats.forEach(s => {
      totalQuestions += s.total;
      globalAttempted += s.attempted;
    });

    Object.values(progress).forEach(p => {
      globalCorrect += p.correctCount;
      globalAttempts += p.attempts;
    });

    const accuracy = globalAttempts > 0 ? (globalCorrect / globalAttempts * 100).toFixed(1) : '0.0';
    const progressPercent = totalQuestions > 0 ? (globalAttempted / totalQuestions * 100).toFixed(1) : '0.0';

    return { totalQuestions, globalAttempted, accuracy, progressPercent };
  }, [subjectStats, progress]);

  const toggleSubject = (subject: string) => {
    setExpandedSubject(prev => prev === subject ? null : subject);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden shadow-xl">
        
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2 text-indigo-600 font-semibold">
            <BarChart className="w-5 h-5" />
            <span>学习进度统计</span>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors px-3 py-1 bg-white border border-slate-200 rounded-lg text-sm font-medium"
          >
            关闭
          </button>
        </div>

        {/* Global Summary */}
        <div className="p-4 sm:p-6 bg-white border-b border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-4 shrink-0">
          <div className="bg-slate-50 p-4 rounded-xl flex flex-col items-center justify-center text-center">
            <span className="text-slate-500 text-xs font-semibold mb-1 uppercase tracking-wider">总题目数</span>
            <span className="text-2xl font-bold text-slate-800">{globalStats.totalQuestions}</span>
          </div>
          <div className="bg-blue-50 p-4 rounded-xl flex flex-col items-center justify-center text-center">
            <span className="text-blue-500 text-xs font-semibold mb-1 uppercase tracking-wider">已做过</span>
            <span className="text-2xl font-bold text-blue-700">{globalStats.globalAttempted}</span>
          </div>
          <div className="bg-green-50 p-4 rounded-xl flex flex-col items-center justify-center text-center">
            <span className="text-green-500 text-xs font-semibold mb-1 uppercase tracking-wider">总覆盖率</span>
            <span className="text-2xl font-bold text-green-700">{globalStats.progressPercent}%</span>
          </div>
          <div className="bg-indigo-50 p-4 rounded-xl flex flex-col items-center justify-center text-center">
            <span className="text-indigo-500 text-xs font-semibold mb-1 uppercase tracking-wider">总体正确率</span>
            <span className="text-2xl font-bold text-indigo-700">{globalStats.accuracy}%</span>
          </div>
        </div>

        {/* List of subjects */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50 space-y-4">
          {subjectStats.map(s => (
            <div key={s.subject} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col gap-3">
              <div 
                className="flex items-center justify-between cursor-pointer group"
                onClick={() => toggleSubject(s.subject)}
              >
                <div className="flex items-center gap-2">
                  {expandedSubject === s.subject ? (
                    <ChevronUp className="w-5 h-5 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                  )}
                  <span className="font-semibold text-slate-800 truncate pr-4 group-hover:text-indigo-600 transition-colors">{s.subject}</span>
                </div>
                <span className="text-xs font-medium px-2 py-1 bg-slate-100 text-slate-600 rounded-md shrink-0">
                  {s.attempted} / {s.total}
                </span>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                  <span className="w-16">进度</span>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 transition-all duration-500"
                      style={{ width: `${s.progressPercent}%` }}
                    />
                  </div>
                  <span className="w-10 text-right">{s.progressPercent}%</span>
                </div>

                <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                  <span className="w-16">正确率</span>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full transition-all duration-500",
                        parseFloat(s.accuracy) >= 80 ? 'bg-green-500' : parseFloat(s.accuracy) >= 60 ? 'bg-amber-500' : 'bg-red-500'
                      )}
                      style={{ width: `${s.accuracy}%` }}
                    />
                  </div>
                  <span className="w-10 text-right">{s.accuracy}%</span>
                </div>
              </div>

              {expandedSubject === s.subject && (
                <div className="mt-4 pt-4 border-t border-slate-100 space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                  
                  {s.completedQuestions.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        已完成题目及正确率
                      </h4>
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                        {s.completedQuestions.map(q => (
                          <div key={q.id} className="text-xs bg-slate-50 p-2 rounded-lg flex items-start gap-3 justify-between">
                            <div className="text-slate-600 line-clamp-2 max-w-[80%] break-words">
                              {q.id}: {(q.text || '').replace(/(#+)([^#\s])/g, '$1 $2').replace(/!\[.*?\]\(.*?\)/g, '[图片]')}
                            </div>
                            <div className="flex flex-col items-end shrink-0 gap-1">
                               <span className={cn(
                                "px-1.5 py-0.5 rounded text-[10px] font-bold",
                                q.accuracy >= 80 ? "bg-green-100 text-green-700" : q.accuracy >= 60 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                              )}>
                                {q.accuracy}%
                              </span>
                              <span className="text-[10px] text-slate-400">已做 {q.attempts} 次</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {s.unfinishedQuestions.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                        <List className="w-4 h-4 text-blue-500" />
                        未完成题目
                      </h4>
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                        {s.unfinishedQuestions.map(q => (
                          <div key={q.id} className="text-xs bg-slate-50 p-2 rounded-lg text-slate-600 flex items-start gap-2">
                            <span className="shrink-0 font-medium text-slate-400">{q.id}</span>
                            <div className="line-clamp-2 break-words">
                              {(q.text || '').replace(/(#+)([^#\s])/g, '$1 $2').replace(/!\[.*?\]\(.*?\)/g, '[图片]')}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
