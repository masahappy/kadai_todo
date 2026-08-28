const { verifyUser } = require('./utils/verifyUser');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  const userId = await verifyUser(event);

  if (!userId) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'ログインが必要です' })
    };
  }

  const schedule = JSON.parse(event.body);
  schedule.user_id = userId;

  try {
    // upsert: あれば更新、なければ新規作成
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/schedules?on_conflict=user_id`,
      {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates,return=representation'
        },
        body: JSON.stringify(schedule)
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