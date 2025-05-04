import { NextRequest, NextResponse } from 'next/server';
import LlamaAPIClient from 'llama-api-client';

// Define a type for the expected structured output from Llama
interface ImageVibe {
  label: string;
  prompt: string;
}

interface LlamaVibeResponse {
  vibes: ImageVibe[];
}

// Define types for Llama API input messages
type LlamaInputContentPart = 
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

type LlamaInputMessage = {
  role: 'user' | 'assistant' | 'system'; // Add other roles if needed
  content: string | LlamaInputContentPart[];
};

// Initialize the Llama API Client
// Assumes LLAMA_API_KEY and optionally LLAMA_API_BASE_URL are in your .env.local
const llama = new LlamaAPIClient({
  apiKey: process.env.LLAMA_API_KEY,
  baseURL: process.env.LLAMA_API_BASE_URL, // Optional: If you need to point to a specific base URL
});

// Helper function to convert file to base64
async function fileToBase64(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return buffer.toString('base64');
}

export async function POST(request: NextRequest) {
  console.log('Received POST request to /api/llama');

  if (!process.env.LLAMA_API_KEY) {
    console.error('LLAMA_API_KEY is not set.');
    return NextResponse.json(
      { error: 'Server configuration error: Llama API key not found.' },
      { status: 500 }
    );
  }

  try {
    const formData = await request.formData();
    const textPromptInput = formData.get('prompt') as string | null; // Renamed for clarity
    const imageFile = formData.get('image') as File | null;
    const model = 'Llama-4-Maverick-17B-128E-Instruct-FP8'; // Your specified model

    console.log(`Input Text Prompt: ${textPromptInput ? textPromptInput.substring(0, 50) + '...' : 'N/A'}`);
    console.log(`Image File: ${imageFile ? imageFile.name : 'N/A'}`);

    if (!textPromptInput && !imageFile) {
      return NextResponse.json(
        { error: 'Missing required parameters: prompt or image is required' },
        { status: 400 }
      );
    }

    // Construct the initial content for the Llama prompt based on image and/or text
    const initialContent: any[] = [];

    if (textPromptInput) {
      initialContent.push({ type: 'text', text: `User's initial prompt: ${textPromptInput}` });
    }

    if (imageFile) {
      const base64Image = await fileToBase64(imageFile);
      // Determine the correct MIME type (common image types)
      let mimeType = 'image/jpeg'; // Default or guess
      if (imageFile.type.startsWith('image/')) {
        mimeType = imageFile.type;
      }
      initialContent.push({
        type: 'image_url',
        image_url: {
          url: `data:${mimeType};base64,${base64Image}`,
        },
      });
      // Add a marker if only image is provided
      if (!textPromptInput) {
          initialContent.push({ type: 'text', text: "Analyze the provided image." });
      }
    }

    // Define the structured prompt instruction for Llama
    const structuredPromptInstruction = `
Based on the preceding input (image and/or text), generate three distinct variations ("vibes") for an image generation model like DALL-E or Midjourney.
For each vibe, provide:
1.  A short, descriptive label (3 words or less).
2.  A detailed, elaborate image generation prompt suitable for maximizing creative output, incorporating specific details, artistic styles, and moods based on the input.

Format your response STRICTLY as a JSON object containing a single key "vibes", which is an array of three objects. Each object in the array must have two keys: "label" (string) and "prompt" (string).

Example JSON output structure:
{
  "vibes": [
    { "label": "Cyberpunk Night", "prompt": "Expansive cyberpunk cityscape bathed in neon light, rain-slicked streets reflecting towering holographic advertisements, flying vehicles weaving through the dense architecture, moody, atmospheric, cinematic lighting, photorealistic, 8k." },
    { "label": "Solarpunk Utopia", "prompt": "Lush green rooftop gardens integrated into sleek, futuristic buildings, solar panels gleaming in the warm sunset light, people relaxing on balconies overlooking a clean, vibrant city, high-tech eco-friendly transport visible, optimistic, bright, detailed illustration." },
    { "label": "Ancient Ruin", "prompt": "Sun-drenched ancient stone ruins overgrown with vibrant jungle foliage, mysterious glowing artifacts scattered around, shafts of light piercing the canopy, exploration theme, fantasy art style, highly detailed." }
  ]
}

Ensure the output is ONLY the JSON object, without any introductory text, explanations, or markdown formatting.`;

    // Combine the initial content and the instruction
    const finalUserContent: any[] = [...initialContent];
    finalUserContent.push({ type: 'text', text: structuredPromptInstruction });

    const messages: LlamaInputMessage[] = [{ role: 'user', content: finalUserContent }];


    console.log('Calling Llama API for structured vibe generation with model:', model);
    // console.log('Calling Llama API with messages:', JSON.stringify(messages, null, 2));

    const response: any = await llama.chat.completions.create({
      model: model,
      messages: messages as any,
      // Add any other parameters the model/API supports, e.g., max_tokens, temperature
      // max_tokens: 500, // Might need to increase max_tokens for detailed prompts
      // Note: Explicit JSON mode might require using the OpenAI compatibility endpoint/client
      // or specific parameters if supported by llama-api-client directly.
      // Relying on prompt instructions for now.
    });

    console.log('Llama API call successful.');
    // console.log('Raw Llama API Response:', response);

    // Process the response - attempt to parse the JSON
    let generatedVibes: LlamaVibeResponse | null = null;
    let rawContent: string | null = null;
    let parseErrorMsg: string | null = null;

    try {
      if (response && 
          response.completion_message && 
          response.completion_message.content && 
          typeof response.completion_message.content.text === 'string') 
      {
        rawContent = response.completion_message.content.text.trim();
        console.log('Raw content from Llama (via completion_message):', rawContent);

        // Attempt to find JSON block, handling potential markdown fences or leading/trailing text
        const jsonMatch = rawContent!.match(/```(?:json)?\s*([\s\S]*?)\s*```|({[\s\S]*})/);

        if (jsonMatch && (jsonMatch[1] || jsonMatch[2])) {
            const jsonString = jsonMatch[1] || jsonMatch[2];
            generatedVibes = JSON.parse(jsonString) as LlamaVibeResponse;

            // Basic validation
            if (!generatedVibes || !Array.isArray(generatedVibes.vibes) || generatedVibes.vibes.length === 0 || !generatedVibes.vibes[0].label || !generatedVibes.vibes[0].prompt) {
                throw new Error("Parsed JSON structure is invalid or missing required fields.");
            }
            console.log('Successfully parsed vibes:', generatedVibes);
        } else {
            // Fallback: try parsing the whole string if no block markers found
            if (rawContent) {
                try {
                    generatedVibes = JSON.parse(rawContent) as LlamaVibeResponse;
                    // Basic validation
                    if (!generatedVibes || !Array.isArray(generatedVibes.vibes) || generatedVibes.vibes.length === 0 || !generatedVibes.vibes[0].label || !generatedVibes.vibes[0].prompt) {
                        throw new Error("Parsed JSON structure is invalid or missing required fields (fallback attempt).");
                    }
                    console.log('Successfully parsed vibes (fallback):', generatedVibes);
                } catch (fallbackParseError) {
                    throw new Error("Could not find or parse JSON block in the response.");
                }
            } else {
                // This case should be unlikely if the outer `if` passed, but handle defensively
                throw new Error("rawContent was unexpectedly null before fallback JSON parse.");
            }
        }

      } else {
        console.error('Unexpected Llama API response structure:', response);
        throw new Error(`Unexpected Llama API response structure. Expected completion_message.content.text, but received: ${JSON.stringify(response)}`);
      }
    } catch (parseError) {
      console.error('Failed to parse Llama response as JSON:', parseError);
      parseErrorMsg = (parseError instanceof Error) ? parseError.message : String(parseError);
      // Return error including raw content for debugging
      return NextResponse.json(
          {
              error: 'Failed to process Llama response into expected JSON structure.',
              details: parseErrorMsg,
              rawOutput: rawContent ?? response // Include raw content if available
          },
          { status: 500 }
      );
    }

    // Return the parsed vibes
    return NextResponse.json(generatedVibes);

  } catch (error: unknown) {
    console.error('Error in /api/llama:', error);

    let errorMessage = 'An unexpected error occurred processing the Llama request.';
    let status = 500;

    // Check if it's an API error from the client library or a general error
    if (error instanceof Error) {
        errorMessage = error.message;
        // Attempt to get status if it exists (e.g., from API client errors)
        if ('status' in error && typeof error.status === 'number') {
            status = error.status;
        }
    }

    return NextResponse.json({ error: errorMessage }, { status });
  }
} 