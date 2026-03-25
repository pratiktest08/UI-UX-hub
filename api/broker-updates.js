// api/broker-updates.js
// YOUR OWN API — fetches live broker UI/UX updates
// Sources: App Store changelogs + News sites (Entrackr, Inc42, Moneycontrol)
// GET  /api/broker-updates?broker=zerodha&limit=5
// POST /api/broker-updates  body: { brokers:[], query:'', user_key:'' }

const ALL_BROKERS = {
  // Discount
  zerodha:   { name:'Zerodha Kite',    android:'com.zerodha.kite3',         ios:'1333352618', news_query:'Zerodha Kite app update' },
  groww:     { name:'Groww',           android:'com.nextbillion.groww',      ios:'1404680703', news_query:'Groww app new feature' },
  upstox:    { name:'Upstox',          android:'in.upstox.client',           ios:'1449278679', news_query:'Upstox app UI update' },
  dhan:      { name:'Dhan',            android:'co.dhan.app',                ios:'1537691053', news_query:'Dhan app new feature update' },
  paytm:     { name:'Paytm Money',     android:'com.paytmmoney',             ios:'1434861623', news_query:'Paytm Money app update' },
  fyers:     { name:'Fyers',           android:'com.fyers.fyers',            ios:'1501323399', news_query:'Fyers trading app update' },
  '5paisa':  { name:'5paisa',          android:'com.fivepaisas.trading',     ios:'1449278000', news_query:'5paisa app new feature' },
  mstock:    { name:'mStock',          android:'com.mirae.mstock',           ios:'1590000000', news_query:'mStock broker app update' },
  alice:     { name:'Alice Blue',      android:'in.aliceblue.mobile',        ios:'1500000000', news_query:'Alice Blue app UI update' },
  samco:     { name:'Samco',           android:'com.samco.samco_trade',      ios:'1510000000', news_query:'Samco trading app update' },
  // Full Service
  angel:     { name:'Angel One',       android:'com.msf.kite2',              ios:'1457545767', news_query:'Angel One app new feature' },
  hdfc:      { name:'HDFC Sky',        android:'com.hdfcsec.hdfcskyapp',     ios:'1600000000', news_query:'HDFC Sky app UI update' },
  icici:     { name:'ICICI Direct',    android:'com.icicisecurities.prime',  ios:'1398076574', news_query:'ICICI Direct app update' },
  kotak:     { name:'Kotak Neo',       android:'com.kotak.neoapp',           ios:'1610000000', news_query:'Kotak Neo app UI update' },
  sbi:       { name:'SBI Securities',  android:'com.sbisec.trading',         ios:'1620000000', news_query:'SBI Securities app update' },
  motilal:   { name:'Motilal Oswal',   android:'com.msfl.mofslmobileapp',    ios:'1450000000', news_query:'Motilal Oswal app new feature' },
  sharekhan: { name:'Sharekhan',       android:'com.sharekhan.android',      ios:'1420000000', news_query:'Sharekhan app UI update' },
  iifl:      { name:'IIFL Securities', android:'com.iiflsecurities.iimobile',ios:'1460000000', news_query:'IIFL Securities app update' },
  // Wealth
  indmoney:  { name:'INDmoney',        android:'com.indmoney',               ios:'1447420534', news_query:'INDmoney app new feature' },
};

async function searchNews(query, tavilyKey) {
  if (!tavilyKey) return [];
  try {
    const r = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: tavilyKey,
        query: `${query} 2025 UI UX design feature`,
        search_depth: 'basic',
        max_results: 3,
        include_domains: [
          'entrackr.com','inc42.com','moneycontrol.com','livemint.com',
          'economictimes.indiatimes.com','yourstory.com','medianama.com',
          'play.google.com','apps.apple.com'
        ],
      }),
    });
    if (!r.ok) return [];
    const d = await r.json();
    return (d.results || []).map(x => ({
      title: x.title || '',
      url: x.url || '',
      snippet: (x.content || '').slice(0, 250),
      source: new URL(x.url || 'https://x.com').hostname.replace('www.', ''),
      date: x.published_date || '',
    }));
  } catch(e) { return []; }
}

async function analyzeUpdates(brokerName, articles, claudeKey, pattern) {
  if (!claudeKey || articles.length === 0) return [];
  const context = articles.map(a => `[${a.title}] ${a.source}: ${a.snippet}`).join('\n');
  const prompt = `Extract the most important recent UI/UX update for ${brokerName}${pattern ? ` related to "${pattern}"` : ''}.

Articles:
${context}

Return ONLY a JSON array with max 2 items (no markdown):
[{"name":"update name max 60 chars","type":"ui or ux or feature","platform":"apk or web or both","impact":4,"desc":"what changed max 100 chars","adopt":"PL India tip max 80 chars","source":"source name","source_url":"url"}]
If nothing relevant found return [].`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': claudeKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 500, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!r.ok) return [];
    const d = await r.json();
    const text = d.content?.map(c => c.text || '').join('') || '';
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean.slice(clean.indexOf('['), clean.lastIndexOf(']') + 1));
  } catch(e) { return []; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const tavilyKey  = process.env.TAVILY_API_KEY || '';
  const claudeKey  = process.env.ANTHROPIC_API_KEY || '';

  // ── GET: return updates for one or all brokers ──
  if (req.method === 'GET') {
    const { broker, limit = 10, pattern } = req.query;
    const targetBrokers = broker
      ? (ALL_BROKERS[broker] ? [broker] : Object.keys(ALL_BROKERS))
      : Object.keys(ALL_BROKERS).slice(0, 4); // limit GET to 4 brokers

    const results = [];
    for (const key of targetBrokers) {
      const b = ALL_BROKERS[key];
      if (!b) continue;
      const articles = await searchNews(pattern ? `${b.name} ${pattern}` : b.news_query, tavilyKey);
      const updates  = await analyzeUpdates(b.name, articles, claudeKey, pattern);
      updates.forEach((u, i) => results.push({
        id: `${key}_${Date.now()}_${i}`,
        broker: key,
        broker_name: b.name,
        ...u,
        fetched_at: new Date().toISOString(),
        isNew: true,
        isAI: true,
        time: 'Just now',
      }));
    }
    return res.status(200).json({ updates: results.slice(0, parseInt(limit)), total: results.length, brokers_scanned: targetBrokers.length, timestamp: new Date().toISOString() });
  }

  // ── POST: custom query across selected brokers ──
  if (req.method === 'POST') {
    const { brokers = [], query = '', user_key } = req.body;
    const key = claudeKey || user_key || '';
    const targets = brokers.length > 0 ? brokers.filter(b => ALL_BROKERS[b]) : Object.keys(ALL_BROKERS).slice(0, 6);

    const results = [];
    for (const bKey of targets) {
      const b = ALL_BROKERS[bKey];
      if (!b) continue;
      const searchQ = query ? `${b.name} ${query}` : b.news_query;
      const articles = await searchNews(searchQ, tavilyKey);
      const updates  = await analyzeUpdates(b.name, articles, key, query);
      updates.forEach((u, i) => results.push({
        id: `${bKey}_${Date.now()}_${i}`,
        broker: bKey, broker_name: b.name, ...u,
        fetched_at: new Date().toISOString(), isNew: true, isAI: true, time: 'Just now',
      }));
    }
    return res.status(200).json({ updates: results, total: results.length, query, timestamp: new Date().toISOString() });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
