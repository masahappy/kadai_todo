// ===== ログインユーザーの証明書(トークン)が本物か確認する共通部品 =====
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function verifyUser(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization;

  if (!authHeader) {
    return null; // 証明書が送られてきていない
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': SUPABASE_ANON_KEY
      }
    });

    if (!response.ok) return null; // 偽物、または期限切れ

    const user = await response.json();
    return user.id || null; // 本物なら、その人のuser_idを返す
  } catch (err) {
    return null;
  }
}

module.exports = { verifyUser };