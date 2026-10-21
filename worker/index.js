// ===== AIToDo：サーバー側の処理（Cloudflare Workers） =====
// Netlify Functions 7つ（get-tasks / save-task / update-task / delete-task /
// get-schedule / save-schedule / ai-advice）と verifyUser を、このファイル1つにまとめたものです。
// 画面（public/ の中のファイル）からは /api/○○ という住所で呼び出されます。
//
// 必要な環境変数（Cloudflareの画面で設定します。ファイルには書きません）
//   SUPABASE_URL          … SupabaseのプロジェクトURL
//   SUPABASE_ANON_KEY     … Supabaseの Publishable key（ログイン確認用）
//   SUPABASE_SERVICE_KEY  … Supabaseの Secret key（データベース操作用）
//   GROQ_API_KEY          … GroqのAPIキー（AIアドバイス用）

// update-task で更新を許可する項目（これ以外の項目は無視する）
const ALLOWED_TASK_FIELDS = ['title', 'subject', 'deadline', 'priority', 'done', 'start_time', 'end_time'];

// ===== 共通の部品 =====

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function requireMethod(request, method) {
  if (request.method !== method) {
    throw new HttpError(405, 'Method Not Allowed');
  }
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, 'リクエストの形式が正しくありません');
  }
}

// データベース（Supabase）へ送るときの共通ヘッダー
function supabaseHeaders(env, extra = {}) {
  return {
    apikey: env.SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    ...extra,
  };
}

// ===== ログインユーザーの証明書（トークン）が本物か確認する =====
async function verifyUser(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return null; // 証明書が送られてきていない

  const token = authHeader.replace('Bearer ', '');

  try {
    const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: env.SUPABASE_ANON_KEY,
      },
    });

    if (!response.ok) return null; // 偽物、または期限切れ

    const user = await response.json();
    return user.id || null; // 本物なら、その人のuser_idを返す
  } catch {
    return null;
  }
}

// ログインしていなければ、ここで処理を止める（401）
async function requireUser(request, env) {
  const userId = await verifyUser(request, env);
  if (!userId) throw new HttpError(401, 'ログインが必要です');
  return userId;
}

// ===== /api/get-tasks：自分の課題を全部取得 =====
async function getTasks(request, env) {
  const userId = await requireUser(request, env);

  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/tasks?select=*&user_id=eq.${encodeURIComponent(userId)}`,
    { method: 'GET', headers: supabaseHeaders(env) }
  );

  const data = await response.json();
  return json(data, response.ok ? 200 : 500);
}

// ===== /api/save-task：課題を1件追加 =====
async function saveTask(request, env) {
  requireMethod(request, 'POST');
  const userId = await requireUser(request, env);

  const task = await readJson(request);
  if (task === null || typeof task !== 'object' || Array.isArray(task)) {
    throw new HttpError(400, 'リクエストの形式が正しくありません');
  }

  // 送られてきた課題に、確認できたuser_idを追加する（なりすまし防止）
  task.user_id = userId;

  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/tasks`, {
    method: 'POST',
    headers: supabaseHeaders(env, {
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    }),
    body: JSON.stringify(task),
  });

  const data = await response.json();
  return json(data, response.ok ? 200 : 500);
}

// ===== /api/update-task：課題を更新（完了切り替え・編集） =====
async function updateTask(request, env) {
  requireMethod(request, 'POST');
  const userId = await requireUser(request, env);

  const body = await readJson(request);
  const id = body && body.id;

  // 許可された項目だけを取り出す
  const updates = {};
  ALLOWED_TASK_FIELDS.forEach((key) => {
    if (body && key in body) updates[key] = body[key];
  });

  if (id === undefined || id === null || id === '' || Object.keys(updates).length === 0) {
    throw new HttpError(400, '更新する内容がありません');
  }

  // 「このidであること」かつ「user_idが自分であること」の課題だけを更新
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/tasks?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}`,
    {
      method: 'PATCH',
      headers: supabaseHeaders(env, {
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      }),
      body: JSON.stringify(updates),
    }
  );

  const data = await response.json();
  return json(data, response.ok ? 200 : 500);
}

// ===== /api/delete-task：課題を1件削除 =====
async function deleteTask(request, env) {
  requireMethod(request, 'POST');
  const userId = await requireUser(request, env);

  const body = await readJson(request);
  const id = body && body.id;
  if (id === undefined || id === null || id === '') {
    throw new HttpError(400, '削除する課題が指定されていません');
  }

  // 「このidであること」かつ「user_idが自分であること」の課題だけを削除
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/tasks?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}`,
    { method: 'DELETE', headers: supabaseHeaders(env) }
  );

  return json({ success: response.ok }, response.ok ? 200 : 500);
}

// ===== /api/get-schedule：今週の予定を取得 =====
async function getSchedule(request, env) {
  const userId = await requireUser(request, env);

  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/schedules?select=*&user_id=eq.${encodeURIComponent(userId)}`,
    { method: 'GET', headers: supabaseHeaders(env) }
  );

  const data = await response.json();
  if (!response.ok) return json(data, 500);

  // 予定がまだ登録されていない場合は空のオブジェクトを返す
  const schedule = Array.isArray(data) && data.length > 0 ? data[0] : {};
  return json(schedule);
}

// ===== /api/save-schedule：今週の予定を保存（あれば更新、なければ新規作成） =====
async function saveSchedule(request, env) {
  requireMethod(request, 'POST');
  const userId = await requireUser(request, env);

  const schedule = await readJson(request);
  if (schedule === null || typeof schedule !== 'object' || Array.isArray(schedule)) {
    throw new HttpError(400, 'リクエストの形式が正しくありません');
  }
  schedule.user_id = userId;

  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/schedules?on_conflict=user_id`, {
    method: 'POST',
    headers: supabaseHeaders(env, {
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    }),
    body: JSON.stringify(schedule),
  });

  const data = await response.json();
  return json(data, response.ok ? 200 : 500);
}

// ===== /api/ai-advice：AIにスケジュールのアドバイスをもらう =====
async function aiAdvice(request, env) {
  requireMethod(request, 'POST');

  const { prompt } = await readJson(request);

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = await response.json();
  const text = data && data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content
    : null;

  if (!text) {
    const message = (data && data.error && data.error.message) || 'AIから応答を取得できませんでした';
    return json({ error: message }, 500);
  }

  return json({ text });
}

// ===== 住所（URL）と処理の対応表 =====
const ROUTES = {
  '/api/get-tasks': getTasks,
  '/api/save-task': saveTask,
  '/api/update-task': updateTask,
  '/api/delete-task': deleteTask,
  '/api/get-schedule': getSchedule,
  '/api/save-schedule': saveSchedule,
  '/api/ai-advice': aiAdvice,
};

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    const handler = ROUTES[pathname.replace(/\/+$/, '')];

    if (!handler) return json({ error: 'Not Found' }, 404);

    try {
      return await handler(request, env);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status);
      return json({ error: err.message }, 500);
    }
  },
};