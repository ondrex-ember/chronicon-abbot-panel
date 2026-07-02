import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";

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

  const { title, category, year, promptGuideline } = req.body;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY environment variable is not defined in settings.' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const systemInstruction = `You are an expert medieval monastic chronicler and translator living in 1490.
You write beautifully authentic medieval manuscripts.
You must return your output strictly in JSON format matching the requested schema.
The book should have rich, historically accurate details.
For Czech language text (titleCs, authorCs, contentCs), use authentic-sounding Old Czech or poetic Czech, fitting of medieval manuscripts.
For English language text (titleEn, authorEn, contentEn), use stately King James or high-middle-English styling.
The content should be divided into chapters or dramatic narrative blocks, utilizing markdown formatting like **Chapter I** or **On the Creation**.
Ensure that the book ID starts with "book_" and matches the title (using lowercase and underscores, e.g. "book_chronica_silesiae").`;

    const userPrompt = `Generate a complete medieval book entry.
Details requested:
- Target Title Idea: ${title || "A mystical or historical book"}
- Category of study: ${category || "history"} (One of: history, innovation, conflict, local, special)
- Suggested year: ${year || "1485"}
- Primary focus / custom guidelines: ${promptGuideline || "Write an intriguing narrative about medieval mysteries, monkish daily struggles, botanical alchemy, or chronicles."}

Please output the book matching the requested schema. Ensure contentCs and contentEn are rich and multiple paragraphs long, reflecting deep medieval lore.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: userPrompt,
      config: {
        systemInstruction,
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.HIGH
        },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING, description: "A unique book ID starting with 'book_', e.g., 'book_chronica_silesiae'." },
            category: { type: Type.STRING, description: "One of: history, innovation, conflict, local, special" },
            unlockDay: { type: Type.INTEGER, description: "Unlock day in Scriptorium game from 10 to 180" },
            icon: { type: Type.STRING, description: "A single medieval-themed emoji, e.g. 📜, 📕, ⛪, 🛡️, 🧪" },
            year: { type: Type.STRING, description: "Year of publication/writing, e.g. '1482'" },
            titleCs: { type: Type.STRING, description: "Czech title of the book, in poetic historical tone" },
            authorCs: { type: Type.STRING, description: "Czech description of author/printer/patrons" },
            contentCs: { type: Type.STRING, description: "Immersive Czech book content. Markdown supported." },
            titleEn: { type: Type.STRING, description: "English translation of the title" },
            authorEn: { type: Type.STRING, description: "English translation of the author description" },
            contentEn: { type: Type.STRING, description: "Immersive English book content, monastic style. Markdown supported." }
          },
          required: ["id", "category", "unlockDay", "icon", "year", "titleCs", "authorCs", "contentCs", "titleEn", "authorEn", "contentEn"]
        }
      }
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error("Empty response from Gemini.");
    }

    const generatedBook = JSON.parse(responseText.trim());
    return res.status(200).json({ success: true, book: generatedBook });
  } catch (error) {
    console.error("Failed to generate book with Gemini:", error);
    return res.status(500).json({ error: error.message || "Failed to generate book." });
  }
}
