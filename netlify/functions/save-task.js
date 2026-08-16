const { verifyUser } = require('./utils/verifyUser');

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

  const task = JSON.parse(event.body);

  // ② 送られてきたタスクに、確認できたuser_idを追加する
  task.user_id = userId;

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/tasks`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(task)
    });

    const data = await response.json();

    return {
      statusCode: 200,
      body: JSON.stringify(data)
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};