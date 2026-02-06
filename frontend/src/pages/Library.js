import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { FileText, Trash2, Home as HomeIcon, Loader2, Link as LinkIcon } from "lucide-react";
import { motion } from "framer-motion";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Library() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const response = await axios.get(`${API}/documents`);
      setDocuments(response.data);
    } catch (error) {
      toast.error("Failed to load library");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (docId, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this document?')) return;

    try {
      await axios.delete(`${API}/documents/${docId}`);
      setDocuments(docs => docs.filter(d => d.id !== docId));
      toast.success("Document deleted");
    } catch (error) {
      toast.error("Failed to delete document");
      console.error(error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#6D28D9] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-12">
          <div>
            <h1 
              className="text-4xl md:text-5xl font-bold tracking-tight mb-2"
              style={{ fontFamily: 'Space Grotesk' }}
              data-testid="library-title"
            >
              Document Library
            </h1>
            <p className="text-gray-400" data-testid="document-count">{documents.length} documents</p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="p-3 hover:bg-white/5 rounded-full transition-colors"
            data-testid="home-button"
          >
            <HomeIcon className="w-6 h-6" />
          </button>
        </div>

        {documents.length === 0 ? (
          <div className="text-center py-20">
            <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 mb-6" data-testid="empty-message">No documents yet</p>
            <button
              onClick={() => navigate('/')}
              className="bg-[#6D28D9] hover:bg-[#6D28D9]/90 text-white rounded-full px-8 py-3 font-medium transition-all"
              data-testid="upload-first-button"
            >
              Upload Your First Document
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {documents.map((doc, index) => (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                onClick={() => navigate(`/reader/${doc.id}`)}
                className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 cursor-pointer hover:border-[#6D28D9]/50 transition-all hover:-translate-y-1 hover:shadow-lg group"
                data-testid={`document-card-${index}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-[#6D28D9]/10 rounded-xl group-hover:bg-[#6D28D9]/20 transition-colors">
                    {doc.source_type === 'url' ? (
                      <LinkIcon className="w-6 h-6 text-[#6D28D9]" />
                    ) : (
                      <FileText className="w-6 h-6 text-[#6D28D9]" />
                    )}
                  </div>
                  <button
                    onClick={(e) => handleDelete(doc.id, e)}
                    className="p-2 hover:bg-red-500/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    data-testid={`delete-button-${index}`}
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>

                <h3 className="font-semibold mb-2 truncate" data-testid={`doc-title-${index}`}>
                  {doc.title}
                </h3>
                <p className="text-sm text-gray-500 mb-4" data-testid={`doc-meta-${index}`}>
                  {doc.sentences.length} sentences
                </p>
                <p className="text-xs text-gray-600 truncate" data-testid={`doc-date-${index}`}>
                  {new Date(doc.created_at).toLocaleDateString()}
                </p>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}