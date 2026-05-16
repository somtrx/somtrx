export const config = { runtime: 'edge' };

export default async function handler(req) {

  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Basic rate limit hint (Vercel doesn't block, but we can check origin)
  const origin = req.headers.get('origin') || '';
  const allowed = ['somtrx.in', 'www.somtrx.in', 'localhost'];
  if (!allowed.some(d => origin.includes(d))) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let messages;
  try {
    const body = await req.json();
    messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) throw new Error();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Forward to Groq — key lives only here, never in the browser
  const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages,
      max_tokens: 1024,
      temperature: 0.72,
      stream: true
    })
  });

  if (!groqRes.ok) {
    const err = await groqRes.json().catch(() => ({}));
    return new Response(JSON.stringify({ error: err?.error?.message || 'Groq API error' }), {
      status: groqRes.status,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Pass the stream straight through to the browser
  return new Response(groqRes.body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
