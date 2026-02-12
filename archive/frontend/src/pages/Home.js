import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import axios from "axios";
import { toast } from "sonner";
import { Upload, Link as LinkIcon, FileText, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Home() {
  const navigate = useNavigate();
  const [isUploading, setIsUploading] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [url, setUrl] = useState("");

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post(`${API}/documents/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Document uploaded successfully!");
      navigate(`/reader/${response.data.id}`);
    } catch (error) {
      toast.error("Failed to upload document");
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  }, [navigate]);

  const handleUrlSubmit = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;

    setIsUploading(true);
    try {
      const response = await axios.post(`${API}/documents/url`, { url });
      toast.success("URL content loaded successfully!");
      navigate(`/iframe-reader/${response.data.id}`);
    } catch (error) {
      toast.error("Failed to load URL content");
      console.error(error);
    } finally {
      setIsUploading(false);
      setUrl("");
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/markdown': ['.md'],
      'text/plain': ['.txt'],
    },
    multiple: false,
    disabled: isUploading,
  });

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          background: 'radial-gradient(circle at 50% 50%, rgba(109, 40, 217, 0.15) 0%, rgba(5, 5, 5, 0) 50%)'
        }}
      />
      
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-4xl mx-auto mb-12"
        >
          <h1 
            className="text-5xl md:text-7xl font-bold tracking-tighter mb-6"
            style={{ fontFamily: 'Space Grotesk' }}
            data-testid="hero-title"
          >
            <span className="bg-gradient-to-r from-[#6D28D9] to-[#00F0FF] bg-clip-text text-transparent">
              LexiFlow
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-400 mb-4" data-testid="hero-subtitle">
            Documentation reader with AI-powered assistance
          </p>
          <p className="text-base text-gray-500" data-testid="hero-description">
            Upload docs, listen with synchronized highlighting, ask AI anything
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="w-full max-w-2xl space-y-6"
        >
          <div
            {...getRootProps()}
            className={`
              bg-black/40 backdrop-blur-xl border-2 border-dashed rounded-2xl p-12
              transition-all cursor-pointer
              ${isDragActive ? 'border-[#6D28D9] bg-[#6D28D9]/10' : 'border-white/10 hover:border-[#6D28D9]/50'}
              ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
            `}
            data-testid="upload-dropzone"
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center text-center">
              {isUploading ? (
                <Loader2 className="w-12 h-12 text-[#6D28D9] animate-spin mb-4" />
              ) : (
                <Upload className="w-12 h-12 text-[#6D28D9] mb-4" />
              )}
              <p className="text-xl font-medium mb-2" data-testid="upload-text">
                {isDragActive ? 'Drop your file here' : 'Drag & drop or click to upload'}
              </p>
              <p className="text-sm text-gray-500" data-testid="supported-formats">
                Supports PDF, DOCX, MD, TXT
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-gray-500 text-sm">OR</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {!showUrlInput ? (
            <button
              onClick={() => setShowUrlInput(true)}
              className="w-full bg-[#1F1F22] hover:bg-[#1F1F22]/80 text-white rounded-full px-6 py-4 font-medium border border-white/5 transition-all flex items-center justify-center gap-2"
              data-testid="load-url-button"
            >
              <LinkIcon className="w-5 h-5" />
              Load from URL
            </button>
          ) : (
            <form onSubmit={handleUrlSubmit} className="space-y-3">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/documentation"
                className="w-full bg-[#1F1F22]/50 border-transparent focus:border-[#6D28D9]/50 focus:ring-1 focus:ring-[#6D28D9]/50 rounded-xl h-12 px-4 transition-all text-white"
                disabled={isUploading}
                data-testid="url-input"
              />
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isUploading || !url.trim()}
                  className="flex-1 bg-[#6D28D9] hover:bg-[#6D28D9]/90 text-white rounded-full px-6 py-3 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="submit-url-button"
                >
                  {isUploading ? 'Loading...' : 'Load URL'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowUrlInput(false);
                    setUrl("");
                  }}
                  className="px-6 py-3 text-gray-400 hover:text-white transition-colors"
                  data-testid="cancel-url-button"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <button
            onClick={() => navigate('/library')}
            className="w-full bg-transparent hover:bg-white/5 text-gray-400 hover:text-white rounded-full px-6 py-4 font-medium border border-white/5 transition-all flex items-center justify-center gap-2"
            data-testid="library-button"
          >
            <FileText className="w-5 h-5" />
            View Library
          </button>
        </motion.div>
      </div>
    </div>
  );
}