import React, { useState, useEffect, useRef } from "react";
import { 
  BookOpen, 
  Sparkles, 
  Scroll, 
  Clock, 
  Search, 
  Copy, 
  Plus, 
  Trash2, 
  Volume2, 
  VolumeX, 
  Compass, 
  Flame, 
  Languages, 
  CornerDownRight, 
  BookMarked,
  RotateCcw
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Book, CATEGORIES, CategoryType } from "./types";
import ChroniconAdmin from "./components/ChroniconAdmin";
import LoginScreen from "./components/LoginScreen";

export default function App() {
  // Auth
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const token = sessionStorage.getItem("abbot_token");
    if (!token) { setAuthChecked(true); return; }
    // Verify token je stale platny
    fetch("/api/auth/verify", { headers: { "x-admin-token": token } })
      .then(r => r.json())
      .then(data => {
        if (data.valid) setAuthToken(token);
        else sessionStorage.removeItem("abbot_token");
      })
      .catch(() => {})
      .finally(() => setAuthChecked(true));
  }, []);

  // App States
  const [books, setBooks] = useState<Book[]>([]);
  const [activeMainTab, setActiveMainTab] = useState<"scriptorium" | "chronicon">("scriptorium");
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [activeLang, setActiveLang] = useState<"cs" | "en">("cs");
  
  // Search & Filters
  const [searchTerm, setSearchSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("");

  // Editor State
  const [editorMode, setEditorMode] = useState<"manual" | "ai">("ai");
  const [formId, setFormId] = useState("");
  const [formTitleCs, setFormTitleCs] = useState("");
  const [formAuthorCs, setFormAuthorCs] = useState("");
  const [formContentCs, setFormContentCs] = useState("");
  const [formTitleEn, setFormTitleEn] = useState("");
  const [formAuthorEn, setFormAuthorEn] = useState("");
  const [formContentEn, setFormContentEn] = useState("");
  const [formCategory, setFormCategory] = useState<CategoryType>("history");
  const [formUnlockDay, setFormUnlockDay] = useState<number>(30);
  const [formIcon, setFormIcon] = useState<string>("📕");
  const [formYear, setFormYear] = useState<string>("1485");

  // AI Prompt Guidance
  const [aiPromptGuideline, setAiPromptGuideline] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);

  // Monastic Ambience States
  const [monkVigor, setMonkVigor] = useState(100);
  const [canonicalHourIndex, setCanonicalHourIndex] = useState(4); // Start at Sext (Midday)
  const [isMuted, setIsMuted] = useState(true);
  const [catHappiness, setCatHappiness] = useState(80);
  const [catMessage, setCatCatMessage] = useState("Kocour Barnabáš spokojeně přede na hromádce prázdných pergamenů.");
  
  // Toast notification
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // Audio Context Ref for synthesized ambient sounds
  const audioCtxRef = useRef<AudioContext | null>(null);
  const ambientOscRef = useRef<OscillatorNode | null>(null);
  const ambientGainRef = useRef<GainNode | null>(null);

  // Canonical hours definitions
  const canonicalHours = [
    { name: "Matutina", time: "02:00", description: "Matins - Hluboká noc. Čas ticha a rozjímání.", icon: "🌌" },
    { name: "Laudes", time: "05:00", description: "Lauds - Jitřní chvály. První paprsky slunce nad klášterem.", icon: "🌅" },
    { name: "Prima", time: "06:00", description: "Prime - První hodina. Ranní modlitba před prací.", icon: "☀️" },
    { name: "Tertia", time: "09:00", description: "Terce - Třetí hodina. Práce v zahradě a opisování textů.", icon: "🕊️" },
    { name: "Sexta", time: "12:00", description: "Sext - Poledne. Krátký odpočinek, čas na kousek sýra.", icon: "🔔" },
    { name: "Nona", time: "15:00", description: "None - Devátá hodina. Nejvyšší pracovní vypětí.", icon: "☕" },
    { name: "Vesperae", time: "18:00", description: "Vespers - Nešpory. Slunce zapadá, zapalujeme svíce.", icon: "🕯️" },
    { name: "Completorium", time: "21:00", description: "Compline - Dokonání dne. Ukládání ke spánku.", icon: "🌙" }
  ];

  // Load books on init
  useEffect(() => {
    fetchCatalog();
  }, []);

  if (!authChecked) return null;
  if (!authToken) return <LoginScreen onLogin={setAuthToken} />;

  const fetchCatalog = async () => {
    setLoading(true);
    try {
      let data;
      try {
        const res = await fetch("/api/fetch-catalog");
        data = await res.json();
      } catch (apiErr) {
        console.warn("Local Scriptorium API unreachable. Attempting client-side direct fetch from GitHub...", apiErr);
        const libUrl = "https://raw.githubusercontent.com/ondrex-ember/scriptorium/main/scriptorium/src/data/library.js";
        const enUrl = "https://raw.githubusercontent.com/ondrex-ember/scriptorium/main/scriptorium/src/i18n/en.js";

        const [libRes, enRes] = await Promise.all([
          fetch(libUrl).catch(() => null),
          fetch(enUrl).catch(() => null)
        ]);

        if (libRes && libRes.ok && enRes && enRes.ok) {
          const libText = await libRes.text();
          const enText = await enRes.text();
          
          const parsedBooks: any[] = [];
          const blocks = libText.match(/\{\s*id:\s*'book_[\s\S]*?\}/g) || [];

          const getField = (block: string, field: string) => {
            const regex = new RegExp(`${field}:\\s*(?:'([^']*)'|([^,\\}\n]*))`);
            const m = block.match(regex);
            if (!m) return "";
            return m[1] || m[2] || "";
          };

          const getContent = (block: string) => {
            const match = block.match(/content:\s*`([\s\S]*?)`/);
            return match ? match[1] : "";
          };

          const parseEnTranslations = (text: string) => {
            const trans: Record<string, { title: string; author: string; content: string }> = {};
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
            const id = getField(block, "id").trim().replace(/['"`]/g, "");
            if (!id) continue;

            const title = getField(block, "title").trim().replace(/['"`]/g, "");
            const category = getField(block, "category").trim().replace(/['"`]/g, "");
            const unlockDay = parseInt(getField(block, "unlockDay")) || 10;
            const icon = getField(block, "icon").trim().replace(/['"`]/g, "");
            const author = getField(block, "author").trim().replace(/['"`]/g, "");
            const year = getField(block, "year").trim().replace(/['"`]/g, "");
            const content = getContent(block);

            const eng = enTrans[id] || { title: "", author: "", content: "" };

            parsedBooks.push({
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
          
          if (parsedBooks.length > 0) {
            data = { books: parsedBooks, source: "github-client-direct" };
          } else {
            throw new Error("Parsed 0 books from GitHub files client-side.");
          }
        } else {
          throw new Error("Failed to fetch library or language files directly from GitHub.");
        }
      }

      setBooks(data.books || []);
      if (data.books && data.books.length > 0) {
        setSelectedBook(data.books[0]);
      }
      showToast(
        `Katalog úspěšně načten z archivu (${data.source === "github-client-direct" ? "Přímé stažení z GitHubu" : "API Scriptorium"}).`, 
        "success"
      );
    } catch (err) {
      console.error(err);
      showToast("Nepodařilo se připojit k archivu. Aktivován lokální nouzový stav.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Sound generator (monastic ambient loop)
  const toggleSound = () => {
    if (!isMuted) {
      // Mute
      if (ambientOscRef.current) {
        try {
          ambientOscRef.current.stop();
        } catch (e) {}
        ambientOscRef.current = null;
      }
      setIsMuted(true);
    } else {
      // Play synthesized medieval low drone & crackling fireplace
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;

        // Medieval Gregorian chant organum drone (Perfect fifth blend)
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gainNode = ctx.createGain();

        // 110Hz (A2) and 165Hz (E3) for pure monastic harmony
        osc1.frequency.setValueAtTime(110, ctx.currentTime);
        osc2.frequency.setValueAtTime(165, ctx.currentTime);
        
        osc1.type = "sine";
        osc2.type = "sine";

        // Lower the volume to make it a subtle background ambient drone
        gainNode.gain.setValueAtTime(0.02, ctx.currentTime);

        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc1.start();
        osc2.start();

        ambientOscRef.current = osc1; // Keep track to stop
        ambientGainRef.current = gainNode;
        setIsMuted(false);
        showToast("Harmonický chorální šum aktivován.", "info");
      } catch (err) {
        console.error("Web Audio not supported or blocked", err);
        showToast("Zvukový generátor nelze v tomto prohlížeči spustit.", "error");
      }
    }
  };

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  // Form helpers
  const handleTitleCsChange = (val: string) => {
    setFormTitleCs(val);
    // Auto-generate clean Scriptorium ID from title if empty or manual
    if (editorMode === "manual" && !formId) {
      const slug = val
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/(^_+|_+$)/g, "");
      if (slug) {
        setFormId("book_" + slug);
      }
    }
  };

  // AI-Generation call
  const generateBookWithAI = async () => {
    if (aiGenerating) return;
    setAiGenerating(true);
    showToast("Vysílám klerika pro radu k moudrému učenci (Gemini s hlubokým přemýšlením)...", "info");

    try {
      const res = await fetch("/api/generate-book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitleCs,
          category: formCategory,
          year: formYear,
          promptGuideline: aiPromptGuideline
        })
      });

      const data = await res.json();
      if (data.success && data.book) {
        const book = data.book;
        setFormId(book.id);
        setFormTitleCs(book.titleCs);
        setFormAuthorCs(book.authorCs);
        setFormContentCs(book.contentCs);
        setFormTitleEn(book.titleEn);
        setFormAuthorEn(book.authorEn);
        setFormContentEn(book.contentEn);
        setFormIcon(book.icon);
        setFormUnlockDay(book.unlockDay);
        setFormYear(book.year);
        
        // Auto decrease monastic vigor slightly on mental strain
        setMonkVigor(prev => Math.max(20, prev - 15));
        showToast("Kniha byla úspěšně vygenerována moudrým učencem!", "success");
      } else {
        throw new Error(data.error || "Chyba při komunikaci.");
      }
    } catch (err: any) {
      console.error(err);
      showToast(`Chyba generování: ${err.message || "Učenec neodpovídá."}`, "error");
    } finally {
      setAiGenerating(false);
    }
  };

  // Add customized book to list
  const saveBook = () => {
    if (!formId.startsWith("book_")) {
      showToast("Neplatné ID! Scriptorium vyžaduje formát: book_nazev", "error");
      return;
    }
    if (books.some(b => b.id === formId)) {
      showToast("Kniha s tímto ID již ve Scriptorium knihovně existuje!", "error");
      return;
    }
    if (!formTitleCs || !formAuthorCs || !formContentCs) {
      showToast("Chybí povinná česká pole (Název, Autor, Obsah)!", "error");
      return;
    }

    const newBook: Book = {
      id: formId,
      title: formTitleCs,
      category: formCategory,
      unlockDay: formUnlockDay,
      icon: formIcon || "📕",
      author: formAuthorCs,
      year: formYear || "1485",
      content: formContentCs,
      titleEn: formTitleEn || formTitleCs,
      authorEn: formAuthorEn || formAuthorCs,
      contentEn: formContentEn || "// English translation pending in the scriptorium..."
    };

    const updated = [newBook, ...books];
    setBooks(updated);
    setSelectedBook(newBook);
    
    // Clear editor fields
    clearForm();
    showToast(`Nová kniha '${newBook.title}' dopsána a zařazena do katalogu!`, "success");
  };

  const deleteBook = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Opravdu si přeješ vyřadit tento tisk z klášterní knihovny?")) {
      const updated = books.filter(b => b.id !== id);
      setBooks(updated);
      if (selectedBook?.id === id) {
        setSelectedBook(updated[0] || null);
      }
      showToast("Tisk byl spálen a vyřazen z archivu.", "info");
    }
  };

  const clearForm = () => {
    setFormId("");
    setFormTitleCs("");
    setFormAuthorCs("");
    setFormContentCs("");
    setFormTitleEn("");
    setFormAuthorEn("");
    setFormContentEn("");
    setFormUnlockDay(30);
    setFormIcon("📕");
    setFormYear("1485");
    setAiPromptGuideline("");
  };

  // Monastic actions
  const petCat = () => {
    setCatHappiness(prev => Math.min(100, prev + 10));
    setMonkVigor(prev => Math.min(100, prev + 5));
    const lines = [
      "Kocour Barnabáš slastně přivírá oči a otírá se o tvůj hnědý habit.",
      "Barnabáš spokojeně zavrněl a ukradl kousek sušeného sýra z tvé kapsy.",
      "Mňau! Barnabáš se ti otřel o lýtka. Cítíš příliv klášterní inspirace (+5 Vigor).",
      "Kocour se svalil na záda a vyžaduje drbání na bříšku. Práce na opisech musí počkat."
    ];
    const randomLine = lines[Math.floor(Math.random() * lines.length)];
    setCatCatMessage(randomLine);
    showToast("Pohladil jsi Barnabáše.", "info");
  };

  const ringBells = () => {
    setCanonicalHourIndex(prev => (prev + 1) % canonicalHours.length);
    setMonkVigor(prev => Math.max(10, prev - 10));
    showToast("Zazněly klášterní zvony. Čas plyne...", "info");
  };

  const drinkWine = () => {
    setMonkVigor(prev => Math.min(100, prev + 25));
    showToast("Ochutnal jsi mešní víno z klášterního sklepa (+25 Vigor).", "success");
  };

  // Filters logic
  const filteredBooks = books.filter(b => {
    const matchesSearch = 
      b.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.titleEn && b.titleEn.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory = activeCategory === "" || b.category === activeCategory;

    return matchesSearch && matchesCategory;
  });

  // Export builders
  const generateCsExportCode = () => {
    return books.map(b => {
      // Escape backticks safely
      const escapedContent = b.content.replace(/`/g, "\\`").replace(/\${/g, "\\${");
      return `        {
            id: '${b.id}',
            title: '${b.title.replace(/'/g, "\\'")}',
            category: '${b.category}',
            unlockDay: ${b.unlockDay},
            icon: '${b.icon}',
            author: '${b.author.replace(/'/g, "\\'")}',
            year: ${isNaN(Number(b.year)) ? `'${b.year}'` : b.year},
            content: \`${escapedContent}\`
        }`;
    }).join(",\n");
  };

  const generateEnExportCode = () => {
    return books.map(b => {
      const title = b.titleEn || b.title;
      const author = b.authorEn || b.author;
      const escapedContent = (b.contentEn || b.content).replace(/`/g, "\\`").replace(/\${/g, "\\${");
      return `        ${b.id}: {
            title: "${title.replace(/"/g, '\\"')}",
            author: "${author.replace(/"/g, '\\"')}",
            content: \`${escapedContent}\`
        }`;
    }).join(",\n");
  };

  const copyToClipboard = (text: string, type: "cs" | "en") => {
    navigator.clipboard.writeText(text);
    showToast(`Exportovaný kód pro ${type === "cs" ? "library.js" : "en.js"} zkopírován!`, "success");
  };

  return (
    <div className="min-h-screen text-parchment font-serif relative overflow-x-hidden selection:bg-gold/30 selection:text-white">
      {/* Background Medieval Pattern Overlays */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(197,160,89,0.06),transparent_40%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(124,45,18,0.04),transparent_50%)] pointer-events-none" />

      {/* Atmospheric Monastic Header */}
      <header className="border-b border-gold/30 bg-ink-soft/90 sticky top-0 z-50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="text-4xl">📜</span>
            <div>
              <h1 className="text-2xl font-bold font-display tracking-widest text-gold drop-shadow-md">
                SCRIPTORIUM · CODYX STUDIO
              </h1>
              <p className="text-xs text-gold-dark/60 font-sans tracking-wider mt-0.5">
                INTERAKTIVNÍ KATALOG, EDITOR A GENEROVÁNÍ KLÁŠTERNÍCH TISKŮ
              </p>
            </div>
          </div>

          {/* Canonical Hour & Monk Stats Dashboard */}
          <div className="flex flex-wrap items-center gap-4 bg-ink/80 border border-gold/20 p-2.5 rounded shadow-inner">
            {/* Clock & Bells */}
            <div className="flex items-center gap-2">
              <span className="text-xl" title={canonicalHours[canonicalHourIndex].description}>
                {canonicalHours[canonicalHourIndex].icon}
              </span>
              <div className="text-left leading-tight">
                <div className="text-xs font-display text-gold-dark font-semibold">
                  {canonicalHours[canonicalHourIndex].name}
                </div>
                <div className="text-[10px] text-parchment/60 font-mono">
                  Liturgie hodin · {canonicalHours[canonicalHourIndex].time}
                </div>
              </div>
              <button 
                onClick={ringBells}
                className="p-1 rounded hover:bg-gold/10 text-gold-dark hover:text-gold transition-colors ml-1"
                title="Zazvonit na klášterní zvony a posunout čas"
              >
                <Clock className="w-4 h-4" />
              </button>
            </div>

            <div className="h-6 w-px bg-gold/20" />

            {/* Monk Vigor */}
            <div className="flex items-center gap-2" title="Duševní síla opata opisovače">
              <Flame className="w-4 h-4 text-wax" />
              <div className="w-20 bg-ink-soft rounded-full h-1.5 overflow-hidden border border-gold/10">
                <div 
                  className="bg-gradient-to-r from-wax to-gold h-full transition-all duration-300" 
                  style={{ width: `${monkVigor}%` }}
                />
              </div>
              <span className="text-xs font-mono font-bold text-gold-dark">{monkVigor}%</span>
              <button 
                onClick={drinkWine}
                className="text-[10px] bg-wax/30 hover:bg-wax/50 text-parchment border border-wax/40 px-1.5 py-0.5 rounded transition-colors"
                title="Ochutnat mešní víno z klášterního cellaria"
              >
                🍷 Napít
              </button>
            </div>

            <div className="h-6 w-px bg-gold/20" />

            {/* Atmospheric Sound Control */}
            <button 
              onClick={toggleSound}
              className={`p-1.5 rounded border transition-all flex items-center gap-1.5 ${
                isMuted 
                  ? "border-gold/20 text-parchment/40 hover:border-gold/40 hover:text-parchment" 
                  : "border-gold/50 bg-gold/10 text-gold shadow-sm shadow-gold/20"
              }`}
              title="Zapnout/vypnout klášterní hudební šum"
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              <span className="text-[10px] font-sans tracking-wide">CHORÁL</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Barnabas the Cat Section */}
        <section className="mb-6 animate-fade-in">
          <div className="parchment-card border border-gold/20 bg-gradient-to-r from-ink-soft/40 to-ink-soft/10 p-4 rounded flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <span className="text-3xl filter drop-shadow">🐈</span>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <h4 className="font-display font-semibold text-sm text-gold tracking-wider">Kocour Barnabáš</h4>
                  <span className="text-[10px] bg-monk-green/30 border border-monk-green/40 px-1.5 py-0.5 rounded text-emerald-400 font-mono">
                    Štěstí: {catHappiness}%
                  </span>
                </div>
                <p className="text-xs text-parchment/70 italic mt-0.5">
                  &ldquo;{catMessage}&rdquo;
                </p>
              </div>
            </div>
            <button
              onClick={petCat}
              className="px-4 py-1.5 bg-gold/10 hover:bg-gold/20 text-gold border border-gold/30 rounded text-xs tracking-widest font-display transition-colors"
            >
              🐈 POHLADIT KOCOURA
            </button>
          </div>
        </section>

        {/* Main Tabs Navigation */}
        <div className="flex border-b border-gold/30 mb-8 bg-ink-soft/40 p-1 rounded-lg">
          <button
            onClick={() => setActiveMainTab("scriptorium")}
            className={`flex-1 py-3 text-xs font-display font-bold tracking-[0.2em] transition-all duration-300 flex items-center justify-center gap-3 rounded-md ${
              activeMainTab === "scriptorium"
                ? "bg-gold/15 text-gold border border-gold/40 shadow-md shadow-gold/10 font-bold"
                : "text-parchment/50 hover:text-parchment/80 hover:bg-gold/5"
            }`}
          >
            📚 SCRIPTORIUM — KNIHOVNA & KATALOG
          </button>
          <button
            onClick={() => setActiveMainTab("chronicon")}
            className={`flex-1 py-3 text-xs font-display font-bold tracking-[0.2em] transition-all duration-300 flex items-center justify-center gap-3 rounded-md ${
              activeMainTab === "chronicon"
                ? "bg-gold/15 text-gold border border-gold/40 shadow-md shadow-gold/10 font-bold"
                : "text-parchment/50 hover:text-parchment/80 hover:bg-gold/5"
            }`}
          >
            ⛪ CHRONICON — MONASTICKÝ SVĚT (GM)
          </button>
        </div>

        {activeMainTab === "scriptorium" ? (
          <>
            {/* Double-Panel Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Panel: Codex Creator & Form (lg:col-span-5) */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="parchment-card rounded-md overflow-hidden gothic-border">
              {/* Creator Mode Tabs */}
              <div className="flex bg-ink/90 border-b border-gold/20">
                <button
                  onClick={() => setEditorMode("ai")}
                  className={`flex-1 py-3 text-xs tracking-widest font-display font-semibold transition-all border-r border-gold/10 flex items-center justify-center gap-2 ${
                    editorMode === "ai" 
                      ? "text-gold bg-gold/5 border-b-2 border-b-gold" 
                      : "text-parchment/40 hover:text-parchment/70 hover:bg-gold/5"
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-gold" />
                  🔮 AI SCRIPTORIA
                </button>
                <button
                  onClick={() => setEditorMode("manual")}
                  className={`flex-1 py-3 text-xs tracking-widest font-display font-semibold transition-all flex items-center justify-center gap-2 ${
                    editorMode === "manual" 
                      ? "text-gold bg-gold/5 border-b-2 border-b-gold" 
                      : "text-parchment/40 hover:text-parchment/70 hover:bg-gold/5"
                  }`}
                >
                  <Scroll className="w-3.5 h-3.5" />
                  ✍️ MANUÁLNÍ OPIS
                </button>
              </div>

              <div className="p-5 flex flex-col gap-4">
                {/* AI Prompt Section */}
                {editorMode === "ai" && (
                  <div className="bg-gold/5 border border-gold/15 p-3 rounded flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-display tracking-widest font-semibold text-gold">
                        MOUDRÝ RÁDCE (AI GENERÁTOR)
                      </h3>
                      <span className="text-[10px] px-1.5 py-0.5 bg-wax/20 border border-wax/40 text-wax font-mono rounded">
                        Gemini Thinking Mode
                      </span>
                    </div>
                    <p className="text-[11px] text-parchment/60 leading-relaxed italic">
                      Zadej hrubý nápad na hrdinský příběh, náboženský spis či alchymistický návod. Generátor s hlubokým přemýšlením napíše květnatý středověký spis v češtině a automaticky vytvoří věrný překlad v angličtině.
                    </p>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-display text-gold-dark font-medium">TÉMA / SMĚR KNIHY</label>
                      <textarea
                        value={aiPromptGuideline}
                        onChange={(e) => setAiPromptGuideline(e.target.value)}
                        placeholder="Napiš např.: Tajemné zjevení svatého rysa u řeky Vltavy, alchymistická přeměna olova ve zlato pomocí pivovarských kvasnic, nebo kronika statečného rytíře z Tábora..."
                        className="bg-ink/80 border border-gold/20 rounded p-2 text-xs text-parchment font-serif placeholder:text-parchment/30 resize-none h-20 focus:outline-none focus:border-gold"
                      />
                    </div>

                    <button
                      onClick={generateBookWithAI}
                      disabled={aiGenerating}
                      className={`w-full py-2.5 rounded font-display text-xs tracking-widest font-semibold shadow transition-all ${
                        aiGenerating 
                          ? "bg-gold/20 text-gold-dark cursor-not-allowed" 
                          : "bg-gold hover:bg-gold-dark text-ink hover:text-parchment"
                      }`}
                    >
                      {aiGenerating ? "UČENEC ROZJÍMÁ (MYSLEK)..." : "🔮 VYHNAT KODEX Z MYSLI"}
                    </button>
                  </div>
                )}

                {/* Metadata Fields */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-display text-gold-dark/80 font-semibold tracking-wider flex items-center gap-1">
                      ID TISKU <span className="text-wax">*</span>
                    </label>
                    <input
                      type="text"
                      value={formId}
                      onChange={(e) => setFormId(e.target.value)}
                      placeholder="book_chronica_novis"
                      className="bg-ink/50 border border-gold/20 rounded p-2 text-xs font-mono placeholder:text-parchment/20 focus:outline-none focus:border-gold"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-display text-gold-dark/80 font-semibold tracking-wider">
                      UNLOCK DEN (HRA) <span className="text-wax">*</span>
                    </label>
                    <input
                      type="number"
                      value={formUnlockDay}
                      onChange={(e) => setFormUnlockDay(Number(e.target.value))}
                      min="1"
                      className="bg-ink/50 border border-gold/20 rounded p-2 text-xs font-mono focus:outline-none focus:border-gold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-display text-gold-dark/80 font-semibold tracking-wider">KATEGORIE</label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value as CategoryType)}
                      className="bg-ink/50 border border-gold/20 rounded p-2 text-xs font-serif text-parchment focus:outline-none focus:border-gold"
                    >
                      {Object.values(CATEGORIES).map(cat => (
                        <option key={cat.key} value={cat.key} className="bg-ink">
                          {cat.labelCs}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-display text-gold-dark/80 font-semibold tracking-wider">IKONA</label>
                    <input
                      type="text"
                      value={formIcon}
                      onChange={(e) => setFormIcon(e.target.value)}
                      placeholder="📕"
                      className="bg-ink/50 border border-gold/20 rounded p-2 text-xs text-center focus:outline-none focus:border-gold"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-display text-gold-dark/80 font-semibold tracking-wider">ROK VYDÁNÍ</label>
                    <input
                      type="text"
                      value={formYear}
                      onChange={(e) => setFormYear(e.target.value)}
                      placeholder="1485"
                      className="bg-ink/50 border border-gold/20 rounded p-2 text-xs font-mono focus:outline-none focus:border-gold"
                    />
                  </div>
                </div>

                <div className="border-t border-gold/15 my-1" />

                {/* Czech Translation Tab Header */}
                <div className="flex items-center gap-1.5 text-xs font-display tracking-widest text-gold-dark font-semibold">
                  <span className="text-[10px]">🇨🇿</span> ČESKÝ OPIS (library.js)
                </div>

                <div className="flex flex-col gap-1.5">
                  <input
                    type="text"
                    value={formTitleCs}
                    onChange={(e) => handleTitleCsChange(e.target.value)}
                    placeholder="Název knihy (např. Kronika Trojanů)"
                    className="bg-ink/50 border border-gold/20 rounded p-2 text-xs font-serif focus:outline-none focus:border-gold"
                  />
                  <input
                    type="text"
                    value={formAuthorCs}
                    onChange={(e) => setFormAuthorCs(e.target.value)}
                    placeholder="Autor / Původ (např. Guido de Columnis)"
                    className="bg-ink/50 border border-gold/20 rounded p-2 text-xs font-serif focus:outline-none focus:border-gold"
                  />
                  <textarea
                    value={formContentCs}
                    onChange={(e) => setFormContentCs(e.target.value)}
                    placeholder="Obsah knihy v češtině (Markdown podporován, např. **Kapitola I:** Text...)"
                    className="bg-ink/50 border border-gold/20 rounded p-2 text-xs font-serif h-28 focus:outline-none focus:border-gold resize-y"
                  />
                </div>

                <div className="border-t border-gold/15 my-1" />

                {/* English Translation Tab Header */}
                <div className="flex items-center gap-1.5 text-xs font-display tracking-widest text-gold-dark font-semibold">
                  <span className="text-[10px]">🇬🇧</span> ENGLYSH TRANSLATION (en.js)
                </div>

                <div className="flex flex-col gap-1.5">
                  <input
                    type="text"
                    value={formTitleEn}
                    onChange={(e) => setFormTitleEn(e.target.value)}
                    placeholder="English Book Title"
                    className="bg-ink/50 border border-gold/20 rounded p-2 text-xs font-serif focus:outline-none focus:border-gold"
                  />
                  <input
                    type="text"
                    value={formAuthorEn}
                    onChange={(e) => setFormAuthorEn(e.target.value)}
                    placeholder="English Author / Provenance"
                    className="bg-ink/50 border border-gold/20 rounded p-2 text-xs font-serif focus:outline-none focus:border-gold"
                  />
                  <textarea
                    value={formContentEn}
                    onChange={(e) => setFormContentEn(e.target.value)}
                    placeholder="English content (monastic tone, Markdown supported)"
                    className="bg-ink/50 border border-gold/20 rounded p-2 text-xs font-serif h-24 focus:outline-none focus:border-gold resize-y"
                  />
                </div>

                <div className="flex gap-3 mt-2">
                  <button
                    onClick={clearForm}
                    className="flex-1 py-2 border border-gold/30 hover:border-gold text-gold-dark hover:text-gold rounded text-xs font-display tracking-widest transition-colors flex items-center justify-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    VYMAZAT
                  </button>
                  <button
                    onClick={saveBook}
                    className="flex-[2] py-2 bg-gold hover:bg-gold-dark text-ink hover:text-parchment rounded text-xs font-display tracking-widest font-bold transition-all shadow-md flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    ZAPSAT DO KATALOGU
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel: Catalog Explorer & Immersive Reader (lg:col-span-7) */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            {/* Immersive Book Reader Panel */}
            <section className="parchment-card rounded-md overflow-hidden gothic-border min-h-[350px] flex flex-col">
              <div className="bg-ink/90 border-b border-gold/20 px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-gold" />
                  <h2 className="text-xs font-display tracking-widest font-semibold text-gold">
                    PULPITUM · KLÁŠTERNÍ ČTENÁŘSKÝ PULT
                  </h2>
                </div>
                
                {selectedBook && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveLang("cs")}
                      className={`text-[10px] px-2 py-0.5 border rounded font-display tracking-wide transition-all ${
                        activeLang === "cs" 
                          ? "bg-gold/15 border-gold text-gold" 
                          : "border-gold/20 text-parchment/40 hover:text-parchment"
                      }`}
                    >
                      🇨🇿 Česky
                    </button>
                    <button
                      onClick={() => setActiveLang("en")}
                      className={`text-[10px] px-2 py-0.5 border rounded font-display tracking-wide transition-all ${
                        activeLang === "en" 
                          ? "bg-gold/15 border-gold text-gold" 
                          : "border-gold/20 text-parchment/40 hover:text-parchment"
                      }`}
                    >
                      🇬🇧 English
                    </button>
                  </div>
                )}
              </div>

              <div className="flex-1 p-6 md:p-8 flex flex-col justify-between bg-gradient-to-b from-parchment/5 to-transparent relative">
                <AnimatePresence mode="wait">
                  {selectedBook ? (
                    <motion.div 
                      key={`${selectedBook.id}-${activeLang}`}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.2 }}
                      className="flex flex-col gap-4 text-left"
                    >
                      {/* Book header */}
                      <div className="flex items-start gap-4">
                        <span className="text-4xl filter drop-shadow">{selectedBook.icon}</span>
                        <div>
                          <h3 className="font-display text-xl text-gold font-bold tracking-wide">
                            {activeLang === "cs" ? selectedBook.title : (selectedBook.titleEn || selectedBook.title)}
                          </h3>
                          <div className="text-xs text-gold-dark/60 font-serif italic mt-1">
                            {activeLang === "cs" ? selectedBook.author : (selectedBook.authorEn || selectedBook.author)} · {selectedBook.year}
                          </div>
                        </div>
                      </div>

                      {/* Monastic horizontal line separator */}
                      <div className="flex items-center justify-center gap-2 text-gold/30">
                        <div className="h-px w-12 bg-gradient-to-r from-transparent to-gold" />
                        <span className="text-xs">❦</span>
                        <div className="h-px w-12 bg-gradient-to-l from-transparent to-gold" />
                      </div>

                      {/* Content with simulated drop cap */}
                      <div className="text-parchment/80 leading-relaxed text-sm md:text-base space-y-4 max-h-[300px] overflow-y-auto pr-2">
                        {/* Custom split for markdown blocks */}
                        {(activeLang === "cs" ? selectedBook.content : (selectedBook.contentEn || selectedBook.content))
                          .split("\n\n")
                          .map((para, idx) => {
                            if (idx === 0) {
                              // Elegant dropcap styling
                              const cleanPara = para.replace(/^\*\*(.*?)\*\*/g, ""); // Strip markdown tags for dropcap if needed
                              const firstChar = para.charAt(0);
                              const restOfPara = para.slice(1);
                              return (
                                <p key={idx} className="relative">
                                  {firstChar && (
                                    <span className="font-display text-4xl float-left font-bold text-gold mr-2 mt-1 leading-none select-none">
                                      {firstChar}
                                    </span>
                                  )}
                                  <span dangerouslySetInnerHTML={{ 
                                    __html: restOfPara
                                      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                                      .replace(/\*(.*?)\*/g, "<em>$1</em>") 
                                  }} />
                                </p>
                              );
                            }
                            return (
                              <p key={idx} dangerouslySetInnerHTML={{ 
                                __html: para
                                  .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                                  .replace(/\*(.*?)\*/g, "<em>$1</em>") 
                              }} />
                            );
                          })}
                      </div>
                    </motion.div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center text-parchment/30 italic py-12">
                      <BookMarked className="w-12 h-12 text-gold-dark/20 mb-2" />
                      Na pulpitu neleží žádná kniha. Vyber knihu z katalogu níže.
                    </div>
                  )}
                </AnimatePresence>

                {selectedBook && (
                  <div className="border-t border-gold/10 mt-6 pt-4 flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-gold-dark/60">
                    <div className="flex items-center gap-1">
                      <Compass className="w-3.5 h-3.5" />
                      <span>ID: {selectedBook.id}</span>
                    </div>
                    <div>Den odemčení: {selectedBook.unlockDay}</div>
                    <div className="px-2 py-0.5 rounded border border-gold/20 text-[10px] font-sans tracking-wide">
                      {selectedBook.category.toUpperCase()}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Catalog Explorer */}
            <section className="parchment-card rounded-md overflow-hidden gothic-border flex-1 flex flex-col">
              <div className="bg-ink/90 border-b border-gold/20 px-5 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Scroll className="w-4 h-4 text-gold" />
                  <h2 className="text-xs font-display tracking-widest font-semibold text-gold">
                    BIBLIOTHECA · TISKY V KNIHOVNĚ
                  </h2>
                </div>

                {/* Filter and Search Bar */}
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:flex-initial">
                    <Search className="w-3.5 h-3.5 text-gold-dark absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchSearch(e.target.value)}
                      placeholder="Hledat knihu..."
                      className="bg-ink/60 border border-gold/20 rounded pl-8 pr-3 py-1 text-xs text-parchment font-serif placeholder:text-parchment/30 focus:outline-none focus:border-gold w-full sm:w-44"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 flex flex-col gap-3">
                {/* Category filtering badges */}
                <div className="flex flex-wrap gap-1.5 border-b border-gold/10 pb-3">
                  <button
                    onClick={() => setActiveCategory("")}
                    className={`text-[10px] font-display tracking-widest px-2.5 py-1 rounded-full border transition-all ${
                      activeCategory === "" 
                        ? "bg-gold text-ink border-gold font-bold" 
                        : "border-gold/20 text-gold-dark/80 hover:border-gold/40 hover:text-gold"
                    }`}
                  >
                    VŠE
                  </button>
                  {Object.values(CATEGORIES).map(cat => (
                    <button
                      key={cat.key}
                      onClick={() => setActiveCategory(cat.key)}
                      className={`text-[10px] font-display tracking-widest px-2.5 py-1 rounded-full border transition-all ${
                        activeCategory === cat.key 
                          ? "bg-gold text-ink border-gold font-bold" 
                          : `${cat.colorClass} hover:bg-gold/5`
                      }`}
                    >
                      {cat.labelCs.toUpperCase()}
                    </button>
                  ))}
                </div>

                {/* Books Grid */}
                <div className="max-h-[220px] overflow-y-auto pr-1">
                  {loading ? (
                    <div className="text-center text-xs text-parchment/40 italic py-8">
                      Otevírám těžké klášterní dveře archivu...
                    </div>
                  ) : filteredBooks.length === 0 ? (
                    <div className="text-center text-xs text-parchment/40 italic py-8">
                      V této sekci knihovny nebyly nalezeny žádné opisy.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {filteredBooks.map((book) => {
                        const isSelected = selectedBook?.id === book.id;
                        return (
                          <div
                            key={book.id}
                            onClick={() => setSelectedBook(book)}
                            className={`p-3 rounded border text-left cursor-pointer transition-all flex items-start gap-2.5 relative group ${
                              isSelected 
                                ? "bg-gold/10 border-gold shadow-md" 
                                : "bg-ink-soft/20 border-gold/15 hover:border-gold/40 hover:bg-ink-soft/40"
                            }`}
                          >
                            <span className="text-2xl">{book.icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="text-[9px] font-mono text-gold-dark/60 tracking-wider">
                                den {book.unlockDay} · {book.year}
                              </div>
                              <h4 className="font-display font-semibold text-xs text-parchment group-hover:text-gold transition-colors truncate">
                                {book.title}
                              </h4>
                              <p className="text-[10px] text-parchment/50 truncate italic">
                                {book.author}
                              </p>
                            </div>
                            
                            {/* Delete button for local additions */}
                            <button
                              onClick={(e) => deleteBook(book.id, e)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-parchment/30 hover:text-wax rounded transition-all absolute right-2 top-2"
                              title="Spálit knihu"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </section>

          </div>
        </div>

        {/* Code Block Exporter (Full Width Tab) */}
        <section className="mt-8 animate-fade-in">
          <div className="parchment-card rounded-md overflow-hidden gothic-border">
            <div className="bg-ink/90 border-b border-gold/20 px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CornerDownRight className="w-4 h-4 text-gold" />
                <h2 className="text-xs font-display tracking-widest font-semibold text-gold">
                  EXPORT CODYX · EXPORTOVÁNÍ KÓDU PRO HRU SCRIPTORIUM
                </h2>
              </div>
              <span className="text-[10px] font-sans text-gold-dark/60">
                Připraveno ke zkopírování do souborů hry
              </span>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* library.js Block */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-gold flex items-center gap-1.5">
                    📄 SCRIPTORIUM / src / data / library.js
                  </span>
                  <button
                    onClick={() => copyToClipboard(generateCsExportCode(), "cs")}
                    className="px-3 py-1 bg-gold/10 hover:bg-gold/20 text-gold border border-gold/30 rounded text-[10px] font-display tracking-wider transition-colors"
                  >
                    KOPÍROVAT KÓD
                  </button>
                </div>
                <div className="relative">
                  <pre className="bg-ink/90 border border-gold/20 p-4 rounded text-[10px] font-mono overflow-auto h-48 text-left text-teal-300">
                    {books.length > 0 ? generateCsExportCode() : "// Žádné knihy k exportu"}
                  </pre>
                </div>
                <p className="text-[10px] text-parchment/40 italic text-left">
                  Tento blok vložte dovnitř pole `const library_lore` v souboru `library.js` ve vašem projektu.
                </p>
              </div>

              {/* en.js Block */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-gold flex items-center gap-1.5">
                    📄 SCRIPTORIUM / src / i18n / en.js
                  </span>
                  <button
                    onClick={() => copyToClipboard(generateEnExportCode(), "en")}
                    className="px-3 py-1 bg-gold/10 hover:bg-gold/20 text-gold border border-gold/30 rounded text-[10px] font-display tracking-wider transition-colors"
                  >
                    KOPÍROVAT KÓD
                  </button>
                </div>
                <div className="relative">
                  <pre className="bg-ink/90 border border-gold/20 p-4 rounded text-[10px] font-mono overflow-auto h-48 text-left text-amber-300">
                    {books.length > 0 ? generateEnExportCode() : "// No English translations available to export"}
                  </pre>
                </div>
                <p className="text-[10px] text-parchment/40 italic text-left">
                  Tento blok vložte jako klíče pod objekt `STRINGS_en.library_lore.books` v souboru `en.js` ve vašem projektu.
                </p>
              </div>
            </div>
          </div>
        </section>
          </>
        ) : (
          <ChroniconAdmin showToast={showToast} />
        )}

      </main>

      {/* Global CSS Medieval Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded border shadow-xl flex items-center gap-2.5 max-w-sm text-xs font-display tracking-wider ${
              toast.type === "error" 
                ? "bg-wax text-parchment border-gold/30" 
                : toast.type === "info"
                ? "bg-ink-soft text-gold border-gold/30"
                : "bg-monk-green/90 text-parchment border-gold/40"
            }`}
          >
            <span>{toast.type === "error" ? "⚠️" : "☩"}</span>
            <span className="text-left font-serif leading-snug">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
