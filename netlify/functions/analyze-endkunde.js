// Netlify Function: analyze-endkunde.js
// Branchenanalyse für den Bot-Kosten-Rechner (Endkunden-Version)
// Erwartet POST: { branche: string, kennzahlen: { verloreneAnfragen, verlorenerUmsatz, noshows, bearbeitungsStd, reaktionFaktor, totalVerlust } }
// Gibt zurück:   { emoji, brancheNormiert, insight, bots[] }

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let branche, kennzahlen;
  try {
    const body = JSON.parse(event.body);
    branche    = body.branche    || '';
    kennzahlen = body.kennzahlen || {};
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'API key not configured' }) };
  }

  // Reaktionszeit als lesbarer Text
  const reaktionText =
    kennzahlen.reaktionFaktor <= 0.10 ? 'sofort' :
    kennzahlen.reaktionFaktor <= 0.25 ? 'noch am gleichen Tag' :
    'erst am nächsten Morgen';

  const prompt = `Du analysierst einen Betrieb in der Branche: "${branche}"

Berechnete Kennzahlen dieses Betriebs:
- Verlorene Anfragen/Monat: ${kennzahlen.verloreneAnfragen || '?'}
- Entgangener Umsatz/Monat: ${kennzahlen.verlorenerUmsatz || '?'} €
- No-Shows/Monat: ${kennzahlen.noshows || '?'}
- Manuelle Bearbeitungszeit: ${kennzahlen.bearbeitungsStd || '?'} Std/Monat
- Reaktionszeit: ${reaktionText}
- Gesamtverlust/Monat: ${kennzahlen.totalVerlust || '?'} €

Antworte NUR mit einem JSON-Objekt, ohne Markdown-Backticks, ohne Erklärungen:

{
  "emoji": "<ein passendes Emoji für die Branche>",
  "brancheNormiert": "<Branche sauber ausgeschrieben, z.B. 'Zahnarztpraxis' statt 'zahnarzt'>",
  "insight": "<1-2 Sätze, die konkret auf diese Branche eingehen. Nutze Prozent statt absoluter Zahlen. Kein Motivationssprech. Beispiel: 'In der Immobilienbranche entscheiden sich bis zu 70 % der Interessenten für den ersten Anbieter, der antwortet – wer hier wartet, verliert den Lead.'>",
  "bots": [
    {
      "icon": "<Emoji>",
      "name": "<Bot-Name>",
      "prio": <1, 2 oder 3>,
      "desc": "<Kurze, branchenspezifische Beschreibung was der Bot konkret tut>",
      "einsparung": "<Konkreter Nutzen, z.B. '3–5× mehr Google-Bewertungen'>"
    }
  ]
}

Regeln für die Bots:
- Empfehle 3–5 Bots die wirklich zu dieser Branche passen
- Immer dabei wenn sinnvoll: Terminbuchungs-Bot (📅), Review-Bot (⭐), Fragen & Support-Bot (💬)
- Fragen & Support-Bot ersetzt sowohl FAQ-Bot als auch Kunden-Support-Bot – nie beide separat empfehlen
- Vorqualifizierungs-Bot (🎯) NUR bei Branchen mit Beratungsgespräch/Erstgespräch (Coaches, Berater, Handwerker, Ärzte, Makler etc.) – NICHT bei Beautystudio, Restaurant, Einzelhandel, Fitnessstudio
- Missed Call Text Back NICHT empfehlen (Twilio-Nummer erforderlich, zu hohe Hürde)
- Prio 1 = sofortige, messbare Wirkung; Prio 2 = wichtig aber optional; Prio 3 = nice to have
- Terminbuchungs-Bot ist immer Prio 1 wenn die Branche Termine hat
- Beschreibungen sind konkret und branchenspezifisch, keine generischen Texte`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':         'application/json',
        'x-api-key':            apiKey,
        'anthropic-version':    '2023-06-01'
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data    = await response.json();
    const text    = data.content?.[0]?.text || '';
    const cleaned = text.replace(/```json|```/g, '').trim();
    const result  = JSON.parse(cleaned);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(result)
    };

  } catch (err) {
    console.error('analyze-endkunde error:', err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
