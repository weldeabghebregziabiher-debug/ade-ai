
import React, { useState, useEffect, useRef } from 'react';
import { AppStep, Message, InteractionMode, GroundingLink } from './types';
import { ChatBubble } from './components/ChatBubble';
import { askAssistantStream, translateImage } from './services/geminiService';

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [mode, setMode] = useState<InteractionMode>('concise');
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || 
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTranslationMode, setIsTranslationMode] = useState(false);
  
  // Robust session tracking to prevent stale AI updates after clearing
  const sessionIdRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  const generateGreeting = () => {
    const greetingMsg: Message = {
      role: 'assistant',
      content: 'ሰላም! እንኳዕ ብደሓን መጻእኩም። ዝኾነ ሓገዝ ምስ እትደልዩ ኩሉ ግዜ ኣብዚ ኣለኹልኩም።',
      timestamp: Date.now()
    };
    setMessages([greetingMsg]);
  };

  // Initial mount greeting
  useEffect(() => {
    if (messages.length === 0) {
      generateGreeting();
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isProcessing]);

  const addMessage = (role: 'user' | 'assistant', content: string, image?: string, groundingLinks?: GroundingLink[]) => {
    setMessages(prev => [...prev, { role, content, image, timestamp: Date.now(), groundingLinks }]);
  };

  const updateLastAssistantMessage = (chunk: string, sid: number) => {
    // Only update if this chunk belongs to the current active session
    if (sid !== sessionIdRef.current) return;
    
    setMessages(prev => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      if (last && last.role === 'assistant') {
        return [
          ...prev.slice(0, -1),
          { ...last, content: last.content + chunk }
        ];
      }
      return prev;
    });
  };

  const finalizeLastAssistantMessage = (links: GroundingLink[] | undefined, sid: number) => {
    if (sid !== sessionIdRef.current) return;
    
    setMessages(prev => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      if (last && last.role === 'assistant') {
        return [
          ...prev.slice(0, -1),
          { ...last, groundingLinks: links }
        ];
      }
      return prev;
    });
  };

  const handleFullReset = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm("ታሪኽ ክድምሰስ ርግጸኛ ዲኹም?")) {
      sessionIdRef.current += 1; // Invalidate current background processes
      setMessages([]);
      setInputText('');
      setIsProcessing(false);
      setIsTranslationMode(false);
      // Immediate re-greeting
      generateGreeting();
    }
  };

  const handleClearChat = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm("ዝርርብ ክጸሪ ርግጸኛ ዲኹም?")) {
      sessionIdRef.current += 1; // Invalidate current background processes
      setMessages([]);
      setInputText('');
      setIsProcessing(false);
      setIsTranslationMode(false);
    }
  };

  const handleInteraction = async (text: string) => {
    const currentSid = sessionIdRef.current;
    setIsProcessing(true);
    addMessage('assistant', '');
    
    try {
      await askAssistantStream(
        text, 
        messages, 
        mode, 
        (chunk) => updateLastAssistantMessage(chunk, currentSid),
        (links) => {
          if (currentSid === sessionIdRef.current) {
            finalizeLastAssistantMessage(links, currentSid);
            setIsProcessing(false);
          }
        }
      );
    } catch (err) {
      if (currentSid === sessionIdRef.current) {
        updateLastAssistantMessage("👉 ርክብ ተቋሪጹ።", currentSid);
        setIsProcessing(false);
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const currentSid = sessionIdRef.current;
    setIsProcessing(true);
    
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(',')[1];
      
      if (currentSid !== sessionIdRef.current) {
        setIsProcessing(false);
        return;
      }

      addMessage('user', 'ስእሊ ተላኢኹ።', base64);
      addMessage('assistant', "🔍 ስእሊ ይምርመር ኣሎ...");
      
      try {
        const result = await translateImage(base64);
        if (currentSid === sessionIdRef.current) {
          setMessages(prev => [...prev.slice(0, -1), { 
            role: 'assistant', content: result.translation || result.error || "👉 ሓበሬታ ኣይተረኽበን።", timestamp: Date.now() 
          }]);
        }
      } catch (err) {
        if (currentSid === sessionIdRef.current) {
          setMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: "👉 ጌጋ ተፈጢሩ።", timestamp: Date.now() }]);
        }
      } finally {
        if (currentSid === sessionIdRef.current) {
          setIsProcessing(false);
        }
      }
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const val = inputText.trim();
    if (!val || isProcessing) return;
    
    setInputText('');
    const finalInput = isTranslationMode ? `Short translation into Tigrinya: "${val}"` : val;
    addMessage('user', isTranslationMode ? `ተርጉም: ${val}` : val);
    setIsTranslationMode(false);
    await handleInteraction(finalInput);
  };

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto bg-slate-50 dark:bg-slate-950 shadow-2xl overflow-hidden md:my-6 md:rounded-[2.5rem] border border-slate-200/60 dark:border-slate-800/60 transition-all duration-500">
      
      {/* Sleek Header */}
      <header className="glass sticky top-0 z-20 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-indigo-500 to-brand-600 w-10 h-10 flex items-center justify-center rounded-2xl shadow-lg text-xl">
            ✨
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">Ade AI</h1>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">Active • ትግርኛ</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            type="button"
            onClick={() => setDarkMode(!darkMode)}
            className="p-2.5 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-all border border-slate-100 dark:border-slate-700 shadow-sm"
          >
            {darkMode ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" /></svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
            )}
          </button>
        </div>
      </header>

      {/* Modern Pill Mode Toggle */}
      <div className="px-6 py-3 shrink-0 flex justify-center">
        <div className="bg-slate-100 dark:bg-slate-800/50 p-1 rounded-2xl flex items-center gap-1 border border-slate-200/50 dark:border-slate-700/50">
          <button
            type="button"
            onClick={() => setMode('concise')}
            className={`px-4 py-1.5 rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition-all duration-300 ${
              mode === 'concise' 
              ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
              : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            ቅልጡፍ
          </button>
          <button
            type="button"
            onClick={() => setMode('detailed')}
            className={`px-4 py-1.5 rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition-all duration-300 ${
              mode === 'detailed' 
              ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
              : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            ዕምቆት
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <main 
        ref={scrollRef}
        className="flex-1 overflow-y-auto chat-scroll px-4 md:px-8 py-4 space-y-4"
      >
        {messages.map((msg, idx) => (
          <ChatBubble key={`${msg.timestamp}-${idx}`} message={msg} />
        ))}
        {isProcessing && (
          <div className="flex justify-start items-center gap-3 ml-2">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"></span>
            </div>
          </div>
        )}
      </main>

      {/* Modern Footer Toolbar & Input */}
      <footer className="px-6 pb-6 pt-2 shrink-0 glass border-t border-slate-100/50 dark:border-slate-800/50">
        <div className="flex flex-col gap-3">
          
          {/* Action Row - Stabilized Controls */}
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2">
              <button 
                type="button"
                onClick={handleFullReset}
                className="group flex items-center gap-1.5 px-3 py-2 bg-rose-50 dark:bg-rose-950/30 text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded-xl transition-all border border-rose-200/50 dark:border-rose-900/50 shadow-sm active:scale-95"
                title="Full Reset"
              >
                <svg className="w-3.5 h-3.5 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span className="text-[9px] font-black uppercase tracking-tight">ታሪኽ ደምስስ</span>
              </button>

              <button 
                type="button"
                onClick={handleClearChat}
                className="group flex items-center gap-1.5 px-3 py-2 bg-amber-50 dark:bg-amber-950/30 text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/50 rounded-xl transition-all border border-amber-200/50 dark:border-amber-900/50 shadow-sm active:scale-95"
                title="Clear Screen"
              >
                <svg className="w-3.5 h-3.5 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span className="text-[9px] font-black uppercase tracking-tight">ዝርርብ ኣጽርዮ</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" />
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl transition-all border border-slate-200/50 dark:border-slate-700/50"
                title="Scan Image"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </button>
              
              <button 
                type="button"
                onClick={() => setIsTranslationMode(!isTranslationMode)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all font-black text-[9px] uppercase border shadow-sm ${
                  isTranslationMode 
                  ? 'bg-indigo-600 text-white border-indigo-700' 
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                ተርጉም
              </button>
            </div>
          </div>

          {/* Integrated Input Form */}
          <form onSubmit={handleSubmit} className="relative group">
            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-2xl p-1.5 focus-within:border-indigo-500/50 dark:focus-within:border-indigo-500/5 focus-within:ring-4 focus-within:ring-indigo-500/5 transition-all duration-300 shadow-sm">
              <input 
                ref={textInputRef}
                type="text" 
                value={inputText} 
                onChange={(e) => setInputText(e.target.value)}
                disabled={isProcessing}
                placeholder={isTranslationMode ? "ተርጉም..." : "ሕቶኹም ኣብዚ ጽሓፉ..."}
                className="flex-1 bg-transparent px-3 py-2 text-sm font-bold text-slate-800 dark:text-slate-100 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-600"
              />
              
              <div className="flex items-center gap-1 pr-1">
                <button 
                  type="submit" 
                  disabled={!inputText.trim() || isProcessing}
                  className="bg-indigo-600 dark:bg-indigo-500 text-white p-2 rounded-xl hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-30 disabled:grayscale transition-all shadow-md active:scale-90"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 5l7 7-7 7" /></svg>
                </button>
              </div>
            </div>
          </form>
          
          <p className="text-[8px] text-center font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">Powered by Ade AI 4.0 Core</p>
        </div>
      </footer>
    </div>
  );
};

export default App;
