import React, { useState, useRef } from "react";
import { IoSparkles } from "react-icons/io5";
import { FaImage } from "react-icons/fa6";
import { FiSend } from "react-icons/fi";
import { MdDownload } from "react-icons/md";

export default function Aiimg() {
  const [prompt, setPrompt] = useState("");
  const [image, setImage] = useState("");
  const [loading, setLoading] = useState(false);
  const imageRef = useRef(null);
  const contentRef = useRef(null);

  const generateImage = (e) => {
    e.preventDefault();

    if (!prompt.trim()) return;

    setLoading(true);
    setImage("");

    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(
      prompt
    )}?width=1024&height=1024&seed=${Date.now()}&nologo=true`;

    const img = new Image();

    img.onload = () => {
      setImage(imageUrl);
      setLoading(false);
    };

    img.onerror = () => {
      alert("Failed to generate image.");
      setLoading(false);
    };

    img.src = imageUrl;
  };

  const downloadImage = async () => {
    if (!image) return;

    try {
      const response = await fetch(image);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `ai-generated-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.log("Error downloading the image:", error);
      const link = document.createElement('a');
      link.href = image;
      link.download = `ai-generated-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="flex flex-col bg-white rounded-2xl shadow-lg overflow-hidden" style={{ height: '85vh', maxHeight: '700px' }}>
     
      <div className="flex items-center justify-between gap-3 p-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <IoSparkles size={22} />
          </div>

          <div>
            <h2 className="text-lg font-semibold">AI Image Generator</h2>
            <p className="text-xs text-white/80">
              Powered by Sirajbook AI
            </p>
          </div>
        </div>
        
       
        {image && (
          <button
            onClick={downloadImage}
            className="flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm px-3 py-2 rounded-full transition-all duration-300 hover:scale-105 active:scale-95"
            title="Download Image"
          >
            <MdDownload size={18} />
            <span className="text-sm font-medium hidden sm:inline">Download</span>
          </button>
        )}
      </div>

     
      <div 
        ref={contentRef}
        className="flex-1 overflow-y-auto bg-gray-100 p-4"
        style={{ minHeight: '300px', maxHeight: 'calc(100% - 140px)' }}
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[200px]">
            <div className="w-14 h-14 border-4 border-purple-300 border-t-purple-600 rounded-full animate-spin"></div>
            <p className="mt-5 text-gray-600 font-medium text-lg">
              Generating your image...
            </p>
          </div>
        ) : image ? (
          <div className="relative group">
            <div className="flex justify-center">
              <img
                ref={imageRef}
                src={image}
                alt="Generated"
                className="rounded-xl shadow-2xl max-w-full w-auto h-auto object-contain"
                style={{ maxHeight: '500px' }}
              />
            </div>
            
           
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <button
                onClick={downloadImage}
                className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-4 py-2 rounded-full shadow-lg transition-all duration-300 hover:scale-105 active:scale-95"
              >
                <MdDownload size={18} />
                <span className="text-sm font-medium">Download Image</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center text-gray-500">
            <FaImage className="text-6xl text-purple-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2 text-gray-700">
              AI Image Generator
            </h2>
            <p className="max-w-md text-gray-500 text-sm">
              Enter any prompt below and AI will generate an image for you.
            </p>
          </div>
        )}
      </div>

    
      <div className="border-t bg-white p-4 flex-shrink-0">
        <form onSubmit={generateImage}>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Example: A cyberpunk city at night..."
              className="flex-1 rounded-full border border-gray-300 px-4 py-2.5 outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-gray-800 placeholder-gray-400 bg-white text-sm"
            />

            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 px-5 py-2.5 text-white font-semibold transition hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap text-sm"
            >
              {loading ? (
                "Generating..."
              ) : (
                <>
                  <FiSend size={16} />
                  Generate
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}