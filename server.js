// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
// Note: In Node 18+ 'fetch' is available globally. If you're on an older Node version,
// you can install node-fetch (`npm install node-fetch`) and then:
// const fetch = require('node-fetch');

const app = express();
const port = 3000;

// ====================
// Replace these with your actual CJ Affiliate credentials:
const CJ_API_BASE_URL = 'https://ads.api.cj.com/';
const CJ_COMPANY_ID = process.env.CJ_COMPANY_ID;
const CJ_API_TOKEN = process.env.CJ_API_TOKEN; // your "token:" value
// ====================

// Middleware
app.use(cors());
app.use(express.json());

async function detectProducts(text) {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  // Replace with your actual API key
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
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

// ===========================
// CORRECTED: CJ Affiliate Search Endpoint (matching working curl)
// ===========================
app.post('/search-cj-affiliate', async (req, res) => {
  try {
    const { keyword } = req.body;
    if (!keyword) {
      return res.status(400).json({ success: false, error: 'Keyword is required' });
    }

    console.log(`🔍 /search-cj-affiliate called with keyword: "${keyword}"`);

    // Build the GraphQL query object (matching your working curl command)
    // Added imageLink and link fields for image and affiliate link
    const gqlQuery = {
      query: `query { shoppingProducts(companyId: ${CJ_COMPANY_ID}, keywords: "${keyword}", limit: 4) { resultList { title price { amount currency } imageLink link } } }`
    };

    console.log('📋 GraphQL Query Object:', JSON.stringify(gqlQuery, null, 2));

    // Use the correct endpoint with /query path (matching your working curl)
    const requestUrl = 'https://ads.api.cj.com/query';

    console.log('🌐 Request URL:', requestUrl);
    console.log('🔑 Using API Token:', CJ_API_TOKEN);

    // Make the POST request to CJ Affiliate (matching your working curl exactly)
    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CJ_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(gqlQuery)
    });

    console.log('📊 Response Status:', response.status);
    console.log('📊 Response Headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ CJ Affiliate API Error Response:', errorText);
      return res.status(response.status).json({
        success: false,
        error: `CJ Affiliate API returned ${response.status}`,
        details: errorText
      });
    }

    const responseText = await response.text();
    console.log('📝 Raw Response Text:', responseText);

    try {
      const json = JSON.parse(responseText);
      console.log('📦 Parsed JSON Response:', JSON.stringify(json, null, 2));

      // Check for GraphQL errors
      if (json.errors) {
        console.error('❌ GraphQL Errors:', json.errors);
        return res.status(400).json({
          success: false,
          error: 'GraphQL errors',
          details: json.errors
        });
      }

      const productsList = json.data?.shoppingProducts?.resultList || [];
      console.log('🛍️ Products List Length:', productsList.length);

      if (productsList.length === 0) {
        console.log('⚠️ No products found for keyword:', keyword);
        return res.json({
          success: true,
          products: [],
          totalCount: 0,
          message: `No products found for "${keyword}"`
        });
      }

      const firstProduct = productsList[0];
      const title = firstProduct.title || '';
      const amount = firstProduct.price?.amount ?? null;
      const currency = firstProduct.price?.currency ?? '';
      const imageLink = firstProduct.imageLink || '';
      const link = firstProduct.link || '';

      console.log('✅ First CJ product found:', { title, amount, currency, imageLink, link });

      return res.json({
        success: true,
        product: {
          title,
          amount,
          currency,
          imageLink,
          link
        },
        totalCount: productsList.length,
        keyword: keyword
      });

    } catch (jsonErr) {
      console.error('❌ JSON parse error:', jsonErr);
      console.error('📄 Response text that failed to parse:', responseText);
      return res.status(500).json({
        success: false,
        error: 'Invalid JSON response from CJ Affiliate',
        details: jsonErr.message,
        rawResponse: responseText.substring(0, 500) // First 500 chars for debugging
      });
    }

  } catch (error) {
    console.error('❌ /search-cj-affiliate crash:', error);
    console.error('📍 Error stack:', error.stack);
    
    // More specific error handling
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return res.status(503).json({
        success: false,
        error: 'Network error: Cannot connect to CJ Affiliate API',
        details: error.message
      });
    }

    if (error.name === 'AbortError') {
      return res.status(408).json({
        success: false,
        error: 'Request timeout',
        details: 'CJ Affiliate API request timed out'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});
// Add this new endpoint to server.js
// Add this endpoint to your server.js file after the existing /search-cj-affiliate endpoint

app.post('/get-all-cj-products', async (req, res) => {
  try {
    const { products } = req.body;
    if (!products || !Array.isArray(products)) {
      return res.status(400).json({ success: false, error: 'Products array is required' });
    }

    console.log(`🔍 /get-all-cj-products called with ${products.length} products`);

    const allProductsData = [];

    // Search for each detected product
    for (const keyword of products) {
      try {
        const gqlQuery = {
          query: `query { shoppingProducts(companyId: ${CJ_COMPANY_ID}, keywords: "${keyword}", limit: 4) { resultList { title price { amount currency } imageLink link } } }`
        };

        const response = await fetch('https://ads.api.cj.com/query', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${CJ_API_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(gqlQuery)
        });

        if (!response.ok) {
          console.error(`❌ CJ API error for "${keyword}":`, response.status);
          continue;
        }

        const json = await response.json();
        const productsList = json.data?.shoppingProducts?.resultList || [];
        
        if (productsList.length > 1) {
          // Get products 2, 3, 4 (indices 1, 2, 3)
          const additionalProducts = productsList.slice(1, 4).map(product => ({
            title: product.title || '',
            amount: product.price?.amount ?? null,
            currency: product.price?.currency ?? '',
            imageLink: product.imageLink || '',
            link: product.link || '',
            originalKeyword: keyword
          }));
          
          allProductsData.push(...additionalProducts);
        }
      } catch (error) {
        console.error(`❌ Error searching for "${keyword}":`, error);
      }
    }

    console.log(`✅ Found ${allProductsData.length} additional products`);

    return res.json({
      success: true,
      products: allProductsData,
      totalCount: allProductsData.length
    });

  } catch (error) {
    console.error('❌ /get-all-cj-products error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});


// Add this new endpoint to your server.js file after the existing /search-cj-affiliate endpoint

// ===========================
// NEW: Get all CJ products (2nd, 3rd, 4th) for detected products
// ===========================
app.post('/get-all-cj-products', async (req, res) => {
  try {
    const { products } = req.body;
    if (!products || !Array.isArray(products)) {
      return res.status(400).json({ success: false, error: 'Products array is required' });
    }

    console.log(`🔍 /get-all-cj-products called with ${products.length} products`);

    const allProductsData = [];

    // Search for each detected product
    for (const keyword of products) {
      try {
        const gqlQuery = {
          query: `query { shoppingProducts(companyId: ${CJ_COMPANY_ID}, keywords: "${keyword}", limit: 4) { resultList { title price { amount currency } imageLink link } } }`
        };

        const response = await fetch('https://ads.api.cj.com/query', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${CJ_API_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(gqlQuery)
        });

        if (!response.ok) {
          console.error(`❌ CJ API error for "${keyword}":`, response.status);
          continue;
        }

        const json = await response.json();
        const productsList = json.data?.shoppingProducts?.resultList || [];
        
        if (productsList.length > 1) {
          // Get products 2, 3, 4 (indices 1, 2, 3)
          const additionalProducts = productsList.slice(1, 4).map(product => ({
            title: product.title || '',
            amount: product.price?.amount ?? null,
            currency: product.price?.currency ?? '',
            imageLink: product.imageLink || '',
            link: product.link || '',
            originalKeyword: keyword
          }));
          
          allProductsData.push(...additionalProducts);
        }
      } catch (error) {
        console.error(`❌ Error searching for "${keyword}":`, error);
      }
    }

    console.log(`✅ Found ${allProductsData.length} additional products`);

    return res.json({
      success: true,
      products: allProductsData,
      totalCount: allProductsData.length
    });

  } catch (error) {
    console.error('❌ /get-all-cj-products error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

// ===========================
// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Test endpoint for CJ Affiliate (GET request for easier testing)
app.get('/test-cj/:keyword', async (req, res) => {
  const keyword = req.params.keyword;
  console.log(`🧪 Testing CJ Affiliate with keyword: "${keyword}"`);
  
  // Create a mock request object and call the POST endpoint
  const mockReq = { body: { keyword } };
  await app._router.layers.find(layer => 
    layer.route && layer.route.path === '/search-cj-affiliate'
  ).route.stack[0].handle(mockReq, res);
});

app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
  console.log('✅ Product detection and CJ Affiliate search ready!');
  console.log('📋 Available endpoints:');
  console.log('  POST /detect-products');
  console.log('  POST /search-cj-affiliate');
  console.log('  GET  /test-cj/:keyword');
  console.log('  GET  /health');
});