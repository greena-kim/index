import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPresetTasks, excludeExisting, areasForHome, normalizeHome, numbered, DEFAULT_HOME,
} from '../presets.js';
import { DEFAULT_AREAS, REPEATS, daysBetween } from '../logic.js';

const TODAY = '2026-09-25';
const home = (overrides = {}) => normalizeHome({ ...DEFAULT_HOME, ...overrides });
const areasOf = (tasks) => [...new Set(tasks.map((t) => t.area))];

test('numbered: 1개면 번호 없이, 여러 개면 번호', () => {
  assert.deepEqual(numbered('욕실', 0), []);
  assert.deepEqual(numbered('욕실', 1), ['욕실']);
  assert.deepEqual(numbered('욕실', 2), ['욕실 1', '욕실 2']);
});

test('욕실 2개면 욕실마다 같은 할 일이 따로 생김', () => {
  const tasks = buildPresetTasks(home({ bathrooms: 2 }), TODAY);
  const toilets = tasks.filter((t) => t.title === '변기 청소').map((t) => t.area);
  assert.deepEqual(toilets, ['욕실 1', '욕실 2']);
});

test('베란다 0개면 베란다 할 일 없음', () => {
  const tasks = buildPresetTasks(home({ balconies: 0 }), TODAY);
  assert.ok(!tasks.some((t) => t.area.startsWith('베란다')));
});

test('방 용도별 개수만큼 장소가 생기고, 없는 용도는 빠짐', () => {
  const h = home({ rooms: { master: 1, bedroom: 0, kids: 2, study: 1, dress: 0, guest: 0 } });
  const areas = areasOf(buildPresetTasks(h, TODAY));
  assert.ok(areas.includes('안방'));
  assert.ok(areas.includes('아이방 1') && areas.includes('아이방 2'));
  assert.ok(areas.includes('서재·작업방'));
  assert.ok(!areas.some((a) => a.startsWith('침실') || a === '드레스룸' || a === '손님방'));
});

test('반려동물·식물·다용도실은 선택했을 때만', () => {
  const off = areasOf(buildPresetTasks(home(), TODAY));
  assert.ok(!off.includes('반려동물') && !off.includes('식물') && !off.includes('다용도실'));
  const on = areasOf(buildPresetTasks(home({ pets: true, plants: true, utility: true }), TODAY));
  assert.ok(on.includes('반려동물') && on.includes('식물') && on.includes('다용도실'));
});

test('거실·주방·현관·집 전체는 항상 포함, 정리 항목도 포함', () => {
  const tasks = buildPresetTasks(home({ balconies: 0, bathrooms: 1, rooms: {} }), TODAY);
  const areas = areasOf(tasks);
  for (const a of ['거실', '주방', '현관', '집 전체']) assert.ok(areas.includes(a), a);
  assert.ok(tasks.some((t) => t.title === '냉장고 정리 (유통기한 확인)'));
  assert.ok(tasks.some((t) => t.title === '계절옷 정리'));
});

test('모든 할 일은 올바른 반복과 날짜를 가짐', () => {
  const tasks = buildPresetTasks(home({ pets: true, plants: true, utility: true, bathrooms: 3 }), TODAY);
  for (const t of tasks) {
    assert.ok(REPEATS[t.repeat] && t.repeat !== 'none', t.title);
    assert.match(t.due, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(t.due >= TODAY);
  }
});

test('첫 예정일이 주기 안에서 분산되어 첫날에 몰리지 않음', () => {
  const tasks = buildPresetTasks(home({ bathrooms: 2 }), TODAY);
  const period = { daily: 1, every3days: 3, weekly: 7, biweekly: 14, monthly: 28, quarterly: 84 };
  for (const t of tasks) assert.ok(daysBetween(TODAY, t.due) < period[t.repeat], t.title);
  const weekly = tasks.filter((t) => t.repeat === 'weekly');
  assert.equal(new Set(weekly.map((t) => t.due)).size, 7);
  const dueToday = tasks.filter((t) => t.due === TODAY);
  assert.ok(dueToday.length < tasks.length / 3, `오늘 몰린 할 일 ${dueToday.length}/${tasks.length}`);
});

test('excludeExisting: 같은 장소·같은 이름은 다시 추가하지 않음', () => {
  const first = buildPresetTasks(home({ bathrooms: 1 }), TODAY);
  const existing = first.map((t, i) => ({ ...t, id: String(i) }));
  const again = buildPresetTasks(home({ bathrooms: 2 }), TODAY);
  const added = excludeExisting(again, existing);
  // 욕실이 1개→2개로 바뀌면 '욕실'이 '욕실 1','욕실 2'로 새로 생김
  assert.ok(added.length > 0);
  assert.ok(added.every((t) => t.area.startsWith('욕실')));
  assert.deepEqual(excludeExisting(first, existing), []);
});

test('normalizeHome: 이상한 값은 범위 안으로', () => {
  const h = normalizeHome({ bathrooms: 99, balconies: -1, rooms: { master: 3, kids: 'x' } });
  assert.equal(h.bathrooms, 4);
  assert.equal(h.balconies, 0);
  assert.equal(h.rooms.master, 1);
  assert.equal(h.rooms.kids, 0);
});

test('areasForHome: 집 정보 없으면 기본 장소, 있으면 집 구조대로 + 기타', () => {
  assert.deepEqual(areasForHome(null), DEFAULT_AREAS);
  const areas = areasForHome(home({ bathrooms: 2 }));
  assert.equal(areas[0], '거실');
  assert.equal(areas.at(-1), '기타');
  assert.ok(areas.includes('욕실 2'));
});
