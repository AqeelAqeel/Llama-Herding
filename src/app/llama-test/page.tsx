"use client";

import { useState, FormEvent } from "react";

// Interface for the structure returned by /api/llama
interface VibeData {
  label: string;
  prompt: string;
}

// Interface to hold the combined result for each vibe
interface VibeResult extends VibeData {
  imageUrl: string | null;
  imageError: string | null;
  isGeneratingImage: boolean;
}

export default function LlamaTestPage() {
  const [prompt, setPrompt] = useState<string>("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  // Store the results for the three vibes
  const [vibeResults, setVibeResults] = useState<VibeResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Loading state for the initial /api/llama call
  const [isLlamaLoading, setIsLlamaLoading] = useState<boolean>(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setImageFile(event.target.files[0]);
    } else {
      setImageFile(null);
    }
  };

  // Function to generate image for a single vibe
  const generateImage = async (vibePrompt: string, index: number) => {
    console.log(`Generating image for vibe ${index + 1}...`);
    // Set loading state for this specific vibe
    setVibeResults(prev => 
      prev.map((r, i) => i === index ? { ...r, isGeneratingImage: true, imageError: null } : r)
    );

    try {
      const res = await fetch("/api/images", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        // Assuming /api/images expects { prompt: string } in the body
        body: JSON.stringify({ prompt: vibePrompt }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.message || `Image generation failed with status ${res.status}`);
      }

      // Assuming /api/images returns { imageUrl: string } or similar
      // Adjust data.imageUrl if the actual key is different (e.g., data.data[0].url)
      const imageUrl = data.imageUrl || (data.data && data.data[0]?.url);
      if (!imageUrl) {
        throw new Error("Image URL not found in the response from /api/images");
      }

      // Update state with the generated image URL
      setVibeResults(prev => 
        prev.map((r, i) => i === index ? { ...r, imageUrl: imageUrl, isGeneratingImage: false } : r)
      );
      console.log(`Image generated successfully for vibe ${index + 1}:`, imageUrl);

    } catch (err: any) {
      console.error(`Error generating image for vibe ${index + 1}:`, err);
      // Update state with the error for this specific vibe
      setVibeResults(prev => 
        prev.map((r, i) => i === index ? { ...r, imageError: err.message || "Unknown image generation error", isGeneratingImage: false } : r)
      );
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLlamaLoading(true);
    setError(null);
    setVibeResults([]); // Clear previous results

    if (!prompt && !imageFile) {
      setError("Please provide either a text prompt or an image.");
      setIsLlamaLoading(false);
      return;
    }

    const formData = new FormData();
    if (prompt) {
      formData.append("prompt", prompt);
    }
    if (imageFile) {
      formData.append("image", imageFile);
    }

    try {
      console.log("Sending request to /api/llama...");
      const res = await fetch("/api/llama", {
        method: "POST",
        body: formData,
      });

      console.log("Received response from /api/llama, status:", res.status);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Llama request failed with status ${res.status}`);
      }

      // Validate the response structure
      if (!data || !Array.isArray(data.vibes) || data.vibes.length === 0) {
        throw new Error("Invalid response structure received from /api/llama. Expected { vibes: [...] }.");
      }

      console.log("/api/llama Response (vibes):", data.vibes);
      
      // Initialize vibeResults state
      const initialResults: VibeResult[] = data.vibes.map((vibe: VibeData) => ({
        ...vibe,
        imageUrl: null,
        imageError: null,
        isGeneratingImage: false,
      }));
      setVibeResults(initialResults);

      // Trigger image generation for each vibe sequentially (or in parallel if desired)
      for (let i = 0; i < data.vibes.length; i++) {
        await generateImage(data.vibes[i].prompt, i);
      }

    } catch (err: any) {
      console.error("Error in main process:", err);
      setError(err.message || "An unknown error occurred.");
      setVibeResults([]); // Clear results on error
    } finally {
      setIsLlamaLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-center">Llama & Image Generation Test</h1>
        
        <div className="bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-700 mb-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="prompt" className="block text-sm font-medium mb-2">
                Text Prompt (Optional)
              </label>
              <textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-indigo-500 focus:border-indigo-500"
                rows={4}
                placeholder="Enter your prompt here..."
                aria-label="Text Prompt (Optional)"
              />
            </div>

            <div>
              <label htmlFor="image" className="block text-sm font-medium mb-2">
                Image File (Optional)
              </label>
              <input
                id="image"
                type="file"
                onChange={handleFileChange}
                accept="image/*"
                className="w-full text-sm text-gray-400
                       file:mr-4 file:py-2 file:px-4
                       file:rounded-full file:border-0
                       file:text-sm file:font-semibold
                       file:bg-violet-900 file:text-white
                       hover:file:bg-violet-800 cursor-pointer"
                 aria-label="Image File (Optional)"
              />
              {imageFile && (
                <p className="text-xs mt-1 text-gray-400">Selected: {imageFile.name}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLlamaLoading}
              className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 rounded-md font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {isLlamaLoading ? "Generating Vibes..." : "Generate 3 Image Vibes"}
            </button>
          </form>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-md text-red-200">
            <h3 className="font-bold mb-1">Error:</h3>
            <p>{error}</p>
          </div>
        )}

        {vibeResults.length > 0 && (
          <div>
            <h2 className="text-2xl font-semibold mb-4 text-center">Generated Vibes & Images</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {vibeResults.map((result, index) => (
                <div key={index} className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex flex-col space-y-3">
                  <h3 className="text-lg font-bold text-center text-indigo-400">{result.label || `Vibe ${index + 1}`}</h3>
                  <div>
                    <p className="text-xs font-semibold mb-1 text-gray-400">Prompt:</p>
                    <p className="text-sm bg-gray-900 p-2 rounded text-gray-300 overflow-auto max-h-32 text-left break-words">{result.prompt}</p>
                  </div>
                  <div className="aspect-square bg-gray-700 rounded flex items-center justify-center">
                    {result.isGeneratingImage && (
                      <div className="text-center">
                        <svg className="animate-spin h-8 w-8 text-indigo-400 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <p className="text-sm text-gray-400">Generating Image...</p>
                      </div>
                    )}
                    {result.imageError && (
                      <div className="p-2 text-center text-red-400">
                        <p className="text-sm font-semibold">Image Error:</p>
                        <p className="text-xs break-words">{result.imageError}</p>
                      </div>
                    )}
                    {result.imageUrl && !result.isGeneratingImage && (
                      <img 
                        src={result.imageUrl}
                        alt={`Generated image for: ${result.label}`}
                        className="w-full h-full object-cover rounded"
                        loading="lazy"
                      />
                    )}
                    {!result.imageUrl && !result.isGeneratingImage && !result.imageError && (
                         <p className="text-gray-500 text-sm">Image will appear here</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 