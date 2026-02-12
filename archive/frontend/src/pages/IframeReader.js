import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  MessageSquare,
  Settings,
  Home as HomeIcon,
  Loader2,
  X,
  ExternalLink,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function IframeReader() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState("gpt-4o");
  const [ttsProvider, setTtsProvider] = useState("gemini");
  const [useBrowserTTS, setUseBrowserTTS] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [iframeBlocked, setIframeBlocked] = useState(false);
  
  const audioRef = useRef(null);
  const iframeRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);
  const highlightOverlayRef = useRef(null);

  useEffect(() => {
    fetchDocument();
    fetchChatHistory();
  }, [id]);

  useEffect(() => {
    if (document && isPlaying) {
      highlightCurrentSentence();
    }
  }, [currentSentenceIndex, document]);

  const fetchDocument = async () => {
    try {
      const response = await axios.get(`${API}/documents/${id}`);
      setDocument(response.data);
      
      // Check if it's a URL and might be blocked
      if (response.data.source_type === 'url') {
        checkIframeCompatibility(response.data.source_url);
      }
    } catch (error) {
      toast.error("Failed to load document");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const checkIframeCompatibility = (url) => {
    // Try to load iframe and detect if blocked
    if (typeof window === 'undefined' || !window.document || !window.document.body) {
      // Wait for DOM to be ready
      setTimeout(() => checkIframeCompatibility(url), 100);
      return;
    }
    
    try {
      const testIframe = window.document.createElement('iframe');
      testIframe.style.display = 'none';
      testIframe.src = url;
      testIframe.onload = () => {
        try {
          testIframe.contentWindow?.document;
          setIframeBlocked(false);
        } catch (e) {
          setIframeBlocked(true);
          toast.error("This site blocks iframe embedding. Opening in new tab...");
        }
        if (testIframe.parentNode) {
          testIframe.parentNode.removeChild(testIframe);
        }
      };
      testIframe.onerror = () => {
        setIframeBlocked(true);
        if (testIframe.parentNode) {
          testIframe.parentNode.removeChild(testIframe);
        }
      };
      window.document.body.appendChild(testIframe);
    } catch (error) {
      console.error("Error checking iframe compatibility:", error);
    }
  };

  const fetchChatHistory = async () => {
    try {
      const response = await axios.get(`${API}/chat/${id}`);
      setChatMessages(response.data);
    } catch (error) {
      console.error("Failed to load chat history", error);
    }
  };

  const highlightCurrentSentence = () => {
    if (!iframeRef.current || !document) return;

    try {
      const iframeDoc = iframeRef.current.contentWindow?.document;
      if (!iframeDoc) return;

      // Remove previous highlights
      const prevHighlights = iframeDoc.querySelectorAll('.lexiflow-highlight');
      prevHighlights.forEach(el => {
        const parent = el.parentNode;
        parent.replaceChild(document.createTextNode(el.textContent), el);
        parent.normalize();
      });

      // Find and highlight current sentence
      const currentText = document.sentences[currentSentenceIndex];
      const walker = iframeDoc.createTreeWalker(
        iframeDoc.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );

      let node;
      while (node = walker.nextNode()) {
        const text = node.textContent;
        if (text.includes(currentText.substring(0, 50))) {
          const span = iframeDoc.createElement('span');
          span.className = 'lexiflow-highlight';
          span.style.cssText = `
            background: rgba(109, 40, 217, 0.3);
            border-left: 4px solid #6D28D9;
            padding: 4px 8px;
            display: inline-block;
            animation: pulse 0.5s ease-in-out;
          `;
          span.textContent = currentText;

          const parent = node.parentNode;
          const textBefore = text.substring(0, text.indexOf(currentText));
          const textAfter = text.substring(text.indexOf(currentText) + currentText.length);

          parent.insertBefore(document.createTextNode(textBefore), node);
          parent.insertBefore(span, node);
          parent.insertBefore(document.createTextNode(textAfter), node);
          parent.removeChild(node);

          // Scroll to highlight
          span.scrollIntoView({ behavior: 'smooth', block: 'center' });
          break;
        }
      }
    } catch (error) {
      console.error("Highlighting error:", error);
    }
  };

  const playWithBrowserTTS = (text) => {
    synthRef.current.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = playbackSpeed;
    utterance.onend = () => {
      if (currentSentenceIndex < document.sentences.length - 1) {
        setCurrentSentenceIndex(prev => prev + 1);
      } else {
        setIsPlaying(false);
      }
    };
    synthRef.current.speak(utterance);
  };

  const playWithTTS = async (text) => {
    try {
      const response = await axios.post(`${API}/tts`, { 
        text, 
        provider: ttsProvider 
      }, {
        responseType: 'blob',
      });
      const audioUrl = URL.createObjectURL(response.data);
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.playbackRate = playbackSpeed;
        await audioRef.current.play();
      }
    } catch (error) {
      console.error("TTS failed, falling back to browser TTS", error);
      toast.error(`${ttsProvider} TTS failed. Using browser TTS.`);
      setUseBrowserTTS(true);
      playWithBrowserTTS(text);
    }
  };

  const handlePlayPause = () => {
    if (!document) return;

    if (isPlaying) {
      setIsPlaying(false);
      if (useBrowserTTS) {
        synthRef.current.cancel();
      } else if (audioRef.current) {
        audioRef.current.pause();
      }
    } else {
      setIsPlaying(true);
      const currentText = document.sentences[currentSentenceIndex];
      if (useBrowserTTS) {
        playWithBrowserTTS(currentText);
      } else {
        playWithTTS(currentText);
      }
    }
  };

  const handleNext = () => {
    if (currentSentenceIndex < document.sentences.length - 1) {
      setCurrentSentenceIndex(prev => prev + 1);
      if (isPlaying) {
        if (useBrowserTTS) {
          synthRef.current.cancel();
          playWithBrowserTTS(document.sentences[currentSentenceIndex + 1]);
        } else {
          playWithTTS(document.sentences[currentSentenceIndex + 1]);
        }
      }
    }
  };

  const handlePrevious = () => {
    if (currentSentenceIndex > 0) {
      setCurrentSentenceIndex(prev => prev - 1);
      if (isPlaying) {
        if (useBrowserTTS) {
          synthRef.current.cancel();
          playWithBrowserTTS(document.sentences[currentSentenceIndex - 1]);
        } else {
          playWithTTS(document.sentences[currentSentenceIndex - 1]);
        }
      }
    }
  };

  const handleAudioEnded = () => {
    if (currentSentenceIndex < document.sentences.length - 1) {
      setCurrentSentenceIndex(prev => prev + 1);
      playWithTTS(document.sentences[currentSentenceIndex + 1]);
    } else {
      setIsPlaying(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userMessage = chatInput;
    setChatInput("");
    setChatMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsChatLoading(true);

    try {
      const response = await axios.post(`${API}/chat`, {
        document_id: id,
        message: userMessage,
        model: selectedModel,
      });
      setChatMessages(prev => [...prev, response.data]);
    } catch (error) {
      console.error(error);
      if (error.response?.status === 429) {
        toast.error(error.response?.data?.detail || "API rate limit exceeded.");
      } else {
        toast.error("Failed to get AI response.");
      }
      setChatMessages(prev => prev.slice(0, -1));
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleOpenInNewTab = () => {
    if (document?.source_url) {
      window.open(document.source_url, '_blank');
      toast.success("Opening in new tab. Use the audio controls below to read along!");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#6D28D9] animate-spin" />
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Document not found</p>
      </div>
    );
  }

  // If iframe blocked, show message to open in new tab
  if (iframeBlocked && document.source_type === 'url') {
    return (
      <div className="min-h-screen flex flex-col">
        <audio ref={audioRef} onEnded={handleAudioEnded} />

        <div className="sticky top-0 z-20 bg-black/80 backdrop-blur-xl border-b border-white/10 px-6 py-4">
          <div className="flex items-center justify-between max-w-6xl mx-auto">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="p-2 hover:bg-white/5 rounded-full transition-colors"
                data-testid="home-button"
              >
                <HomeIcon className="w-5 h-5" />
              </button>
              <div>
                <h2 className="font-semibold" data-testid="document-title">{document.title}</h2>
                <p className="text-sm text-gray-500">
                  {currentSentenceIndex + 1} / {document.sentences.length} sentences
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-12">
          <div className="text-center max-w-2xl">
            <ExternalLink className="w-16 h-16 text-[#6D28D9] mx-auto mb-6" />
            <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: 'Space Grotesk' }}>
              This site can't be embedded
            </h2>
            <p className="text-gray-400 mb-8">
              {document.source_url} prevents embedding for security. Open it in a new tab and use the audio controls below to read along!
            </p>
            <button
              onClick={handleOpenInNewTab}
              className="bg-[#6D28D9] hover:bg-[#6D28D9]/90 text-white rounded-full px-8 py-4 font-medium transition-all inline-flex items-center gap-2"
            >
              <ExternalLink className="w-5 h-5" />
              Open in New Tab
            </button>
          </div>
        </div>

        {/* Audio Controls */}
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-black/90 backdrop-blur-xl border-t border-white/10 px-6 py-6">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={handlePrevious}
                disabled={currentSentenceIndex === 0}
                className="p-3 hover:bg-white/5 rounded-full transition-colors disabled:opacity-30"
                data-testid="previous-button"
              >
                <SkipBack className="w-6 h-6" />
              </button>
              <button
                onClick={handlePlayPause}
                className="p-4 bg-[#6D28D9] hover:bg-[#6D28D9]/90 rounded-full transition-all"
                data-testid="play-pause-button"
              >
                {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
              </button>
              <button
                onClick={handleNext}
                disabled={currentSentenceIndex === document.sentences.length - 1}
                className="p-3 hover:bg-white/5 rounded-full transition-colors disabled:opacity-30"
                data-testid="next-button"
              >
                <SkipForward className="w-6 h-6" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-400">{playbackSpeed}x</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-32">
      <audio ref={audioRef} onEnded={handleAudioEnded} />

      {/* Top Bar */}
      <div className="sticky top-0 z-20 bg-black/80 backdrop-blur-xl border-b border-white/10 px-6 py-4">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 hover:bg-white/5 rounded-full transition-colors"
              data-testid="home-button"
            >
              <HomeIcon className="w-5 h-5" />
            </button>
            <div>
              <h2 className="font-semibold" data-testid="document-title">{document.title}</h2>
              <p className="text-sm text-gray-500">
                {currentSentenceIndex + 1} / {document.sentences.length} sentences
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 hover:bg-white/5 rounded-full transition-colors"
              data-testid="settings-button"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowChat(!showChat)}
              className={`p-2 rounded-full transition-colors ${
                showChat ? 'bg-[#6D28D9]' : 'hover:bg-white/5'
              }`}
              data-testid="chat-toggle-button"
            >
              <MessageSquare className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-6 z-30 bg-black/90 backdrop-blur-xl border border-white/10 rounded-2xl p-6 w-80"
          >
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-2 block">AI Chat Model</label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full bg-[#1F1F22] border-white/10 rounded-xl px-4 py-2 text-white"
                >
                  <option value="gpt-4o">OpenAI GPT-4o</option>
                  <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-2 block">TTS Provider</label>
                <select
                  value={ttsProvider}
                  onChange={(e) => setTtsProvider(e.target.value)}
                  className="w-full bg-[#1F1F22] border-white/10 rounded-xl px-4 py-2 text-white"
                >
                  <option value="openai">OpenAI TTS</option>
                  <option value="gemini">Gemini TTS</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Speed: {playbackSpeed}x</label>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={playbackSpeed}
                  onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-400">Browser TTS</label>
                <button
                  onClick={() => setUseBrowserTTS(!useBrowserTTS)}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    useBrowserTTS ? 'bg-[#6D28D9]' : 'bg-gray-600'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      useBrowserTTS ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex h-[calc(100vh-140px)]">
        <div className={`flex-1 transition-all duration-300 ${showChat ? 'mr-96' : ''}`}>
          {document.source_type === 'url' ? (
            <div className="relative w-full h-full">
              <iframe
                ref={iframeRef}
                src={document.source_url}
                className="w-full h-full border-0"
                title={document.title}
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
              />
            </div>
          ) : (
            <div className="p-12 overflow-y-auto h-full">
              <div className="max-w-4xl mx-auto">
                <div className="prose prose-invert max-w-none">
                  {document.sentences.map((sentence, index) => (
                    <p
                      key={index}
                      className={`mb-4 transition-all cursor-pointer ${
                        index === currentSentenceIndex
                          ? 'bg-[#6D28D9]/20 border-l-4 border-[#6D28D9] pl-4 py-2'
                          : 'opacity-50 hover:opacity-75'
                      }`}
                      onClick={() => setCurrentSentenceIndex(index)}
                    >
                      {sentence}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Chat Sidebar */}
        <AnimatePresence>
          {showChat && (
            <motion.div
              initial={{ x: 384, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 384, opacity: 0 }}
              className="fixed right-0 top-0 h-full w-96 bg-black/90 backdrop-blur-xl border-l border-white/10 flex flex-col"
            >
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <h3 className="font-semibold" style={{ fontFamily: 'Space Grotesk' }}>AI Assistant</h3>
                <button
                  onClick={() => setShowChat(false)}
                  className="p-1 hover:bg-white/5 rounded transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {chatMessages.map((msg, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-xl ${
                      msg.role === 'user' ? 'bg-[#6D28D9]/20 ml-8' : 'bg-white/5 mr-8'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                ))}
                {isChatLoading && (
                  <div className="flex items-center gap-2 text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">AI thinking...</span>
                  </div>
                )}
              </div>

              <form onSubmit={handleSendMessage} className="p-6 border-t border-white/10">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask about the document..."
                    className="flex-1 bg-[#1F1F22]/50 border-transparent focus:border-[#6D28D9]/50 rounded-xl px-4 py-3 text-white text-sm"
                    disabled={isChatLoading}
                  />
                  <button
                    type="submit"
                    disabled={isChatLoading || !chatInput.trim()}
                    className="bg-[#6D28D9] hover:bg-[#6D28D9]/90 text-white rounded-xl px-4 py-3 transition-all disabled:opacity-50"
                  >
                    Send
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Audio Controls */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-black/90 backdrop-blur-xl border-t border-white/10 px-6 py-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handlePrevious}
              disabled={currentSentenceIndex === 0}
              className="p-3 hover:bg-white/5 rounded-full transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              data-testid="previous-button"
            >
              <SkipBack className="w-6 h-6" />
            </button>
            <button
              onClick={handlePlayPause}
              className="p-4 bg-[#6D28D9] hover:bg-[#6D28D9]/90 rounded-full transition-all shadow-[0_0_20px_rgba(109,40,217,0.3)] hover:scale-105 active:scale-95"
              data-testid="play-pause-button"
            >
              {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
            </button>
            <button
              onClick={handleNext}
              disabled={currentSentenceIndex === document.sentences.length - 1}
              className="p-3 hover:bg-white/5 rounded-full transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              data-testid="next-button"
            >
              <SkipForward className="w-6 h-6" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-gray-400" />
            <span className="text-sm text-gray-400">{playbackSpeed}x</span>
          </div>
        </div>
      </div>
    </div>
  );
}
