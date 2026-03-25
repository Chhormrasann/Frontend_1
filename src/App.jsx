import React, { useState, useRef, useEffect, memo } from 'react';
import {
  Send,
  Sparkles,
  Loader2,
  Copy,
  Check,
  Plus,
  ArrowUp,
  Layout,
  Share2,
  History,
  User,
  Settings,
  HelpCircle,
  X,
  Image as ImageIcon,
  Mic,
  Sun,
  Moon,
  Trash2,
  Lightbulb,
  Compass,
  Code,
  PenTool,
  Paperclip,
  Eye,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, prism } from 'react-syntax-highlighter/dist/esm/styles/prism';

import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/chat';

// Moved components OUTSIDE to prevent re-mounting on every keystroke
const CodeBlock = memo(({ language, value, theme, handleDownload, setPreviewCode }) => {
  const [copied, setCopied] = useState(false);
  
  const onCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isPreviewable = ['html', 'javascript', 'js', 'jsx', 'css', 'ts', 'tsx'].includes(language?.toLowerCase());

  return (
    <div className="code-card">
      <div className="code-header">
        <span className="code-lang">{language || 'code'}</span>
        <div className="code-actions">
          {isPreviewable && (
            <button className="mini-action-btn" onClick={() => setPreviewCode({ code: value, lang: language })}>
              <Eye size={14} /> Preview
            </button>
          )}
          <button className="mini-action-btn" onClick={() => handleDownload(value, language)}>
            <Download size={14} /> Download
          </button>
          <button className={`mini-action-btn ${copied ? 'success' : ''}`} onClick={onCopy}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      <SyntaxHighlighter
        language={language || 'text'}
        style={theme === 'dark' ? vscDarkPlus : prism}
        customStyle={{ 
          margin: 0, 
          padding: '24px', 
          fontSize: '0.9rem', 
          background: 'transparent',
          lineHeight: '1.5'
        }}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
});

const PreviewModal = memo(({ content, onClose }) => {
  const iframeRef = useRef(null);

  useEffect(() => {
    if (iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      let htmlContent = content.code;
      if (content.lang === 'css') {
          htmlContent = `<style>${content.code}</style><div style="font-family: sans-serif; padding: 20px;">Previewing CSS styles...</div>`;
      } else if (['javascript', 'js', 'jsx'].includes(content.lang)) {
          htmlContent = `
            <div id="root" style="font-family: sans-serif; padding: 20px;">Previewing Script Execution...</div>
            <script>${content.code}</script>
          `;
      } else if (!content.code.includes('<html')) {
          htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin: 0;">${content.code}</body></html>`;
      }
      doc.open();
      doc.write(htmlContent);
      doc.close();
    }
  }, [content]);

  return (
    <div className="preview-modal-overlay" onClick={onClose}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="preview-modal" 
        onClick={e => e.stopPropagation()}
      >
        <div className="preview-modal-header">
          <h3>Component Preview</h3>
          <button className="close-preview-btn" onClick={onClose}><X size={24} /></button>
        </div>
        <iframe title="preview" ref={iframeRef} className="preview-iframe" />
      </motion.div>
    </div>
  );
});

const FeatureCard = memo(({ text, icon: Icon, colorClass, index, setInput }) => (
  <motion.div 
    initial={{ opacity: 0, y: 40, filter: 'blur(10px)' }}
    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
    transition={{ delay: 0.1 * index, duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
    className="aura-card" 
    onClick={() => setInput(text)}
  >
    <div className="card-text">{text}</div>
    <div className="card-icon-container">
      <Icon className={colorClass} size={24} />
    </div>
  </motion.div>
));

function App() {
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem('chat_history');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to parse chat history", e);
      return [];
    }
  });

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [streamingMessage, setStreamingMessage] = useState('');
  const [previewCode, setPreviewCode] = useState(null);

  const messagesEndRef = useRef(null);

  const scrollToBottom = (instant = false) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: instant ? 'auto' : 'smooth',
        block: 'center'
      });
    }
  };

  useEffect(() => {
    scrollToBottom(isLoading);
  }, [messages, isLoading, streamingMessage]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: newMessages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) throw new Error('Failed to connect to the server');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;
          const dataStr = trimmedLine.replace(/^data: /, '').trim();
          if (dataStr === '[DONE]') break;
          try {
            const data = JSON.parse(dataStr);
            if (data.content) {
              assistantMessage += data.content;
              setStreamingMessage(assistantMessage);
            }
          } catch (e) {}
        }
      }
      setMessages(prev => [...prev, { role: 'assistant', content: assistantMessage }]);
      setStreamingMessage('');
      setIsLoading(false);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${error.message}` }]);
      setIsLoading(false);
    }
  };

  const handleDownload = (code, lang) => {
    const extension = lang === 'javascript' ? 'js' : lang === 'typescript' ? 'ts' : lang === 'python' ? 'py' : lang || 'txt';
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `component.${extension}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isLanding = messages.length === 0;

  return (
    <div className="app-wrapper">
      <div className="mesh-gradient" />
      
      <div className="aura-container">
        <AnimatePresence mode="wait">
          {isLanding ? (
            <motion.div 
              key="landing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -20, filter: 'blur(15px)' }}
              transition={{ duration: 0.8 }}
              className="landing-header"
            >
               <motion.h1 
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2, duration: 0.8 }}
                className="brand-title"
               >
                 AuraUI
               </motion.h1>
               <motion.h2 
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3, duration: 0.8 }}
                className="sub-title"
               >
                HTML CSS & JavaScript
               </motion.h2>
               
               <motion.div 
                initial={{ opacity: 0, scale: 0, rotate: -90 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ delay: 0.4, duration: 1.2, type: 'spring' }}
                className="sparkle-icon-large" 
               />
               
               <div className="cards-grid">
                  <FeatureCard 
                    text="Design a home office setup for remote work under $500." 
                    icon={PenTool} 
                    colorClass="icon-blue" 
                    index={0} 
                    setInput={setInput}
                  />
                  <FeatureCard 
                    text="How can I improve my web development skills in 2025?" 
                    icon={Lightbulb} 
                    colorClass="icon-green" 
                    index={1} 
                    setInput={setInput}
                  />
                  <FeatureCard 
                    text="Suggest some useful tools for debugging JavaScript code." 
                    icon={Compass} 
                    colorClass="icon-yellow" 
                    index={2} 
                    setInput={setInput}
                  />
                  <FeatureCard 
                    text="Create a React JS component for the simple todo list app." 
                    icon={Code} 
                    colorClass="icon-purple" 
                    index={3} 
                    setInput={setInput}
                  />
               </div>
            </motion.div>
          ) : (
            <motion.div 
              key="chat"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="chat-messages"
            >
               {messages.map((m, i) => (
                 <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * (i % 5) }}
                  key={i} 
                  className="message-box"
                 >
                    <div className="m-avatar">
                      {m.role === 'assistant' ? <Sparkles size={22} fill="#4285f4" color="#4285f4" /> : <User size={22} />}
                    </div>
                    <div className="m-content">
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={{
                          code({ inline, className, children, ...props }) {
                            const match = /language-(\w+)/.exec(className || '');
                            return !inline && match ? (
                              <CodeBlock
                                language={match[1]}
                                value={String(children).replace(/\n$/, '')}
                                theme={theme}
                                handleDownload={handleDownload}
                                setPreviewCode={setPreviewCode}
                                {...props}
                              />
                            ) : (
                              <code className={className} styles={{ backgroundColor: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px' }} {...props}>
                                {children}
                              </code>
                            );
                          }
                        }}
                      >
                        {m.content}
                      </ReactMarkdown>
                    </div>
                 </motion.div>
               ))}
               
               {(streamingMessage || (isLoading && !streamingMessage)) && (
                  <div className="message-box">
                    <div className="m-avatar">
                      <Sparkles size={22} fill="#4285f4" color="#4285f4" />
                    </div>
                    <div className="m-content">
                      {streamingMessage ? (
                         <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            code({ inline, className, children, ...props }) {
                              const match = /language-(\w+)/.exec(className || '');
                              return !inline && match ? (
                                <CodeBlock
                                  language={match[1]}
                                  value={String(children).replace(/\n$/, '')}
                                  theme={theme}
                                  handleDownload={handleDownload}
                                  setPreviewCode={setPreviewCode}
                                  {...props}
                                />
                              ) : (
                                <code className={className} {...props}>
                                  {children}
                                </code>
                              );
                            }
                          }}
                         >
                           {streamingMessage}
                         </ReactMarkdown>
                      ) : (
                         <div className="shimmer-container" style={{ width: '100%' }}>
                           <div className="shimmer" style={{ width: '90%' }} />
                           <div className="shimmer" style={{ width: '70%' }} />
                           <div className="shimmer" style={{ width: '80%' }} />
                         </div>
                      )}
                    </div>
                  </div>
               )}
               <div ref={messagesEndRef} />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="input-area-wrapper">
          <form className="input-container-pill" onSubmit={handleSubmit}>
            <button type="button" className="attachment-btn"><ImageIcon size={22} /></button>
            <input 
              type="text" 
              className="aura-input"
              placeholder="Ask AuraUI"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button 
              type="submit" 
              className={`send-btn-aura ${input.trim() ? 'active' : ''}`}
              disabled={!input.trim() || isLoading}
            >
              <Send size={22} />
            </button>
          </form>

          <button className="circle-action-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? <Sun size={24} /> : <Moon size={24} />}
          </button>
          
          <button className="circle-action-btn" onClick={() => { if(confirm('Clear all chats?')) { setMessages([]); localStorage.removeItem('chat_history'); } }}>
            <Trash2 size={24} />
          </button>
        </div>

        <div className="disclaimer-text">
           AuraUI can make mistakes, so double-check it.
        </div>
      </div>

      {previewCode && (
        <PreviewModal 
          content={previewCode} 
          onClose={() => setPreviewCode(null)} 
        />
      )}
    </div>
  );
}

export default App;