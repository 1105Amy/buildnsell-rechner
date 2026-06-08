exports.handler = async (event) => {

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Preflight
  if(event.httpMethod === 'OPTIONS'){
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if(event.httpMethod !== 'POST'){
    return { statusCode: 405, headers: corsHeaders, body: 'Method Not Allowed' };
  }

  const { branche } = JSON.parse(event.body || '{}');
  if(!branche) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({error:'Missing branche'}) };

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

  const prompt = 'Du bist ein DACH-Marktexperte fuer AI-Bot-Dienstleistungen. Antworte ausschliesslich mit validem JSON.\n\nAnalysiere die Branche: "' + branche + '"\n\nLiefere exakt dieses JSON-Objekt:\n{\n  "emoji": "passendes Emoji fuer die Branche",\n  "brancheNormiert": "saubere Bezeichnung auf Deutsch",\n  "brancheBeschreibung": "Ein Satz warum AI Bots hier sinnvoll sind (max 120 Zeichen)",\n  "anzahlBetriebe": Zahl,\n  "marktInsight": "Konkreter ueberraschender Fakt mit Zahl warum Betriebe Anfragen verlieren (max 160 Zeichen)",\n  "setupMin": Zahl,\n  "setupMax": Zahl,\n  "retainerMin": Zahl,\n  "retainerMax": Zahl,\n  "useCases": [\n    {"icon":"Emoji","titel":"max 5 Woerter","beschreibung":"Was der Bot konkret tut (max 100 Zeichen)","impact":"hoch oder mittel"}\n  ]\n}\n\nPreisregeln DACH:\n- Anwalt/Steuerberater/Arzt: setupMin 1500, setupMax 3500, retainerMin 397, retainerMax 697\n- Immobilien/Finance: setupMin 1200, setupMax 2500, retainerMin 297, retainerMax 547\n- Handwerk/Dienstleistung: setupMin 800, setupMax 1800, retainerMin 247, retainerMax 447\n- Lifestyle/Beauty/Fitness: setupMin 400, setupMax 900, retainerMin 147, retainerMax 297\n- Restaurant/Gastronomie: setupMin 500, setupMax 1000, retainerMin 147, retainerMax 247\nExakt 4 Use Cases. Nur JSON, kein Text davor oder danach.';

  try{
    const res = await fetch('https://api.anthropic.com/v1/messages',{
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await res.json();
    const text = data.content?.[0]?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(parsed),
    };
  }catch(e){
    console.error('API error:', e);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: e.message }),
    };
  }
};
