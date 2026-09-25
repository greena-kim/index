// 집 구조(욕실·베란다·방 용도별 개수 등)에 맞춘 청소·정리 프리셋.
// 순수 함수만 있음 — node --test 로 테스트 가능

import { DEFAULT_AREAS, addDays, toDateStr } from './logic.js';

/** 방 용도. max 가 있으면 그 개수까지만 */
export const ROOM_TYPES = [
  { key: 'master', label: '안방', max: 1 },
  { key: 'bedroom', label: '침실' },
  { key: 'kids', label: '아이방' },
  { key: 'study', label: '서재·작업방' },
  { key: 'dress', label: '드레스룸' },
  { key: 'guest', label: '손님방' },
];

export const HOME_OPTIONS = [
  { key: 'utility', label: '다용도실·세탁실' },
  { key: 'pets', label: '반려동물' },
  { key: 'plants', label: '화분·식물' },
];

export const DEFAULT_HOME = {
  bathrooms: 1,
  balconies: 1,
  rooms: { master: 1, bedroom: 1, kids: 0, study: 0, dress: 0, guest: 0 },
  utility: false,
  pets: false,
  plants: false,
};

export const COUNT_LIMITS = { bathrooms: [1, 4], balconies: [0, 3], room: [0, 4] };

// [할 일, 반복]
const T = {
  living: [
    ['청소기 돌리기', 'every3days'],
    ['바닥 물걸레질', 'weekly'],
    ['TV·선반 먼지 털기', 'weekly'],
    ['소파·테이블 주변 정리', 'weekly'],
    ['창틀 닦기', 'monthly'],
    ['커튼·러그 세탁', 'quarterly'],
  ],
  kitchen: [
    ['설거지·식기 정리', 'daily'],
    ['음식물 쓰레기 버리기', 'every3days'],
    ['싱크대·배수구 청소', 'weekly'],
    ['가스레인지·인덕션 닦기', 'weekly'],
    ['냉장고 정리 (유통기한 확인)', 'biweekly'],
    ['전자레인지·에어프라이어 닦기', 'monthly'],
    ['냉장고 속 닦기', 'monthly'],
    ['후드 필터 세척', 'quarterly'],
    ['주방 수납장 정리', 'quarterly'],
  ],
  entrance: [
    ['신발 정리', 'weekly'],
    ['현관 바닥 쓸고 닦기', 'weekly'],
    ['신발장 정리', 'quarterly'],
  ],
  whole: [
    ['분리수거', 'weekly'],
    ['일반 쓰레기 버리기', 'every3days'],
    ['빨래 돌리기', 'every3days'],
    ['빨래 개서 정리', 'every3days'],
    ['계절옷 정리', 'quarterly'],
  ],
  bathroom: [
    ['수건 교체', 'every3days'],
    ['세면대·거울 닦기', 'weekly'],
    ['변기 청소', 'weekly'],
    ['바닥·배수구 청소', 'weekly'],
    ['샤워부스·욕조 청소', 'biweekly'],
    ['곰팡이·물때 제거', 'monthly'],
    ['욕실 수납장 정리', 'quarterly'],
  ],
  master: [
    ['청소기 돌리기', 'weekly'],
    ['먼지 털기', 'weekly'],
    ['침구 교체', 'biweekly'],
    ['화장대·협탁 정리', 'monthly'],
    ['옷장·서랍 정리', 'quarterly'],
  ],
  bedroom: [
    ['청소기 돌리기', 'weekly'],
    ['먼지 털기', 'weekly'],
    ['침구 교체', 'biweekly'],
    ['책상·서랍 정리', 'monthly'],
    ['옷장 정리', 'quarterly'],
  ],
  kids: [
    ['장난감 정리', 'daily'],
    ['청소기 돌리기', 'weekly'],
    ['침구 교체', 'biweekly'],
    ['장난감 닦기·소독', 'monthly'],
    ['작아진 옷·안 쓰는 장난감 정리', 'quarterly'],
  ],
  study: [
    ['책상 정리', 'weekly'],
    ['청소기 돌리기', 'weekly'],
    ['먼지 털기 (모니터·책장)', 'weekly'],
    ['서류·책 정리', 'monthly'],
  ],
  dress: [
    ['청소기 돌리기', 'weekly'],
    ['옷 정리', 'monthly'],
    ['안 입는 옷 비우기', 'quarterly'],
  ],
  guest: [
    ['환기·먼지 털기', 'biweekly'],
    ['청소기 돌리기', 'biweekly'],
    ['침구 정리', 'monthly'],
  ],
  balcony: [
    ['바닥 쓸기', 'biweekly'],
    ['창문·방충망 닦기', 'monthly'],
    ['배수구 청소', 'monthly'],
    ['베란다 짐 정리', 'quarterly'],
  ],
  utility: [
    ['세탁기 먼지필터 청소', 'biweekly'],
    ['세탁기 통세척', 'monthly'],
    ['다용도실 정리', 'quarterly'],
  ],
  pets: [
    ['배변 정리', 'daily'],
    ['밥그릇·물그릇 씻기', 'daily'],
    ['반려동물 털 청소', 'every3days'],
    ['방석·장난감 세탁', 'monthly'],
  ],
  plants: [
    ['화분 물 주기', 'weekly'],
    ['시든 잎 정리·잎 닦기', 'monthly'],
  ],
};

