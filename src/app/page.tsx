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

// Interface for a complete generation set (input + 3 generated vibes)
interface GenerationSet {
  id: string;
  inputPrompt: string | null;
  inputImageName: string | null;
  vibes: VibeResult[];
}

export default function HomePage() {
  const [prompt, setPrompt] = useState<string>("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [generationSets, setGenerationSets] = useState<GenerationSet[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLlamaLoading, setIsLlamaLoading] = useState<boolean>(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setImageFile(event.target.files[0]);
    } else {
      setImageFile(null);
    }
  };

  // Function to generate image for a single vibe
  const generateImage = async (vibePrompt: string, generationSetId: string, vibeIndex: number) => {
    console.log(`Processing vibe ${vibeIndex + 1} for generation set ${generationSetId}...`);
    // Set loading state for this specific vibe
    setGenerationSets(prev => 
      prev.map(set => {
        if (set.id === generationSetId) {
          return {
            ...set,
            vibes: set.vibes.map((vibe, i) => 
              i === vibeIndex ? { ...vibe, isGeneratingImage: true, imageError: null } : vibe
            )
          };
        }
        return set;
      })
    );

    try {
      // Call the OpenAI API endpoint to generate an image based on the prompt
      const response = await fetch("/api/openai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: vibePrompt }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Image generation failed with status ${response.status}`);
      }

      // Update the state with the generated image URL
      setGenerationSets(prev => 
        prev.map(set => {
          if (set.id === generationSetId) {
            return {
              ...set,
              vibes: set.vibes.map((vibe, i) => 
                i === vibeIndex ? {
                  ...vibe,
                  imageUrl: data.imageUrl,
                  isGeneratingImage: false
                } : vibe
              )
            };
          }
          return set;
        })
      );
      console.log(`Processed vibe ${vibeIndex + 1}`);

    } catch (err: any) {
      console.error(`Error processing vibe ${vibeIndex + 1}:`, err);
      setGenerationSets(prev => 
        prev.map(set => {
          if (set.id === generationSetId) {
            return {
              ...set,
              vibes: set.vibes.map((vibe, i) => 
                i === vibeIndex ? { 
                  ...vibe, 
                  imageError: err.message || "Unknown error", 
                  isGeneratingImage: false
                } : vibe
              )
            };
          }
          return set;
        })
      );
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLlamaLoading(true);
    setError(null);

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

      if (!data || !Array.isArray(data.vibes) || data.vibes.length === 0) {
        throw new Error("Invalid response structure received from /api/llama. Expected { vibes: [...] }.");
      }

      console.log("/api/llama Response (vibes):", data.vibes);
      
      const newGenerationSetId = Date.now().toString();
      const initialVibes: VibeResult[] = data.vibes.map((vibe: VibeData) => ({
        ...vibe,
        imageUrl: null,
        imageError: null,
        isGeneratingImage: false,
      }));

      const newGenerationSet: GenerationSet = {
        id: newGenerationSetId,
        inputPrompt: prompt || null,
        inputImageName: imageFile ? imageFile.name : null,
        vibes: initialVibes,
      };

      setGenerationSets(prev => [...prev, newGenerationSet]);

      for (let i = 0; i < data.vibes.length; i++) {
        await generateImage(data.vibes[i].prompt, newGenerationSetId, i);
      }

      setPrompt("");
      setImageFile(null);

    } catch (err: any) {
      console.error("Error in main process:", err);
      setError(err.message || "An unknown error occurred.");
    } finally {
      setIsLlamaLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="container mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-center">🦙 Llama Vibe Generator</h1>
        
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
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-indigo-500 focus:border-indigo-500 resize-y"
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
              {isLlamaLoading ? "Generating Vibes & Images..." : "Generate 3 Image Vibes"}
            </button>
          </form>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-md text-red-200">
            <h3 className="font-bold mb-1">Error:</h3>
            <p>{error}</p>
          </div>
        )}

        {generationSets.length > 0 && (
          <div className="space-y-12">
            {generationSets.map((generationSet) => (
              <div key={generationSet.id} className="bg-gray-900/50 p-6 rounded-lg border border-gray-800">
                <div className="mb-4 pb-4 border-b border-gray-700">
                  <h3 className="text-xl font-bold mb-2 text-indigo-400">Generation Input:</h3>
                  {generationSet.inputPrompt && (
                    <div className="mb-2">
                      <span className="text-gray-400 font-semibold">Prompt:</span>
                      <p className="ml-2 text-gray-200">{generationSet.inputPrompt}</p>
                    </div>
                  )}
                  {generationSet.inputImageName && (
                    <div>
                      <span className="text-gray-400 font-semibold">Image:</span>
                      <p className="ml-2 text-gray-200">{generationSet.inputImageName}</p>
                    </div>
                  )}
                </div>

                <h2 className="text-2xl font-semibold mb-4">Generated Vibes & Images</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {generationSet.vibes.map((result, index) => (
                    <div key={index} className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex flex-col space-y-3">
                      <h3 className="text-lg font-bold text-center text-indigo-400">{result.label || `Vibe ${index + 1}`}</h3>
                      <div>
                        <p className="text-xs font-semibold mb-1 text-gray-400">Prompt:</p>
                        <div className="bg-gray-900 p-2 rounded text-gray-300 max-h-32 overflow-auto">
                          <p className="text-sm break-words">{result.prompt}</p>
                        </div>
                      </div>
                      <div className="min-h-64 min-w-64 aspect-square bg-gray-700 rounded flex items-center justify-center">
                        {result.isGeneratingImage && (
                          <div className="text-center">
                            <svg className="animate-spin h-8 w-8 text-indigo-400 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <p className="text-sm text-gray-400">Processing vibe...</p>
                          </div>
                        )}
                        {result.imageError && (
                          <div className="p-2 text-center text-red-400">
                            <p className="text-sm font-semibold">Error:</p>
                            <p className="text-xs break-words">{result.imageError}</p>
                          </div>
                        )}
                        {!result.isGeneratingImage && !result.imageError && !result.imageUrl && (
                          <div className="p-4 text-center">
                            <p className="text-gray-300 text-sm">Generated Vibe:</p>
                            <p className="text-indigo-400 font-medium mt-2">{result.label}</p>
                          </div>
                        )}
                        {!result.isGeneratingImage && !result.imageError && result.imageUrl && (
                          <img 
                            src={result.imageUrl} 
                            alt={`Generated image for ${result.label}`}
                            className="w-full h-full object-cover rounded"
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
