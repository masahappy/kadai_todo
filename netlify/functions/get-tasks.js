const { verifyUser } = require('./utils/verifyUser');

exports.handler = async function (event) {
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

  try {
    // ② 自分のuser_idのタスクだけを取得するよう、URLに条件を追加
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/tasks?select=*&user_id=eq.${userId}`,
      {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      }
    );

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