import React, { useState } from 'react';
import { Message } from '../types';

interface ChatBubbleProps {
  message: Message;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ message }) => {
  const isAssistant = message.role === 'assistant';
  const [copied, setCopied] = useState(false);

  const displayContent = message.content.replace(/\*\*/g, '').trim();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {}
  };

  return (
    <div className={`flex w-full ${isAssistant ? 'justify-start' : 'justify-end animate-in slide-in-from-right-4 duration-300'}`}>
      <div className={`relative max-w-[90%] md:max-w-[85%] rounded-3xl p-4 shadow-sm group transition-all duration-300 border ${
        isAssistant 
          ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border-slate-100 dark:border-slate-800 rounded-tl-none hover:shadow-md' 
          : 'bg-indigo-600 dark:bg-indigo-500 text-white border-transparent rounded-tr-none shadow-indigo-200 dark:shadow-none'
      }`}>
        
        {isAssistant && (
          <button
            onClick={handleCopy}
            className="absolute -top-3 -right-3 p-1.5 rounded-xl bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 opacity-0 group-hover:opacity-100 transition-all border border-slate-100 dark:border-slate-700 shadow-md hover:text-indigo-600 dark:hover:text-indigo-400"
          >
            {copied ? (
              <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            )}
          </button>
        )}

        {message.image && (
          <div className="mb-3 overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
             <img 
              src={`data:image/jpeg;base64,${message.image}`} 
              alt="Scan" 
              className="w-full h-auto object-cover max-h-64"
            />
          </div>
        )}
        
        <div className="text-sm md:text-[15px] leading-relaxed whitespace-pre-wrap font-medium">
          {displayContent}
        </div>

        {isAssistant && message.groundingLinks && message.groundingLinks.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex flex-wrap gap-1.5">
              {message.groundingLinks.map((link, i) => (
                <a 
                  key={i}
                  href={link.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[9px] font-bold bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 px-2 py-1 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-700 transition-colors"
                >
                  🔗 {link.title}
                </a>
              ))}
            </div>
          </div>
        )}
        
        <div className={`flex items-center justify-between mt-3 text-[8px] font-bold uppercase tracking-widest ${isAssistant ? 'text-slate-400 dark:text-slate-600' : 'text-indigo-200'}`}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          {copied && <span className="text-emerald-500 animate-pulse">ተቐዲሑ</span>}
        </div>
      </div>
    </div>
  );
};