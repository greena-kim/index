import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  nextDue, addMonths, dueLabel, todayTasks, weekStart, weeklyScores,
  makeFamilyCode, normalizeCode, isValidCode,
} from '../logic.js';

test('nextDue: 제때 하면 한 주기 뒤', () => {
  assert.equal(nextDue('2026-09-25', 'daily', '2026-09-25'), '2026-09-26');
  assert.equal(nextDue('2026-09-25', 'every3days', '2026-09-25'), '2026-09-28');
  assert.equal(nextDue('2026-09-25', 'weekly', '2026-09-25'), '2026-10-02');
  assert.equal(nextDue('2026-09-25', 'biweekly', '2026-09-25'), '2026-10-09');
  assert.equal(nextDue('2026-09-25', 'monthly', '2026-09-25'), '2026-10-25');
  assert.equal(nextDue('2026-09-25', 'quarterly', '2026-09-25'), '2026-12-25');
});

test('nextDue: 밀렸다가 하면 오늘 이후로 넘어감', () => {
  // 매주 목요일 일을 3주 밀려서 함 → 다음 목요일
  assert.equal(nextDue('2026-09-03', 'weekly', '2026-09-25'), '2026-10-01');
  assert.equal(nextDue('2026-07-10', 'monthly', '2026-09-25'), '2026-10-10');
});

test('nextDue: 미리 하면 원래 일정 다음 주기', () => {
  assert.equal(nextDue('2026-09-30', 'weekly', '2026-09-25'), '2026-10-07');
});

test('nextDue: 한 번 하는 일은 그대로', () => {
  assert.equal(nextDue('2026-09-25', 'none', '2026-09-25'), '2026-09-25');
});

test('월말 보정이 누적되지 않음', () => {
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2028-01-31', 1), '2028-02-29');
  // 1/31 매월 → 2/28 을 거쳐도 3월엔 다시 31일
  assert.equal(nextDue('2026-01-31', 'monthly', '2026-03-01'), '2026-03-31');
  assert.equal(addMonths('2026-11-30', 3), '2027-02-28');
});

test('dueLabel', () => {
  assert.equal(dueLabel('2026-09-25', '2026-09-25'), '오늘');
  assert.equal(dueLabel('2026-09-26', '2026-09-25'), '내일');
  assert.equal(dueLabel('2026-09-24', '2026-09-25'), '어제');
  assert.equal(dueLabel('2026-09-22', '2026-09-25'), '3일 지남');
  assert.equal(dueLabel('2026-09-28', '2026-09-25'), '3일 후');
  assert.equal(dueLabel('2026-10-09', '2026-09-25'), '10/9');
});

test('todayTasks: 밀린 것부터, 완료·미래 제외', () => {
  const tasks = [
    { title: '나', due: '2026-09-25' },
    { title: '가', due: '2026-09-20' },
    { title: '다', due: '2026-09-26' },
    { title: '라', due: '2026-09-01', done: true },
  ];
  assert.deepEqual(todayTasks(tasks, '2026-09-25').map((t) => t.title), ['가', '나']);
});

test('weekStart: 월요일 시작', () => {
  assert.equal(weekStart('2026-09-25'), '2026-09-21'); // 금 → 월
  assert.equal(weekStart('2026-09-21'), '2026-09-21'); // 월
  assert.equal(weekStart('2026-09-27'), '2026-09-21'); // 일
});

test('weeklyScores: 이번 주만 세고 기록 없는 가족도 0으로 표시', () => {
  const logs = [
    { by: '엄마', date: '2026-09-25' },
    { by: '엄마', date: '2026-09-21' },
    { by: '아빠', date: '2026-09-22' },
    { by: '아빠', date: '2026-09-20' }, // 지난주
    { by: '할머니', date: '2026-09-23' }, // 구성원에서 빠졌어도 기록은 표시
  ];
  assert.deepEqual(weeklyScores(logs, ['엄마', '아빠', '아이'], '2026-09-25'), [
    { name: '엄마', count: 2 },
    { name: '아빠', count: 1 },
    { name: '할머니', count: 1 },
    { name: '아이', count: 0 },
  ]);
});

test('초대코드 생성·정규화·검증', () => {
  for (let i = 0; i < 200; i++) assert.ok(isValidCode(makeFamilyCode()));
  assert.equal(normalizeCode(' abcd-2345 '), 'ABCD2345');
  assert.ok(isValidCode('ABCD2345'));
  assert.ok(!isValidCode('ABCD1234')); // 1 은 헷갈려서 안 씀
  assert.ok(!isValidCode('ABC2345'));
});
