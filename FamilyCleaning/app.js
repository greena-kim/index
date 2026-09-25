import { createStore } from './store.js';
import {
  REPEATS, toDateStr, nextDue, parseDateStr, dueLabel, todayTasks, upcomingTasks,
  weeklyScores, normalizeCode, isValidCode,
} from './logic.js';
import {
  ROOM_TYPES, HOME_OPTIONS, DEFAULT_HOME, COUNT_LIMITS,
  normalizeHome, areasForHome, buildPresetTasks, excludeExisting,
} from './presets.js';

const SESSION_KEY = 'family-cleaning:session';
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const state = {
  store: null,
  code: null,
  me: null,
  family: { name: '', members: [], home: null },
  tasks: [],
  logs: [],
  tab: 'today',
  mineOnly: false,
  unsubscribe: null,
  editingId: null,
};

// ───────────────────────── 공통 ─────────────────────────

function loadSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; }
}
function saveSession() {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ code: state.code, me: state.me }));
}

let toastTimer;
function toast(text, action) {
  const el = $('#toast');
  const btn = $('#toast-action');
  $('#toast-text').textContent = text;
  btn.hidden = !action;
  btn.onclick = null;
  if (action) {
    btn.textContent = action.label;
    btn.onclick = () => { el.hidden = true; action.run(); };
  }
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, action ? 5000 : 2500);
}

function showError(err) {
  console.error(err);
  toast(err?.message?.startsWith('가족') ? err.message : '저장하지 못했어요. 인터넷 연결을 확인해 주세요.');
}

/** 저장 요청. Firestore 는 오프라인이면 응답이 늦으므로 화면은 기다리지 않는다 */
const run = (promise) => Promise.resolve(promise).catch(showError);

const formatCode = (code) => `${code.slice(0, 4)}-${code.slice(4)}`;

