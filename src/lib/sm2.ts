/**
 * 简化版 SM-2 算法实现 (艾宾浩斯记忆曲线)
 * https://en.wikipedia.org/wiki/SuperMemo#Description_of_SM-2_algorithm
 */

export function calculateNextSM2(
  quality: number, // 0-5 评分 (我们约定: 全对=4, 错=1)
  repetition: number, // 之前连续答对的次数
  easeFactor: number, // 难度系数 EF
  interval: number   // 上次的间隔天数
) {
  // EF(new) = EF(old) + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  let newEaseFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (newEaseFactor < 1.3) newEaseFactor = 1.3;

  let newRepetition = repetition;
  let newInterval = interval;

  // quality >= 3 表示正确回忆
  if (quality >= 3) {
    if (repetition === 0) {
      newInterval = 1;
    } else if (repetition === 1) {
      newInterval = 6;
    } else {
      newInterval = Math.round(interval * newEaseFactor);
    }
    newRepetition++;
  } else {
    // 错误回调，重置连续次数，间隔设为1天
    newRepetition = 0;
    newInterval = 1;
  }

  return {
    interval: newInterval,
    repetition: newRepetition,
    easeFactor: newEaseFactor,
  };
}

export const initSM2Progress = (questionId: string) => ({
  questionId,
  interval: 0,
  repetition: 0,
  easeFactor: 2.5,
  nextReviewDate: Date.now(), // 默认立刻需要复习
  attempts: 0,
  correctCount: 0,
});
