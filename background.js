const GEMINI_API_KEY = 'AIzaSyDxfyjUFLba7TbmDo50SU2zGbNs2U1bhOc';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

console.log("🚀 Background script started - Gemini API service ready");

async function detectProductsWithGemini(text) {
  try {
    const prompt = `Analyze this text and extract SPECIFIC PRODUCT NAMES . 
Return ONLY a JSON array of product strings. Follow these rules:
1. Include only tangible products (electronics, appliances)
2. Include exact model numbers when available (e.g., "iPhone 15 Pro Max")
3. Exclude generic terms like "buy", "price", or retailer names
4. Exclude abstract concepts and services
5. Prioritize brand + product name combinations

Text: "${text}"`;

    const requestBody = {
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1000,
        response_mime_type: "application/json"
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
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    
    let products = [];
    try {
      const cleanResponse = responseText
        .replace(/```json|```/g, '')
        .replace(/\b(products|items)\b\s*:/gi, '')
        .trim();
      
      products = JSON.parse(cleanResponse);
      
      if (!Array.isArray(products)) {
        throw new Error('Response is not an array');
      }
    } catch (parseError) {
      products = [...new Set(responseText.match(/"([^"]+)"/g) || [])]
        .map(m => m.replace(/"/g, ''))
        .filter(p => p.length > 2 && !/\b(amazon|walmart|buy|price)\b/i.test(p));
    }

    console.log('Detected products:', products);
    return products;

  } catch (error) {
    console.error("Gemini Error:", error);
    return [];
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'detectProducts') {
    detectProductsWithGemini(request.text)
      .then(products => sendResponse({ success: true, products }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// Optional: Add periodic API health check
async function testGeminiConnection() {
  try {
    const testResponse = await detectProductsWithGemini(
      "I'm considering buying the Sony WH-1000XM5 headphones and a Google Pixel 8 Pro."
    );
    console.log("✅ API test successful. Response:", testResponse);
  } catch (error) {
    console.error("❌ API test failed:", error);
  }
}

testGeminiConnection();