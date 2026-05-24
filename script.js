// ============================================================
// 課題ToDo アプリ - script.js (Phase 2)
// ============================================================

// ===== データ管理 =====
let tasks    = JSON.parse(localStorage.getItem('kadai-tasks'))    || [];
let schedule = JSON.parse(localStorage.getItem('kadai-schedule')) || {};
let currentFilter = 'すべて';

// ===== アプリ起動時の処理 =====
window.onload = function () {
  const today = new Date();
  const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
  document.getElementById('today-date').textContent = today.toLocaleDateString('ja-JP', options);

  document.getElementById('input-deadline').value = today.toISOString().split('T')[0];

  loadSchedule();
  renderTasks();
};

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

// ===== 今週の予定を保存する =====
function saveSchedule() {
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
  localStorage.setItem('kadai-schedule', JSON.stringify(schedule));
  alert('予定を保存しました！');
}

// ===== 保存済みの予定を入力欄に反映する =====
function loadSchedule() {
  if (!schedule) return;
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

// ===== タスクを追加する =====
function addTask() {
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

  const newTask = {
    id:       Date.now(),
    title:    title,
    subject:  subject,
    deadline: deadline,
    priority: priority,
    done:     false
  };

  tasks.push(newTask);
  saveTasks();

  titleInput.value = '';
  document.getElementById('input-subject').value = '';
  document.getElementById('input-priority').value = '中';

  renderTasks();
}

// ===== タスクを完了/未完了に切り替える =====
function toggleDone(id) {
  const task = tasks.find(t => t.id === id);
  if (task) {
    task.done = !task.done;
    saveTasks();
    renderTasks();
  }
}

// ===== タスクを削除する =====
function deleteTask(id) {
  if (!confirm('この課題を削除しますか？')) return;
  tasks = tasks.filter(t => t.id !== id);
  saveTasks();
  renderTasks();
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
}

// ===== localStorageへ保存 =====
function saveTasks() {
  localStorage.setItem('kadai-tasks', JSON.stringify(tasks));
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
