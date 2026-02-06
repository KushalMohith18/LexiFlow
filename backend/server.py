from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import io
import re
import PyPDF2
import docx
import markdown
from bs4 import BeautifulSoup
import requests
from openai import OpenAI
from google import genai
from google.genai import types
import trafilatura
from readability import Document as ReadabilityDocument
import html2text

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client_db = AsyncIOMotorClient(mongo_url)
db = client_db[os.environ['DB_NAME']]

openai_client = OpenAI(api_key=os.environ.get('OPENAI_API_KEY'))
gemini_client = genai.Client(api_key=os.environ.get('GEMINI_API_KEY'))

app = FastAPI()
api_router = APIRouter(prefix="/api")

class Document(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    content: str
    sentences: List[str]
    source_type: str
    source_url: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DocumentCreate(BaseModel):
    title: str
    content: str
    source_type: str
    source_url: Optional[str] = None

class URLInput(BaseModel):
    url: str

class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    document_id: str
    role: str
    content: str
    model: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ChatRequest(BaseModel):
    document_id: str
    message: str
    model: str
    context: Optional[str] = None

class TTSRequest(BaseModel):
    text: str
    voice: Optional[str] = "alloy"
    provider: Optional[str] = "openai"

def extract_sentences(text: str) -> List[str]:
    text = re.sub(r'\s+', ' ', text).strip()
    sentences = re.split(r'(?<=[.!?])\s+(?=[A-Z])', text)
    return [s.strip() for s in sentences if s.strip()]

def extract_text_from_pdf(file_bytes: bytes) -> str:
    pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
    text = ""
    for page in pdf_reader.pages:
        text += page.extract_text() + "\n"
    return text

def extract_text_from_docx(file_bytes: bytes) -> str:
    doc = docx.Document(io.BytesIO(file_bytes))
    return "\n".join([para.text for para in doc.paragraphs])

def extract_text_from_markdown(file_bytes: bytes) -> str:
    md_text = file_bytes.decode('utf-8')
    html = markdown.markdown(md_text)
    return BeautifulSoup(html, 'html.parser').get_text()

def extract_main_content(html: str, url: str) -> str:
    """
    Extract main content from HTML using multiple methods.
    This removes ads, navigation, footers, and other non-content elements.
    """
    try:
        # Method 1: Trafilatura (best for news/documentation sites)
        extracted = trafilatura.extract(html, include_comments=False, include_tables=True)
        if extracted and len(extracted.strip()) > 200:
            logger.info(f"Content extracted using Trafilatura: {len(extracted)} chars")
            return extracted
        
        # Method 2: Readability (Mozilla's algorithm)
        doc = ReadabilityDocument(html)
        readable_html = doc.summary()
        
        # Convert HTML to clean text
        h = html2text.HTML2Text()
        h.ignore_links = False
        h.ignore_images = True
        h.ignore_emphasis = False
        readable_text = h.handle(readable_html)
        
        if len(readable_text.strip()) > 200:
            logger.info(f"Content extracted using Readability: {len(readable_text)} chars")
            return readable_text
        
        # Method 3: Custom heuristic fallback
        soup = BeautifulSoup(html, 'html.parser')
        
        # Remove unwanted elements
        for element in soup(['script', 'style', 'nav', 'header', 'footer', 
                           'aside', 'iframe', 'noscript', 'meta', 'link']):
            element.decompose()
        
        # Remove common ad/navigation classes
        ad_patterns = ['ad', 'advertisement', 'banner', 'sidebar', 'menu', 
                      'navigation', 'nav', 'social', 'share', 'comment', 
                      'related', 'recommended', 'popup', 'modal', 'cookie']
        
        for pattern in ad_patterns:
            for element in soup.find_all(class_=lambda x: x and pattern in x.lower()):
                element.decompose()
            for element in soup.find_all(id=lambda x: x and pattern in x.lower()):
                element.decompose()
        
        # Try to find main content areas
        main_content = (
            soup.find('main') or 
            soup.find('article') or 
            soup.find('div', class_=lambda x: x and ('content' in x.lower() or 'article' in x.lower())) or
            soup.find('div', id=lambda x: x and ('content' in x.lower() or 'article' in x.lower())) or
            soup.body
        )
        
        if main_content:
            text = main_content.get_text(separator='\n', strip=True)
            # Clean up extra whitespace
            text = '\n'.join(line.strip() for line in text.split('\n') if line.strip())
            logger.info(f"Content extracted using custom heuristic: {len(text)} chars")
            return text
        
        # Ultimate fallback
        text = soup.get_text(separator='\n', strip=True)
        return '\n'.join(line.strip() for line in text.split('\n') if line.strip())
        
    except Exception as e:
        logger.error(f"Content extraction error: {str(e)}")
        # Final fallback to basic text extraction
        soup = BeautifulSoup(html, 'html.parser')
        return soup.get_text(separator='\n', strip=True)

def analyze_content_context(text: str) -> dict:
    """
    Analyze content to identify context without using AI.
    Returns metadata about the content type and structure.
    """
    text_lower = text.lower()
    word_count = len(text.split())
    
    # Identify content type based on keywords
    context = {
        "type": "general",
        "topics": [],
        "word_count": word_count,
        "has_code": False,
        "has_headings": False,
        "technical_level": "medium"
    }
    
    # Check for code documentation
    code_indicators = ['function', 'class', 'import', 'const', 'var', 'def', 'return', 
                      'api', 'endpoint', 'parameter', 'method', 'syntax']
    code_count = sum(1 for indicator in code_indicators if indicator in text_lower)
    if code_count >= 3:
        context["type"] = "technical_documentation"
        context["has_code"] = True
        context["technical_level"] = "high"
    
    # Check for tutorial/guide
    tutorial_indicators = ['step', 'tutorial', 'guide', 'how to', 'getting started', 
                          'example', 'follow', 'first', 'next']
    tutorial_count = sum(1 for indicator in tutorial_indicators if indicator in text_lower)
    if tutorial_count >= 3:
        context["type"] = "tutorial"
    
    # Check for API documentation
    if any(word in text_lower for word in ['api', 'endpoint', 'request', 'response', 'json']):
        if "api" in text_lower and ("endpoint" in text_lower or "request" in text_lower):
            context["type"] = "api_documentation"
    
    # Detect headings presence
    if any(marker in text for marker in ['#', '===', '---']) or '\n\n' in text:
        context["has_headings"] = True
    
    return context

@api_router.post("/documents/upload", response_model=Document)
async def upload_document(file: UploadFile = File(...)):
    try:
        file_bytes = await file.read()
        filename = file.filename.lower()
        
        if filename.endswith('.pdf'):
            content = extract_text_from_pdf(file_bytes)
        elif filename.endswith('.docx'):
            content = extract_text_from_docx(file_bytes)
        elif filename.endswith(('.md', '.markdown')):
            content = extract_text_from_markdown(file_bytes)
        elif filename.endswith('.txt'):
            content = file_bytes.decode('utf-8')
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format")
        
        sentences = extract_sentences(content)
        doc_data = {
            "title": file.filename,
            "content": content,
            "sentences": sentences,
            "source_type": "file",
            "source_url": None
        }
        doc = Document(**doc_data)
        doc_dict = doc.model_dump()
        doc_dict['created_at'] = doc_dict['created_at'].isoformat()
        await db.documents.insert_one(doc_dict)
        return doc
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/documents/url", response_model=Document)
async def add_url_document(input_data: URLInput):
    try:
        # Fetch the URL content
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        response = requests.get(input_data.url, timeout=15, headers=headers)
        response.raise_for_status()
        
        # Extract main content using enhanced methods
        content = extract_main_content(response.text, input_data.url)
        
        if not content or len(content.strip()) < 100:
            raise HTTPException(status_code=400, detail="Unable to extract meaningful content from URL")
        
        # Analyze content context
        context_info = analyze_content_context(content)
        logger.info(f"Content context: {context_info}")
        
        sentences = extract_sentences(content)
        title = input_data.url.split('//')[-1].split('/')[0]
        
        doc_data = {
            "title": title,
            "content": content,
            "sentences": sentences,
            "source_type": "url",
            "source_url": input_data.url
        }
        doc = Document(**doc_data)
        doc_dict = doc.model_dump()
        doc_dict['created_at'] = doc_dict['created_at'].isoformat()
        await db.documents.insert_one(doc_dict)
        return doc
    except requests.RequestException as e:
        logger.error(f"Failed to fetch URL {input_data.url}: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Failed to fetch URL: {str(e)}")
    except Exception as e:
        logger.error(f"Error processing URL {input_data.url}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/documents", response_model=List[Document])
async def get_documents():
    docs = await db.documents.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    for doc in docs:
        if isinstance(doc['created_at'], str):
            doc['created_at'] = datetime.fromisoformat(doc['created_at'])
    return docs

@api_router.get("/documents/{doc_id}", response_model=Document)
async def get_document(doc_id: str):
    doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if isinstance(doc['created_at'], str):
        doc['created_at'] = datetime.fromisoformat(doc['created_at'])
    return doc

@api_router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str):
    result = await db.documents.delete_one({"id": doc_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    await db.chat_messages.delete_many({"document_id": doc_id})
    return {"message": "Document deleted"}

@api_router.post("/tts")
async def text_to_speech(request: TTSRequest):
    try:
        response = openai_client.audio.speech.create(
            model="tts-1",
            voice=request.voice,
            input=request.text[:4096]
        )
        audio_bytes = io.BytesIO()
        for chunk in response.iter_bytes():
            audio_bytes.write(chunk)
        audio_bytes.seek(0)
        return StreamingResponse(audio_bytes, media_type="audio/mpeg")
    except Exception as e:
        logger.error(f"TTS error: {str(e)}")
        if "429" in str(e) or "rate_limit" in str(e).lower():
            raise HTTPException(status_code=429, detail="OpenAI API rate limit exceeded. Please try browser TTS or wait a few minutes.")
        raise HTTPException(status_code=500, detail=f"TTS failed: {str(e)}")

@api_router.post("/chat", response_model=ChatMessage)
async def chat_with_ai(request: ChatRequest):
    try:
        doc = await db.documents.find_one({"id": request.document_id}, {"_id": 0})
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")
        
        context = request.context or doc['content'][:8000]
        system_prompt = f"You are a helpful AI assistant. Answer questions based on this documentation:\n\n{context}"
        
        if request.model.startswith('gpt'):
            try:
                response = openai_client.chat.completions.create(
                    model="gpt-4o",
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": request.message}
                    ],
                    timeout=30
                )
                answer = response.choices[0].message.content
            except Exception as e:
                logger.error(f"OpenAI chat error: {str(e)}")
                if "429" in str(e) or "rate_limit" in str(e).lower():
                    raise HTTPException(status_code=429, detail="OpenAI API rate limit exceeded. Please try Gemini model or wait a few minutes.")
                raise
        else:
            try:
                prompt = f"{system_prompt}\n\nUser: {request.message}"
                response = gemini_client.models.generate_content(
                    model='gemini-2.0-flash-exp',
                    contents=prompt
                )
                answer = response.text
            except Exception as e:
                logger.error(f"Gemini chat error: {str(e)}")
                raise HTTPException(status_code=500, detail=f"Gemini API error: {str(e)}")
        
        msg_data = {
            "document_id": request.document_id,
            "role": "assistant",
            "content": answer,
            "model": request.model
        }
        msg = ChatMessage(**msg_data)
        msg_dict = msg.model_dump()
        msg_dict['created_at'] = msg_dict['created_at'].isoformat()
        await db.chat_messages.insert_one(msg_dict)
        return msg
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Chat error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/chat/{document_id}", response_model=List[ChatMessage])
async def get_chat_history(document_id: str):
    messages = await db.chat_messages.find(
        {"document_id": document_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(100)
    for msg in messages:
        if isinstance(msg['created_at'], str):
            msg['created_at'] = datetime.fromisoformat(msg['created_at'])
    return messages

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client_db.close()