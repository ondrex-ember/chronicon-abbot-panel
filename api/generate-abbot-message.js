import { GoogleGenAI } from "@google/genai";

export default async function handler(req, res) {
  // CORS configuration to allow Vercel or local host
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { abbotName, abbotMood, abbotVirtue, topic } = req.body;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY environment variable is not defined in settings.' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const systemInstruction = `You are Abbot ${abbotName || "Augustin"}, head of the Scriptorium monastery in 1465 Bohemia.
Your virtue rating is ${abbotVirtue || 7} out of 10, and your current mood is "${abbotMood || "klidný"}".
You must write a holy decree or Abbot message ("golden news from the Abbot") to your monks and the world.
The message must be returned strictly in JSON format with two keys:
- "messageCs": A beautifully authentic Czech message, written in elegant medieval, highly poetic, monastic style (in Czech).
- "messageEn": An equally evocative, King James / high-middle-English style translation.

Make the message incredibly rich, full of historical depth, theological vocabulary, and specific monastic context matching your current mood and virtue.
If your virtue is high, speak with absolute benevolence and biblical references. If low, be more stern, material, or critical.`;

    const userPrompt = `Draft a decree / abbot message on the following topic: "${topic || "Pochvala za věrnou práci na opisech"}".
Remember to match your current mood ("${abbotMood}") and virtue ("${abbotVirtue}").`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: userPrompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            messageCs: { type: "STRING" },
            messageEn: { type: "STRING" }
          },
          required: ["messageCs", "messageEn"]
        }
      }
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error("Empty response from Gemini.");
    }

    const result = JSON.parse(responseText.trim());
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("Failed to generate abbot decree with Gemini:", error);
    return res.status(500).json({ error: error.message || "Failed to generate decree." });
  }
}
