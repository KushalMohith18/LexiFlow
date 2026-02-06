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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Reader() {
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
  const [useBrowserTTS, setUseBrowserTTS] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  const audioRef = useRef(null);
  const sentenceRefs = useRef([]);
  const synthRef = useRef(window.speechSynthesis);

  useEffect(() => {
    fetchDocument();
    fetchChatHistory();
  }, [id]);

  useEffect(() => {
    if (document && sentenceRefs.current[currentSentenceIndex]) {
      sentenceRefs.current[currentSentenceIndex].scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentSentenceIndex, document]);

  const fetchDocument = async () => {
    try {
      const response = await axios.get(`${API}/documents/${id}`);
      setDocument(response.data);
    } catch (error) {
      toast.error("Failed to load document");
      console.error(error);
    } finally {
      setLoading(false);
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

  const playWithOpenAITTS = async (text) => {
    try {
      const response = await axios.post(`${API}/tts`, { text }, {
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
        playWithOpenAITTS(currentText);
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
          playWithOpenAITTS(document.sentences[currentSentenceIndex + 1]);
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
          playWithOpenAITTS(document.sentences[currentSentenceIndex - 1]);
        }
      }
    }
  };

  const handleSentenceClick = (index) => {
    setCurrentSentenceIndex(index);
    if (isPlaying) {
      if (useBrowserTTS) {
        synthRef.current.cancel();
        playWithBrowserTTS(document.sentences[index]);
      } else {
        playWithOpenAITTS(document.sentences[index]);
      }
    }
  };

  const handleAudioEnded = () => {
    if (currentSentenceIndex < document.sentences.length - 1) {
      setCurrentSentenceIndex(prev => prev + 1);
      playWithOpenAITTS(document.sentences[currentSentenceIndex + 1]);
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
      toast.error("Failed to get AI response");
      console.error(error);
    } finally {
      setIsChatLoading(false);
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

  return (
    <div className="min-h-screen pb-32">
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
              <p className="text-sm text-gray-500" data-testid="sentence-progress">
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

      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-6 z-30 bg-black/90 backdrop-blur-xl border border-white/10 rounded-2xl p-6 w-80"
            data-testid="settings-panel"
          >
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-2 block">AI Model</label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full bg-[#1F1F22] border-white/10 rounded-xl px-4 py-2 text-white"
                  data-testid="model-select"
                >
                  <option value="gpt-4o">OpenAI GPT-4o</option>
                  <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Playback Speed: {playbackSpeed}x</label>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={playbackSpeed}
                  onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                  className="w-full"
                  data-testid="speed-slider"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-400">Use Browser TTS</label>
                <button
                  onClick={() => setUseBrowserTTS(!useBrowserTTS)}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    useBrowserTTS ? 'bg-[#6D28D9]' : 'bg-gray-600'
                  }`}
                  data-testid="tts-toggle"
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

      <div className="flex">
        <div className={`flex-1 transition-all duration-300 ${showChat ? 'mr-96' : ''}`}>
          <div className="max-w-3xl mx-auto px-6 py-12">
            <div className="h-[70vh] overflow-y-auto scroll-smooth no-scrollbar mask-image-gradient" data-testid="reader-content">
              {document.sentences.map((sentence, index) => (
                <div
                  key={index}
                  ref={el => sentenceRefs.current[index] = el}
                  onClick={() => handleSentenceClick(index)}
                  className={`
                    py-4 pl-4 border-l-4 transition-all duration-300 cursor-pointer
                    ${
                      index === currentSentenceIndex
                        ? 'text-white scale-105 origin-left font-medium border-[#6D28D9] bg-gradient-to-r from-[#6D28D9]/10 to-transparent text-2xl md:text-3xl leading-normal'
                        : 'text-white/30 border-transparent hover:text-white/50 text-xl md:text-2xl'
                    }
                  `}
                  data-testid={`sentence-${index}`}
                >
                  {sentence}
                </div>
              ))}
            </div>
          </div>
        </div>

        <AnimatePresence>
          {showChat && (
            <motion.div
              initial={{ x: 384, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 384, opacity: 0 }}
              className="fixed right-0 top-0 h-full w-96 bg-black/90 backdrop-blur-xl border-l border-white/10 flex flex-col"
              data-testid="chat-sidebar"
            >
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <h3 className="font-semibold" style={{ fontFamily: 'Space Grotesk' }}>AI Assistant</h3>
                <button
                  onClick={() => setShowChat(false)}
                  className="p-1 hover:bg-white/5 rounded transition-colors"
                  data-testid="close-chat-button"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4" data-testid="chat-messages">
                {chatMessages.map((msg, index) => (
                  <div
                    key={index}
                    className={`
                      p-4 rounded-xl
                      ${
                        msg.role === 'user'
                          ? 'bg-[#6D28D9]/20 ml-8'
                          : 'bg-white/5 mr-8'
                      }
                    `}
                    data-testid={`chat-message-${index}`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                ))}
                {isChatLoading && (
                  <div className="flex items-center gap-2 text-gray-400" data-testid="chat-loading">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">AI is thinking...</span>
                  </div>
                )}
              </div>

              <form onSubmit={handleSendMessage} className="p-6 border-t border-white/10">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask anything about the document..."
                    className="flex-1 bg-[#1F1F22]/50 border-transparent focus:border-[#6D28D9]/50 focus:ring-1 focus:ring-[#6D28D9]/50 rounded-xl px-4 py-3 text-white text-sm"
                    disabled={isChatLoading}
                    data-testid="chat-input"
                  />
                  <button
                    type="submit"
                    disabled={isChatLoading || !chatInput.trim()}
                    className="bg-[#6D28D9] hover:bg-[#6D28D9]/90 text-white rounded-xl px-4 py-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    data-testid="send-message-button"
                  >
                    Send
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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
              {isPlaying ? (
                <Pause className="w-6 h-6" />
              ) : (
                <Play className="w-6 h-6" />
              )}
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