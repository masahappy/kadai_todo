// ============================================================
// 課題ToDo アプリ - script.js (Phase 3: Supabase連携)
// ============================================================

// ===== データ管理 =====
// ===== Supabaseクライアントの初期化 =====
const SUPABASE_URL = 'https://cfhsjszynwtcaqifylsc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_BcCHyZatGpZF8ok00ATkHg_6sgxmEsc';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let tasks    = [];  // Supabaseから読み込んだタスクをここに保持
let schedule = JSON.parse(localStorage.getItem('kadai-schedule')) || {};
let currentFilter = 'すべて';

// ===== アプリ起動時の処理 =====
// ===== サインアップ =====
async function handleSignup() {
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const errorEl = document.getElementById('auth-error');

  const { data, error } = await supabaseClient.auth.signUp({ email, password });

  if (error) {
    errorEl.textContent = error.message;
    errorEl.style.display = 'block';
    return;
  }

  errorEl.style.display = 'none';
  alert('登録できました。そのままログインしてください。');
}

// ===== ログイン =====
async function handleLogin() {
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const errorEl = document.getElementById('auth-error');

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    errorEl.textContent = error.message;
    errorEl.style.display = 'block';
    return;
  }

  errorEl.style.display = 'none';
  showApp();
}

// ===== ログアウト =====
async function handleLogout() {
  await supabaseClient.auth.signOut();
  document.getElementById('main-app').style.display = 'none';
  document.getElementById('auth-screen').style.display = 'flex';
}

// ===== ログイン済みならタスク画面を表示、そうでなければログイン画面を表示 =====
async function showApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('main-app').style.display = 'block';
  await loadSchedule();
  await fetchTasks();
}
window.onload = async function () {
  const today = new Date();
  const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
  document.getElementById('today-date').textContent = today.toLocaleDateString('ja-JP', options);
  document.getElementById('input-deadline').value = today.toISOString().split('T')[0];


  // ログイン状態を確認
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (session) {
    // ログイン済みならタスク画面を表示
    showApp();
  } else {
    // 未ログインならログイン画面を表示したまま
    document.getElementById('auth-screen').style.display = 'flex';
  }
};

// ===== Supabaseからタスクを取得する =====
async function fetchTasks() {
  const list = document.getElementById('task-list');
  list.innerHTML = '<p class="empty-msg">読み込み中...</p>';

  try {
    // 今ログインしている人の証明書(トークン)を取得
    const { data: { session } } = await supabaseClient.auth.getSession();

    const response = await fetch('/.netlify/functions/get-tasks', {
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    });
    const data = await response.json();
    tasks = Array.isArray(data) ? data : [];
  } catch (err) {
    tasks = [];
    alert('課題の読み込みに失敗しました。');
  }

  renderTasks();
}

// ===== 今週の予定：開閉トグル =====
function toggleSchedule() {
  const body = document.getElementById('schedule-body');
  const icon = document.getElementById('schedule-toggle-icon');
  if (body.style.display === 'none') {
    body.style.display = 'block';
    icon.textContent = '▼';
  } else {
    body.style.display = 'none';
    icon.textContent = '▶';
  }
}

// ===== 今週の予定を保存する（Supabaseに保存） =====
async function saveSchedule() {
  schedule = {
    mon:       document.getElementById('schedule-mon').value,
    tue:       document.getElementById('schedule-tue').value,
    wed:       document.getElementById('schedule-wed').value,
    thu:       document.getElementById('schedule-thu').value,
    fri:       document.getElementById('schedule-fri').value,
    sat:       document.getElementById('schedule-sat').value,
    sun:       document.getElementById('schedule-sun').value,
    condition: document.getElementById('schedule-condition').value,
  };

  try {
    const { data: { session } } = await supabaseClient.auth.getSession();

    await fetch('/.netlify/functions/save-schedule', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify(schedule)
    });

    alert('予定を保存しました！');
  } catch (err) {
    alert('予定の保存に失敗しました。');
  }
}

// ===== 保存済みの予定をSupabaseから取得して入力欄に反映する =====
async function loadSchedule() {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();

    const response = await fetch('/.netlify/functions/get-schedule', {
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    });
    schedule = await response.json();
  } catch (err) {
    schedule = {};
  }

  const fields = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun', 'condition'];
  fields.forEach(key => {
    const el = document.getElementById(`schedule-${key}`);
    if (el && schedule[key]) el.value = schedule[key];
  });
}