/** '욕실' 1개면 ['욕실'], 2개면 ['욕실 1', '욕실 2'] */
export function numbered(label, count) {
  if (count <= 0) return [];
  if (count === 1) return [label];
  return Array.from({ length: count }, (_, i) => `${label} ${i + 1}`);
}

const clamp = (n, [min, max]) => Math.max(min, Math.min(max, Number(n) || 0));

/** 저장된 값이 일부 비어 있거나 이상해도 안전한 프로필로 */
export function normalizeHome(home = {}) {
  const rooms = {};
  for (const { key, max } of ROOM_TYPES) {
    rooms[key] = clamp(home.rooms?.[key] ?? DEFAULT_HOME.rooms[key], [0, max ?? COUNT_LIMITS.room[1]]);
  }
  return {
    bathrooms: clamp(home.bathrooms ?? DEFAULT_HOME.bathrooms, COUNT_LIMITS.bathrooms),
    balconies: clamp(home.balconies ?? DEFAULT_HOME.balconies, COUNT_LIMITS.balconies),
    rooms,
    utility: Boolean(home.utility),
    pets: Boolean(home.pets),
    plants: Boolean(home.plants),
  };
}

/** 집 정보 → [{ area, templateKey }] (화면에 보여줄 순서) */
function homeAreas(home) {
  const h = normalizeHome(home);
  const list = [
    { area: '거실', key: 'living' },
    { area: '주방', key: 'kitchen' },
  ];
  for (const { key, label } of ROOM_TYPES) {
    for (const area of numbered(label, h.rooms[key])) list.push({ area, key });
  }
  for (const area of numbered('욕실', h.bathrooms)) list.push({ area, key: 'bathroom' });
  for (const area of numbered('베란다', h.balconies)) list.push({ area, key: 'balcony' });
  list.push({ area: '현관', key: 'entrance' });
  if (h.utility) list.push({ area: '다용도실', key: 'utility' });
  if (h.pets) list.push({ area: '반려동물', key: 'pets' });
  if (h.plants) list.push({ area: '식물', key: 'plants' });
  list.push({ area: '집 전체', key: 'whole' });
  return list;
}

/** 할 일 추가 화면에서 고를 장소 목록. 집 정보가 없으면 기본 장소 */
export function areasForHome(home) {
  if (!home) return DEFAULT_AREAS;
  return [...homeAreas(home).map((a) => a.area), '기타'];
}

// 첫 예정일 분산: 같은 주기의 일들을 주기 안에서 며칠씩 떨어뜨림
const SPREAD = {
  daily: { period: 1, stride: 1 },
  every3days: { period: 3, stride: 1 },
  weekly: { period: 7, stride: 1 },
  biweekly: { period: 14, stride: 3 },
  monthly: { period: 28, stride: 5 },
  quarterly: { period: 84, stride: 11 },
};

/** 집 정보로 할 일 목록 만들기 */
export function buildPresetTasks(home, today = toDateStr()) {
  const counters = {};
  const tasks = [];
  for (const { area, key } of homeAreas(home)) {
    for (const [title, repeat] of T[key]) {
      const { period, stride } = SPREAD[repeat];
      const n = counters[repeat] = (counters[repeat] ?? -1) + 1;
      tasks.push({ title, area, repeat, due: addDays(today, (n * stride) % period) });
    }
  }
  return tasks;
}

const taskKey = (t) => `${t.area}|${t.title}`;

/** 이미 같은 장소·같은 이름의 할 일이 있으면 빼기 (프리셋을 다시 적용할 때) */
export function excludeExisting(presetTasks, existingTasks) {
  const existing = new Set(existingTasks.map(taskKey));
  return presetTasks.filter((t) => !existing.has(taskKey(t)));
}
