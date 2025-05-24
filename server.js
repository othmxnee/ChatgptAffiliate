//server.js
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const port = 3000;

// Replace with your actual API key
const genAI = new GoogleGenerativeAI('AIzaSyDxfyjUFLba7TbmDo50SU2zGbNs2U1bhOc');

// Middleware
app.use(cors());
app.use(express.json());

async function detectProducts(text) {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = `
You are a product recommendation detector. Extract ALL product names mentioned in the following text that are being recommended for purchase or suggested to buy.

IMPORTANT RULES:
1. Include products that have additional information in parentheses (e.g., "Kindle Paperwhite (11th Gen)" should be extracted as "Kindle Paperwhite (11th Gen)")
2. Include products with brand names and model numbers
3. Include products that are part of a list or bullet points
4. Include products mentioned with phrases like "consider", "great option", "recommended", "popular", "good for", etc.
5. Extract the COMPLETE product name including any descriptive text in parentheses
6. Do NOT extract generic categories - only specific product names or brands

Return ONLY a JSON array of strings. Each string should be the complete product name as mentioned in the text.

Examples of what TO extract:
- "Kindle Paperwhite (11th Gen)"
- "Language Learning Tools (e.g., Pimsleur, Rosetta Stone)"
- "STEM Toys for Kids (LEGO Boost, Snap Circuits)"
- "Planners and Productivity Journals"

Text to analyze:
${text}

Return only the JSON array, no other text:`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let output = await response.text();

    console.log("Raw Gemini response:");
    console.log(output);
    
    // Clean up the response to extract JSON
    output = output.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    // Remove any text before the first [ and after the last ]
    const startIndex = output.indexOf('[');
    const endIndex = output.lastIndexOf(']');
    
    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
      output = output.substring(startIndex, endIndex + 1);
    }
    
    // Try to parse JSON from the response
    try {
      const products = JSON.parse(output);
      
      // Validate that we got an array
      if (Array.isArray(products)) {
        // Clean up the products array - remove empty strings and duplicates
        const cleanProducts = [...new Set(products.filter(p => p && typeof p === 'string' && p.trim().length > 0))];
        console.log("Detected products:");
        console.log(cleanProducts);
        return cleanProducts;
      } else {
        console.log("Response is not an array, attempting to extract manually");
        return extractProductsManually(text);
      }
    } catch (parseError) {
      console.log("Could not parse as JSON, attempting manual extraction");
      return extractProductsManually(text);
    }
  } catch (error) {
    console.error("Gemini API Error:", error);
    
    // Check if it's a network error
    if (error.message.includes('fetch failed')) {
      throw new Error('Network error: Could not connect to Gemini API. Check your internet connection.');
    }
    
    // Check if it's an API key error
    if (error.message.includes('API key')) {
      throw new Error('API key error: Please check your Gemini API key.');
    }
    
    throw error;
  }
}

// Fallback function to manually extract products using regex patterns
function extractProductsManually(text) {
  console.log("Using manual product extraction...");
  
  const products = [];
  
  // Pattern to match bullet points with product names
  const bulletPatterns = [
    /\*\s*\*\*([^*]+(?:\([^)]+\))?[^*]*)\*\*/g, // **Product Name (details)**
    /\*\s*([A-Z][^*\n]+(?:\([^)]+\))?)/g, // * Product Name (details)
    /\d+\.\s*\*\*([^*]+(?:\([^)]+\))?[^*]*)\*\*/g, // 1. **Product Name (details)**
    /\d+\.\s*([A-Z][^\n]+(?:\([^)]+\))?)/g // 1. Product Name (details)
  ];
  
  bulletPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const product = match[1].trim();
      if (product.length > 2 && !products.includes(product)) {
        products.push(product);
      }
    }
  });
  
  // Also look for products mentioned with recommendation keywords
  const recommendationPatterns = [
    /(?:consider|recommend|suggest|try|popular|great|good for|best)\s+([A-Z][^.!?\n]+(?:\([^)]+\))?)/gi,
    /([A-Z][A-Za-z\s]+(?:\([^)]+\))?)\s*[-–]\s*(?:popular|great|good|recommended|excellent)/gi
  ];
  
  recommendationPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const product = match[1].trim();
      if (product.length > 2 && !products.includes(product)) {
        products.push(product);
      }
    }
  });
  
  console.log("Manually extracted products:", products);
  return products.length > 0 ? products : { rawResponse: "No products found", error: "Manual extraction failed" };
}

// API endpoint for product detection
app.post('/detect-products', async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }
    
    console.log('Received text for analysis:', text.substring(0, 200) + '...');
    
    const products = await detectProducts(text);
    
    res.json(products);
  } catch (error) {
    console.error('Server error:', error);
    
    // Send more specific error messages
    if (error.message.includes('Network error')) {
      res.status(503).json({ 
        error: 'Service unavailable: Cannot connect to Gemini API',
        details: error.message 
      });
    } else if (error.message.includes('API key')) {
      res.status(401).json({ 
        error: 'Authentication error: Invalid API key',
        details: error.message 
      });
    } else {
      res.status(500).json({ 
        error: 'Internal server error',
        details: error.message 
      });
    }
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log('Enhanced product detection ready!');
});