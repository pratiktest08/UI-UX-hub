// api/live-compare.js
// Full pipeline: Tavily search → Claude analysis → structured UI/UX comparison

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { pattern, brokers = [], user_key } = req.body;
    if (!pattern) return res.status(400).json({ error: 'Missing pattern field' });

    const anthropicKey = (process.env.ANTHROPIC_API_KEY || user_key || '').trim();
    const tavilyKey    = (process.env.TAVILY_API_KEY || '').trim();

    if (!anthropicKey) return res.status(401).json({ error: 'No Anthropic API key' });

    const targetBrokers = brokers.length > 0 ? brokers :
      ['zerodha','groww','upstox','dhan','angel','indmoney','paytm','fyers'];

    const brokerNames = {
      zerodha:'Zerodha Kite', groww:'Groww', upstox:'Upstox', dhan:'Dhan',
      angel:'Angel One', indmoney:'INDmoney', paytm:'Paytm Money', fyers:'Fyers'
    };

    // Step 1: Search for live news about each broker's UI updates
    let liveContext = '';
    if (tavilyKey) {
      try {
        const searchQuery = `${targetBrokers.map(b => brokerNames[b]||b).join(' OR ')} "${pattern}" UI UX design update 2025`;
        const tRes = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: tavilyKey,
            query: searchQuery,
            search_depth: 'basic',
            include_answer: true,
            max_results: 6,
          }),
        });
        if (tRes.ok) {
          const tData = await tRes.json();
          const snippets = (tData.results || []).map(r =>
            `[${r.title}] (${new URL(r.url||'https://x.com').hostname}): ${(r.content||'').slice(0,200)}`
          ).join('\n');
          liveContext = tData.answer
            ? `LIVE SEARCH SUMMARY: ${tData.answer}\n\nRECENT ARTICLES:\n${snippets}`
            : `RECENT ARTICLES:\n${snippets}`;
        }
      } catch(e) {
        liveContext = ''; // Search failed, continue without live data
      }
    }

    // Step 2: Claude analysis with live context injected
    const prompt = `You are a UI/UX expert for Indian stock trading apps.
Compare the "${pattern}" UI pattern across these brokers: ${targetBrokers.map(b=>brokerNames[b]||b).join(', ')}.

${liveContext ? `Use this LIVE context from recent web search to make your analysis current and accurate:\n${liveContext}\n\n` : ''}

Return ONLY a valid JSON object (no markdown, no backticks, no extra text):
{
  "pattern": "${pattern} UI Pattern",
  "intro": "one sentence specifically about ${pattern} in Indian trading apps",
  "last_updated": "March 2025",
  "has_live_data": ${liveContext ? 'true' : 'false'},
  "f1_name": "most relevant feature 1 for ${pattern} max 3 words",
  "f2_name": "most relevant feature 2 for ${pattern} max 3 words",
  "f3_name": "most relevant feature 3 for ${pattern} max 3 words",
  "f4_name": "most relevant feature 4 for ${pattern} max 3 words",
  "winner": "broker key of best implementation",
  "plindia": "specific actionable tip for PL India about ${pattern} max 15 words",
  "brokers": [
    {
      "key": "dhan",
      "rank": 1,
      "visual": 9.2,
      "ease": 9.0,
      "speed": 8.8,
      "clarity": 9.0,
      "overall": 9.1,
      "f1": true,
      "f2": true,
      "f3": false,
      "f4": true,
      "standout": "specific to ${pattern} max 7 words",
      "verdict": "specific to ${pattern} max 12 words",
      "weakness": "specific weakness for ${pattern} max 7 words",
      "latest_update": "any recent update if known else empty string"
    }
  ]
}
All 8 brokers must be in the array. Rank 1=best. Base scores specifically on "${pattern}" implementation quality.`;

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!claudeRes.ok) {
      const e = await claudeRes.json();
      return res.status(claudeRes.status).json({ error: e?.error?.message || 'Claude API error' });
    }

    const claudeData = await claudeRes.json();
    let text = claudeData.content?.map(c => c.text || '').join('') || '';

    // Parse JSON from Claude response
    text = text.replace(/```json/gi,'').replace(/```/g,'').trim();
    const start = text.indexOf('{'), end = text.lastIndexOf('}');
    if (start === -1 || end === -1) return res.status(500).json({ error: 'Could not parse AI response' });

    let result = JSON.parse(text.slice(start, end + 1).replace(/,(\s*[}\]])/g, '$1'));
    result.has_live_data = !!liveContext;
    result.generated_at = new Date().toISOString();

    return res.status(200).json(result);

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
