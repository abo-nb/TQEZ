import { Question } from '../types';

// 使用 Vite 的 import.meta.glob 动态导入所有的 .json 文件
const modules = import.meta.glob('./**/*.json', { eager: true }) as Record<string, { default: Question[] }>;

export const allSubjects: Record<string, Question[]> = {};

for (const path in modules) {
  // 提取文件所在的文件夹名或文件名作为科目名 (移除 .json 和 前缀)
  let subject = path.replace(/^\.\//, '').replace(/\.json$/, '');
  // 如果是某文件夹下的 Question.json，则科目名为文件夹名
  if (subject.endsWith('/Question')) {
    subject = subject.replace(/\/Question$/, '');
  }
  
  const content = modules[path].default;
  if (Array.isArray(content)) {
    allSubjects[subject] = content;
  }
}

// 导出所有科目的名称列表
export const subjectList = Object.keys(allSubjects);
