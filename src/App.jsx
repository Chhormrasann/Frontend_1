import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  Loader2,
  Copy,
  Check,
  Download,
  Play,
  Paperclip,
  User,
  Menu,
  MoreVertical,
  Plus,
  Search,
  LayoutGrid,
  Library,
  FileText,
  History,
  Globe,
  TrendingUp,
  FileSearch,
  ArrowUp,
  Cpu,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

import chatbotIcon from './assets/chatbot.png';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/chat';

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
  const [promptType, setPromptType] = useState('code');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });
  const [streamingMessage, setStreamingMessage] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

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
    if (isLoading) return;
    try {
      localStorage.setItem('chat_history', JSON.stringify(messages));
    } catch (e) {
      console.error("Failed to save chat history", e);
    }
  }, [messages, isLoading]);

  useEffect(() => {
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    if (isDarkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [isDarkMode]);

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
          type: promptType,
        }),
      });

      if (!response.ok) throw new Error('Failed to connect to the server');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';
      let buffer = '';
      let lastUpdateTime = Date.now();

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
              const now = Date.now();
              if (now - lastUpdateTime > 50) { // Throttle updates to ~20fps
                setStreamingMessage(assistantMessage);
                lastUpdateTime = now;
              }
            } else if (data.error) {
              throw new Error(data.details || data.error);
            }
          } catch (e) {
            console.error('SSE Error:', e);
          }
        }
      }
      setStreamingMessage(assistantMessage); // Final update

      setMessages(prev => [...prev, { role: 'assistant', content: assistantMessage }]);
      setStreamingMessage('');
      setIsLoading(false);

    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${error.message}` },
      ]);
      setStreamingMessage('');
      setIsLoading(false);
    }
  };

  const handleCopy = (code, id) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownload = (code, lang) => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `generated-code.${lang || 'txt'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRun = (code, lang) => {
    const isWeb = ['html', 'css', 'javascript', 'js', 'xml'].includes(lang);
    if (!isWeb) {
      alert("Only Web code (HTML/CSS/JS) can be run in the browser.");
      return;
    }

    const blob = new Blob([code], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const MarkdownCodeBlock = ({ lang, code, index }) => (
    <div className="result-card">
      <div className="card-header">
        <span>{lang || 'code'}</span>
        <div className="card-actions">
          <button className="mini-action-btn" onClick={() => handleCopy(code, `${index}-copy`)}>
            {copiedId === `${index}-copy` ? <Check size={14} /> : <Copy size={14} />}
            <span>{copiedId === `${index}-copy` ? 'Copied' : 'Copy'}</span>
          </button>
          <button className="mini-action-btn" onClick={() => handleDownload(code, lang)}>
            <Download size={14} />
            <span>Download</span>
          </button>
          <button className="mini-action-btn success" onClick={() => handleRun(code, lang)}>
            <Play size={14} fill="currentColor" />
            <span>Run</span>
          </button>
        </div>
      </div>
      <div className="code-viewport">
        <SyntaxHighlighter
          language={lang || 'javascript'}
          style={vscDarkPlus}
          showLineNumbers={true}
          PreTag="div"
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );

  const handleLandingSelection = (text) => {
    setInput(text);
    // Submit after a small delay to allow input state to catch up
    setTimeout(() => {
       const btn = document.getElementById('chat-submit-btn');
       if (btn) btn.click();
    }, 100);
  };

  const isLanding = messages.length === 0;

  return (
    <div className="app-wrapper">
      {/* SIDEBAR */}
      <aside className={`sidebar ${isSidebarOpen ? '' : 'closed'}`}>
        <div className="sidebar-header">
          <div className="logo-section">
            <div className="logo-box">
              <Cpu size={20} />
            </div>
            <span>Valerio.ai</span>
          </div>
          <Menu 
            className="cursor-pointer text-secondary hover:text-primary transition" 
            size={18} 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          />
        </div>

        <div className="search-box">
          <Search size={16} className="text-secondary" />
          <input type="text" placeholder="Search chat" />
        </div>

        <button 
          className="new-chat-sidebar-btn"
          onClick={() => { if(confirm('Start a new chat?')) { setMessages([]); setInput(''); } }}
        >
          <Plus size={18} />
          <span>New Chat</span>
        </button>

        <nav className="nav-section">
          <div className="nav-item active">
            <LayoutGrid size={18} />
            <span>Explore</span>
          </div>
          <div className="nav-item">
            <Library size={18} />
            <span>Library</span>
          </div>
          <div className="nav-item">
            <FileText size={18} />
            <span>Files</span>
          </div>
          <div className="nav-item">
            <History size={18} />
            <span>History</span>
          </div>
        </nav>

        <h3 className="section-label">Recent Chats</h3>
        <div className="recent-chats">
          {messages.length > 0 ? (
            <div className="recent-item">
              <span>{messages[0].content}</span>
            </div>
          ) : (
            <>
              <div className="recent-item">Brainstorming small busines...</div>
              <div className="recent-item">The history of roman empire</div>
              <div className="recent-item">Crypto investment suggestio...</div>
            </>
          )}
        </div>

        <div className="upgrade-card">
          <h4>Upgrade to <span className="pro-badge">PRO</span></h4>
          <p>Upgrade for image uploads, smarter AI, and more Pro Search.</p>
          <button className="learn-more-btn">
            <span>Learn More</span>
            <Plus size={14} />
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main-content">
        <header className="top-nav">
          <div className="mode-selector">
            <select 
              className="mode-dropdown" 
              value={promptType} 
              onChange={(e) => setPromptType(e.target.value)}
            >
              <option value="general">🌍 General AI</option>
              <option value="ui">✨ UI UI Architect</option>
              <option value="code">💻 Senior Code</option>
              <option value="sql">📊 SQL Expert</option>
              <option value="debug">🐞 Debugger</option>
              <option value="explain">💡 Educator</option>
            </select>
          </div>

          <div className="user-profile">
            <button className="theme-toggle-btn" onClick={() => setIsDarkMode(!isDarkMode)}>
              {isDarkMode ? <Sparkles size={18} fill="#fdd835" /> : <Sparkles size={18} />}
            </button>
          </div>
        </header>

        <div className="chat-area">
          {isLanding ? (
            <div className="landing-view">
              <div className="greeting-text">
                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                >
                  Welcome
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                >
                  How can i help you today?
                </motion.p>
              </div>

              <div className="feature-cards">
                 <motion.div 
                    className="feature-card"
                    whileHover={{ scale: 1.02 }}
                    onClick={() => handleLandingSelection("What's happen in 24 hours?")}
                 >
                    <div className="card-icon icon-purple"><Globe size={20} /></div>
                    <h3>What's Happen in 24 hours?</h3>
                    <p>See what's been happening in the world over the last 24 hours</p>
                 </motion.div>

                 <motion.div 
                    className="feature-card"
                    whileHover={{ scale: 1.02 }}
                    onClick={() => handleLandingSelection("Stock market update")}
                 >
                    <div className="card-icon icon-pink"><TrendingUp size={20} /></div>
                    <h3>Stock market update</h3>
                    <p>See what's happening in the stock market in real time</p>
                 </motion.div>

                 <motion.div 
                    className="feature-card"
                    whileHover={{ scale: 1.02 }}
                    onClick={() => handleLandingSelection("Deep economic research")}
                 >
                    <div className="card-icon icon-indigo"><FileSearch size={20} /></div>
                    <h3>Deep economic research</h3>
                    <p>See research from experts that we have simplified</p>
                 </motion.div>
              </div>
            </div>
          ) : (
            <div className="chat-container">
               {messages.map((m, i) => (
                 <div key={i} className="message-row">
                   <div className={`avatar-circle ${m.role === 'assistant' ? 'ai-avatar' : ''}`}>
                     {m.role === 'assistant' ? <Cpu size={18} /> : <User size={18} />}
                   </div>
                    <div className="message-content">
                      <div className={m.role === 'user' ? 'user-message' : 'markdown-content'}>
                        {m.role === 'assistant' ? (
                           <ReactMarkdown 
                             remarkPlugins={[remarkGfm]}
                             components={{
                               code({ node, inline, className, children, ...props }) {
                                 const match = /language-(\w+)/.exec(className || '');
                                 const codeStr = String(children).replace(/\n$/, '');
                                 return !inline && match ? (
                                   <MarkdownCodeBlock 
                                     lang={match[1]} 
                                     code={codeStr} 
                                     index={i} 
                                   />
                                 ) : (
                                   <code className={className} {...props}>
                                     {children}
                                   </code>
                                 );
                               }
                             }}
                           >
                             {m.content}
                           </ReactMarkdown>
                        ) : (
                          m.content
                        )}
                      </div>
                   </div>
                 </div>
               ))}

               {streamingMessage && (
                 <div className="message-row">
                   <div className="avatar-circle ai-avatar">
                     <Cpu size={18} />
                   </div>
                   <div className="message-content">
                     <div className="markdown-content">
                       <ReactMarkdown 
                         remarkPlugins={[remarkGfm]}
                         components={{
                           code({ node, inline, className, children, ...props }) {
                             const match = /language-(\w+)/.exec(className || '');
                             const codeStr = String(children).replace(/\n$/, '');
                             return !inline && match ? (
                               <MarkdownCodeBlock 
                                 lang={match[1]} 
                                 code={codeStr} 
                                 index="streaming" 
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
                       <span className="typing-cursor" />
                     </div>
                   </div>
                 </div>
               )}

               {isLoading && !streamingMessage && (
                 <div className="message-row">
                   <div className="avatar-circle ai-avatar">
                      <Loader2 size={16} className="animate-spin" />
                   </div>
                   <div className="message-content">
                      <div className="shimmer-line" style={{width: '90%'}} />
                      <div className="shimmer-line" style={{width: '60%'}} />
                   </div>
                 </div>
               )}
               <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* INPUT BOX */}
        <div className="input-container">
           <form className="input-wrapper" onSubmit={handleSubmit}>
              <button type="button" className="text-secondary hover:text-primary transition">
                <Paperclip size={20} />
              </button>
              <textarea
                ref={textareaRef}
                placeholder="Ask something.."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                rows={1}
              />
              <button 
                id="chat-submit-btn"
                type="submit" 
                className="send-btn-circle"
                disabled={!input.trim() || isLoading}
              >
                <ArrowUp size={20} />
              </button>
           </form>
           <div className="bottom-info">
             Join the valerius community for more insights <a href="#">Join Discord</a>
           </div>
        </div>
      </main>
    </div>
  );
}

export default App;