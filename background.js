// background.js - Gemini API service for product detection
const GEMINI_API_KEY = 'AIzaSyDxfyjUFLba7TbmDo50SU2zGbNs2U1bhOc'; // Replace with your real API key
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

console.log("🚀 Background script started - Gemini API service ready");

async function detectProductsWithGemini(text) {
  try {
    console.log("📡 Calling Gemini API to detect products...");
    
    const prompt = `Analyze the following text and extract all product names(for ex "Npoclk Portable Air Conditioner","Flexzilla Garden Hose","Rest Evercool Cooling Comforter"... ), i want to search for them in amazon , walmart ... by their names . Return ONLY a JSON array of strings containing the detected products. Do not include any explanations or additional text.

Text to analyze: "${text}"

Example response format: ["iPhone", "MacBook", "Nike shoes", "Samsung TV"]`;

    const requestBody = {
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1000,
      }
    };

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // Updated response parsing for Gemini 2.0 Flash
    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
      const geminiResponse = data.candidates[0].content.parts[0].text;
      
      try {
        const cleanResponse = geminiResponse.replace(/```json|```/g, '').trim();
        const products = JSON.parse(cleanResponse);
        
        if (Array.isArray(products)) {
          console.log("🎯 Products detected by Gemini:", products);
          return products;
        }
      } catch (parseError) {
        console.warn("⚠️ Failed to parse Gemini response:", parseError);
        const productMatches = geminiResponse.match(/["']([^"']+)["']/g) || [];
        return productMatches.map(match => match.replace(/["']/g, ''));
      }
    }
    
    return [];
    
  } catch (error) {
    console.error("❌ Error calling Gemini API:", error);
    // Fallback to basic keyword detection
    const fallbackKeywords = ['buy', 'price', 'Amazon', 'Walmart', /* ... */];
    return fallbackKeywords.filter(kw => text.toLowerCase().includes(kw.toLowerCase()));
  }
}

// Message listener remains the same
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'detectProducts') {
    detectProductsWithGemini(request.text)
      .then(products => sendResponse({ success: true, products }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// Test function updated for new model
async function testGeminiConnection() {
  try {
    const testResponse = await detectProductsWithGemini("I want to buy an iPhone and MacBook");
    console.log("✅ API test successful. Response:", testResponse);
  } catch (error) {
    console.error("❌ API test failed:", error);
  }
}

testGeminiConnection();