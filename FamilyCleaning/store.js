// 데이터 저장소. Firebase 설정이 있으면 Firestore(가족 간 실시간 동기화),
// 없으면 이 기기 localStorage 에만 저장하는 체험 모드로 동작한다.
// 두 구현은 같은 인터페이스를 가진다.

import { firebaseConfig } from './firebase-config.js';
import { makeFamilyCode, nextDue, toDateStr } from './logic.js';

const FIREBASE_VERSION = '10.12.2';
const LOG_LIMIT = 200;

export function isFirebaseConfigured() {
  return Boolean(firebaseConfig && firebaseConfig.apiKey && firebaseConfig.projectId);
}

/**
 * @param {{ onWriteError?: (err: Error) => void }} options
 *   서버 응답을 기다리지 않는 쓰기(완료 체크)가 나중에 실패했을 때 호출
 */
export async function createStore({ onWriteError = console.error } = {}) {
  return isFirebaseConfigured() ? createFirebaseStore(onWriteError) : createLocalStore();
}

/** 완료 처리 시 할 일에 적용할 변경사항 */
function completionPatch(task, by, today) {
  const base = { lastDoneBy: by, lastDoneAt: Date.now() };
  if (task.repeat && task.repeat !== 'none') {
    return { ...base, due: nextDue(task.due, task.repeat, today) };
  }
  return { ...base, done: true };
}

function newLog(task, by, today) {
  return { taskId: task.id, title: task.title, area: task.area, by, date: today, at: Date.now() };
}

// ───────────────────────── 체험 모드 (localStorage) ─────────────────────────

function createLocalStore() {
  const KEY = 'family-cleaning:local-db';
  const listeners = new Set();

  const load = () => {
    try { return JSON.parse(localStorage.getItem(KEY)) || { families: {} }; }
    catch { return { families: {} }; }
  };
  const save = (db) => {
    localStorage.setItem(KEY, JSON.stringify(db));
    listeners.forEach((fn) => fn());
  };
  const family = (db, code) => {
    const f = db.families[code];
    if (!f) throw new Error('가족을 찾을 수 없어요. 초대코드를 확인해 주세요.');
    return f;
  };
  // 다른 탭에서 바뀐 것도 반영
  window.addEventListener('storage', (e) => { if (e.key === KEY) listeners.forEach((fn) => fn()); });

  return {
    mode: 'local',

    async createFamily(name, member) {
      const db = load();
      let code;
      do { code = makeFamilyCode(); } while (db.families[code]);
      db.families[code] = { name, members: [member], tasks: {}, logs: [], createdAt: Date.now() };
      save(db);
      return code;
    },

    async joinFamily(code, member) {
      const db = load();
      const f = family(db, code);
      if (!f.members.includes(member)) f.members.push(member);
      save(db);
    },

    async addMember(code, member) {
      return this.joinFamily(code, member);
    },

    async removeMember(code, member) {
      const db = load();
      const f = family(db, code);
      f.members = f.members.filter((m) => m !== member);
      save(db);
    },

    subscribe(code, { onFamily, onTasks, onLogs, onError }) {
      const emit = () => {
        const f = load().families[code];
        if (!f) { onError?.(new Error('가족 정보가 없어요.')); return; }
        onFamily({ name: f.name, members: f.members, home: f.home || null });
        onTasks(Object.entries(f.tasks).map(([id, t]) => ({ ...t, id })));
        onLogs([...f.logs].sort((a, b) => b.at - a.at).slice(0, LOG_LIMIT));
      };
      listeners.add(emit);
      queueMicrotask(emit);
      return () => listeners.delete(emit);
    },

    async addTask(code, task) {
      const db = load();
      const id = crypto.randomUUID();
      family(db, code).tasks[id] = { ...task, done: false, createdAt: Date.now() };
      save(db);
    },

    async setHome(code, home) {
      const db = load();
      family(db, code).home = home;
      save(db);
    },

    async addTasks(code, tasks) {
      const db = load();
      const f = family(db, code);
      for (const task of tasks) f.tasks[crypto.randomUUID()] = { ...task, done: false, createdAt: Date.now() };
      save(db);
    },

    async updateTask(code, id, patch) {
      const db = load();
      const f = family(db, code);
      f.tasks[id] = { ...f.tasks[id], ...patch };
      save(db);
    },

    async deleteTask(code, id) {
      const db = load();
      delete family(db, code).tasks[id];
      save(db);
    },

    async completeTask(code, task, by) {
      const today = toDateStr();
      const db = load();
      const f = family(db, code);
      f.tasks[task.id] = { ...f.tasks[task.id], ...completionPatch(task, by, today) };
      const logId = crypto.randomUUID();
      f.logs.push({ ...newLog(task, by, today), id: logId });
      if (f.logs.length > LOG_LIMIT * 2) f.logs = f.logs.slice(-LOG_LIMIT);
      save(db);
      return logId;
    },

    async deleteLog(code, logId) {
      const db = load();
      const f = family(db, code);
      f.logs = f.logs.filter((l) => l.id !== logId);
      save(db);
    },
  };
}

