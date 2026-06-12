export interface Option {
  id: string;
  content: string; // 选项内容
  isCorrect: boolean; // 是否正确
}

export type QuestionType = 'single' | 'multiple';

export interface Question {
  id: string;
  chapter: string; // 章节
  questionNumber: string; // 题号
  type: QuestionType; // 单选或多选
  content: string; // 主问题 (Markdown)
  imageUrl?: string; // 附图 (Optional)
  options: Option[]; // 答案选项
}

// SM-2 Algorithm Progress
export interface SM2Progress {
  questionId: string;
  interval: number; // 距离下次复习的间隔(天数) (I)
  repetition: number; // 成功复习的连续次数 (N)
  easeFactor: number; // 难度系数 (EF), 默认 2.5
  nextReviewDate: number; // 下次推荐复习的时间戳
  attempts: number;
  correctCount: number;
}
