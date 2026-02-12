#!/usr/bin/env python3

import requests
import sys
import json
import io
from datetime import datetime
from pathlib import Path

class LexiFlowAPITester:
    def __init__(self, base_url="https://repo-detective-11.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.created_documents = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def test_document_upload(self):
        """Test document upload functionality"""
        print("\n🔍 Testing Document Upload...")
        
        # Create a test text file
        test_content = "This is a test document. It contains multiple sentences. Each sentence will be parsed separately for the reader."
        
        try:
            files = {'file': ('test.txt', io.StringIO(test_content), 'text/plain')}
            response = requests.post(f"{self.api_url}/documents/upload", files=files, timeout=30)
            
            if response.status_code == 200:
                doc_data = response.json()
                if 'id' in doc_data and 'sentences' in doc_data:
                    self.created_documents.append(doc_data['id'])
                    self.log_test("Document Upload (TXT)", True)
                    return doc_data['id']
                else:
                    self.log_test("Document Upload (TXT)", False, "Missing required fields in response")
            else:
                self.log_test("Document Upload (TXT)", False, f"Status: {response.status_code}")
                
        except Exception as e:
            self.log_test("Document Upload (TXT)", False, str(e))
        
        return None

    def test_url_document(self):
        """Test URL document loading"""
        print("\n🔍 Testing URL Document Loading...")
        
        try:
            # Test with a simple webpage
            test_url = "https://httpbin.org/html"
            response = requests.post(
                f"{self.api_url}/documents/url", 
                json={"url": test_url},
                timeout=30
            )
            
            if response.status_code == 200:
                doc_data = response.json()
                if 'id' in doc_data and 'sentences' in doc_data:
                    self.created_documents.append(doc_data['id'])
                    self.log_test("URL Document Loading", True)
                    return doc_data['id']
                else:
                    self.log_test("URL Document Loading", False, "Missing required fields")
            else:
                self.log_test("URL Document Loading", False, f"Status: {response.status_code}")
                
        except Exception as e:
            self.log_test("URL Document Loading", False, str(e))
        
        return None

    def test_get_documents(self):
        """Test getting all documents"""
        print("\n🔍 Testing Get All Documents...")
        
        try:
            response = requests.get(f"{self.api_url}/documents", timeout=10)
            
            if response.status_code == 200:
                docs = response.json()
                if isinstance(docs, list):
                    self.log_test("Get All Documents", True, f"Found {len(docs)} documents")
                    return True
                else:
                    self.log_test("Get All Documents", False, "Response is not a list")
            else:
                self.log_test("Get All Documents", False, f"Status: {response.status_code}")
                
        except Exception as e:
            self.log_test("Get All Documents", False, str(e))
        
        return False

    def test_get_single_document(self, doc_id):
        """Test getting a single document"""
        print(f"\n🔍 Testing Get Single Document ({doc_id[:8]}...)...")
        
        if not doc_id:
            self.log_test("Get Single Document", False, "No document ID provided")
            return False
        
        try:
            response = requests.get(f"{self.api_url}/documents/{doc_id}", timeout=10)
            
            if response.status_code == 200:
                doc = response.json()
                if 'id' in doc and 'sentences' in doc:
                    self.log_test("Get Single Document", True)
                    return True
                else:
                    self.log_test("Get Single Document", False, "Missing required fields")
            elif response.status_code == 404:
                self.log_test("Get Single Document", False, "Document not found")
            else:
                self.log_test("Get Single Document", False, f"Status: {response.status_code}")
                
        except Exception as e:
            self.log_test("Get Single Document", False, str(e))
        
        return False

    def test_tts_functionality(self):
        """Test Text-to-Speech functionality"""
        print("\n🔍 Testing Text-to-Speech...")
        
        # Test OpenAI TTS
        try:
            test_text = "Hello, this is a test of the text to speech functionality."
            response = requests.post(
                f"{self.api_url}/tts",
                json={"text": test_text, "voice": "alloy", "provider": "openai"},
                timeout=30
            )
            
            if response.status_code == 200:
                if response.headers.get('content-type') == 'audio/mpeg':
                    self.log_test("OpenAI TTS", True)
                else:
                    self.log_test("OpenAI TTS", False, "Invalid content type")
            else:
                self.log_test("OpenAI TTS", False, f"Status: {response.status_code}")
                
        except Exception as e:
            self.log_test("OpenAI TTS", False, str(e))
        
        # Test Gemini TTS
        try:
            response = requests.post(
                f"{self.api_url}/tts",
                json={"text": test_text, "provider": "gemini"},
                timeout=30
            )
            
            if response.status_code == 200:
                if response.headers.get('content-type') == 'audio/wav':
                    self.log_test("Gemini TTS", True)
                    return True
                else:
                    self.log_test("Gemini TTS", False, "Invalid content type")
            else:
                self.log_test("Gemini TTS", False, f"Status: {response.status_code}")
                
        except Exception as e:
            self.log_test("Gemini TTS", False, str(e))
        
        return False

    def test_ai_chat_openai(self, doc_id):
        """Test AI chat with OpenAI"""
        print(f"\n🔍 Testing AI Chat (OpenAI) with doc {doc_id[:8] if doc_id else 'None'}...")
        
        if not doc_id:
            self.log_test("AI Chat (OpenAI)", False, "No document ID provided")
            return False
        
        try:
            response = requests.post(
                f"{self.api_url}/chat",
                json={
                    "document_id": doc_id,
                    "message": "What is this document about?",
                    "model": "gpt-4o"
                },
                timeout=60
            )
            
            if response.status_code == 200:
                chat_data = response.json()
                if 'content' in chat_data and 'model' in chat_data:
                    self.log_test("AI Chat (OpenAI)", True)
                    return True
                else:
                    self.log_test("AI Chat (OpenAI)", False, "Missing required fields")
            else:
                self.log_test("AI Chat (OpenAI)", False, f"Status: {response.status_code}")
                
        except Exception as e:
            self.log_test("AI Chat (OpenAI)", False, str(e))
        
        return False

    def test_ai_chat_gemini(self, doc_id):
        """Test AI chat with Gemini"""
        print(f"\n🔍 Testing AI Chat (Gemini) with doc {doc_id[:8] if doc_id else 'None'}...")
        
        if not doc_id:
            self.log_test("AI Chat (Gemini)", False, "No document ID provided")
            return False
        
        try:
            response = requests.post(
                f"{self.api_url}/chat",
                json={
                    "document_id": doc_id,
                    "message": "Summarize this document in one sentence.",
                    "model": "gemini-2.0-flash"
                },
                timeout=60
            )
            
            if response.status_code == 200:
                chat_data = response.json()
                if 'content' in chat_data and 'model' in chat_data:
                    self.log_test("AI Chat (Gemini)", True)
                    return True
                else:
                    self.log_test("AI Chat (Gemini)", False, "Missing required fields")
            else:
                self.log_test("AI Chat (Gemini)", False, f"Status: {response.status_code}")
                
        except Exception as e:
            self.log_test("AI Chat (Gemini)", False, str(e))
        
        return False

    def test_chat_history(self, doc_id):
        """Test getting chat history"""
        print(f"\n🔍 Testing Chat History for doc {doc_id[:8] if doc_id else 'None'}...")
        
        if not doc_id:
            self.log_test("Chat History", False, "No document ID provided")
            return False
        
        try:
            response = requests.get(f"{self.api_url}/chat/{doc_id}", timeout=10)
            
            if response.status_code == 200:
                messages = response.json()
                if isinstance(messages, list):
                    self.log_test("Chat History", True, f"Found {len(messages)} messages")
                    return True
                else:
                    self.log_test("Chat History", False, "Response is not a list")
            else:
                self.log_test("Chat History", False, f"Status: {response.status_code}")
                
        except Exception as e:
            self.log_test("Chat History", False, str(e))
        
        return False

    def test_delete_document(self, doc_id):
        """Test document deletion"""
        print(f"\n🔍 Testing Document Deletion for {doc_id[:8] if doc_id else 'None'}...")
        
        if not doc_id:
            self.log_test("Document Deletion", False, "No document ID provided")
            return False
        
        try:
            response = requests.delete(f"{self.api_url}/documents/{doc_id}", timeout=10)
            
            if response.status_code == 200:
                self.log_test("Document Deletion", True)
                return True
            elif response.status_code == 404:
                self.log_test("Document Deletion", False, "Document not found")
            else:
                self.log_test("Document Deletion", False, f"Status: {response.status_code}")
                
        except Exception as e:
            self.log_test("Document Deletion", False, str(e))
        
        return False

    def run_all_tests(self):
        """Run comprehensive API tests"""
        print("🚀 Starting LexiFlow API Tests...")
        print(f"📡 Testing against: {self.base_url}")
        
        # Test document operations
        doc_id = self.test_document_upload()
        url_doc_id = self.test_url_document()
        
        # Test document retrieval
        self.test_get_documents()
        self.test_get_single_document(doc_id)
        
        # Test TTS
        self.test_tts_functionality()
        
        # Test AI chat (use the first document created)
        test_doc = doc_id or url_doc_id
        if test_doc:
            self.test_ai_chat_openai(test_doc)
            self.test_ai_chat_gemini(test_doc)
            self.test_chat_history(test_doc)
        
        # Test deletion (clean up)
        for doc_id in self.created_documents:
            self.test_delete_document(doc_id)
        
        # Print summary
        print(f"\n📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        return success_rate >= 80

def main():
    tester = LexiFlowAPITester()
    success = tester.run_all_tests()
    
    # Save detailed results
    results = {
        "timestamp": datetime.now().isoformat(),
        "total_tests": tester.tests_run,
        "passed_tests": tester.tests_passed,
        "success_rate": (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0,
        "test_details": tester.test_results
    }
    
    with open('/app/backend_test_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())