const { verifyUser } = require('./utils/verifyUser');

// 更新を許可する項目（これ以外の項目は無視する）
const ALLOWED_FIELDS = ['title', 'subject', 'deadline', 'priority', 'done', 'start_time', 'end_time'];

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  // ① 証明書を確認して、ユーザーIDを取得
  const userId = await verifyUser(event);

  if (!userId) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'ログインが必要です' })
    };
  }

  const body = JSON.parse(event.body);
  const { id } = body;

  // ② 許可された項目だけを取り出す
  const updates = {};
  ALLOWED_FIELDS.forEach(key => {
    if (key in body) updates[key] = body[key];
  });

  if (!id || Object.keys(updates).length === 0) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: '更新する内容がありません' })
    };
  }

  try {
    // ③ 「このidであること」かつ「user_idが自分であること」の課題だけを更新
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/tasks?id=eq.${id}&user_id=eq.${userId}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(updates)
      }
    );

    const data = await response.json();

    return {
      statusCode: response.ok ? 200 : 500,
      body: JSON.stringify(data)
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};