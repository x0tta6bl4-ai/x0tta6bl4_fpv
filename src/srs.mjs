// Общее расписание повтора колоды «Срез» (гл. 20, src/labs/quiz.mjs): ключ localStorage и формат записи.
// Ошибку в другом тренажёре (пробный срез, «Что сделаешь первым?») ставим в повтор сегодня — шаг лестницы с нуля.
export const SREZ_SCHED_KEY = "fpv_srez_sched";

export function markDue(nums) {
  try {
    const sc = JSON.parse(localStorage.getItem(SREZ_SCHED_KEY) || "{}");
    const now = Date.now();
    for (const n of nums) sc[`srez:${n}`] = { step: 0, interval: 0, due: now, last: now };
    localStorage.setItem(SREZ_SCHED_KEY, JSON.stringify(sc));
  } catch (e) {}
}