// ===== AIアドバイスを取得する =====
async function getAIAdvice() {
  const undoneTasks = tasks.filter(t => !t.done);

  if (undoneTasks.length === 0) {
    alert('未完了の課題がありません！');
    return;
  }

  const btn = document.querySelector('.btn-ai');
  btn.textContent = '⏳ AIが考え中...';
  btn.disabled = true;

  const resultEl = document.getElementById('ai-result');
  resultEl.style.display = 'block';
  resultEl.innerHTML = '<p class="ai-loading">AIが分析しています。少しお待ちください...</p>';

  const taskList = undoneTasks.map(t =>
    `・${t.title}（カテゴリ：${t.subject || 'なし'}、締切：${t.deadline || '未設定'}、優先度：${t.priority}）`
  ).join('\n');

  const scheduleText = `
月曜：${schedule.mon || '未入力'}
火曜：${schedule.tue || '未入力'}
水曜：${schedule.wed || '未入力'}
木曜：${schedule.thu || '未入力'}
金曜：${schedule.fri || '未入力'}
土曜：${schedule.sat || '未入力'}
日曜：${schedule.sun || '未入力'}
体調・状況：${schedule.condition || '未入力'}
  `.trim();

  const prompt = `
あなたは大学生の課題管理をサポートするAIアシスタントです。
以下の情報をもとに、今週の効率的な課題スケジュールを提案してください。

【未完了の課題】
${taskList}

【今週の予定】
${scheduleText}

以下の点を考慮してアドバイスしてください：
- 締切が近いものを優先する
- 疲れやすい日は軽めのタスクを割り当てる
- 空き時間が多い日に重いタスクを入れる
- 具体的に「何曜日にどの課題をやるか」を提案する
- 日本語で、箇条書きでわかりやすく回答する
  `.trim();

  try {
    const response = await fetch('/.netlify/functions/ai-advice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });

    const data = await response.json();
    const text = data.text;

    resultEl.innerHTML = `
      <div class="ai-answer">
        <h3>🤖 AIからのアドバイス</h3>
        <div class="ai-text">${text.replace(/\n/g, '<br>')}</div>
      </div>
    `;
  } catch (err) {
    resultEl.innerHTML = '<p class="ai-error">エラーが発生しました。もう一度試してみてください。</p>';
  }

  btn.textContent = '✨ AIにアドバイスをもらう';
  btn.disabled = false;
}

// ===== タスクを追加する（Supabaseに保存） =====
async function addTask() {
  const titleInput = document.getElementById('input-title');
  const title = titleInput.value.trim();

  if (title === '') {
    alert('課題名を入力してください。');
    titleInput.focus();
    return;
  }

  const subject  = document.getElementById('input-subject').value.trim();
  const deadline = document.getElementById('input-deadline').value;
  const priority = document.getElementById('input-priority').value;
  const dueDate   = document.getElementById('input-due-date').value;
  const startTime = document.getElementById('input-start-time').value;

  const newTask = {
    title:      title,
    subject:    subject || null,
    deadline:   deadline || null,
    priority:   priority,
    done:       false,
    due_date:   dueDate || null,
    start_time: startTime || null
  };

  const btn = document.getElementById('btn-add');
  btn.disabled = true;

  try {
    const { data: { session } } = await supabaseClient.auth.getSession();

    const response = await fetch('/.netlify/functions/save-task', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify(newTask)
    });

    if (!response.ok) {
      alert('課題の追加に失敗しました。');
      return;
    }

    titleInput.value = '';
    document.getElementById('input-subject').value = '';
    document.getElementById('input-priority').value = '中';
    document.getElementById('input-due-date').value = '';
    document.getElementById('input-start-time').value = '';

    await fetchTasks();
  } catch (err) {
    alert('課題の追加に失敗しました。');
  }

  btn.disabled = false;
}

// ===== タスクを完了/未完了に切り替える =====
async function toggleDone(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  const newDoneState = !task.done;

  try {
    const { data: { session } } = await supabaseClient.auth.getSession();

    const response = await fetch('/.netlify/functions/update-task', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ id, done: newDoneState })
    });

    if (!response.ok) {
      alert('更新に失敗しました。');
      return;
    }

    await fetchTasks();
  } catch (err) {
    alert('更新に失敗しました。');
  }
}

// ===== タスクを削除する =====
async function deleteTask(id) {
  if (!confirm('この課題を削除しますか？')) return;

  try {
    const { data: { session } } = await supabaseClient.auth.getSession();

    const response = await fetch('/.netlify/functions/delete-task', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ id })
    });

    if (!response.ok) {
      alert('削除に失敗しました。');
      return;
    }

    await fetchTasks();
  } catch (err) {
    alert('削除に失敗しました。');
  }
}

// ===== フィルタリング =====
function filterBySubject(filter, clickedBtn) {
  currentFilter = filter;
  document.querySelectorAll('.tab').forEach(btn => btn.classList.remove('active'));
  clickedBtn.classList.add('active');
  renderTasks();
}

// ===== 締切が間近かどうか判定（3日以内） =====
function isUrgent(deadlineStr) {
  if (!deadlineStr) return false;
  const today    = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(deadlineStr);
  const diffDays = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays <= 3;
}

// ===== 締切日を読みやすい形式に変換 =====
function formatDeadline(deadlineStr) {
  if (!deadlineStr) return '';
  const deadline = new Date(deadlineStr);
  const month    = deadline.getMonth() + 1;
  const day      = deadline.getDate();

  const today    = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));

  let suffix = '';
  if      (diffDays < 0)   suffix = '（期限切れ）';
  else if (diffDays === 0) suffix = '（今日！）';
  else if (diffDays === 1) suffix = '（明日）';
  else if (diffDays <= 3)  suffix = `（あと${diffDays}日）`;

  return `${month}/${day}${suffix}`;
}

