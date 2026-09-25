// 순수 로직 모음 — DOM/Firebase 의존성 없음 (node --test 로 테스트 가능)

/** 집 정보를 입력하지 않았을 때 쓰는 기본 장소 */
export const DEFAULT_AREAS = ['거실', '주방', '욕실', '침실', '현관', '베란다', '기타'];

export const REPEATS = {
  none: '한 번',
  daily: '매일',
  every3days: '3일마다',
  weekly: '매주',
  biweekly: '2주마다',
  monthly: '매월',
  quarterly: '3개월마다',
};

/** 월 단위 반복 주기 (말일 보정이 필요한 것) */
const MONTH_STEPS = { monthly: 1, quarterly: 3 };

const pad = (n) => String(n).padStart(2, '0');

/** Date → 'YYYY-MM-DD' (기기 로컬 시간 기준) */
export function toDateStr(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 'YYYY-MM-DD' → 로컬 자정 Date */
export function parseDateStr(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(dateStr, days) {
  const d = parseDateStr(dateStr);
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

/** 월 단위 더하기. 1/31 + 1개월 → 2/28(29) 처럼 말일로 맞춤 */
export function addMonths(dateStr, months) {
  const d = parseDateStr(dateStr);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return toDateStr(d);
}

function advance(dateStr, repeat) {
  switch (repeat) {
    case 'daily': return addDays(dateStr, 1);
    case 'every3days': return addDays(dateStr, 3);
    case 'weekly': return addDays(dateStr, 7);
    case 'biweekly': return addDays(dateStr, 14);
    default: return dateStr;
  }
}

/**
 * 반복 할 일을 완료했을 때 다음 예정일.
 * 밀린 일을 늦게 해도 다음 예정일은 항상 '오늘 이후'가 되도록 주기만큼 계속 넘긴다.
 * (월 단위 반복은 원래 날짜 기준으로 계산해 말일 보정이 누적되지 않게 함)
 */
export function nextDue(due, repeat, today = toDateStr()) {
  if (!REPEATS[repeat] || repeat === 'none') return due;
  const step = MONTH_STEPS[repeat];
  if (step) {
    let n = 1;
    let next = addMonths(due, step);
    while (next <= today) next = addMonths(due, step * ++n);
    return next;
  }
  let next = advance(due, repeat);
  while (next <= today) next = advance(next, repeat);
  return next;
}

export function daysBetween(fromStr, toStr) {
  return Math.round((parseDateStr(toStr) - parseDateStr(fromStr)) / 86400000);
}

/** 예정일을 사람이 읽기 좋은 말로 */
export function dueLabel(due, today = toDateStr()) {
  const diff = daysBetween(today, due);
  if (diff === 0) return '오늘';
  if (diff === 1) return '내일';
  if (diff === -1) return '어제';
  if (diff < 0) return `${-diff}일 지남`;
  if (diff < 7) return `${diff}일 후`;
  const d = parseDateStr(due);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** 오늘 해야 할 일: 완료 안 됐고 예정일이 오늘이거나 지난 것. 오래 밀린 순 */
export function todayTasks(tasks, today = toDateStr()) {
  return tasks
    .filter((t) => !t.done && t.due <= today)
    .sort((a, b) => a.due.localeCompare(b.due) || a.title.localeCompare(b.title, 'ko'));
}

/** 앞으로 할 일 (내일~) */
export function upcomingTasks(tasks, today = toDateStr()) {
  return tasks
    .filter((t) => !t.done && t.due > today)
    .sort((a, b) => a.due.localeCompare(b.due) || a.title.localeCompare(b.title, 'ko'));
}

/** 이번 주(월요일 시작) 첫날 */
export function weekStart(today = toDateStr()) {
  const d = parseDateStr(today);
  const dow = (d.getDay() + 6) % 7; // 월=0 … 일=6
  return addDays(today, -dow);
}

/** 이번 주 멤버별 완료 횟수. members 순서를 유지하고 기록에만 있는 이름도 포함 */
export function weeklyScores(logs, members, today = toDateStr()) {
  const start = weekStart(today);
  const scores = new Map(members.map((m) => [m, 0]));
  for (const log of logs) {
    if (log.date >= start && log.date <= today) {
      scores.set(log.by, (scores.get(log.by) || 0) + 1);
    }
  }
  return [...scores.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

// 헷갈리는 글자(0/O, 1/I/L) 뺀 알파벳 — 전화로 불러주기 쉽게
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** 가족 초대코드 (기본 8자리 ≈ 8.5×10^11 가지) */
export function makeFamilyCode(length = 8, rand = Math.random) {
  let code = '';
  for (let i = 0; i < length; i++) code += CODE_CHARS[Math.floor(rand() * CODE_CHARS.length)];
  return code;
}

export function normalizeCode(input) {
  return String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isValidCode(code) {
  return code.length === 8 && [...code].every((c) => CODE_CHARS.includes(c));
}
