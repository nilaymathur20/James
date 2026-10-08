import React, { useState, useEffect } from "react";
import { ShellProvider } from "@/store/shellStore";
import { Header } from "@/components/layout/Header";
import { ChatContainer } from "@/components/chat/ChatContainer";
import { Composer } from "@/components/composer/Composer";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { ImageGeneratorModal } from "@/components/media/ImageGeneratorModal";
import { ImageLibraryModal } from "@/components/media/ImageLibraryModal";
import type { ChatMessage, ServiceStatus, LiveChannelState, PrivacyMode } from "@/types";
import {
  FileText,
  Languages,
  MessageSquare,
  Upload,
  Search,
  CheckCircle2,
  AlertCircle,
  FileSearch,
  Sparkles,
  BookOpen,
  History,
  ShieldCheck,
  Key,
  Trash2,
  RefreshCw,
  Info,
  User,
  Bot
} from "lucide-react";

const API_BASE = "";

function PolicyFAQView() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [answerData, setAnswerData] = useState<any>(null);
  const [uploadStatus, setUploadStatus] = useState("");


  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadStatus("Uploading document to municipal storage...");
    
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      const res = await fetch(`${API_BASE}/api/municipal/documents/upload`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      setUploadStatus("Indexing document pages & sentence windows into FTS5 RAG...");
      const indexRes = await fetch(`${API_BASE}/api/municipal/documents/index`, {
        method: "POST",
      });
      if (!indexRes.ok) throw new Error("Indexing failed");
      setUploadStatus("Document indexed & source-grounded citations ready!");
    } catch (err: any) {
      setUploadStatus(`Error: ${err.message || "Failed to process document"}`);
    }
  };

  const handleLoadDemo = async () => {
    setUploadStatus("Loading official Municipal Housing Scheme 2026 guidelines...");
    try {
      await fetch(`${API_BASE}/api/municipal/demo-data`);
      await fetch(`${API_BASE}/api/municipal/documents/index`, { method: "POST" });
      setUploadStatus("Demo Housing Scheme Guidelines 2026 loaded and indexed!");
    } catch {
      setUploadStatus("Failed to load demo documents.");
    }
  };

  const handleQuery = async (searchQuery?: string) => {
    const q = searchQuery || query;
    if (!q) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/municipal/faq/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      setAnswerData(data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 text-slate-100">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-900/60 via-indigo-900/50 to-slate-900 border border-blue-500/30 rounded-2xl p-6 shadow-2xl backdrop-blur-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-blue-400 font-semibold text-xs tracking-wider uppercase mb-1">
            <BookOpen size={16} /> Municipal Policy Grounded RAG Pipeline
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Source-Grounded Policy FAQ Engine</h2>
          <p className="text-slate-300 text-sm mt-1 max-w-xl">
            Upload official municipal circulars, housing schemes, or tax notices. Get answers grounded strictly in retrieved document passages with page & paragraph citations.
          </p>
        </div>
        <button
          onClick={handleLoadDemo}
          className="px-5 py-2.5 rounded-xl bg-blue-600/30 hover:bg-blue-600/50 border border-blue-400/40 text-blue-200 text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap shadow-lg shadow-blue-950/60"
        >
          <Sparkles size={16} className="text-blue-400" />
          Load Demo Scheme Guidelines
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Card */}
        <div className="lg:col-span-1 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between backdrop-blur-md">
          <div>
            <h3 className="text-base font-semibold text-white mb-2 flex items-center gap-2">
              <Upload size={18} className="text-blue-400" /> Upload PDF / Scheme Notice
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Extracts text blocks using PyMuPDF & sentence-window indexing.
            </p>
            <label className="border-2 border-dashed border-slate-700/80 hover:border-blue-500/60 bg-slate-950/60 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all text-center group">
              <FileText size={36} className="text-slate-500 group-hover:text-blue-400 transition-colors mb-2" />
              <span className="text-xs font-semibold text-slate-200">Click to upload document</span>
              <span className="text-[11px] text-slate-500 mt-1">PDF, DOCX, TXT up to 10MB</span>
              <input type="file" accept=".pdf,.docx,.txt,.md" onChange={handleUpload} className="hidden" />
            </label>
          </div>
          {uploadStatus && (
            <div className="mt-4 p-3 bg-blue-950/50 border border-blue-800/50 rounded-xl text-xs text-blue-300 font-medium flex items-center gap-2 shadow-inner">
              <CheckCircle2 size={16} className="text-blue-400 shrink-0" />
              <span>{uploadStatus}</span>
            </div>
          )}
        </div>

        {/* Query Area */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-md">
            <h3 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
              <Search size={18} className="text-blue-400" /> Search Policy & Scheme Guidelines
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleQuery()}
                placeholder="E.g., Who is eligible for the housing scheme?"
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
              <button
                onClick={() => handleQuery()}
                disabled={loading}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium text-sm transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-blue-950"
              >
                {loading ? "Searching RAG..." : "Ask Policy"}
              </button>
            </div>

            {/* Suggested Prompts */}
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="text-[11px] font-mono text-slate-500 self-center">Try:</span>
              {[
                "Who is eligible for this scheme?",
                "What documents are required?",
                "What is the application deadline?",
                "Property tax rebate percentage",
              ].map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setQuery(prompt);
                    handleQuery(prompt);
                  }}
                  className="text-xs bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 text-slate-300 px-3 py-1.5 rounded-lg transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          {/* Results Display */}
          {answerData && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6 backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                <div className="flex items-center gap-2">
                  {answerData.grounded ? (
                    <span className="inline-flex items-center gap-1.5 bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 text-xs font-semibold px-3 py-1 rounded-full">
                      <CheckCircle2 size={14} /> GROUNDED ANSWER
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 bg-amber-950/80 text-amber-400 border border-amber-500/30 text-xs font-semibold px-3 py-1 rounded-full">
                      <AlertCircle size={14} /> INSUFFICIENT EVIDENCE
                    </span>
                  )}
                </div>
                <span className="text-xs font-mono text-slate-400 uppercase">Confidence: {answerData.confidence || "High"}</span>
              </div>

              <div className="text-base text-slate-100 leading-relaxed font-sans whitespace-pre-wrap">
                {answerData.answer}
              </div>

              {answerData.fraud_warning && (
                <div className="p-3 bg-amber-950/40 border border-amber-800/40 rounded-xl text-xs text-amber-300 flex items-center gap-2">
                  <ShieldCheck size={16} className="text-amber-400 shrink-0" />
                  <span><strong>Fraud Prevention Check:</strong> {answerData.fraud_warning}</span>
                </div>
              )}

              {answerData.contact_info && (
                <div className="p-3.5 bg-blue-950/50 border border-blue-800/40 rounded-xl text-xs text-blue-300 flex items-center justify-between">
                  <span className="font-semibold text-blue-400 flex items-center gap-1.5">
                    <Info size={14} /> Official Support & Contact:
                  </span>
                  <span className="font-mono">{answerData.contact_info}</span>
                </div>
              )}

              {answerData.citations && answerData.citations.length > 0 && (
                <div className="border-t border-slate-800/80 pt-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <FileSearch size={14} className="text-blue-400" /> Source Citation Cards ({answerData.citations.length})
                  </h4>
                  <div className="space-y-3">
                    {answerData.citations.map((cite: any, i: number) => (
                      <div key={i} className="p-4 bg-slate-950/90 rounded-xl border border-slate-800 hover:border-slate-700 transition-colors">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-blue-400 mb-2">
                          <span className="font-semibold text-slate-200">{cite.document_id || cite.source}</span>
                          <div className="flex gap-2 text-[11px] text-slate-400">
                            {cite.page && <span className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">Page {cite.page}</span>}
                            {cite.paragraph && <span className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">Para {cite.paragraph}</span>}
                          </div>
                        </div>
                        <p className="text-xs text-slate-300 italic bg-slate-900/70 p-3 rounded-lg border border-slate-800/50 leading-relaxed">
                          "{cite.snippet}"
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NoticeTranslatorView() {
  const [loading, setLoading] = useState(false);
  const [ocrText, setOcrText] = useState("");
  const [targetLang, setTargetLang] = useState("Hindi");
  const [analysis, setAnalysis] = useState<any>(null);
  const [ocrStatus, setOcrStatus] = useState("");

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setLoading(true);
    setOcrStatus("Running PyMuPDF & Tesseract OCR on notice file...");
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      const res = await fetch(`${API_BASE}/api/municipal/notices/ocr`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setOcrText(data.ocr_text || "");
      setOcrStatus("OCR Text Successfully Extracted!");
    } catch (err) {
      console.error(err);
      setOcrStatus("OCR processing error.");
    }
    setLoading(false);
  };

  const handleTranslate = async () => {
    if (!ocrText) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/municipal/notices/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: ocrText, target_language: targetLang }),
      });
      const data = await res.json();
      setAnalysis(data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 text-slate-100">
      <div className="bg-gradient-to-r from-purple-900/60 via-indigo-900/40 to-slate-900 border border-purple-500/30 rounded-2xl p-6 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-2 text-purple-400 font-semibold text-xs tracking-wider uppercase mb-1">
          <Languages size={16} /> Multilingual Notice & Jargon Analyzer
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Public Notice Translator & Plain-Language Engine</h2>
        <p className="text-slate-300 text-sm mt-1 max-w-2xl">
          Upload public notice screenshots or circular PDFs. Extracts text via OCR, translates into Indian regional languages, explains administrative jargon, and generates a crisp 3-bullet plain-language summary.
        </p>
      </div>

      {/* Upload Zone */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-md">
        <h3 className="text-base font-semibold text-white mb-2 flex items-center gap-2">
          <Upload size={18} className="text-purple-400" /> Upload Printed Notice / Scan (JPG, PNG, PDF)
        </h3>
        <label className="border-2 border-dashed border-slate-700/80 hover:border-purple-500/60 bg-slate-950/60 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all text-center group">
          <FileText size={36} className="text-slate-500 group-hover:text-purple-400 transition-colors mb-2" />
          <span className="text-xs font-semibold text-slate-200">Click to upload notice image or scan</span>
          <span className="text-[11px] text-slate-500 mt-1">PNG, JPG, JPEG, PDF up to 10MB</span>
          <input type="file" accept=".png,.jpg,.jpeg,.pdf" onChange={handleUpload} className="hidden" />
        </label>
        {ocrStatus && <p className="text-xs font-medium text-purple-400 mt-3">{ocrStatus}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Text & Controls */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4 backdrop-blur-md">
          <h3 className="text-sm font-semibold text-slate-200">Notice Text (OCR Extracted or Paste)</h3>
          <textarea
            value={ocrText}
            onChange={(e) => setOcrText(e.target.value)}
            placeholder="Paste notice text or upload an image above..."
            className="w-full h-56 p-4 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono text-slate-200 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
          />
          <div className="flex items-center gap-3">
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-purple-500"
            >
              <option value="Hindi">Hindi (हिन्दी)</option>
              <option value="English">English</option>
              <option value="Marathi">Marathi (मराठी)</option>
              <option value="Bengali">Bengali (বাংলা)</option>
              <option value="Gujarati">Gujarati (ગુજરાતી)</option>
              <option value="Tamil">Tamil (தமிழ்)</option>
              <option value="Telugu">Telugu (తెలుగు)</option>
              <option value="Kannada">Kannada (ಕನ್ನಡ)</option>
            </select>
            <button
              onClick={handleTranslate}
              disabled={loading || !ocrText}
              className="flex-1 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-medium text-sm transition-all disabled:opacity-50 shadow-lg shadow-purple-950"
            >
              {loading ? "Analyzing Notice..." : "Translate & Analyze"}
            </button>
          </div>
        </div>

        {/* Right: Output */}
        {analysis ? (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6 backdrop-blur-md">
            <div>
              <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-2">Translation ({targetLang})</h4>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-sm text-slate-200 leading-relaxed font-sans whitespace-pre-wrap">
                {analysis.translation}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                <CheckCircle2 size={14} /> 3-Bullet Plain-Language Summary
              </h4>
              <ul className="space-y-2.5 bg-emerald-950/40 border border-emerald-500/20 p-4 rounded-xl text-sm text-emerald-200 font-medium">
                {analysis.summary?.map((bullet: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2 leading-relaxed">
                    <span className="text-emerald-400 font-bold shrink-0">•</span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800">
                <div className="text-[10px] font-mono text-slate-500 uppercase">Deadline / Date</div>
                <div className="text-sm font-semibold text-slate-200 mt-0.5">{analysis.deadline || "Refer to notice text"}</div>
              </div>
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800">
                <div className="text-[10px] font-mono text-slate-500 uppercase">Office Location</div>
                <div className="text-sm font-semibold text-slate-200 mt-0.5">{analysis.office || "Ward Office"}</div>
              </div>
            </div>

            {analysis.jargon && analysis.jargon.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-3">Jargon Explainer (Government Terms)</h4>
                <div className="space-y-2.5">
                  {analysis.jargon.map((j: any, i: number) => (
                    <div key={i} className="p-3.5 bg-slate-950 rounded-xl border border-slate-800">
                      <span className="text-xs font-bold text-purple-300">{j.term}</span>
                      <p className="text-xs text-slate-400 mt-1">{j.explanation}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-8 flex flex-col items-center justify-center text-center text-slate-500">
            <Languages size={40} className="mb-3 text-slate-600" />
            <p className="text-sm">Upload or paste a notice to see translation & 3-bullet plain language summary.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function HistoryView({ onSelectPrompt }: { onSelectPrompt: (text: string) => void }) {
  const [history, setHistory] = useState<any[]>([]);
  const [token, setToken] = useState("");
  const [userHash, setUserHash] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const storedToken = localStorage.getItem("james_auth_token");
      const headers: Record<string, string> = {};
      if (storedToken) {
        headers["Authorization"] = `Bearer ${storedToken}`;
      }
      const res = await fetch(`${API_BASE}/api/chat/history`, { headers });
      const data = await res.json();
      setHistory(data.messages || []);
      setToken(data.token || storedToken || "");
      setUserHash(data.hashed_ip || "");
      if (data.token) {
        localStorage.setItem("james_auth_token", data.token);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleClear = async () => {
    const storedToken = localStorage.getItem("james_auth_token");
    const headers: Record<string, string> = {};
    if (storedToken) {
      headers["Authorization"] = `Bearer ${storedToken}`;
    }
    await fetch(`${API_BASE}/api/chat/clear`, { method: "POST", headers });
    setHistory([]);
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 text-slate-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 font-semibold text-xs tracking-wider uppercase mb-1">
            <History size={16} /> Persistent Session History
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Saved Chat History (JWT Auth)</h2>
          <p className="text-slate-400 text-sm mt-1 max-w-xl">
            Conversations are encrypted & persisted locally using JWT tokens based on your client session.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchHistory}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium transition-colors flex items-center gap-2"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
          <button
            onClick={handleClear}
            className="px-4 py-2 bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/40 text-rose-300 rounded-xl text-xs font-medium transition-colors flex items-center gap-2"
          >
            <Trash2 size={14} /> Clear History
          </button>
        </div>
      </div>

      {/* Auth Info Token Badge */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-slate-300">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-emerald-400" />
          <span>User Hash: <span className="text-indigo-400 font-bold">{userHash ? `${userHash.slice(0, 16)}...` : "Active"}</span></span>
        </div>
        <div className="flex items-center gap-2">
          <Key size={14} className="text-amber-400" />
          <span>JWT Token: <span className="text-emerald-400 font-semibold">{token ? `${token.slice(0, 20)}...` : "Active Token"}</span></span>
        </div>
      </div>


      {/* History Timeline */}
      <div className="space-y-4">
        {history.length === 0 ? (
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-12 text-center text-slate-500">
            <History size={48} className="mx-auto mb-3 opacity-40" />
            <h3 className="text-base font-semibold text-slate-300">No chat history yet</h3>
            <p className="text-xs text-slate-500 mt-1">Start a conversation in the James Assistant Chat tab to see your persisted messages here.</p>
          </div>
        ) : (
          history.map((item, idx) => (
            <div
              key={idx}
              className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-xl p-4 transition-all space-y-2 group"
            >
              <div className="flex items-center justify-between text-xs">
                <span className={`font-semibold flex items-center gap-1.5 ${item.role === "user" ? "text-blue-400" : "text-emerald-400"}`}>
                  {item.role === "user" ? <User size={14} /> : <Bot size={14} />}
                  {item.role === "user" ? "You" : "James Assistant"}
                </span>
                <span className="text-slate-500 font-mono text-[11px]">
                  {item.timestamp ? new Date(item.timestamp * 1000).toLocaleTimeString() : ""}
                </span>
              </div>
              <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{item.content}</p>
              {item.role === "user" && (
                <button
                  onClick={() => onSelectPrompt(item.content)}
                  className="opacity-0 group-hover:opacity-100 text-xs text-indigo-400 hover:underline transition-opacity pt-1 flex items-center gap-1"
                >
                  <RefreshCw size={12} /> Re-run prompt
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function App() {
  const [activeTab, setActiveTab] = useState<"chat" | "policy" | "notice" | "history">("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [activity, setActivity] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isImageGenOpen, setIsImageGenOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [privacyMode, setPrivacyMode] = useState<PrivacyMode>("cloud");
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus>({
    state: "online",
    chunks: 14,
    provider: "gemini",
    historyAvailable: true,
  });
  const [liveState] = useState<LiveChannelState>("connected");

  const refreshHealth = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/health`);
      if (res.ok) {
        const data = await res.json();
        setServiceStatus({
          state: "online",
          chunks: data.chunks || data.indexed_chunks || 14,
          provider: data.provider || "gemini",
          historyAvailable: true,
        });
        if (data.mode) {
          setPrivacyMode(data.mode as PrivacyMode);
        }
      }
    } catch {
      setServiceStatus((prev) => ({ ...prev, state: "offline" }));
    }
  };

  useEffect(() => {
    refreshHealth();
  }, []);

  const handleSaveKeys = async (keys: Record<string, string>) => {
    const res = await fetch(`${API_BASE}/api/settings/keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keys }),
    });
    if (!res.ok) throw new Error("Failed to save API keys");
    await refreshHealth();
  };

  const handleChangeMode = async (mode: PrivacyMode) => {
    setPrivacyMode(mode);
    const res = await fetch(`${API_BASE}/api/settings/privacy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    if (!res.ok) throw new Error("Failed to update privacy mode");
    await refreshHealth();
  };

  const handleSend = async (text: string) => {
    const userMsg: ChatMessage = {
      id: crypto.randomUUID?.() || `${Date.now()}`,
      role: "user",
      content: text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);
    setActivity("Processing request...");

    try {
      const storedToken = localStorage.getItem("james_auth_token");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (storedToken) {
        headers["Authorization"] = `Bearer ${storedToken}`;
      }

      const res = await fetch(`${API_BASE}/api/assistant`, {
        method: "POST",
        headers,
        body: JSON.stringify({ text, use_history: true }),
      });
      const data = await res.json();

      if (data.token) {
        localStorage.setItem("james_auth_token", data.token);
      }
      
      const botMsg: ChatMessage = {
        id: crypto.randomUUID?.() || `${Date.now()}`,
        role: "assistant",
        content: data.response || "No response received.",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        kind: data.kind,
        sources: data.results || [],
        mediaUrl: data.media_url || data.mediaUrl,
        mediaType: data.media_type || data.mediaType,
        steps: data.steps || [],
        toolProposals: data.tool_proposals || [],
        fileCandidates: data.file_candidates || [],
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID?.() || `${Date.now()}`,
        role: "assistant",
        content: `Error connecting to backend: ${err.message || "Request failed"}`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setSending(false);
      setActivity("");
    }
  };

  return (
    <ShellProvider>
      <div className="app-shell min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        {/* James Header */}
        <Header
          service={serviceStatus}
          liveState={liveState}
          onRefreshHealth={refreshHealth}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenImageGen={() => setIsImageGenOpen(true)}
          onOpenLibrary={() => setIsLibraryOpen(true)}
        />

        {/* Tab Navigation Bar */}
        <div className="bg-slate-900/90 border-b border-slate-800/80 px-6 backdrop-blur-md sticky top-[64px] z-30 shadow-md">
          <div className="max-w-6xl mx-auto flex gap-1">
            <button
              onClick={() => setActiveTab("chat")}
              className={`py-3.5 px-5 font-semibold text-sm border-b-2 transition-all flex items-center gap-2 ${
                activeTab === "chat"
                  ? "border-blue-500 text-blue-400 bg-blue-950/30"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <MessageSquare size={16} /> James Assistant Chat
            </button>
            <button
              onClick={() => setActiveTab("policy")}
              className={`py-3.5 px-5 font-semibold text-sm border-b-2 transition-all flex items-center gap-2 ${
                activeTab === "policy"
                  ? "border-blue-500 text-blue-400 bg-blue-950/30"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <BookOpen size={16} /> Policy FAQ Generator
            </button>
            <button
              onClick={() => setActiveTab("notice")}
              className={`py-3.5 px-5 font-semibold text-sm border-b-2 transition-all flex items-center gap-2 ${
                activeTab === "notice"
                  ? "border-purple-500 text-purple-400 bg-purple-950/30"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Languages size={16} /> Notice Translator
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`py-3.5 px-5 font-semibold text-sm border-b-2 transition-all flex items-center gap-2 ${
                activeTab === "history"
                  ? "border-indigo-500 text-indigo-400 bg-indigo-950/30"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <History size={16} /> History (JWT Auth)
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col overflow-hidden bg-slate-950">
          {activeTab === "chat" && (
            <div className="flex-1 flex flex-col max-w-5xl w-full mx-auto p-4 overflow-hidden">
              <div className="flex-1 overflow-y-auto pr-2">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-xl shadow-blue-500/20 mb-4">
                      <Sparkles size={32} className="text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">Welcome to James Assistant</h2>
                    <p className="text-slate-400 text-sm max-w-md mb-6">
                      Your local-first assistant with built-in RAG, device management, and municipal policy capabilities.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-lg w-full">
                      <button
                        onClick={() => setActiveTab("policy")}
                        className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-blue-500/50 text-left transition-all group"
                      >
                        <div className="flex items-center gap-2 font-semibold text-sm text-blue-400 group-hover:text-blue-300">
                          <BookOpen size={16} /> Policy FAQ Mode
                        </div>
                        <p className="text-xs text-slate-400 mt-1">Upload municipal guidelines & query with page citations.</p>
                      </button>
                      <button
                        onClick={() => setActiveTab("notice")}
                        className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-purple-500/50 text-left transition-all group"
                      >
                        <div className="flex items-center gap-2 font-semibold text-sm text-purple-400 group-hover:text-purple-300">
                          <Languages size={16} /> Notice Translator Mode
                        </div>
                        <p className="text-xs text-slate-400 mt-1">OCR public notice photos, translate & extract 3 action bullets.</p>
                      </button>
                    </div>
                  </div>
                ) : (
                  <ChatContainer messages={messages} sending={sending} activity={activity} />
                )}
              </div>
              <Composer onSend={handleSend} />
            </div>
          )}

          {activeTab === "policy" && <PolicyFAQView />}
          {activeTab === "notice" && <NoticeTranslatorView />}
          {activeTab === "history" && (
            <HistoryView
              onSelectPrompt={(txt) => {
                setActiveTab("chat");
                handleSend(txt);
              }}
            />
          )}
        </main>

        {/* Modals */}
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          currentMode={privacyMode}
          onChangeMode={handleChangeMode}
          onSaveKeys={handleSaveKeys}
        />

        <ImageGeneratorModal
          isOpen={isImageGenOpen}
          onClose={() => setIsImageGenOpen(false)}
        />

        <ImageLibraryModal
          isOpen={isLibraryOpen}
          onClose={() => setIsLibraryOpen(false)}
        />
      </div>
    </ShellProvider>
  );
}

export default App;

