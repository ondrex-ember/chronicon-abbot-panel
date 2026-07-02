import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";

dotenv.config();

// Initialize Gemini SDK safely
let ai: GoogleGenAI | null = null;
try {
  if (process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  } else {
    console.warn("GEMINI_API_KEY is not defined. AI generation will not be active.");
  }
} catch (err) {
  console.error("Failed to initialize Gemini SDK:", err);
}

// Fallback catalog books in case GitHub is unreachable
const fallbackBooks = [
  {
    id: "book_biblia_pauperum",
    title: "Biblia Pauperum",
    category: "history",
    unlockDay: 15,
    icon: "📕",
    author: "Neznámý autor, rytiny blokové knihy",
    year: "1465",
    content: "**Biblia pauperum** neboli Bible chudých jest souborem biblických výjevů doplňujících texty Písma svatého. Spojuje příběhy Starého i Nového zákona, aby prostému lidu i chudým klerikům přiblížila tajemství vykoupení.\n\n*Každá strana nese středový obraz ze života Kristova, obklopený dvěma starozákonními předobrazy a proroctvími proroků.*",
    titleEn: "Biblia Pauperum",
    authorEn: "Unknown Author, block book engravings",
    contentEn: "**Biblia pauperum**, or Bible of the Poor, is a collection of biblical scenes supplementing the scriptures. It connects Old and New Testament stories to explain the mystery of redemption to commoners and poor clerics.\n\n*Each page carries a central image from Christ's life, flanked by two Old Testament prefigurations and prophetic utterances.*"
  },
  {
    id: "book_chronica_bohemorum",
    title: "Kronika Trojanů",
    category: "local",
    unlockDay: 30,
    icon: "📜",
    author: "Guido de Columnis, tisk v Plzni",
    year: "1468",
    content: "**Kronika Trojanů** jest prvním známým knihtiskem na území Království českého. Vypráví o slavném dobývání města Tróje, hrdinství reka Hektora a lstivosti Řeků s jejich dřevěným koněm.\n\n*Vytištěno písmem bastardním v dílně plzeňského tiskaře, jehož jméno zůstává skryto v mlze dějin.*",
    titleEn: "Chronicle of the Trojans",
    authorEn: "Guido de Columnis, printed in Pilsen",
    contentEn: "**Chronicle of the Trojans** is the first known printed book in the Kingdom of Bohemia. It tells the story of the fall of Troy, Hector's valor, and the cunning Greeks with their wooden horse.\n\n*Printed in bastarda script in the workshop of a Pilsen printer whose name remains veiled in the mists of history.*"
  },
  {
    id: "book_de_revolutionibus",
    title: "De revolutionibus orbium coelestium",
    category: "innovation",
    unlockDay: 120,
    icon: "🧪",
    author: "Mikołaj Kopernik",
    year: "1543",
    content: "**O obězích sfér nebeských** přináší odvážné učení heliocentralismu. Slunce, nikoli Země, jest středem všehomíra, a planety kolem něj krouží v dokonalých sférách.\n\n*Spis, jenž otřásl pilíři scholastické kosmolgie a změnil pohled člověka na řád stvoření.*",
    titleEn: "On the Revolutions of the Heavenly Spheres",
    authorEn: "Nicolaus Copernicus",
    contentEn: "**On the Revolutions of the Heavenly Spheres** presents the bold theory of heliocentrism. The Sun, not the Earth, lies at the center of the universe, and planets revolve around it in perfect spheres.\n\n*A work that shook the pillars of scholastic cosmology and transformed humanity's view of the created order.*"
  }
];

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // ── AUTH — session token store (in-memory, expiry 8h) ──────────────────────
  const activeSessions = new Map<string, number>(); // token → expiresAt
  const SESSION_TTL = 8 * 60 * 60 * 1000; // 8h

  const generateToken = () =>
    Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

  const isValidToken = (token: string | undefined): boolean => {
    if (!token) return false;
    const exp = activeSessions.get(token);
    if (!exp) return false;
    if (Date.now() > exp) { activeSessions.delete(token); return false; }
    return true;
  };

  app.post("/api/auth/login", (req, res) => {
    const { password } = req.body || {};
    const expected = process.env.ADMIN_PASSWORD;
    if (!expected) return res.status(500).json({ error: "ADMIN_PASSWORD not configured." });
    if (password !== expected) return res.status(401).json({ error: "Nesprávné heslo." });
    const token = generateToken();
    activeSessions.set(token, Date.now() + SESSION_TTL);
    return res.json({ success: true, token });
  });

  app.post("/api/auth/logout", (req, res) => {
    const token = req.headers["x-admin-token"] as string;
    if (token) activeSessions.delete(token);
    return res.json({ success: true });
  });

  app.get("/api/auth/verify", (req, res) => {
    const token = req.headers["x-admin-token"] as string;
    return res.json({ valid: isValidToken(token) });
  });
  // ── END AUTH ────────────────────────────────────────────────────────────────

  // API Route: Fetch Catalog from GitHub (with fallback)
  app.get("/api/fetch-catalog", async (req, res) => {
    try {
      // We attempt to fetch library.js and en.js from GitHub
      const libUrl = "https://raw.githubusercontent.com/ondrex-ember/scriptorium/main/scriptorium/src/data/library.js";
      const enUrl = "https://raw.githubusercontent.com/ondrex-ember/scriptorium/main/scriptorium/src/i18n/en.js";

      const [libRes, enRes] = await Promise.all([
        fetch(libUrl).catch(() => null),
        fetch(enUrl).catch(() => null)
      ]);

      if (!libRes || !libRes.ok || !enRes || !enRes.ok) {
        console.warn("Could not fetch library or language files from GitHub. Using fallbacks.");
        return res.json({ source: "fallback", books: fallbackBooks });
      }

      const libText = await libRes.text();
      const enText = await enRes.text();

      // Simple parse of books from library.js
      // library.js format is: const library_lore = [ { id: 'book_x', ... }, ... ]
      // Let's extract book blocks using regex or clean text splits
      const books: any[] = [];
      
      // Extract JS blocks that resemble { id: 'book_...' }
      // We look for objects starting with id: 'book_
      const bookRegex = /\{\s*id:\s*'([a-zA-Z0-9_-]+)'[\s\S]*?\}/g;
      const blocks = libText.match(/\{\s*id:\s*'book_[\s\S]*?\}/g) || [];

      // Simple regex helpers to parse fields
      const getField = (block: string, field: string) => {
        const regex = new RegExp(`${field}:\\s*(?:'([^']*)'|([^,}\n]*))`);
        const m = block.match(regex);
        if (!m) return "";
        return m[1] || m[2] || "";
      };

      const getContent = (block: string) => {
        // Content is often wrapped in backticks ``
        const match = block.match(/content:\s*`([\s\S]*?)`/);
        return match ? match[1] : "";
      };

      // Also parse English translations from en.js
      // en.js has: book_id: { title: "...", author: "...", content: `...` }
      const parseEnTranslations = (text: string) => {
        const trans: Record<string, { title: string; author: string; content: string }> = {};
        // Match: book_id: { ... }
        const regex = /(book_[a-zA-Z0-9_-]+):\s*\{\s*title:\s*(["'`])([\s\S]*?)\2,\s*author:\s*(["'`])([\s\S]*?)\4,\s*content:\s*`([\s\S]*?)`/g;
        let match;
        while ((match = regex.exec(text)) !== null) {
          trans[match[1]] = {
            title: match[3],
            author: match[5],
            content: match[6]
          };
        }
        return trans;
      };

      const enTrans = parseEnTranslations(enText);

      for (const block of blocks) {
        const id = getField(block, "id").trim();
        if (!id) continue;

        const title = getField(block, "title").trim();
        const category = getField(block, "category").trim();
        const unlockDay = parseInt(getField(block, "unlockDay")) || 10;
        const icon = getField(block, "icon").trim();
        const author = getField(block, "author").trim();
        const year = getField(block, "year").trim().replace(/['"`]/g, "");
        const content = getContent(block);

        const eng = enTrans[id] || { title: "", author: "", content: "" };

        books.push({
          id,
          title,
          category,
          unlockDay,
          icon: icon || "📕",
          author,
          year,
          content,
          titleEn: eng.title,
          authorEn: eng.author,
          contentEn: eng.content
        });
      }

      if (books.length === 0) {
        console.warn("Parsed 0 books from GitHub files, defaulting to fallbacks.");
        return res.json({ source: "fallback", books: fallbackBooks });
      }

      return res.json({ source: "github", books });
    } catch (error: any) {
      console.error("Error fetching/parsing Scriptorium catalog:", error);
      return res.json({ source: "fallback", books: fallbackBooks, error: error.message });
    }
  });

  // API Route: Generate Book using Gemini with HIGH Thinking
  app.post("/api/generate-book", async (req, res) => {
    if (!ai) {
      return res.status(500).json({ error: "Gemini API client is not initialized. Please ensure GEMINI_API_KEY is provided in settings." });
    }

    const { title, category, year, language, promptGuideline } = req.body;

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

    try {
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
      return res.json({ success: true, book: generatedBook });
    } catch (error: any) {
      console.error("Failed to generate book with Gemini:", error);
      return res.status(500).json({ error: error.message || "Failed to generate book." });
    }
  });

  // --- CHRONICON API ENDPOINTS ---

  // API Route: Fetch Chronicon Snapshot from GitHub (with simulation fallback)
  app.get("/api/fetch-chronicon-snapshot", async (req, res) => {
    try {
      const snapshotUrl = "https://raw.githubusercontent.com/ondrex-ember/chronicon/main/data/chronicon_snapshot.json";
      const response = await fetch(snapshotUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch chronicon snapshot: ${response.statusText}`);
      }
      const data = await response.json();
      return res.json({ success: true, source: "github", snapshot: data });
    } catch (error: any) {
      console.warn("Could not fetch Chronicon snapshot from GitHub, generating realistic local simulation data:", error.message);
      
      const mockSnapshot = {
        version: 2,
        generated: new Date().toISOString(),
        valid_until: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
        abbot: {
          name: "Bratr Augustin",
          mood: "klidný",
          virtue: 7,
          portrait: null,
          scrinium_open: true,
          message: "Blahoslavení milosrdní, neboť oni milosrdenství dojdou. Dbejte na čistotu pergamenů a ostrost brků, bratři."
        },
        unlockFlag: null,
        weather: {
          key: "clear",
          name: "Jasno a slunečno",
          icon: "☀️",
          desc: "Obloha je bez mráčku, slunce pálí a ohřívá kamenné zdi kláštera.",
          season: 2,
          modifier_grain: 1.2,
          modifier_wood: 1.0
        },
        time: {
          year: 1465,
          season: 2,
          season_name: "Léto",
          season_icon: "🌿",
          day: 42,
          total_tick: 168,
          date_string: "1. července 1465"
        },
        actors: {
          monastery: { mood: 78, wealth: 62, piety: 85 },
          vesnicane: { mood: 65, stores: 50 },
          valach: { mood: 80, herd: 45 },
          inkvizitor: { active: false, tension: 12 }
        },
        resources: {
          grain: 245,
          wood: 180,
          grose: 412,
          piety: 320
        },
        chronicle: [
          {
            tick: 168,
            day: 42,
            text: "Bratr Augustin udělil požehnání ranním pracím v zahradě. Byl v neobyčejně klidném rozpoložení.",
            source: "monastery_internal",
            source_label: "Abbot Augustin"
          },
          {
            tick: 167,
            day: 41,
            text: "Z Olomouce přišla zpráva o novém dekretu městské rady ohledně prodeje piva na náměstí.",
            source: "local_events",
            source_label: "Městský písař"
          },
          {
            tick: 166,
            day: 41,
            text: "Kočovníci na valašských pastvinách hlásí narození trojčat u nejlepší ovce ze stáda.",
            source: "local_events",
            source_label: "Valaši"
          },
          {
            tick: 165,
            day: 40,
            text: "Krakovský kardinál zaslal list s prosbou o opis starého spisu sv. Augustina.",
            source: "distant_events",
            source_label: "Krakov"
          }
        ],
        chronicle_local: [
          {
            tick: 168,
            day: 42,
            text: "Bratr Augustin udělil požehnání ranním pracím v zahradě. Byl v neobyčejně klidném rozpoložení.",
            source: "monastery_internal",
            source_label: "Abbot Augustin"
          },
          {
            tick: 167,
            day: 41,
            text: "Z Olomouce přišla zpráva o novém dekretu městské rady ohledně prodeje piva na náměstí.",
            source: "local_events",
            source_label: "Městský písař"
          }
        ],
        chronicle_distant: [
          {
            tick: 165,
            day: 40,
            text: "Krakovský kardinál zaslal list s prosbou o opis starého spisu sv. Augustina.",
            source: "distant_events",
            source_label: "Krakov"
          }
        ],
        church_calendar: {
          day_of_year: 182,
          season: "Léto",
          season_icon: "🌿",
          year: 1465,
          note: "Sv. Prokop, opat sázavský"
        }
      };
      return res.json({ success: true, source: "mock", snapshot: mockSnapshot });
    }
  });

  // API Route: Fetch Chronicon Event database from GitHub (with offline fallback)
  app.get("/api/fetch-chronicon-events", async (req, res) => {
    try {
      const urls = {
        local: "https://raw.githubusercontent.com/ondrex-ember/chronicon/main/narrative/local_events_v1.json",
        distant: "https://raw.githubusercontent.com/ondrex-ember/chronicon/main/narrative/distant_events_v1.json",
        monastery: "https://raw.githubusercontent.com/ondrex-ember/chronicon/main/narrative/monastery_internal_v1.json"
      };

      const fetchJson = async (url: string) => {
        const response = await fetch(url).catch(() => null);
        if (response && response.ok) {
          return response.json();
        }
        return null;
      };

      const [local, distant, monastery] = await Promise.all([
        fetchJson(urls.local),
        fetchJson(urls.distant),
        fetchJson(urls.monastery)
      ]);

      const result: any = {
        source: "github",
        local: local || [],
        distant: distant || [],
        monastery: monastery || []
      };

      if (!local && !distant && !monastery) {
        result.source = "fallback";
        result.local = [
          { id: "loc_001", text: "V Olomouci se šíří řeči o podivném kometárním tělesu, jež bylo spatřeno nad věží chrámu sv. Václava. Lidé mají strach z moru.", source: "local_events", source_label: "Olomoucké pověsti" },
          { id: "loc_002", text: "Trhovci si stěžují, že výběrčí cla na Holické bráně požadují vyšší poplatky za dovoz soli.", source: "local_events", source_label: "Holická brána" },
          { id: "loc_003", text: "Na břehu Moravy byl nalezen utonulý mlynářský tovaryš. Rychtář vyšetřuje, zda nešlo o mord.", source: "local_events", source_label: "Úřad rychtáře" }
        ];
        result.distant = [
          { id: "dist_001", text: "Z Říma přicházejí zvěsti, že Svatý otec plánuje vyhlásit novou křížovou výpravu proti nevěřícím na východě.", source: "distant_events", source_label: "Římská kurie" },
          { id: "dist_002", text: "V Benátkách vypukl požár v přístavním skladišti koření. Ceny pepře a skořice v celé Evropě raketově rostou.", source: "distant_events", source_label: "Benátky" }
        ];
        result.monastery = [
          { id: "mon_001", text: "Sklepník bratr Bernard hlásí, že sudy s loňským mešním vínem začínají kysnout. Navrhuje je rychle spotřebovat.", source: "monastery_internal", source_label: "Klášterní sklep" },
          { id: "mon_002", text: "V noci byl v ambitu spatřen stín. Někteří novici šeptají o přízraku zakladatele kláštera, jiní o toulavé kočce.", source: "monastery_internal", source_label: "Ambit" }
        ];
      }

      return res.json({ success: true, ...result });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  // API Route: Generate Abbot Message using Gemini
  app.post("/api/generate-abbot-message", async (req, res) => {
    if (!ai) {
      return res.status(500).json({ error: "Gemini API client is not initialized." });
    }

    const { abbotName, abbotMood, abbotVirtue, topic } = req.body;

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

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: userPrompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              messageCs: { type: Type.STRING, description: "Authentic Czech medieval decree from the Abbot." },
              messageEn: { type: Type.STRING, description: "Elegant English translation of the decree in biblical/high tone." }
            },
            required: ["messageCs", "messageEn"]
          }
        }
      });

      const text = response.text;
      if (!text) throw new Error("Empty response from Gemini.");

      const parsed = JSON.parse(text.trim());
      return res.json({ success: true, ...parsed });
    } catch (error: any) {
      console.error("Failed to generate Abbot message:", error);
      return res.status(500).json({ error: error.message });
    }
  });


  // Vite middleware setup for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