// ===== 統計を更新する =====
function updateStats() {
  const undone = tasks.filter(t => !t.done).length;
  const urgent = tasks.filter(t => !t.done && isUrgent(t.deadline)).length;
  const done   = tasks.filter(t => t.done).length;

  document.getElementById('stat-total').textContent  = undone;
  document.getElementById('stat-urgent').textContent = urgent;
  document.getElementById('stat-done').textContent   = done;
}

// ===== タスク一覧を描画する =====
function renderTasks() {
  updateStats();

  const list     = document.getElementById('task-list');
  const emptyMsg = document.getElementById('empty-msg');

  let filtered;
  if      (currentFilter === 'すべて')   filtered = tasks;
  else if (currentFilter === '未完了')   filtered = tasks.filter(t => !t.done);
  else if (currentFilter === '完了済み') filtered = tasks.filter(t => t.done);
  else                                   filtered = tasks;

  const sorted = [...filtered].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    return new Date(a.deadline) - new Date(b.deadline);
  });

  list.innerHTML = '';

  if (sorted.length === 0) {
    emptyMsg.style.display = 'block';
    return;
  }
  emptyMsg.style.display = 'none';

  sorted.forEach(task => {
    const card = document.createElement('div');
    card.className = `task-card${task.done ? ' is-done' : ''}`;

    const deadlineClass = isUrgent(task.deadline) && !task.done ? 'deadline is-urgent' : 'deadline';

    card.innerHTML = `
      <button
        class="check-btn${task.done ? ' checked' : ''}"
        onclick="toggleDone(${task.id})"
        title="${task.done ? '未完了に戻す' : '完了にする'}"
      >${task.done ? '✓' : ''}</button>

      <div class="task-info">
        <div class="task-title">${escapeHtml(task.title)}</div>
        <div class="task-meta">
          ${task.subject ? `<span class="badge">${escapeHtml(task.subject)}</span>` : ''}
          ${task.deadline ? `<span class="${deadlineClass}">📅 ${formatDeadline(task.deadline)}</span>` : ''}
          <span class="priority priority-${task.priority}">${task.priority}</span>
        </div>
      </div>

      <button class="delete-btn" onclick="deleteTask(${task.id})" title="削除">🗑</button>
    `;

    list.appendChild(card);
  });
  renderTodayView();
}


// ===== 今日のタスク：開閉トグル =====
function toggleTodayView() {
  const body = document.getElementById('today-body');
  const icon = document.getElementById('today-toggle-icon');
  if (body.style.display === 'none') {
    body.style.display = 'block';
    icon.textContent = '▼';
  } else {
    body.style.display = 'none';
    icon.textContent = '▶';
  }
}

// ===== 時刻を読みやすい形式に変換（例: 09:00） =====
function formatTime(timeStr) {
  if (!timeStr) return '';
  return timeStr.slice(0, 5); // "09:00:00" -> "09:00"
}

// ===== 今日のタスクビューを描画する =====
function renderTodayView() {
  const todayStr = new Date().toISOString().split('T')[0];
  const todayTasks = tasks.filter(t => t.due_date === todayStr && !t.done);

  const timeline    = document.getElementById('today-timeline');
  const anytimeList = document.getElementById('today-anytime-list');
  const emptyMsg    = document.getElementById('today-empty-msg');

  timeline.innerHTML    = '';
  anytimeList.innerHTML = '';

  if (todayTasks.length === 0) {
    emptyMsg.style.display = 'block';
    return;
  }
  emptyMsg.style.display = 'none';

  const timed   = todayTasks.filter(t => t.start_time).sort((a, b) => a.start_time.localeCompare(b.start_time));
  const anytime = todayTasks.filter(t => !t.start_time);

  timed.forEach(task => {
    const item = document.createElement('div');
    item.className = 'timeline-item';
    item.innerHTML = `
      <span class="timeline-time">${formatTime(task.start_time)}</span>
      <div class="timeline-content">
        <span class="task-title">${escapeHtml(task.title)}</span>
        ${task.subject ? `<span class="badge">${escapeHtml(task.subject)}</span>` : ''}
      </div>
      <button class="check-btn" onclick="toggleDone(${task.id})" title="完了にする"></button>
    `;
    timeline.appendChild(item);
  });

  anytime.forEach(task => {
    const item = document.createElement('div');
    item.className = 'anytime-item';
    item.innerHTML = `
      <div class="task-info">
        <span class="task-title">${escapeHtml(task.title)}</span>
        ${task.subject ? `<span class="badge">${escapeHtml(task.subject)}</span>` : ''}
      </div>
      <button class="check-btn" onclick="toggleDone(${task.id})" title="完了にする"></button>
    `;
    anytimeList.appendChild(item);
  });
}


// ===== XSS対策 =====
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ===== Enterキーで課題追加 =====
document.addEventListener('DOMContentLoaded', function () {
  document.getElementById('input-title').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') addTask();
  });
});