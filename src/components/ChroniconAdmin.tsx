import React, { useState, useEffect } from "react";
import { 
  Church, 
  Sparkles, 
  Compass, 
  Database, 
  Copy, 
  Download, 
  RefreshCw, 
  User, 
  PenTool, 
  Activity, 
  Wheat, 
  Coins, 
  ShieldAlert, 
  CloudRain, 
  Sun, 
  Calendar, 
  BookMarked,
  Filter,
  CheckCircle,
  Clock,
  ArrowRight,
  Upload
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ChroniconSnapshot, GmInput, ChroniconEvent, ChronicleLog } from "../types";

interface ChroniconAdminProps {
  showToast: (msg: string, type: "success" | "error" | "info") => void;
}

export default function ChroniconAdmin({ showToast }: ChroniconAdminProps) {
  const [snapshot, setSnapshot] = useState<ChroniconSnapshot | null>(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [events, setEvents] = useState<{ local: ChroniconEvent[]; distant: ChroniconEvent[]; monastery: ChroniconEvent[] } | null>(null);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<"gm" | "live" | "events">("gm");

  // GM Input Form state
  const [abbotName, setAbbotName] = useState("Bratr Augustin");
  const [abbotMood, setAbbotMood] = useState("klidný");
  const [abbotVirtue, setAbbotVirtue] = useState<number>(7);
  const [scriniumOpen, setScriniumOpen] = useState(true);
  const [abbotMessage, setAbbotMessage] = useState<string>("");
  const [tensionModifier, setTensionModifier] = useState<number>(0);
  const [eventInject, setEventInject] = useState<string>("");
  const [unlockFlag, setUnlockFlag] = useState<string>("");

  // AI Decree Composer state
  const [aiTopic, setAiTopic] = useState("Pochvala za věrnou práci na opisech a trpělivost");
  const [aiComposing, setAiComposing] = useState(false);
  const [aiDraftCs, setAiDraftCs] = useState("");
  const [aiDraftEn, setAiDraftEn] = useState("");

  // Search & Filtering for Chronicle Feed & Database
  const [feedSearch, setFeedSearch] = useState("");
  const [feedSourceFilter, setFeedSourceFilter] = useState<string>("all");
  const [dbSearch, setDbSearch] = useState("");
  const [dbSourceFilter, setDbSourceFilter] = useState<"local" | "distant" | "monastery">("local");

  // Load Data
  useEffect(() => {
    fetchSnapshot();
    fetchEvents();
  }, []);

  const fetchSnapshot = async () => {
    setLoadingSnapshot(true);
    try {
      let data;
      try {
        const res = await fetch("/api/fetch-chronicon-snapshot");
        data = await res.json();
      } catch (apiErr) {
        console.warn("Local API for Chronicon snapshot unreachable. Attempting client-side direct fetch from GitHub...", apiErr);
        const snapshotUrl = "https://raw.githubusercontent.com/ondrex-ember/chronicon/main/data/chronicon_snapshot.json";
        const response = await fetch(snapshotUrl);
        if (response.ok) {
          const snapshotData = await response.json();
          data = { success: true, source: "github-direct", snapshot: snapshotData };
        } else {
          throw apiErr;
        }
      }

      if (data && data.success) {
        setSnapshot(data.snapshot);
        // Sync some GM states with current live abbot values if they are loaded
        if (data.snapshot.abbot) {
          setAbbotName(data.snapshot.abbot.name || "Bratr Augustin");
          setAbbotMood(data.snapshot.abbot.mood || "klidný");
          setAbbotVirtue(data.snapshot.abbot.virtue ?? 7);
          setScriniumOpen(data.snapshot.abbot.scrinium_open ?? true);
          if (data.snapshot.abbot.message) {
            setAbbotMessage(data.snapshot.abbot.message);
          }
        }
        showToast(
          `Chronicon feed úspěšně synchronizován (${data.source === "github-direct" || data.source === "github" ? "GitHub Live" : "Nouzový simulátor"}).`,
          "success"
        );
      }
    } catch (err) {
      showToast("Selhalo načítání Chronicon snapshotu.", "error");
    } finally {
      setLoadingSnapshot(false);
    }
  };

  const fetchEvents = async () => {
    setLoadingEvents(true);
    try {
      let data;
      try {
        const res = await fetch("/api/fetch-chronicon-events");
        data = await res.json();
      } catch (apiErr) {
        console.warn("Local API for Chronicon events unreachable. Attempting client-side direct fetch from GitHub...", apiErr);
        const urls = {
          local: "https://raw.githubusercontent.com/ondrex-ember/chronicon/main/narrative/local_events_v1.json",
          distant: "https://raw.githubusercontent.com/ondrex-ember/chronicon/main/narrative/distant_events_v1.json",
          monastery: "https://raw.githubusercontent.com/ondrex-ember/chronicon/main/narrative/monastery_internal_v1.json"
        };
        const fetchJson = async (url: string) => {
          const response = await fetch(url).catch(() => null);
          if (response && response.ok) return response.json();
          return null;
        };
        const [local, distant, monastery] = await Promise.all([
          fetchJson(urls.local),
          fetchJson(urls.distant),
          fetchJson(urls.monastery)
        ]);
        if (local || distant || monastery) {
          data = {
            success: true,
            local: local || [],
            distant: distant || [],
            monastery: monastery || []
          };
        } else {
          throw apiErr;
        }
      }

      if (data && data.success) {
        setEvents({
          local: data.local || [],
          distant: data.distant || [],
          monastery: data.monastery || []
        });
      }
    } catch (err) {
      showToast("Selhalo načítání eventové databáze.", "error");
    } finally {
      setLoadingEvents(false);
    }
  };

  // Compose Abbot Decree via Gemini
  const handleComposeDecree = async () => {
    setAiComposing(true);
    try {
      const res = await fetch("/api/generate-abbot-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          abbotName,
          abbotMood,
          abbotVirtue,
          topic: aiTopic
        })
      });
      const data = await res.json();
      if (data.success) {
        setAiDraftCs(data.messageCs);
        setAiDraftEn(data.messageEn);
        showToast("Gemini sepsal vysoce poetické opatské nařízení.", "success");
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      showToast(err.message || "Nepodařilo se zformulovat poselství.", "error");
    } finally {
      setAiComposing(false);
    }
  };

  // Apply AI Draft into current message input
  const applyDraftToMessage = (lang: "cs" | "en") => {
    if (lang === "cs") {
      setAbbotMessage(aiDraftCs);
      showToast("Český koncept přenesen do herní zprávy.", "info");
    } else {
      setAbbotMessage(aiDraftEn);
      showToast("Anglický koncept přenesen do herní zprávy.", "info");
    }
  };

  // Construct current gm_input.json output object
  const buildGmInputJson = (): GmInput => {
    return {
      abbot_name: abbotName,
      abbot_mood: abbotMood,
      abbot_virtue: abbotVirtue,
      abbot_portrait: null,
      scrinium_open: scriniumOpen,
      abbot_message: abbotMessage || null,
      tension_modifier: tensionModifier,
      event_inject: eventInject ? JSON.parse(JSON.stringify(eventInject)) : null,
      unlock_flag: unlockFlag || null
    };
  };

  const copyGmInput = () => {
    const jsonStr = JSON.stringify(buildGmInputJson(), null, 2);
    navigator.clipboard.writeText(jsonStr);
    showToast("Kód gm_input.json byl zkopírován do schránky.", "success");
  };

  const downloadGmInput = () => {
    const jsonStr = JSON.stringify(buildGmInputJson(), null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "gm_input.json";
    link.click();
    URL.revokeObjectURL(url);
    showToast("Soubor gm_input.json stažen.", "success");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json) {
          if (json.abbot_name !== undefined) setAbbotName(json.abbot_name);
          if (json.abbot_mood !== undefined) setAbbotMood(json.abbot_mood);
          if (json.abbot_virtue !== undefined) setAbbotVirtue(Number(json.abbot_virtue));
          if (json.scrinium_open !== undefined) setScriniumOpen(!!json.scrinium_open);
          if (json.abbot_message !== undefined) setAbbotMessage(json.abbot_message || "");
          if (json.tension_modifier !== undefined) setTensionModifier(Number(json.tension_modifier));
          if (json.event_inject !== undefined) {
            setEventInject(typeof json.event_inject === "string" ? json.event_inject : JSON.stringify(json.event_inject));
          }
          if (json.unlock_flag !== undefined) setUnlockFlag(json.unlock_flag || "");
          showToast("Soubor gm_input.json úspěšně nahrán a načten do editoru!", "success");
        }
      } catch (err) {
        showToast("Nepodařilo se správně naparsovat herní JSON.", "error");
      }
    };
    reader.readAsText(file);
  };

  // Preset topics for Ondrex
  const aiTopicPresets = [
    { label: "🌾 Sklizeň obilí", val: "Poděkování a pochvala bratrům za bohatou sklizeň obilí a mešní desátky" },
    { label: "✍️ Líné opisování", val: "Důrazné varování pro písaře, kteří dělají kaňky, píší křivě a usínají u pultů" },
    { label: "🛡️ Blížící se vojáci", val: "Zvěst o toulavých hrdlořezech v okolí kláštera a nařízení uzavřít brány" },
    { label: "⛪ Sváteční mše", val: "Požehnání a kázání u příležitosti svátku patrona kláštera s odkazem na zbožnost" },
    { label: "🩸 Inkviziční stín", val: "Obavy z příjezdu inkvizitora do Olomouce a instrukce ukrýt zakázané spisy" }
  ];

  return (
    <div className="space-y-8" id="chronicon-admin-root">
      {/* Top Controls & Sub-Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-monk-amber/20 pb-4">
        <div>
          <h2 className="text-xl font-sans font-semibold text-monk-amber tracking-tight flex items-center gap-2">
            <Church className="h-5 w-5" id="chronicon-icon" /> CHRONICON — Monastický Informační Systém
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Ovládání generativního světa, synchronizace zpráv a přímé zásahy Opata Augustina (GM)
          </p>
        </div>
        
        {/* Sub-Tabs Nav */}
        <div className="flex bg-charcoal-light/60 p-1 rounded-lg border border-monk-amber/10 self-stretch sm:self-auto">
          <button
            onClick={() => setActiveSubTab("gm")}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeSubTab === "gm"
                ? "bg-monk-amber/20 text-monk-amber border border-monk-amber/30"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            ⛪ Opat & GM Override
          </button>
          <button
            onClick={() => setActiveSubTab("live")}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeSubTab === "live"
                ? "bg-monk-amber/20 text-monk-amber border border-monk-amber/30"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            📡 Pulpitum Live Feed
          </button>
          <button
            onClick={() => setActiveSubTab("events")}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeSubTab === "events"
                ? "bg-monk-amber/20 text-monk-amber border border-monk-amber/30"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            📚 Knihovna událostí
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* TAB 1: GM OVERRIDE EDITOR */}
        {activeSubTab === "gm" && (
          <motion.div
            key="gm-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8"
          >
            {/* Form Settings - left 7 cols */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-charcoal-light/30 border border-monk-amber/10 rounded-xl p-6 shadow-xl space-y-6">
                <div className="flex items-center justify-between border-b border-monk-amber/10 pb-3">
                  <div className="flex items-center gap-2">
                    <PenTool className="h-4 w-4 text-monk-amber" />
                    <h3 className="font-sans font-medium text-gray-200 text-sm">Parametry GM Zásahu (gm_input.json)</h3>
                  </div>
                  
                  {/* Client-side File Loader */}
                  <label className="flex items-center gap-1.5 px-2.5 py-1 bg-charcoal hover:bg-monk-amber/10 text-[11px] text-monk-amber hover:text-white rounded border border-monk-amber/20 hover:border-monk-amber/40 transition-all cursor-pointer">
                    <Upload className="h-3 w-3" />
                    <span>Nahrát gm_input.json</span>
                    <input 
                      type="file" 
                      accept=".json" 
                      onChange={handleFileUpload} 
                      className="hidden" 
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Abbot Name */}
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Jméno Opatova zástupce</label>
                    <input
                      type="text"
                      value={abbotName}
                      onChange={(e) => setAbbotName(e.target.value)}
                      className="w-full bg-charcoal border border-monk-amber/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-monk-amber/40"
                    />
                  </div>

                  {/* Abbot Mood */}
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Rozpoložení opata (Mood)</label>
                    <select
                      value={abbotMood}
                      onChange={(e) => setAbbotMood(e.target.value)}
                      className="w-full bg-charcoal border border-monk-amber/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-monk-amber/40"
                    >
                      <option value="klidný">Klidný / Serene</option>
                      <option value="rozjímající">Rozjímající / Contemplative</option>
                      <option value="znepokojený">Znepokojený / Concerned</option>
                      <option value="přísný">Přísný / Stern</option>
                      <option value="rozradostněný">Rozradostněný / Joyous</option>
                      <option value="popudlivý">Popudlivý / Choleric</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Abbot Virtue */}
                  <div>
                    <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                      <span>Ctnost / Přísnost opata (Virtue)</span>
                      <span className="text-monk-amber font-mono font-bold">{abbotVirtue}/10</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={abbotVirtue}
                      onChange={(e) => setAbbotVirtue(parseInt(e.target.value))}
                      className="w-full accent-monk-amber bg-charcoal border border-monk-amber/10 rounded-lg h-2"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">
                      Vyšší hodnota evokuje duchovní čistotu, nižší hodnota přísnou sekulární tvrdost.
                    </p>
                  </div>

                  {/* Scrinium Open Toggle */}
                  <div className="flex items-center justify-between p-3 bg-charcoal/50 border border-monk-amber/10 rounded-lg">
                    <div>
                      <span className="block text-xs font-medium text-gray-200">Scrinium Otevřeno</span>
                      <span className="block text-[10px] text-gray-500">Mohou bratři opisovat knihy?</span>
                    </div>
                    <button
                      onClick={() => setScriniumOpen(!scriniumOpen)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        scriniumOpen ? "bg-monk-green" : "bg-red-900/40"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          scriniumOpen ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Tension modifier */}
                  <div>
                    <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                      <span>Modifikátor napětí (Inkvizitor)</span>
                      <span className={`font-mono font-bold ${tensionModifier > 0 ? "text-rose-400" : tensionModifier < 0 ? "text-emerald-400" : "text-gray-400"}`}>
                        {tensionModifier > 0 ? `+${tensionModifier}` : tensionModifier}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="-3"
                      max="3"
                      value={tensionModifier}
                      onChange={(e) => setTensionModifier(parseInt(e.target.value))}
                      className="w-full accent-monk-amber bg-charcoal border border-monk-amber/10 rounded-lg h-2"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">
                      Přímé zvýšení či snížení inkvizičního ohrožení při dalším ticku.
                    </p>
                  </div>

                  {/* Unlock Flag */}
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Zpřístupnit herní příznak (Unlock Flag)</label>
                    <input
                      type="text"
                      placeholder="např. flag_secret_abbey_discovered"
                      value={unlockFlag}
                      onChange={(e) => setUnlockFlag(e.target.value)}
                      className="w-full bg-charcoal border border-monk-amber/10 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-monk-amber/40"
                    />
                  </div>
                </div>

                {/* Abbot Message Textarea */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-medium text-gray-400">
                      Opatovo zlaté poselství (Abbot Message) — Zobrazí se ve hře
                    </label>
                    <span className="text-[10px] text-monk-amber font-mono font-bold">Ondrex GM Slot</span>
                  </div>
                  <textarea
                    value={abbotMessage}
                    onChange={(e) => setAbbotMessage(e.target.value)}
                    rows={4}
                    placeholder="Sem napište opatovo poselství nebo použijte AI k jeho sepsání v pravém panelu..."
                    className="w-full bg-charcoal border border-monk-amber/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-monk-amber/40 font-serif leading-relaxed"
                  />
                </div>

                {/* Event Inject */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Vynutit specifickou událost (Event Inject)</label>
                  <input
                    type="text"
                    placeholder='např. "hailstorm_ruins_crops" nebo custom text'
                    value={eventInject}
                    onChange={(e) => setEventInject(e.target.value)}
                    className="w-full bg-charcoal border border-monk-amber/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-monk-amber/40 placeholder-gray-600 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* AI Decree Composer and Code Output - right 5 cols */}
            <div className="lg:col-span-5 space-y-6">
              {/* AI Composer Parchment */}
              <div className="bg-gradient-to-br from-charcoal-light/40 to-amber-950/10 border border-monk-amber/20 rounded-xl p-5 shadow-xl space-y-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 text-monk-amber/10 font-serif text-6xl pointer-events-none select-none">
                  A
                </div>
                
                <h4 className="font-sans font-semibold text-monk-amber text-xs tracking-wider uppercase flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> AI Scriptorium Chronograf (Gemini)
                </h4>
                <p className="text-xs text-gray-300 leading-relaxed">
                  Zadejte téma a nechte umělou inteligenci zformulovat historické, teologicky přesvědčivé opatské nařízení, jež odráží zvolenou náladu a ctnost.
                </p>

                {/* Composer Input */}
                <div className="space-y-3">
                  <div>
                    <input
                      type="text"
                      value={aiTopic}
                      onChange={(e) => setAiTopic(e.target.value)}
                      placeholder="Co má opat bratrům oznámit?"
                      className="w-full bg-charcoal/80 border border-monk-amber/20 rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-monk-amber/40"
                    />
                  </div>

                  {/* Preset Buttons */}
                  <div className="flex flex-wrap gap-1.5">
                    {aiTopicPresets.map((pr, i) => (
                      <button
                        key={i}
                        onClick={() => setAiTopic(pr.val)}
                        className="text-[10px] bg-charcoal hover:bg-monk-amber/10 text-gray-300 border border-monk-amber/10 hover:border-monk-amber/30 px-2 py-1 rounded transition-all"
                      >
                        {pr.label}
                      </button>
                    ))}
                  </div>

                  {/* Compose Button */}
                  <button
                    onClick={handleComposeDecree}
                    disabled={aiComposing || !aiTopic}
                    className="w-full bg-monk-amber hover:bg-monk-amber-hover disabled:bg-charcoal text-charcoal font-sans font-semibold text-xs py-2 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg disabled:text-gray-500 cursor-pointer"
                  >
                    {aiComposing ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        Opat brousí brk a rozjímá...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5" />
                        Sepsat Opatovo poselství (Gemini)
                      </>
                    )}
                  </button>
                </div>

                {/* Composed Outputs Area */}
                {(aiDraftCs || aiDraftEn) && (
                  <div className="space-y-3 mt-4 pt-4 border-t border-monk-amber/10 text-xs">
                    {aiDraftCs && (
                      <div className="bg-charcoal/50 p-3 rounded-lg border border-monk-amber/10 space-y-1.5 relative group">
                        <span className="absolute top-1 right-2 text-[9px] text-monk-amber uppercase tracking-widest">CZ Dekret</span>
                        <p className="text-gray-300 italic font-serif leading-relaxed pr-8">{aiDraftCs}</p>
                        <button
                          onClick={() => applyDraftToMessage("cs")}
                          className="mt-2 text-[10px] text-monk-amber hover:text-white font-sans font-medium flex items-center gap-1"
                        >
                          <CheckCircle className="h-3 w-3" /> Použít český text
                        </button>
                      </div>
                    )}

                    {aiDraftEn && (
                      <div className="bg-charcoal/50 p-3 rounded-lg border border-monk-amber/10 space-y-1.5 relative group">
                        <span className="absolute top-1 right-2 text-[9px] text-blue-400 uppercase tracking-widest">EN Translation</span>
                        <p className="text-gray-400 italic font-serif leading-relaxed pr-8">{aiDraftEn}</p>
                        <button
                          onClick={() => applyDraftToMessage("en")}
                          className="mt-2 text-[10px] text-blue-400 hover:text-white font-sans font-medium flex items-center gap-1"
                        >
                          <CheckCircle className="h-3 w-3" /> Použít anglický text (Translations)
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Code Export block */}
              <div className="bg-charcoal-light/30 border border-monk-amber/10 rounded-xl p-5 shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-300 font-sans">Kód pro chronicon repozytář</span>
                  <span className="text-[10px] bg-amber-950/40 text-monk-amber px-2 py-0.5 rounded border border-monk-amber/20 font-mono">
                    gm_input.json
                  </span>
                </div>
                
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Zkopírujte tento JSON kód a uložte jej do souboru <code className="text-monk-amber font-mono">gm/gm_input.json</code> ve svém Chronicon repu. Engine ho automaticky načte při příštím ticku.
                </p>

                <div className="bg-charcoal p-3 rounded-lg border border-monk-amber/5 relative group">
                  <pre className="text-[11px] font-mono text-gray-400 overflow-x-auto max-h-48 leading-relaxed">
                    {JSON.stringify(buildGmInputJson(), null, 2)}
                  </pre>
                  
                  {/* Copy & download tools */}
                  <div className="absolute top-2 right-2 flex gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={copyGmInput}
                      className="bg-charcoal-light hover:bg-monk-amber/20 p-1.5 rounded border border-monk-amber/10 text-gray-400 hover:text-monk-amber transition-colors"
                      title="Kopírovat"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={downloadGmInput}
                      className="bg-charcoal-light hover:bg-monk-amber/20 p-1.5 rounded border border-monk-amber/10 text-gray-400 hover:text-monk-amber transition-colors"
                      title="Stáhnout"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* TAB 2: LIVE FEED STATUS */}
        {activeSubTab === "live" && (
          <motion.div
            key="live-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Sync bar */}
            <div className="bg-charcoal-light/30 border border-monk-amber/10 p-4 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className={`h-2.5 w-2.5 rounded-full ${loadingSnapshot ? "bg-amber-500 animate-pulse" : "bg-monk-green"}`} />
                <span className="text-xs text-gray-200">
                  {loadingSnapshot ? "Stahuji data..." : `Poslední aktualizace snapshotu: ${snapshot ? new Date(snapshot.generated).toLocaleString() : "Nedostupná"}`}
                </span>
              </div>
              <button
                onClick={fetchSnapshot}
                disabled={loadingSnapshot}
                className="bg-charcoal hover:bg-monk-amber/10 text-xs text-monk-amber px-3 py-1.5 rounded-lg border border-monk-amber/20 hover:border-monk-amber/50 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <RefreshCw className={`h-3 w-3 ${loadingSnapshot ? "animate-spin" : ""}`} /> Synchronizovat z GitHub
              </button>
            </div>

            {snapshot ? (
              <div className="space-y-6">
                {/* World Clock & Weather Overview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Monastic Calendar Clock */}
                  <div className="bg-charcoal-light/20 border border-monk-amber/10 p-5 rounded-xl shadow-md space-y-3 relative overflow-hidden">
                    <div className="absolute top-2 right-2 text-3xl opacity-20 select-none">⏳</div>
                    <span className="text-[10px] text-monk-amber uppercase tracking-widest font-semibold flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Monastický čas
                    </span>
                    <h4 className="text-xl font-sans font-semibold text-gray-200">{snapshot.time.date_string}</h4>
                    <div className="space-y-1.5 text-xs text-gray-400">
                      <div className="flex justify-between">
                        <span>Aktuální rok (Year)</span>
                        <span className="text-gray-200 font-semibold">{snapshot.time.year}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Doba roku (Season)</span>
                        <span className="text-gray-200 flex items-center gap-1">
                          {snapshot.time.season_icon} {snapshot.time.season_name}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Klášterní den (Day)</span>
                        <span className="text-gray-200 font-semibold">Den {snapshot.time.day}</span>
                      </div>
                      <div className="flex justify-between border-t border-gray-800/60 pt-1.5 mt-1.5">
                        <span>Celkem odehraných tiků</span>
                        <span className="text-monk-amber font-mono font-bold">{snapshot.time.total_tick}</span>
                      </div>
                    </div>
                  </div>

                  {/* Medieval Monastic Weather */}
                  <div className="bg-charcoal-light/20 border border-monk-amber/10 p-5 rounded-xl shadow-md space-y-3 relative overflow-hidden">
                    <div className="absolute top-2 right-2 text-4xl opacity-20 select-none">
                      {snapshot.weather.icon}
                    </div>
                    <span className="text-[10px] text-blue-400 uppercase tracking-widest font-semibold flex items-center gap-1">
                      <CloudRain className="h-3 w-3" /> Počasí v Olomouci
                    </span>
                    <h4 className="text-xl font-sans font-semibold text-gray-200 flex items-center gap-2">
                      {snapshot.weather.icon} {snapshot.weather.name}
                    </h4>
                    <p className="text-xs text-gray-400 leading-relaxed italic">{snapshot.weather.desc}</p>
                    <div className="flex gap-4 text-[10px] bg-charcoal/40 p-2 rounded border border-gray-800/50 mt-2">
                      <div className="flex-1">
                        <span className="text-gray-500 block">Sklizeň obilí</span>
                        <span className="text-emerald-400 font-mono font-bold">x{snapshot.weather.modifier_grain}</span>
                      </div>
                      <div className="flex-1">
                        <span className="text-gray-500 block">Těžba dřeva</span>
                        <span className="text-amber-400 font-mono font-bold">x{snapshot.weather.modifier_wood}</span>
                      </div>
                    </div>
                  </div>

                  {/* Church Liturgical Calendar */}
                  <div className="bg-charcoal-light/20 border border-monk-amber/10 p-5 rounded-xl shadow-md space-y-3 relative overflow-hidden">
                    <div className="absolute top-2 right-2 text-3xl opacity-20 select-none">🕯️</div>
                    <span className="text-[10px] text-purple-400 uppercase tracking-widest font-semibold flex items-center gap-1">
                      <BookMarked className="h-3 w-3" /> Liturgický kalendář
                    </span>
                    <h4 className="text-xl font-sans font-semibold text-gray-200">
                      {snapshot.church_calendar.season_icon} {snapshot.church_calendar.season}
                    </h4>
                    <p className="text-xs text-gray-400">
                      <span className="block text-gray-500">Významný liturgický svátek (Note):</span>
                      <span className="text-purple-300 italic font-medium">
                        {snapshot.church_calendar.note || "Ferialis (Bez zvláštního svátku)"}
                      </span>
                    </p>
                    <div className="text-[10px] text-gray-500 mt-1">
                      Pořadové číslo dne v liturgickém roce: <strong className="text-gray-300 font-mono">{snapshot.church_calendar.day_of_year} / 365</strong>
                    </div>
                  </div>
                </div>

                {/* Simulated Actors & Resources */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Actors - 8 cols */}
                  <div className="lg:col-span-8 bg-charcoal-light/10 border border-monk-amber/10 p-5 rounded-xl space-y-4">
                    <h5 className="text-xs font-semibold text-gray-200 uppercase tracking-wider flex items-center gap-2">
                      <Activity className="h-4 w-4 text-monk-amber" /> Stav Společenství a Frakcí (Actors Engine)
                    </h5>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Monastery actor */}
                      <div className="bg-charcoal/40 p-4 rounded-lg border border-gray-800/60 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-semibold text-monk-amber">⛪ Klášterní komunita (Monastery)</span>
                        </div>
                        <div className="space-y-1 text-[11px]">
                          <div className="flex justify-between text-gray-400">
                            <span>Nálada bratrů (Mood)</span>
                            <span className="text-gray-200 font-semibold">{snapshot.actors.monastery.mood}%</span>
                          </div>
                          <div className="w-full bg-gray-900 h-1 rounded-full overflow-hidden">
                            <div className="bg-monk-amber h-full" style={{ width: `${snapshot.actors.monastery.mood}%` }} />
                          </div>
                          <div className="flex justify-between text-gray-400">
                            <span>Hospodaření (Wealth)</span>
                            <span className="text-gray-200 font-semibold">{snapshot.actors.monastery.wealth}%</span>
                          </div>
                          <div className="flex justify-between text-gray-400">
                            <span>Zbožnost a duchovnost (Piety)</span>
                            <span className="text-gray-200 font-semibold">{snapshot.actors.monastery.piety}%</span>
                          </div>
                        </div>
                      </div>

                      {/* Vesničané */}
                      <div className="bg-charcoal/40 p-4 rounded-lg border border-gray-800/60 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-semibold text-emerald-400">🏡 Poddaní & Vesničané (Villagers)</span>
                        </div>
                        <div className="space-y-1 text-[11px]">
                          <div className="flex justify-between text-gray-400">
                            <span>Nálada poddaných (Mood)</span>
                            <span className="text-gray-200 font-semibold">{snapshot.actors.vesnicane.mood}%</span>
                          </div>
                          <div className="w-full bg-gray-900 h-1 rounded-full overflow-hidden">
                            <div className="bg-emerald-500 h-full" style={{ width: `${snapshot.actors.vesnicane.mood}%` }} />
                          </div>
                          <div className="flex justify-between text-gray-400">
                            <span>Zásoby v sýpkách (Stores)</span>
                            <span className="text-gray-200 font-semibold">{snapshot.actors.vesnicane.stores}%</span>
                          </div>
                        </div>
                      </div>

                      {/* Valaši */}
                      <div className="bg-charcoal/40 p-4 rounded-lg border border-gray-800/60 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-semibold text-blue-400">🐏 Valašští pastevci (Valach)</span>
                        </div>
                        <div className="space-y-1 text-[11px]">
                          <div className="flex justify-between text-gray-400">
                            <span>Loajalita & Nálada pastevců</span>
                            <span className="text-gray-200 font-semibold">{snapshot.actors.valach.mood}%</span>
                          </div>
                          <div className="w-full bg-gray-900 h-1 rounded-full overflow-hidden">
                            <div className="bg-blue-400 h-full" style={{ width: `${snapshot.actors.valach.mood}%` }} />
                          </div>
                          <div className="flex justify-between text-gray-400">
                            <span>Velikost stád (Herd size)</span>
                            <span className="text-gray-200 font-semibold">{snapshot.actors.valach.herd} ovcí</span>
                          </div>
                        </div>
                      </div>

                      {/* Inkvizitor */}
                      <div className={`p-4 rounded-lg border space-y-2 ${snapshot.actors.inkvizitor.active ? "bg-red-950/20 border-red-500/25" : "bg-charcoal/40 border-gray-800/60"}`}>
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-semibold text-rose-400 flex items-center gap-1">
                            <ShieldAlert className="h-3.5 w-3.5" /> Inkviziční dohled (Inquisition)
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${snapshot.actors.inkvizitor.active ? "bg-red-500 text-charcoal" : "bg-gray-800 text-gray-400"}`}>
                            {snapshot.actors.inkvizitor.active ? "AKTIVNÍ V OKOLÍ" : "NEAKTIVNÍ"}
                          </span>
                        </div>
                        <div className="space-y-1 text-[11px]">
                          <div className="flex justify-between text-gray-400">
                            <span>Míra podezření a napětí</span>
                            <span className={`font-mono font-bold ${snapshot.actors.inkvizitor.tension > 60 ? "text-red-400" : "text-gray-200"}`}>
                              {snapshot.actors.inkvizitor.tension} / 100
                            </span>
                          </div>
                          <div className="w-full bg-gray-900 h-1 rounded-full overflow-hidden">
                            <div className="bg-red-500 h-full" style={{ width: `${snapshot.actors.inkvizitor.tension}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Scriptorium Resources - 4 cols */}
                  <div className="lg:col-span-4 bg-charcoal-light/10 border border-monk-amber/10 p-5 rounded-xl space-y-4">
                    <h5 className="text-xs font-semibold text-gray-200 uppercase tracking-wider flex items-center gap-2">
                      <Wheat className="h-4 w-4 text-monk-amber" /> Klášterní sýpky & kasy
                    </h5>

                    <div className="space-y-3.5">
                      {/* Grain */}
                      <div className="flex items-center justify-between p-2.5 bg-charcoal/60 rounded-lg border border-gray-800/40">
                        <div className="flex items-center gap-2">
                          <Wheat className="h-5 w-5 text-amber-500" />
                          <div>
                            <span className="block text-xs font-semibold text-gray-200">Zásoby obilí</span>
                            <span className="text-[10px] text-gray-500">Míra obživy kláštera</span>
                          </div>
                        </div>
                        <span className="text-lg font-mono font-bold text-amber-400">{snapshot.resources.grain} <span className="text-xs text-gray-500">měřic</span></span>
                      </div>

                      {/* Wood */}
                      <div className="flex items-center justify-between p-2.5 bg-charcoal/60 rounded-lg border border-gray-800/40">
                        <div className="flex items-center gap-2">
                          <CloudRain className="h-5 w-5 text-orange-400" />
                          <div>
                            <span className="block text-xs font-semibold text-gray-200">Palivové dříví</span>
                            <span className="text-[10px] text-gray-500">Topení v zimě a na svícny</span>
                          </div>
                        </div>
                        <span className="text-lg font-mono font-bold text-orange-400">{snapshot.resources.wood} <span className="text-xs text-gray-500">sáhů</span></span>
                      </div>

                      {/* Grose */}
                      <div className="flex items-center justify-between p-2.5 bg-charcoal/60 rounded-lg border border-gray-800/40">
                        <div className="flex items-center gap-2">
                          <Coins className="h-5 w-5 text-yellow-500" />
                          <div>
                            <span className="block text-xs font-semibold text-gray-200">Pražské groše</span>
                            <span className="text-[10px] text-gray-500">Zlaté mince na nákupy</span>
                          </div>
                        </div>
                        <span className="text-lg font-mono font-bold text-yellow-500">{snapshot.resources.grose} <span className="text-xs text-gray-500">grošů</span></span>
                      </div>

                      {/* Piety resource */}
                      <div className="flex items-center justify-between p-2.5 bg-charcoal/60 rounded-lg border border-gray-800/40">
                        <div className="flex items-center gap-2">
                          <Church className="h-5 w-5 text-purple-400" />
                          <div>
                            <span className="block text-xs font-semibold text-gray-200">Duchovní milost</span>
                            <span className="text-[10px] text-gray-500">Boží požehnání</span>
                          </div>
                        </div>
                        <span className="text-lg font-mono font-bold text-purple-400">{snapshot.resources.piety} <span className="text-xs text-gray-500">b.</span></span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Live Chronicle Logs — What went, what goes */}
                <div className="bg-charcoal-light/10 border border-monk-amber/10 p-5 rounded-xl space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800/60 pb-3">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-monk-amber" />
                      <h5 className="text-xs font-semibold text-gray-200 uppercase tracking-wider">
                        Klášterní kronika (The Chronicle Feed) — Posledních 20 událostí
                      </h5>
                    </div>
                    
                    {/* Filters */}
                    <div className="flex gap-2">
                      <select
                        value={feedSourceFilter}
                        onChange={(e) => setFeedSourceFilter(e.target.value)}
                        className="bg-charcoal border border-gray-800 text-xs text-gray-300 rounded px-2.5 py-1 focus:outline-none focus:border-monk-amber/40"
                      >
                        <option value="all">Všechny zdroje</option>
                        <option value="monastery_internal">Monastery (Klášter)</option>
                        <option value="local_events">Local events (Okolí)</option>
                        <option value="distant_events">Distant news (Z dálky)</option>
                        <option value="gm">Abbot/GM overrides</option>
                      </select>

                      <input
                        type="text"
                        placeholder="Hledat v kronice..."
                        value={feedSearch}
                        onChange={(e) => setFeedSearch(e.target.value)}
                        className="bg-charcoal border border-gray-800 text-xs text-gray-300 rounded px-2.5 py-1 focus:outline-none focus:border-monk-amber/40"
                      />
                    </div>
                  </div>

                  {/* Log list */}
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                    {snapshot.chronicle
                      .filter((log) => {
                        if (feedSourceFilter !== "all" && log.source !== feedSourceFilter) return false;
                        if (feedSearch && !log.text.toLowerCase().includes(feedSearch.toLowerCase())) return false;
                        return true;
                      })
                      .map((log, index) => {
                        let srcColor = "text-monk-amber border-monk-amber/20 bg-monk-amber/5";
                        if (log.source === "local_events") srcColor = "text-emerald-400 border-emerald-500/20 bg-emerald-500/5";
                        if (log.source === "distant_events") srcColor = "text-blue-400 border-blue-500/20 bg-blue-500/5";
                        if (log.source === "gm") srcColor = "text-purple-400 border-purple-500/20 bg-purple-500/5";

                        return (
                          <div
                            key={index}
                            className="bg-charcoal/20 border border-gray-800/80 p-3.5 rounded-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-3 hover:border-gray-700/60 transition-all"
                          >
                            <div className="space-y-1 flex-1">
                              <p className="text-xs text-gray-300 font-serif leading-relaxed font-medium">
                                "{log.text}"
                              </p>
                              <div className="flex flex-wrap items-center gap-2 text-[10px] text-gray-500">
                                <span>Klášterní den: <strong className="text-gray-400 font-mono">Den {log.day}</strong></span>
                                <span>•</span>
                                <span>Tick: <strong className="text-gray-400 font-mono">#{log.tick}</strong></span>
                              </div>
                            </div>

                            <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded border ${srcColor} shrink-0`}>
                              {log.source_label || log.source}
                            </span>
                          </div>
                        );
                      })}

                    {snapshot.chronicle.length === 0 && (
                      <div className="text-center py-8 text-gray-500 text-xs font-serif italic">
                        Kronika pro vybraná kritéria neobsahuje žádné záznamy.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-16 border border-dashed border-monk-amber/20 rounded-xl space-y-3">
                <ShieldAlert className="h-8 w-8 text-monk-amber mx-auto animate-pulse" />
                <p className="text-sm font-serif text-gray-400">Chronicon snapshot nebyl dosud načten.</p>
                <p className="text-xs text-gray-500">Klikněte na tlačítko "Synchronizovat" pro stažení živých dat.</p>
              </div>
            )}
          </motion.div>
        )}

        {/* TAB 3: EVENT DATABASE BROWSER */}
        {activeSubTab === "events" && (
          <motion.div
            key="events-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Filter database bar */}
            <div className="bg-charcoal-light/30 border border-monk-amber/10 p-4 rounded-xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div className="flex bg-charcoal/80 p-1 rounded-lg border border-gray-800">
                <button
                  onClick={() => setDbSourceFilter("local")}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    dbSourceFilter === "local"
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  🏡 Místní drby (Local)
                </button>
                <button
                  onClick={() => setDbSourceFilter("distant")}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    dbSourceFilter === "distant"
                      ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  🌎 Zprávy z dálky (Distant)
                </button>
                <button
                  onClick={() => setDbSourceFilter("monastery")}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    dbSourceFilter === "monastery"
                      ? "bg-monk-amber/20 text-monk-amber border border-monk-amber/30"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  ⛪ Klášterní život (Monastery)
                </button>
              </div>

              {/* Keyword Search */}
              <div className="relative flex-1 max-w-sm">
                <input
                  type="text"
                  placeholder={`Hledat v ${dbSourceFilter === "local" ? "místních" : dbSourceFilter === "distant" ? "vzdálených" : "interních"} událostech...`}
                  value={dbSearch}
                  onChange={(e) => setDbSearch(e.target.value)}
                  className="w-full bg-charcoal border border-gray-800 rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-monk-amber/40"
                />
              </div>
            </div>

            {loadingEvents ? (
              <div className="text-center py-16 space-y-3">
                <RefreshCw className="h-6 w-6 text-monk-amber animate-spin mx-auto" />
                <p className="text-xs text-gray-400">Načítám rozsáhlou knihovnu osudů a zvěstí z kroniky...</p>
              </div>
            ) : events ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center px-1">
                  <span className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold font-mono">
                    Celkem načteno: {events[dbSourceFilter].length} záznamů v datovém setu
                  </span>
                  
                  <span className="text-[11px] text-monk-amber flex items-center gap-1">
                    <Filter className="h-3 w-3" /> Filtr aktivní
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[550px] overflow-y-auto pr-2">
                  {events[dbSourceFilter]
                    .filter((ev) => {
                      if (dbSearch && !ev.text.toLowerCase().includes(dbSearch.toLowerCase())) return false;
                      return true;
                    })
                    .map((ev, i) => (
                      <div
                        key={i}
                        className="bg-charcoal-light/10 border border-gray-800/80 p-4 rounded-xl flex flex-col justify-between gap-4 hover:border-gray-700/60 transition-all relative group"
                      >
                        <div className="space-y-2">
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-mono text-[10px] text-gray-500 font-bold bg-charcoal p-1 rounded border border-gray-800">
                              ID: {ev.id || `ev_preset_${i}`}
                            </span>
                            <span className="text-[9px] uppercase tracking-wider font-mono text-gray-400 bg-gray-800/50 px-2 py-0.5 rounded">
                              {ev.source_label}
                            </span>
                          </div>

                          <p className="text-xs text-gray-300 font-serif leading-relaxed">
                            "{ev.text}"
                          </p>
                        </div>

                        {/* Force trigger button helper for GM */}
                        <div className="flex justify-between items-center border-t border-gray-800/60 pt-3 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-[10px] text-gray-500 font-mono">
                            Váha výběru: {ev.weight ?? 1}
                          </span>
                          <button
                            onClick={() => {
                              setEventInject(ev.id);
                              setActiveSubTab("gm");
                              showToast(`Event ID "${ev.id}" byl přenesen do pole Event Inject v GM Override!`, "info");
                            }}
                            className="text-[10px] text-monk-amber hover:text-white font-sans font-medium flex items-center gap-1 bg-charcoal px-2.5 py-1 rounded border border-monk-amber/20 hover:border-monk-amber/50 transition-all cursor-pointer"
                          >
                            Injektovat do hry <ArrowRight className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}

                  {events[dbSourceFilter].filter((ev) => {
                    if (dbSearch && !ev.text.toLowerCase().includes(dbSearch.toLowerCase())) return false;
                    return true;
                  }).length === 0 && (
                    <div className="col-span-2 text-center py-12 text-gray-500 text-xs italic font-serif">
                      Nebyly nalezeny žádné záznamy odpovídající hledanému klíči.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-16 border border-dashed border-gray-800 rounded-xl space-y-3">
                <Database className="h-8 w-8 text-gray-500 mx-auto" />
                <p className="text-sm font-serif text-gray-400">Sety událostí nebyly dosud staženy z repozitáře.</p>
                <button
                  onClick={fetchEvents}
                  className="bg-charcoal hover:bg-monk-amber/10 text-xs text-monk-amber px-3 py-1.5 rounded-lg border border-monk-amber/20 hover:border-monk-amber/50 cursor-pointer"
                >
                  Načíst databázi
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