// ───────────────────────── Firebase (Firestore) ─────────────────────────

async function createFirebaseStore(onWriteError) {
  const cdn = (m) => `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-${m}.js`;
  const [{ initializeApp }, auth, fs] = await Promise.all([
    import(cdn('app')), import(cdn('auth')), import(cdn('firestore')),
  ]);

  const app = initializeApp(firebaseConfig);
  const db = fs.initializeFirestore(app, {
    // 지하철 등 오프라인일 때도 체크하고, 연결되면 자동 동기화
    localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }),
  });

  // 가족 초대코드가 곧 공유 비밀번호 역할. 기기마다 익명 로그인만 해 둔다.
  const firebaseAuth = auth.getAuth(app);
  await auth.signInAnonymously(firebaseAuth);

  const familyRef = (code) => fs.doc(db, 'families', code);
  const tasksCol = (code) => fs.collection(db, 'families', code, 'tasks');
  const logsCol = (code) => fs.collection(db, 'families', code, 'logs');

  return {
    mode: 'firebase',

    async createFamily(name, member) {
      for (let i = 0; i < 5; i++) {
        const code = makeFamilyCode();
        const ref = familyRef(code);
        const created = await fs.runTransaction(db, async (tx) => {
          if ((await tx.get(ref)).exists()) return false;
          tx.set(ref, { name, members: [member], createdAt: fs.serverTimestamp() });
          return true;
        });
        if (created) return code;
      }
      throw new Error('가족을 만들지 못했어요. 다시 시도해 주세요.');
    },

    async joinFamily(code, member) {
      const snap = await fs.getDoc(familyRef(code));
      if (!snap.exists()) throw new Error('가족을 찾을 수 없어요. 초대코드를 확인해 주세요.');
      await fs.updateDoc(familyRef(code), { members: fs.arrayUnion(member) });
    },

    async addMember(code, member) {
      await fs.updateDoc(familyRef(code), { members: fs.arrayUnion(member) });
    },

    async removeMember(code, member) {
      await fs.updateDoc(familyRef(code), { members: fs.arrayRemove(member) });
    },

    subscribe(code, { onFamily, onTasks, onLogs, onError }) {
      const unsubs = [
        fs.onSnapshot(familyRef(code), (snap) => {
          if (!snap.exists()) { onError?.(new Error('가족 정보가 없어요.')); return; }
          const { name, members = [], home = null } = snap.data();
          onFamily({ name, members, home });
        }, onError),
        fs.onSnapshot(tasksCol(code), (snap) => {
          onTasks(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
        }, onError),
        fs.onSnapshot(fs.query(logsCol(code), fs.orderBy('at', 'desc'), fs.limit(LOG_LIMIT)), (snap) => {
          onLogs(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
        }, onError),
      ];
      return () => unsubs.forEach((u) => u());
    },

    async addTask(code, task) {
      await fs.addDoc(tasksCol(code), { ...task, done: false, createdAt: Date.now() });
    },

    async setHome(code, home) {
      await fs.updateDoc(familyRef(code), { home });
    },

    async addTasks(code, tasks) {
      const batch = fs.writeBatch(db);
      for (const task of tasks) batch.set(fs.doc(tasksCol(code)), { ...task, done: false, createdAt: Date.now() });
      await batch.commit();
    },

    async updateTask(code, id, patch) {
      await fs.updateDoc(fs.doc(tasksCol(code), id), patch);
    },

    async deleteTask(code, id) {
      await fs.deleteDoc(fs.doc(tasksCol(code), id));
    },

    async completeTask(code, task, by) {
      const today = toDateStr();
      const batch = fs.writeBatch(db);
      batch.update(fs.doc(tasksCol(code), task.id), completionPatch(task, by, today));
      const logRef = fs.doc(logsCol(code));
      batch.set(logRef, newLog(task, by, today));
      // 화면은 로컬 캐시로 즉시 바뀌므로 서버 응답(오프라인이면 한참 뒤)을 기다리지 않음
      batch.commit().catch(onWriteError);
      return logRef.id;
    },

    async deleteLog(code, logId) {
      await fs.deleteDoc(fs.doc(logsCol(code), logId));
    },
  };
}
