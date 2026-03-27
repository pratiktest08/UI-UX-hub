// api/broker-updates.js — YOUR OWN BROKER UI/UX UPDATE API
// Sources: App Store changelogs + news sites (Entrackr, Inc42, Moneycontrol, Livemint)
// GET  /api/broker-updates?broker=zerodha&limit=5
// POST /api/broker-updates  { brokers:[], query:'', user_key:'' }

const BROKERS = {
  zerodha:   {name:'Zerodha Kite',    query:'Zerodha Kite app new feature update 2025'},
  groww:     {name:'Groww',           query:'Groww app new feature UI update 2025'},
  upstox:    {name:'Upstox',          query:'Upstox app UI UX update 2025'},
  dhan:      {name:'Dhan',            query:'Dhan app new feature update 2025'},
  paytm:     {name:'Paytm Money',     query:'Paytm Money app update 2025'},
  fyers:     {name:'Fyers',           query:'Fyers trading app update 2025'},
  '5paisa':  {name:'5paisa',          query:'5paisa app new feature 2025'},
  mstock:    {name:'mStock',          query:'mStock Mirae broker app update 2025'},
  alice:     {name:'Alice Blue',      query:'Alice Blue ANT app update 2025'},
  samco:     {name:'Samco',           query:'Samco trading app new feature 2025'},
  angel:     {name:'Angel One',       query:'Angel One app new feature update 2025'},
  hdfc:      {name:'HDFC Sky',        query:'HDFC Sky trading app update 2025'},
  icici:     {name:'ICICI Direct',    query:'ICICI Direct app new feature 2025'},
  kotak:     {name:'Kotak Neo',       query:'Kotak Neo trading app update 2025'},
  sbi:       {name:'SBI Securities',  query:'SBI Securities Yono app update 2025'},
  axis:      {name:'Axis Direct',     query:'Axis Direct app update 2025'},
  motilal:   {name:'Motilal Oswal',   query:'Motilal Oswal MO Investor app update 2025'},
  sharekhan: {name:'Sharekhan',       query:'Sharekhan app new feature 2025'},
  iifl:      {name:'IIFL Securities', query:'IIFL markets app update 2025'},
  reliance:  {name:'Reliance Money',  query:'Reliance Securities app update 2025'},
  indmoney:  {name:'INDmoney',        query:'INDmoney app new feature update 2025'},
  nirmal:    {name:'Nirmal Bang',     query:'Nirmal Bang app update 2025'},
  share:     {name:'Share.Market',    query:'Share.Market app new feature 2025'},
  wisdom:    {name:'Wisdom Capital',  query:'Wisdom Capital app update 2025'},
  finvasia:  {name:'Finvasia',        query:'Finvasia Shoonya app update 2025'},
  trade:     {name:'Tradejini',       query:'Tradejini app update 2025'},
};

async function searchNews(query, tavilyKey) {
  if (!tavilyKey) return [];
  try {
    const r = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        api_key: tavilyKey, query, search_depth:'basic', max_results:4,
        include_domains:['entrackr.com','inc42.com','moneycontrol.com','livemint.com',
          'economictimes.indiatimes.com','yourstory.com','medianama.com',
          'play.google.com','apps.apple.com'],
      }),
    });
    if (!r.ok) return [];
    const d = await r.json();
    return (d.results||[]).map(x=>({
      title: x.title||'', url: x.url||'',
      snippet: (x.content||'').slice(0,300),
      source: new URL(x.url||'https://x.com').hostname.replace('www.',''),
      date: x.published_date||'',
    }));
  } catch(e){ return []; }
}

async function analyzeWithClaude(brokerName, articles, claudeKey, pattern) {
  if (!claudeKey || articles.length===0) return [];
  const ctx = articles.map(a=>`[${a.title}] ${a.source}: ${a.snippet}`).join('\n');
  const prompt = `Extract the most important recent UI/UX updates for ${brokerName}${pattern?` about "${pattern}"`:''}.\nArticles:\n${ctx}\nReturn ONLY a JSON array max 2 items (no markdown):\n[{"name":"max 60 chars","type":"ui or ux or feature","platform":"apk or web or both","impact":4,"desc":"max 100 chars","adopt":"PL India tip max 80 chars","source":"source name","source_url":"url"}]\nIf nothing relevant, return [].`;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':claudeKey,'anthropic-version':'2023-06-01'},
      body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:500,messages:[{role:'user',content:prompt}]}),
    });
    if (!r.ok) return [];
    const d = await r.json();
    const text = d.content?.map(c=>c.text||'').join('')||'';
    const clean = text.replace(/```json|```/g,'').trim();
    return JSON.parse(clean.slice(clean.indexOf('['),clean.lastIndexOf(']')+1));
  } catch(e){ return []; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if (req.method==='OPTIONS') return res.status(200).end();

  const tavilyKey  = process.env.TAVILY_API_KEY||'';
  const claudeKey  = process.env.ANTHROPIC_API_KEY||'';

  if (req.method==='GET') {
    const {broker, limit=10, pattern} = req.query;
    const targets = broker
      ? (BROKERS[broker]?[broker]:[])
      : Object.keys(BROKERS).slice(0,4); // limit to 4 for GET
    const results=[];
    for (const key of targets) {
      const b=BROKERS[key]; if(!b) continue;
      const q = pattern?`${b.name} ${pattern} 2025`:b.query;
      const articles = await searchNews(q, tavilyKey);
      const updates  = await analyzeWithClaude(b.name, articles, claudeKey, pattern||'');
      updates.forEach((u,i)=>results.push({id:`${key}_${Date.now()}_${i}`,broker:key,broker_name:b.name,...u,fetched_at:new Date().toISOString(),isNew:true,isAI:true,time:'Just now'}));
    }
    return res.status(200).json({updates:results.slice(0,parseInt(limit)),total:results.length,timestamp:new Date().toISOString()});
  }

  if (req.method==='POST') {
    const {brokers=[],query='',user_key} = req.body;
    const key = claudeKey||user_key||'';
    const targets = brokers.length>0 ? brokers.filter(b=>BROKERS[b]) : Object.keys(BROKERS).slice(0,5);
    const results=[];
    for (const bKey of targets) {
      const b=BROKERS[bKey]; if(!b) continue;
      const q = query?`${b.name} ${query} 2025`:b.query;
      const articles = await searchNews(q, tavilyKey);
      const updates  = await analyzeWithClaude(b.name, articles, key, query);
      updates.forEach((u,i)=>results.push({id:`${bKey}_${Date.now()}_${i}`,broker:bKey,broker_name:b.name,...u,fetched_at:new Date().toISOString(),isNew:true,isAI:true,time:'Just now'}));
    }
    return res.status(200).json({updates:results,total:results.length,query,timestamp:new Date().toISOString()});
  }
  return res.status(405).json({error:'Method not allowed'});
}