function todayLabel() {
  const d = new Date();
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${days[d.getDay()]}요일`;
}

function areas() {
  const list = areasForHome(state.family.home);
  // 예전에 쓰던 장소 이름도 목록에 남겨 둠
  const extra = [...new Set(state.tasks.map((t) => t.area).filter((a) => a && !list.includes(a)))];
  return [...list.slice(0, -1), ...extra, list[list.length - 1]];
}

function closeOnBackdrop(dialog) {
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  $$('[data-close]', dialog).forEach((b) => b.addEventListener('click', () => dialog.close()));
}

// ───────────────────────── 처음 화면 ─────────────────────────

function showSetup() {
  $('#main').hidden = true;
  $('#setup').hidden = false;
  $('[data-mode-note]').textContent = state.store.mode === 'local'
    ? '지금은 체험 모드예요. 이 기기에만 저장되고 가족과 공유되지 않아요.'
    : '';
}

function initSetup() {
  $$('[data-setup-tab]').forEach((btn) => btn.addEventListener('click', () => {
    const tab = btn.dataset.setupTab;
    $$('[data-setup-tab]').forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
    $('#create-form').hidden = tab !== 'create';
    $('#join-form').hidden = tab !== 'join';
  }));

  $('#create-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const name = form.family.value.trim();
    const me = form.me.value.trim();
    if (!name || !me) return;
    form.querySelector('button').disabled = true;
    try {
      state.code = await state.store.createFamily(name, me);
      state.me = me;
      saveSession();
      enterFamily();
      openHomeDialog();
    } catch (err) {
      showError(err);
    } finally {
      form.querySelector('button').disabled = false;
    }
  });

  const codeInput = $('#join-form [name=code]');
  codeInput.addEventListener('input', () => {
    const code = normalizeCode(codeInput.value).slice(0, 8);
    codeInput.value = code.length > 4 ? formatCode(code) : code;
  });

  $('#join-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const code = normalizeCode(form.code.value);
    const me = form.me.value.trim();
    if (!isValidCode(code)) { toast('초대코드 8자리를 확인해 주세요.'); return; }
    if (!me) return;
    form.querySelector('button').disabled = true;
    try {
      await state.store.joinFamily(code, me);
      state.code = code;
      state.me = me;
      saveSession();
      enterFamily();
    } catch (err) {
      showError(err);
    } finally {
      form.querySelector('button').disabled = false;
    }
  });
}

// ───────────────────────── 메인 화면 ─────────────────────────

function enterFamily() {
  $('#setup').hidden = true;
  $('#main').hidden = false;
  $('#demo-banner').hidden = state.store.mode !== 'local';
  $('#today-label').textContent = todayLabel();
  $('#me-name').textContent = state.me;

  state.unsubscribe?.();
  state.unsubscribe = state.store.subscribe(state.code, {
    onFamily: (family) => { state.family = family; render(); },
    onTasks: (tasks) => { state.tasks = tasks; render(); },
    onLogs: (logs) => { state.logs = logs; render(); },
    onError: (err) => {
      showError(err);
      if (err?.message?.startsWith('가족')) leaveFamily();
    },
  });
}

function leaveFamily() {
  state.unsubscribe?.();
  state.unsubscribe = null;
  state.code = null;
  state.me = null;
  state.family = { name: '', members: [], home: null };
  state.tasks = [];
  state.logs = [];
  localStorage.removeItem(SESSION_KEY);
  showSetup();
}

function visible(tasks) {
  return state.mineOnly ? tasks.filter((t) => !t.assignee || t.assignee === state.me) : tasks;
}

function taskItem(task, today) {
  const overdue = !task.done && task.due < today;
  const meta = [
    `<span>${esc(task.area)}</span>`,
    task.repeat !== 'none' ? `<span>🔁 ${esc(REPEATS[task.repeat] || '')}</span>` : '',
    task.assignee ? `<span class="who">${esc(task.assignee)}</span>` : '',
    task.done
      ? `<span>✓ ${esc(task.lastDoneBy || '')}</span>`
      : `<span class="${overdue ? 'overdue' : ''}">${esc(dueLabel(task.due, today))}</span>`,
  ].filter(Boolean).join('');
  return `
    <li class="task ${task.done ? 'is-done' : ''}" data-id="${esc(task.id)}">
      <button type="button" class="check" data-action="complete" aria-label="${esc(task.title)} 완료"
        ${task.done ? 'disabled' : ''}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M9.5 16.2 5.3 12l-1.4 1.4 5.6 5.6 11-11-1.4-1.4z"/></svg>
      </button>
      <button type="button" class="task-body" data-action="edit">
        <span class="task-title">${esc(task.title)}</span>
        <span class="task-meta">${meta}</span>
      </button>
    </li>`;
}

const taskList = (tasks, today) => `<ul class="task-list">${tasks.map((t) => taskItem(t, today)).join('')}</ul>`;

function emptyState(emoji, title, text, withPreset = false) {
  return `
    <div class="empty">
      <div class="empty-emoji" aria-hidden="true">${emoji}</div>
      <p class="empty-title">${esc(title)}</p>
      <p>${esc(text)}</p>
      ${withPreset ? '<button type="button" class="btn primary" data-action="open-home">우리 집에 맞는 할 일 추천받기</button>' : ''}
    </div>`;
}

function renderToday(today) {
  const all = visible(state.tasks);
  const due = todayTasks(all, today);
  const overdue = due.filter((t) => t.due < today);
  const now = due.filter((t) => t.due === today);
  const soon = upcomingTasks(all, today).slice(0, 5);
  $('#today-count').textContent = due.length || '';

  if (state.tasks.length === 0) {
    return emptyState('🏠', '아직 할 일이 없어요', '+ 버튼으로 직접 추가하거나, 집 구조에 맞는 추천을 받아 보세요.', true);
  }
  let html = '';
  if (overdue.length) html += `<h2 class="section-title warn">밀린 일 ${overdue.length}</h2>${taskList(overdue, today)}`;
  if (now.length) html += `<h2 class="section-title">오늘 ${now.length}</h2>${taskList(now, today)}`;
  if (!due.length) html += emptyState('✨', '오늘 할 일 끝!', '깨끗한 집, 수고했어요.');
  if (soon.length) html += `<h2 class="section-title muted">곧 할 일</h2>${taskList(soon, today)}`;
  return html;
}

function renderAll(today) {
  const all = visible(state.tasks);
  if (!all.length) {
    return state.tasks.length
      ? emptyState('🙌', '내 담당 할 일이 없어요', '"내 것만"을 끄면 가족 모두의 할 일이 보여요.')
      : emptyState('🏠', '아직 할 일이 없어요', '+ 버튼으로 추가해 보세요.', true);
  }
  const active = all.filter((t) => !t.done);
  const done = all.filter((t) => t.done);
  let html = '';
  for (const area of areas()) {
    const items = active.filter((t) => t.area === area).sort((a, b) => a.due.localeCompare(b.due));
    if (items.length) html += `<h2 class="section-title">${esc(area)} <span class="muted">${items.length}</span></h2>${taskList(items, today)}`;
  }
  if (done.length) {
    html += `<h2 class="section-title muted">완료한 일회성 할 일
      <button type="button" class="link-btn" data-action="clear-done">모두 지우기</button></h2>${taskList(done, today)}`;
  }
  return html;
}

function renderHistory(today) {
  const scores = weeklyScores(state.logs, state.family.members, today);
  const max = Math.max(1, ...scores.map((s) => s.count));
  const scoreHtml = scores.map((s, i) => `
    <li class="score">
      <span class="score-name">${i === 0 && s.count > 0 ? '👑 ' : ''}${esc(s.name)}</span>
      <span class="score-bar"><span style="width:${(s.count / max) * 100}%"></span></span>
      <span class="score-count">${s.count}</span>
    </li>`).join('');

  const recent = state.logs.slice(0, 50);
  let logHtml = '';
  let lastDate = '';
  for (const log of recent) {
    if (log.date !== lastDate) {
      if (lastDate) logHtml += '</ul>';
      const d = parseDateStr(log.date);
      const label = log.date === today ? '오늘' : dueLabel(log.date, today) === '어제' ? '어제' : `${d.getMonth() + 1}월 ${d.getDate()}일`;
      logHtml += `<h3 class="log-date">${label}</h3><ul class="log-list">`;
      lastDate = log.date;
    }
    logHtml += `<li><strong>${esc(log.by)}</strong> · ${esc(log.title)} <span class="muted">${esc(log.area || '')}</span></li>`;
  }
  if (lastDate) logHtml += '</ul>';

  return `
    <h2 class="section-title">이번 주 청소왕</h2>
    <ul class="score-list card">${scoreHtml}</ul>
    <h2 class="section-title">최근 기록</h2>
    ${logHtml || '<p class="muted pad">아직 기록이 없어요. 할 일을 체크하면 여기에 쌓여요.</p>'}`;
}

function render() {
  if (!state.code) return;
  const today = toDateStr();
  $('#family-name').textContent = state.family.name || '우리집';
  $$('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === state.tab)));
  $('#filter-row').hidden = state.tab === 'history';
  $('#mine-toggle').setAttribute('aria-pressed', String(state.mineOnly));

  const html = state.tab === 'today' ? renderToday(today)
    : state.tab === 'all' ? renderAll(today)
    : renderHistory(today);
  if (state.tab !== 'today') todayCountOnly(today);
  $('#view').innerHTML = html;

  if ($('#settings-dialog').open) renderSettings();
}

function todayCountOnly(today) {
  $('#today-count').textContent = todayTasks(visible(state.tasks), today).length || '';
}

async function completeTask(task) {
  const prev = {
    due: task.due,
    done: Boolean(task.done),
    lastDoneBy: task.lastDoneBy ?? null,
    lastDoneAt: task.lastDoneAt ?? null,
  };
  try {
    const logId = await state.store.completeTask(state.code, task, state.me);
    const msg = task.repeat === 'none'
      ? `"${task.title}" 완료!`
      : `"${task.title}" 완료! 다음은 ${dueLabel(nextDue(task.due, task.repeat))}`;
    toast(msg, {
      label: '되돌리기',
      run: () => {
        run(state.store.updateTask(state.code, task.id, prev));
        run(state.store.deleteLog(state.code, logId));
      },
    });
  } catch (err) {
    showError(err);
  }
}

function initMain() {
  $$('[data-tab]').forEach((btn) => btn.addEventListener('click', () => {
    state.tab = btn.dataset.tab;
    render();
    window.scrollTo({ top: 0 });
  }));
  $('#mine-toggle').addEventListener('click', () => { state.mineOnly = !state.mineOnly; render(); });
  $('#add-task').addEventListener('click', () => openTaskDialog(null));
  $('#open-settings').addEventListener('click', openSettings);

  $('#view').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'open-home') { openHomeDialog(); return; }
    if (action === 'clear-done') {
      const done = state.tasks.filter((t) => t.done);
      if (confirm(`완료한 일회성 할 일 ${done.length}개를 지울까요?`)) {
        done.forEach((t) => run(state.store.deleteTask(state.code, t.id)));
      }
      return;
    }
    const task = state.tasks.find((t) => t.id === btn.closest('[data-id]')?.dataset.id);
    if (!task) return;
    if (action === 'complete') {
      btn.closest('.task').classList.add('completing');
      completeTask(task);
    }
    if (action === 'edit') openTaskDialog(task);
  });
}

// ───────────────────────── 할 일 추가/수정 ─────────────────────────

function chipRadios(container, name, options, selected) {
  container.innerHTML = options.map(({ value, label }) => `
    <label class="chip-radio">
      <input type="radio" name="${name}" value="${esc(value)}" ${value === selected ? 'checked' : ''} />
      <span>${esc(label)}</span>
    </label>`).join('');
}

function openTaskDialog(task) {
  state.editingId = task?.id ?? null;
  const form = $('#task-form');
  form.reset();
  $('#task-dialog-title').textContent = task ? '할 일 수정' : '할 일 추가';
  $('#delete-task').hidden = !task;

  const areaList = areas();
  chipRadios($('#area-options'), 'area', areaList.map((a) => ({ value: a, label: a })), task?.area ?? areaList[0]);
  chipRadios($('#assignee-options'), 'assignee',
    [{ value: '', label: '누구나' }, ...state.family.members.map((m) => ({ value: m, label: m }))],
    task?.assignee ?? '');
  $('#repeat-select').innerHTML = Object.entries(REPEATS)
    .map(([value, label]) => `<option value="${value}">${label}</option>`).join('');

  form.title.value = task?.title ?? '';
  form.repeat.value = task?.repeat ?? 'weekly';
  form.due.value = task?.due ?? toDateStr();
  $('#task-dialog').showModal();
  if (!task) form.title.focus();
}

function initTaskDialog() {
  const dialog = $('#task-dialog');
  closeOnBackdrop(dialog);

  $('#task-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = {
      title: form.title.value.trim(),
      area: form.area.value,
      repeat: form.repeat.value,
      due: form.due.value || toDateStr(),
      assignee: form.assignee.value,
    };
    if (!data.title) return;
    if (state.editingId) {
      const current = state.tasks.find((t) => t.id === state.editingId);
      // 날짜를 다시 잡았으면 완료 상태를 풀어 준다
      if (current?.done && data.due !== current.due) data.done = false;
      run(state.store.updateTask(state.code, state.editingId, data));
    } else {
      run(state.store.addTask(state.code, data));
    }
    dialog.close();
  });

  $('#delete-task').addEventListener('click', () => {
    const task = state.tasks.find((t) => t.id === state.editingId);
    if (task && confirm(`"${task.title}"을(를) 지울까요?`)) {
      run(state.store.deleteTask(state.code, task.id));
      dialog.close();
    }
  });
}

// ───────────────────────── 집 정보 · 프리셋 ─────────────────────────

let homeDraft = normalizeHome(DEFAULT_HOME);
let presetDraft = [];

function renderHomeForm() {
  $$('#home-form [data-count]').forEach((row) => {
    $('output', row).textContent = homeDraft[row.dataset.count];
  });
  $('#room-counters').innerHTML = ROOM_TYPES.map(({ key, label }) => `
    <div class="counter" data-room="${key}">
      <span class="counter-label">${esc(label)}</span>
      <button type="button" class="step-btn" data-delta="-1" aria-label="${esc(label)} 줄이기">−</button>
      <output>${homeDraft.rooms[key]}</output>
      <button type="button" class="step-btn" data-delta="1" aria-label="${esc(label)} 늘리기">+</button>
    </div>`).join('');
  $('#home-options').innerHTML = HOME_OPTIONS.map(({ key, label }) => `
    <button type="button" class="chip" data-option="${key}" aria-pressed="${homeDraft[key]}">${esc(label)}</button>`).join('');
}

function showHomeStep(step) {
  $$('#home-form [data-step-panel]').forEach((p) => { p.hidden = p.dataset.stepPanel !== step; });
  $('#home-dialog').scrollTop = 0;
}

function renderPresetPreview() {
  const groups = new Map();
  presetDraft.forEach((t, i) => {
    if (!groups.has(t.area)) groups.set(t.area, []);
    groups.get(t.area).push({ ...t, i });
  });
  $('#preset-list').innerHTML = presetDraft.length ? [...groups.entries()].map(([area, items]) => `
    <section class="preset-group">
      <h3>${esc(area)}</h3>
      ${items.map((t) => `
        <label class="preset-item">
          <input type="checkbox" data-index="${t.i}" checked />
          <span class="preset-title">${esc(t.title)}</span>
          <span class="muted">${esc(REPEATS[t.repeat])}</span>
        </label>`).join('')}
    </section>`).join('')
    : '<p class="muted pad">추천할 새 할 일이 없어요. 이미 모두 추가되어 있어요.</p>';
  updatePresetCount();
}

function updatePresetCount() {
  const n = $$('#preset-list input:checked').length;
  $('#preset-count').textContent = presetDraft.length ? `${n}개` : '';
  $('#apply-preset').textContent = n ? `${n}개 추가하기` : '집 정보만 저장';
}

function openHomeDialog() {
  homeDraft = normalizeHome(state.family.home ?? DEFAULT_HOME);
  renderHomeForm();
  showHomeStep('profile');
  $('#settings-dialog').close();
  $('#home-dialog').showModal();
}

function initHomeDialog() {
  const dialog = $('#home-dialog');
  closeOnBackdrop(dialog);

  $('#home-form').addEventListener('click', (e) => {
    const step = e.target.closest('[data-delta]');
    if (step) {
      const delta = Number(step.dataset.delta);
      const row = step.closest('.counter');
      if (row.dataset.count) {
        const key = row.dataset.count;
        const [min, max] = COUNT_LIMITS[key];
        homeDraft[key] = Math.max(min, Math.min(max, homeDraft[key] + delta));
      } else {
        const key = row.dataset.room;
        const max = ROOM_TYPES.find((r) => r.key === key).max ?? COUNT_LIMITS.room[1];
        homeDraft.rooms[key] = Math.max(0, Math.min(max, homeDraft.rooms[key] + delta));
      }
      renderHomeForm();
      return;
    }
    const option = e.target.closest('[data-option]');
    if (option) {
      homeDraft[option.dataset.option] = !homeDraft[option.dataset.option];
      option.setAttribute('aria-pressed', String(homeDraft[option.dataset.option]));
    }
  });

  $('#to-preview').addEventListener('click', () => {
    presetDraft = excludeExisting(buildPresetTasks(homeDraft), state.tasks);
    renderPresetPreview();
    showHomeStep('preview');
  });
  $('#back-to-profile').addEventListener('click', () => showHomeStep('profile'));
  $('#preset-list').addEventListener('change', updatePresetCount);

  $('#home-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const chosen = $$('#preset-list input:checked').map((c) => presetDraft[Number(c.dataset.index)]);
    run(state.store.setHome(state.code, homeDraft));
    if (chosen.length) run(state.store.addTasks(state.code, chosen));
    dialog.close();
    toast(chosen.length ? `할 일 ${chosen.length}개를 추가했어요` : '집 정보를 저장했어요');
    state.tab = 'today';
    render();
  });
}

// ───────────────────────── 설정 ─────────────────────────

function homeSummary(home) {
  if (!home) return '욕실·베란다·방 개수에 맞춰 청소·정리 할 일을 추천받을 수 있어요.';
  const h = normalizeHome(home);
  const parts = [`욕실 ${h.bathrooms}`, `베란다 ${h.balconies}`];
  for (const { key, label } of ROOM_TYPES) if (h.rooms[key]) parts.push(`${label} ${h.rooms[key]}`);
  for (const { key, label } of HOME_OPTIONS) if (h[key]) parts.push(label);
  return parts.join(' · ');
}

function renderSettings() {
  $('#family-code').textContent = formatCode(state.code);
  $('#home-summary').textContent = homeSummary(state.family.home);
  $('#member-list').innerHTML = state.family.members.map((m) => `
    <li>
      <span>${esc(m)}${m === state.me ? ' <span class="muted">(나)</span>' : ''}</span>
      ${m === state.me ? '' : `<button type="button" class="link-btn" data-remove="${esc(m)}">빼기</button>`}
    </li>`).join('');
  $('#me-options').innerHTML = state.family.members.map((m) => `
    <button type="button" class="chip" data-me="${esc(m)}" aria-pressed="${m === state.me}">${esc(m)}</button>`).join('');
}

function openSettings() {
  renderSettings();
  $('#settings-dialog').showModal();
}

function initSettings() {
  const dialog = $('#settings-dialog');
  closeOnBackdrop(dialog);

  $('#share-code').addEventListener('click', async () => {
    const text = `우리집 청소 앱에서 초대코드 ${formatCode(state.code)} 를 입력하고 함께해요!\n${location.origin}${location.pathname}`;
    try {
      if (navigator.share) await navigator.share({ title: '우리집 청소 초대', text });
      else { await navigator.clipboard.writeText(text); toast('초대 문구를 복사했어요'); }
    } catch { /* 공유 취소 */ }
  });

  $('#open-home').addEventListener('click', openHomeDialog);

  $('#member-list').addEventListener('click', (e) => {
    const name = e.target.closest('[data-remove]')?.dataset.remove;
    if (name && confirm(`${name}님을 구성원에서 뺄까요? (기록은 남아요)`)) {
      run(state.store.removeMember(state.code, name));
    }
  });

  $('#add-member-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = e.currentTarget.name;
    const name = input.value.trim();
    if (!name) return;
    run(state.store.addMember(state.code, name));
    input.value = '';
  });

  $('#me-options').addEventListener('click', (e) => {
    const name = e.target.closest('[data-me]')?.dataset.me;
    if (!name) return;
    state.me = name;
    saveSession();
    $('#me-name').textContent = name;
    render();
    renderSettings();
  });

  $('#leave-family').addEventListener('click', () => {
    if (confirm(`이 기기에서 나갈까요?\n다시 들어오려면 초대코드 ${formatCode(state.code)} 가 필요해요.`)) {
      dialog.close();
      leaveFamily();
    }
  });

  // 안드로이드(삼성 인터넷·크롬)는 설치 버튼을 직접 띄울 수 있음. 아이폰은 안내 문구로.
  let installPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt = e;
    $('#install-btn').hidden = false;
  });
  $('#install-btn').addEventListener('click', async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    $('#install-btn').hidden = true;
  });
}

// ───────────────────────── 시작 ─────────────────────────

async function main() {
  initSetup();
  initMain();
  initTaskDialog();
  initHomeDialog();
  initSettings();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch((err) => console.warn('SW 등록 실패', err));
  }

  try {
    state.store = await createStore({ onWriteError: showError });
  } catch (err) {
    console.error(err);
    document.body.innerHTML = '<p class="fatal">앱을 시작하지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요.</p>';
    return;
  }

  const session = loadSession();
  if (session?.code && session?.me) {
    state.code = session.code;
    state.me = session.me;
    enterFamily();
  } else {
    showSetup();
  }

  // 자정이 지나거나 앱으로 돌아왔을 때 '오늘' 다시 계산
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.code) {
      $('#today-label').textContent = todayLabel();
      render();
    }
  });
}

main();
