const { verifyUser } = require('./utils/verifyUser');

exports.handler = async function (event) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  const userId = await verifyUser(event);

  if (!userId) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'ログインが必要です' })
    };
  }

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/schedules?select=*&user_id=eq.${userId}`,
      {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      }
    );

    const data = await response.json();

    // 予定がまだ登録されていない場合は空のオブジェクトを返す
    const schedule = Array.isArray(data) && data.length > 0 ? data[0] : {};

    return {
      statusCode: 200,
      body: JSON.stringify(schedule)
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};