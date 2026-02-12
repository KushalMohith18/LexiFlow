import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Reader from "./pages/Reader";
import IframeReader from "./pages/IframeReader";
import Library from "./pages/Library";
import { Toaster } from "sonner";
import "@/App.css";

function App() {
  return (
    <div className="App">
      <Toaster position="top-center" theme="dark" />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/reader/:id" element={<Reader />} />
          <Route path="/iframe-reader/:id" element={<IframeReader />} />
          <Route path="/library" element={<Library />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;