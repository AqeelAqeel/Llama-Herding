import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// Initialize the OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const { prompt } = await request.json();

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    // Call OpenAI's image generation API
    const response = await openai.images.generate({
      model: "dall-e-3", // Using DALL-E 3 as fallback if gpt-image-1 isn't available
      prompt,
      n: 1,
      quality: "standard",
      size: "1024x1024",
    });

    // Safely access the URL
    const imageUrl = response.data && response.data[0] ? response.data[0].url : null;

    // Return the generated image URL
    return NextResponse.json({ imageUrl });
  } catch (error: any) {
    console.error("Error generating image:", error);
    
    return NextResponse.json(
      { error: error.message || "An error occurred during image generation" },
      { status: 500 }
    );
  }
} 