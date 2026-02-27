// netlify/functions/analyze.js
// Netlify Function – hält den Anthropic API Key serverseitig

exports.handler = async function(event) {
  // Nur POST erlaubt
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // CORS Header – wichtig damit der Browser die Anfrage durchlässt
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  let branche;
  try {
    const body = JSON.parse(event.body);
    branche = body.branche?.trim();
    if (!branche) throw new Error('no branche');
  } catch(e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Branche fehlt' }) };
  }

  // API Key kommt aus Netlify Environment Variable – niemals im Code!
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'API Key nicht konfiguriert' }) };
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `Du bist Experte für AI Automation Bots (Conversation AI + Voice AI).
Analysiere die Branche: "${branche}"

Antworte NUR mit validem JSON – kein Text davor oder danach:
{
  "emoji": "ein passendes Emoji",
  "brancheNormiert": "Klarer Branchenname auf Deutsch",
  "brancheBeschreibung": "Ein prägnanter Satz warum AI Bots hier besonders wertvoll sind",
  "anzahlBetriebe": Zahl (geschätzte Betriebe DACH),
  "marktreife": "hoch" | "mittel" | "niedrig",
  "useCases": [
    {
      "icon": "Emoji",
      "titel": "Maximal 5 Wörter",
      "beschreibung": "Was der Bot konkret tut – ein prägnanter Satz",
      "impact": "hoch" | "mittel"
    }
  ],
  "marktInsight": "1-2 Sätze: Der konkrete Pain Point dieser Branche der AI Bots so wertvoll macht."
}
Genau 4 Use Cases. Fokus auf: Terminbuchung, Missed Call Text Back, FAQ-Automatisierung, Follow-up, Lead-Qualifizierung, Review-Automation.`
        }]
      })
    });

    const data = await res.json();
    const raw  = data.content?.find(b => b.type === 'text')?.text || '';
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Kein JSON in Antwort');

    const parsed = JSON.parse(match[0]);
    return { statusCode: 200, headers, body: JSON.stringify(parsed) };

  } catch(e) {
    console.error('API Error:', e.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Analyse fehlgeschlagen', details: e.message })
    };
  }
};
