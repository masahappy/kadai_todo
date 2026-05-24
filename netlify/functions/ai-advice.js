exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { prompt } = JSON.parse(event.body);
  const apiKey = process.env.GROQ_API_KEY;

  // APIキーが読み込まれているか確認
  console.log('APIキーの最初の10文字:', apiKey ? apiKey.substring(0, 10) : 'undefined');

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    console.log('Groqのレスポンスステータス:', response.status);

    const data = await response.json();
    console.log('Groqのレスポンス:', JSON.stringify(data).substring(0, 200));

    const text = data.choices[0].message.content;

    return {
      statusCode: 200,
      body: JSON.stringify({ text })
    };
  } catch (err) {
    console.log('エラー:', err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
