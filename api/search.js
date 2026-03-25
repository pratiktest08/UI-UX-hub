// api/search.js — Live broker UI/UX news fetcher using Tavily AI Search

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { query, broker, type = 'news' } = req.body;
    const tavilyKey = process.env.TAVILY_API_KEY || '';

    if (!tavilyKey) {
      return res.status(401).json({ error: 'TAVILY_API_KEY not set in Vercel Environment Variables' });
    }

    // Build smart search queries for broker UI/UX updates
    const buildQueries = (broker, query) => {
      const brokerMap = {
        zerodha: 'Zerodha Kite',
        groww: 'Groww app',
        upstox: 'Upstox',
        dhan: 'Dhan app',
        angel: 'Angel One',
        indmoney: 'INDmoney',
        paytm: 'Paytm Money',
        fyers: 'Fyers',
      };
      const brokerName = brokerMap[broker] || broker || 'Indian stock broker';
      if (query) return `${brokerName} ${query} UI UX update 2025`;
      return `${brokerName} new feature UI UX update app 2025`;
    };

    const searchQuery = buildQueries(broker, query);

    // Call Tavily Search API
    const tavilyRes = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: tavilyKey,
        query: searchQuery,
        search_depth: 'advanced',
        include_answer: true,
        include_raw_content: false,
        max_results: 5,
        include_domains: [
          'entrackr.com', 'inc42.com', 'moneycontrol.com',
          'economictimes.indiatimes.com', 'livemint.com',
          'techcrunch.com', 'yourstory.com', 'medianama.com',
          'blog.zerodha.com', 'dhan.co', 'angelone.in',
          'play.google.com', 'apps.apple.com'
        ],
      }),
    });

    if (!tavilyRes.ok) {
      const err = await tavilyRes.json();
      return res.status(tavilyRes.status).json({ error: err?.message || 'Tavily API error' });
    }

    const tavilyData = await tavilyRes.json();

    // Format results for our app
    const results = (tavilyData.results || []).map(r => ({
      title: r.title || '',
      url: r.url || '',
      content: r.content || '',
      score: r.score || 0,
      published_date: r.published_date || '',
      source: new URL(r.url || 'https://unknown.com').hostname.replace('www.', ''),
    }));

    return res.status(200).json({
      query: searchQuery,
      answer: tavilyData.answer || '',
      results,
      total: results.length,
    });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
