// content.js

console.log('🔍 ChatGPT Product Detector loaded and waiting for full response...');

let processedResponses = new Set();
const SERVER_URL = 'http://localhost:3000/detect-products';
const CJ_SEARCH_URL = 'http://localhost:3000/search-cj-affiliate';
let debounceTimer = null;
let lastChangeTime = Date.now();

const ALL_PRODUCTS_URL = 'http://localhost:3000/get-all-cj-products';
let detectedProductsForCards = [];
let cardsContainer = null;

// Create tooltip container
let tooltipContainer = document.createElement('div');
tooltipContainer.style.cssText = `
  position: absolute;
  z-index: 10000;
  display: none;
  pointer-events: none;
`;
document.body.appendChild(tooltipContainer);

let observedElements = new Map();
let currentSearches = new Map(); // Track ongoing searches

// Search CJ Affiliate for product
async function searchCJAffiliate(keyword) {
  if (currentSearches.has(keyword)) {
    console.log(`⏳ Search already in progress for: "${keyword}"`);
    return currentSearches.get(keyword);
  }

  console.log(`🔍 Searching CJ Affiliate for: "${keyword}"`);
  
  const searchPromise = fetch(CJ_SEARCH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keyword: keyword }),
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }
    return response.json();
  })
  .then(data => {
    console.log(`✅ CJ Affiliate results for "${keyword}":`, data);
    return data;
  })
  .catch(error => {
    console.error(`❌ CJ Affiliate search failed for "${keyword}":`, error);
    return {
      success: false,
      error: error.message,
      product: null
    };
  })
  .finally(() => {
    currentSearches.delete(keyword);
  });

  currentSearches.set(keyword, searchPromise);
  return searchPromise;
}


 

async function getAllCJProducts(products) {
  console.log(`🔍 Getting all CJ products for: ${products.join(', ')}`);
  
  try {
    const response = await fetch(ALL_PRODUCTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products: products }),
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`✅ Got ${data.products?.length || 0} products for cards`);
    return data;
  } catch (error) {
    console.error(`❌ Error getting all CJ products:`, error);
    return { success: false, error: error.message, products: [] };
  }
}

// ADD this function after getAllCJProducts
function createProductCards(products) {
  if (!products || products.length === 0) {
    console.log('❌ No products to create cards for');
    return;
  }

  console.log(`🎴 Creating cards for ${products.length} products`);

  // Remove existing cards container if any
  if (cardsContainer) {
    cardsContainer.remove();
  }

  // Find the last assistant message
  const assistantMessages = document.querySelectorAll('[data-message-author-role="assistant"]');
  if (assistantMessages.length === 0) {
    console.log('❌ No assistant message found to append cards');
    return;
  }

  const lastMessage = assistantMessages[assistantMessages.length - 1];
  const messageContainer = lastMessage.closest('.group') || lastMessage.parentElement;

  // Create cards container
  cardsContainer = document.createElement('div');
  cardsContainer.style.cssText = `
    margin-top: 20px;
    padding: 16px;
    border-top: 2px solid #e5e7eb;
    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
    border-radius: 12px;
  `;

  // Create "See More" toggle button
  const toggleButton = document.createElement('button');
  toggleButton.innerHTML = '🛍️ See More Products';
  toggleButton.style.cssText = `
    background: linear-gradient(45deg, #3b82f6, #1d4ed8);
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 16px;
    transition: all 0.3s ease;
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
  `;

  // Create cards row container (initially hidden)
  const cardsRow = document.createElement('div');
  cardsRow.style.cssText = `
    display: none;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 16px;
    margin-top: 16px;
  `;

  let isExpanded = false;

  // Toggle functionality
  toggleButton.addEventListener('click', () => {
    isExpanded = !isExpanded;
    if (isExpanded) {
      cardsRow.style.display = 'grid';
      toggleButton.innerHTML = '🔼 Hide Products';
      toggleButton.style.background = 'linear-gradient(45deg, #ef4444, #dc2626)';
    } else {
      cardsRow.style.display = 'none';
      toggleButton.innerHTML = '🛍️ See More Products';
      toggleButton.style.background = 'linear-gradient(45deg, #3b82f6, #1d4ed8)';
    }
  });

  // Create individual product cards
  products.forEach((product, index) => {
    const card = document.createElement('div');
    const isDarkMode = document.documentElement.classList.contains('dark') || 
                       document.body.classList.contains('dark');
    
    const bgColor = isDarkMode ? '#1f2937' : '#ffffff';
    const textColor = isDarkMode ? '#ffffff' : '#1f2937';
    const borderColor = isDarkMode ? '#374151' : '#e5e7eb';
    
    card.style.cssText = `
      background: ${bgColor};
      border: 1px solid ${borderColor};
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      transition: all 0.3s ease;
      cursor: pointer;
    `;

    // Hover effects
    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-4px)';
      card.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
    });
    
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'translateY(0)';
      card.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
    });

    const priceDisplay = (product.amount !== null && product.currency) 
      ? `$${product.amount} ${product.currency}` 
      : 'Price N/A';
    
    const displayTitle = product.title.length > 50 
      ? product.title.substring(0, 47) + '...' 
      : product.title;

    card.innerHTML = `
      <div style="text-align: center;">
        ${product.imageLink ? `
          <img src="${product.imageLink}" 
               alt="${product.title}" 
               style="
                 width: 100%;
                 max-height: 150px;
                 object-fit: contain;
                 border-radius: 8px;
                 margin-bottom: 12px;
                 background: ${isDarkMode ? '#374151' : '#f9fafb'};
                 padding: 8px;
               "
               onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"
          />
          <div style="display: none; padding: 20px; color: #6b7280; font-size: 12px;">
            📷 Image not available
          </div>
        ` : `
          <div style="
            height: 150px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: ${isDarkMode ? '#374151' : '#f3f4f6'};
            border-radius: 8px;
            margin-bottom: 12px;
            color: #6b7280;
          ">
            📦 No Image
          </div>
        `}
        
        <h3 style="
          font-size: 14px;
          font-weight: 600;
          color: ${textColor};
          margin: 0 0 8px 0;
          line-height: 1.3;
          min-height: 36px;
        ">${displayTitle}</h3>
        
        <div style="
          font-size: 16px;
          font-weight: 700;
          color: #f59e0b;
          margin-bottom: 12px;
        ">${priceDisplay}</div>
        
        ${product.link ? `
          <a href="${product.link}" 
             target="_blank" 
             rel="noopener noreferrer"
             style="
               background: linear-gradient(45deg, #10b981, #059669);
               color: white;
               text-decoration: none;
               padding: 8px 16px;
               border-radius: 6px;
               font-size: 12px;
               font-weight: 500;
               display: inline-block;
               transition: all 0.2s ease;
             "
             onmouseover="this.style.background='linear-gradient(45deg, #059669, #047857)'"
             onmouseout="this.style.background='linear-gradient(45deg, #10b981, #059669)'"
          >
            🛒 View Product
          </a>
        ` : `
          <div style="color: #6b7280; font-size: 12px; font-style: italic;">
            🔗 Link not available
          </div>
        `}
      </div>
    `;

    cardsRow.appendChild(card);
  });

  // Assemble the complete cards container
  cardsContainer.appendChild(toggleButton);
  cardsContainer.appendChild(cardsRow);

  // Append to message container
  messageContainer.appendChild(cardsContainer);
  
  console.log(`✅ Created ${products.length} product cards`);
}

function createProductCards(products) {
  if (!products || products.length === 0) {
    console.log('❌ No products to create cards for');
    return;
  }

  console.log(`🎴 Creating cards for ${products.length} products`);

  // Remove existing cards container if any
  if (cardsContainer) {
    cardsContainer.remove();
  }

  // Find the last assistant message - try multiple selectors
  let lastMessage = null;
  const selectors = [
    '[data-message-author-role="assistant"]',
    '[data-testid*="conversation-turn"]:has([data-message-author-role="assistant"])',
    '.group.w-full:has([data-message-author-role="assistant"])'
  ];

  for (const selector of selectors) {
    const messages = document.querySelectorAll(selector);
    if (messages.length > 0) {
      lastMessage = messages[messages.length - 1];
      break;
    }
  }

  if (!lastMessage) {
    console.log('❌ No assistant message found to append cards');
    return;
  }

  // Find the container to append to
  let messageContainer = lastMessage.closest('.group') || 
                         lastMessage.closest('[data-testid*="conversation-turn"]') || 
                         lastMessage.parentElement;

  // Create cards container
  cardsContainer = document.createElement('div');
  cardsContainer.style.cssText = `
    margin-top: 20px;
    padding: 16px;
    border-top: 2px solid #e5e7eb;
    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
    border-radius: 12px;
  `;

  // Create "See More" toggle button
  const toggleButton = document.createElement('button');
  toggleButton.innerHTML = '🛍️ See More Products';
  toggleButton.style.cssText = `
    background: linear-gradient(45deg, #3b82f6, #1d4ed8);
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 16px;
    transition: all 0.3s ease;
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
  `;

  // Create cards row container (initially hidden)
  const cardsRow = document.createElement('div');
  cardsRow.style.cssText = `
    display: none;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 16px;
    margin-top: 16px;
  `;

  let isExpanded = false;

  // Toggle functionality
  toggleButton.addEventListener('click', () => {
    isExpanded = !isExpanded;
    if (isExpanded) {
      cardsRow.style.display = 'grid';
      toggleButton.innerHTML = '🔼 Hide Products';
      toggleButton.style.background = 'linear-gradient(45deg, #ef4444, #dc2626)';
    } else {
      cardsRow.style.display = 'none';
      toggleButton.innerHTML = '🛍️ See More Products';
      toggleButton.style.background = 'linear-gradient(45deg, #3b82f6, #1d4ed8)';
    }
  });

  // Create individual product cards
  products.forEach((product, index) => {
    const card = document.createElement('div');
    const isDarkMode = document.documentElement.classList.contains('dark') || 
                       document.body.classList.contains('dark');
    
    const bgColor = isDarkMode ? '#1f2937' : '#ffffff';
    const textColor = isDarkMode ? '#ffffff' : '#1f2937';
    const borderColor = isDarkMode ? '#374151' : '#e5e7eb';
    
    card.style.cssText = `
      background: ${bgColor};
      border: 1px solid ${borderColor};
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      transition: all 0.3s ease;
      cursor: pointer;
    `;

    const priceDisplay = (product.amount !== null && product.currency) 
      ? `$${product.amount} ${product.currency}` 
      : 'Price N/A';
    
    const displayTitle = product.title.length > 50 
      ? product.title.substring(0, 47) + '...' 
      : product.title;

    card.innerHTML = `
      <div style="text-align: center;">
        ${product.imageLink ? `
          <img src="${product.imageLink}" 
               alt="${product.title}" 
               style="
                 width: 100%;
                 max-height: 150px;
                 object-fit: contain;
                 border-radius: 8px;
                 margin-bottom: 12px;
                 background: ${isDarkMode ? '#374151' : '#f9fafb'};
                 padding: 8px;
               "
               onerror="this.style.display='none';"
          />
        ` : `
          <div style="
            height: 150px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: ${isDarkMode ? '#374151' : '#f3f4f6'};
            border-radius: 8px;
            margin-bottom: 12px;
            color: #6b7280;
          ">
            📦
          </div>
        `}
        
        <h3 style="
          font-size: 14px;
          font-weight: 600;
          color: ${textColor};
          margin: 0 0 8px 0;
          line-height: 1.3;
        ">${displayTitle}</h3>
        
        <div style="
          font-size: 16px;
          font-weight: 700;
          color: #f59e0b;
          margin-bottom: 12px;
        ">${priceDisplay}</div>
        
        ${product.link ? `
          <a href="${product.link}" 
             target="_blank" 
             rel="noopener noreferrer"
             style="
               background: linear-gradient(45deg, #10b981, #059669);
               color: white;
               text-decoration: none;
               padding: 8px 16px;
               border-radius: 6px;
               font-size: 12px;
               font-weight: 500;
               display: inline-block;
             "
          >
            🛒 View Product
          </a>
        ` : `
          <div style="color: #6b7280; font-size: 12px;">
            🔗 Link N/A
          </div>
        `}
      </div>
    `;

    cardsRow.appendChild(card);
  });

  // Assemble the complete cards container
  cardsContainer.appendChild(toggleButton);
  cardsContainer.appendChild(cardsRow);

  // Append to message container
  messageContainer.appendChild(cardsContainer);
  
  console.log(`✅ Created ${products.length} product cards`);
}


function showTooltip(anchor, keyword) {
  const rect = anchor.getBoundingClientRect();
  
  const isDarkMode = document.documentElement.classList.contains('dark') || 
                     document.body.classList.contains('dark') ||
                     window.getComputedStyle(document.body).backgroundColor === 'rgb(52, 53, 65)';
  
  const bgColor = isDarkMode ? '#2d2d2d' : '#ffffff';
  const textColor = isDarkMode ? '#ffffff' : '#000000';
  const borderColor = isDarkMode ? '#444444' : '#cccccc';

  // Initial tooltip HTML: loading state for CJ affiliate
  tooltipContainer.innerHTML = `
    <div style="
      background: ${bgColor};
      color: ${textColor};
      border: 1px solid ${borderColor};
      padding: 16px;
      width: 350px;
      max-width: 90vw;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      border-radius: 12px;
      font-size: 13px;
      pointer-events: auto;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    ">
      <div id="cj-loading" style="display: flex; align-items: center; margin-bottom: 12px; justify-content: center; padding: 20px 0;">
        <div style="
          width: 20px; 
          height: 20px; 
          border: 3px solid ${borderColor}; 
          border-top: 3px solid #ff6b35; 
          border-radius: 50%; 
          animation: spin 1s linear infinite;
        "></div>
        <span style="margin-left: 10px; font-size: 13px; color: #666;">Loading product details...</span>
      </div>
      <div id="cj-results" style="font-size: 13px; color: ${textColor};">
        <!-- Result will be injected here -->
      </div>
      <style>
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .cj-product-image {
          transition: transform 0.2s ease;
        }
        .cj-product-image:hover {
          transform: scale(1.05);
        }
        .cj-affiliate-link {
          background: linear-gradient(45deg, #ff6b35, #f7931e);
          color: white;
          text-decoration: none;
          padding: 8px 16px;
          border-radius: 6px;
          font-weight: 400;
          display: inline-block;
          transition: all 0.2s ease;
          margin-top: 8px;
        }
        .cj-affiliate-link:hover {
          background: linear-gradient(45deg, #e55a2b, #d9821a);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(255, 107, 53, 0.3);
        }
      </style>
    </div>
  `;

  // Position tooltip below the anchor, adjusting if it goes outside viewport
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const tooltipWidth = 350; 
  const tooltipHeight = 200; // increased for image

  let left = rect.left + window.scrollX;
  let top = rect.bottom + window.scrollY + 8;
  
  if (left + tooltipWidth > viewportWidth) {
    left = viewportWidth - tooltipWidth - 15;
  }
  if (left < 15) {
    left = 15;
  }
  
  if (top + tooltipHeight > viewportHeight + window.scrollY) {
    top = rect.top + window.scrollY - tooltipHeight - 8;
  }

  tooltipContainer.style.top = `${top}px`;
  tooltipContainer.style.left = `${left}px`;
  tooltipContainer.style.display = 'block';
  
  console.log(`✅ Tooltip displayed for "${keyword}" at (${left}, ${top})`);

  // Fetch CJ Affiliate data
  searchCJAffiliate(keyword).then(result => {
    const loadingElement = document.getElementById('cj-loading');
    const resultsElement = document.getElementById('cj-results');

    if (loadingElement) loadingElement.style.display = 'none';
    
    if (!resultsElement) return;

    if (result.success && result.product) {
      const { title, amount, currency, imageLink, link } = result.product;
      const priceDisplay = (amount !== null && currency) ? `$${amount} ${currency}` : 'Price N/A';
      
      // Truncate long titles
      const displayTitle = title.length > 60 ? title.substring(0, 57) + '...' : title;
      
      // Build the result HTML with image and link
      let resultHTML = `
        <div style="display: flex; flex-direction: column; gap: 12px;">
      `;
      
      // Product image (if available)
      if (imageLink && imageLink.trim() !== '') {
        resultHTML += `
          <div style="text-align: center;">
            <img src="${imageLink}" 
                 alt="${title}" 
                 class="cj-product-image"
                 style="
                   max-width: 200px; 
                   max-height: 300px; 
                   object-fit: contain; 
                   border-radius: 8px;
                   border: 2px solid ${isDarkMode ? '#444' : '#eee'};
                   background: ${isDarkMode ? '#333' : '#f9f9f9'};
                   padding: 8px;
                 "
                 onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"
            />
            <div style="display: none; padding: 20px; color: #888; font-size: 12px;">
              📷 Image not available
            </div>
          </div>
        `;
      }
      
      // Product details
      resultHTML += `
          <div>
            <div style="font-weight: bold; font-size: 14px; margin-bottom: 6px; line-height: 1.3;">
              ${displayTitle}
            </div>
            <div style="font-size: 16px; color: #ff6b35; font-weight: 700; margin-bottom: 8px;">
              ${priceDisplay}
            </div>
      `;
      
      // Affiliate link (if available)
      if (link && link.trim() !== '') {
        resultHTML += `
            <a href="${link}" 
               target="_blank" 
               rel="noopener noreferrer"
               class="cj-affiliate-link"
               onclick="console.log('🔗 Clicked affiliate link:', '${link}')">
              🛒 View on CJ Affiliate
            </a>
        `;
      } else {
        resultHTML += `
            <div style="color: #888; font-size: 12px; font-style: italic;">
              🔗 Direct link not available
            </div>
        `;
      }
      
      resultHTML += `
          </div>
        </div>
      `;
      
      resultsElement.innerHTML = resultHTML;
      console.log(`📌 Displayed CJ result: Title="${title}", Price="${priceDisplay}", Image="${imageLink ? 'Yes' : 'No'}", Link="${link ? 'Yes' : 'No'}"`);
      
    } else {
      const msg = result.error 
        ? `Error: ${result.error}` 
        : 'No CJ Affiliate product found.';
      resultsElement.innerHTML = `
        <div style="
          text-align: center; 
          padding: 20px; 
          color: #888; 
          font-style: italic; 
          font-size: 13px;
        ">
          <div style="font-size: 24px; margin-bottom: 8px;">😕</div>
          ${msg}
        </div>
      `;
      console.log(`ℹ️ CJ result status: ${msg}`);
    }
  });
}

function hideTooltip() {
  tooltipContainer.style.display = 'none';
  console.log('👻 Tooltip hidden');
}

// Highlight detected products (unchanged from your original approach)
function highlightProducts(element, products) {
  if (!products || !Array.isArray(products) || products.length === 0) {
    console.log('❌ No products to highlight');
    return;
  }

  console.log('🎯 Highlighting', products.length, 'products');

  try {
    // Create a temporary div to work with plain text first
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = element.innerHTML;
    
    // Remove existing highlights first to prevent nesting
    const existingHighlights = tempDiv.querySelectorAll('.product-highlight');
    existingHighlights.forEach(highlight => {
      const textNode = document.createTextNode(highlight.textContent);
      highlight.parentNode.replaceChild(textNode, highlight);
    });
    
    // Now work with the cleaned content
    // We'll process text nodes directly to avoid HTML entity issues
    const walker = document.createTreeWalker(
      tempDiv,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    
    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node);
    }
    
    // Process each product for highlighting
    products.forEach(product => {
      if (!product || typeof product !== 'string') return;
      
      const cleanProduct = product.trim();
      if (cleanProduct.length < 3) return;
      
      try {
        // Create regex that handles the product name case-insensitively
        // Escape ALL special regex characters including &, (), [], etc.
        const escapedProduct = cleanProduct.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        // For products with special characters, we might need to be more flexible with word boundaries
        let regex;
        if (/[()[\]{}]/.test(cleanProduct)) {
          // For products with brackets, use lookahead/lookbehind for word boundaries
          // This handles cases like "Product (Model)" better
          regex = new RegExp(`(?<!\\w)${escapedProduct}(?!\\w)`, 'gi');
        } else {
          // For regular products, use standard word boundaries
          regex = new RegExp(`\\b${escapedProduct}\\b`, 'gi');
        }
        
        console.log(`🔍 Looking for: "${cleanProduct}" with regex: ${regex}`);
        
        // Process each text node
        textNodes.forEach(textNode => {
          const originalText = textNode.textContent;
          
          if (regex.test(originalText)) {
            console.log(`✅ Found "${cleanProduct}" in text node`);
            
            // Create replacement HTML
            const highlightedText = originalText.replace(regex, (match) => {
              return `<span class="product-highlight" 
                        data-product="${cleanProduct}" 
                        style="
                          font-weight: bold; 
                          cursor: pointer;
                          text-decoration: underline;
                          text-decoration-color: #ffc107;
                          text-decoration-thickness: 2px;
                        ">${match}</span>`;
            });
            
            // Only replace if we actually made changes
            if (highlightedText !== originalText) {
              // Create a temporary container to hold the new HTML
              const tempContainer = document.createElement('div');
              tempContainer.innerHTML = highlightedText;
              
              // Replace the text node with the highlighted content
              const fragment = document.createDocumentFragment();
              while (tempContainer.firstChild) {
                fragment.appendChild(tempContainer.firstChild);
              }
              
              textNode.parentNode.replaceChild(fragment, textNode);
            }
          }
        });
        
        console.log(`✅ Processed highlighting for: "${cleanProduct}"`);
      } catch (error) {
        console.log(`⚠️ Could not highlight: "${cleanProduct}"`, error);
      }
    });
    
    // Apply the changes back to the original element
    element.innerHTML = tempDiv.innerHTML;
    
    // Add event listeners to all highlighted elements
    const highlights = element.querySelectorAll('.product-highlight');
    console.log(`🎯 Found ${highlights.length} highlighted elements after processing`);
    
    highlights.forEach((span, index) => {
      console.log(`🔗 Adding events to highlight ${index + 1}: "${span.textContent}"`);
      
      let hoverTimeout;
      
      span.addEventListener('mouseenter', function() {
        console.log(`🖱️ Mouse entered: "${this.textContent}"`);

        // Clear any pending hide
        if (hoverTimeout) {
          clearTimeout(hoverTimeout);
        }
        
        const productName = this.getAttribute('data-product') || this.textContent.trim();
        showTooltip(this, productName);
      });
      
      span.addEventListener('mouseleave', function() {
        console.log(`🖱️ Mouse left: "${this.textContent}"`);
        
        // Delay hiding tooltip to allow moving into it
        hoverTimeout = setTimeout(() => {
          if (!tooltipContainer.matches(':hover')) {
            hideTooltip();
          }
        }, 300);
      });
      
      span.addEventListener('click', function(e) {
        e.preventDefault();
        console.log(`🖱️ Clicked: "${this.textContent}"`);
        // Keep tooltip open on click for better UX
        const productName = this.getAttribute('data-product') || this.textContent.trim();
        showTooltip(this, productName);
      });
      
      // Store reference for cleanup
      observedElements.set(span, hoverTimeout);
    });
    
    console.log(`✅ Added event listeners to ${highlights.length} highlights`);
    
  } catch (error) {
    console.error('❌ Error in highlightProducts:', error);
  }
}

// Enhanced tooltip mouse interactions
tooltipContainer.addEventListener('mouseenter', function() {
  console.log('🖱️ Mouse entered tooltip');
});

tooltipContainer.addEventListener('mouseleave', function() {
  console.log('🖱️ Mouse left tooltip');
  hideTooltip();
});

// Allow clicking links in tooltip
tooltipContainer.style.pointerEvents = 'auto';

// Send text to server for product detection
// Send text to server for product detection
async function detectAndLogProducts(responseElement) {
  // Skip if already processed to prevent re-highlighting
  if (responseElement.querySelector('.product-highlight')) {
    console.log('⏭️ Element already has highlights, skipping');
    return;
  }

  const text = responseElement.innerText || responseElement.textContent || '';
  if (!text || text.length < 100) {
    console.log('⚠️ Text too short, skipping detection');
    return;
  }

  const textHash = text.length + '_' + text.substring(0, 100);
  if (processedResponses.has(textHash)) {
    console.log('⏭️ Already processed this response');
    return;
  }

  processedResponses.add(textHash);
  console.log('📤 Sending to product detector...');

  try {
    const response = await fetch(SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text }),
    });

    if (!response.ok) {
      console.error('❌ Server error:', response.status);
      console.log('🧪 Server failed, adding test products for debugging...');
      highlightProducts(responseElement, ['iPhone', 'MacBook', 'AirPods']);
      
      // Create cards for test products
      detectedProductsForCards = ['iPhone', 'MacBook', 'AirPods'];
      getAllCJProducts(['iPhone', 'MacBook', 'AirPods']).then(allProductsResult => {
        if (allProductsResult.success && allProductsResult.products.length > 0) {
          createProductCards(allProductsResult.products);
        }
      });
      return;
    }

    const result = await response.json();

    console.group('🛍️ DETECTED PRODUCTS');
    console.log('📝 Text length:', text.length, 'characters');

    if (Array.isArray(result) && result.length > 0) {
      console.log('✅ Found', result.length, 'products:');
      result.forEach((product, index) => {
        console.log(`  ${index + 1}. ${product}`);
      });

      highlightProducts(responseElement, result);
      
      // Store detected products for card display
      detectedProductsForCards = result;
      
      // Get all CJ products and create cards
      getAllCJProducts(result).then(allProductsResult => {
        if (allProductsResult.success && allProductsResult.products.length > 0) {
          createProductCards(allProductsResult.products);
        }
      });
    } else {
      console.log('📊 No products detected');
      console.log('🧪 Adding test products for debugging...');
      highlightProducts(responseElement, ['iPhone', 'MacBook', 'AirPods']);
      
      // Create cards for test products
      detectedProductsForCards = ['iPhone', 'MacBook', 'AirPods'];
      getAllCJProducts(['iPhone', 'MacBook', 'AirPods']).then(allProductsResult => {
        if (allProductsResult.success && allProductsResult.products.length > 0) {
          createProductCards(allProductsResult.products);
        }
      });
    }

    console.groupEnd();
  } catch (error) {
    console.error('❌ Error detecting products:', error);
    console.log('🧪 Server failed, adding test products for debugging...');
    highlightProducts(responseElement, ['iPhone', 'MacBook', 'AirPods']);
    
    // Create cards for test products
    detectedProductsForCards = ['iPhone', 'MacBook', 'AirPods'];
    getAllCJProducts(['iPhone', 'MacBook', 'AirPods']).then(allProductsResult => {
      if (allProductsResult.success && allProductsResult.products.length > 0) {
        createProductCards(allProductsResult.products);
      }
    });
    
    processedResponses.delete(textHash); // allow retry
  }
}

// Find and process ChatGPT assistant responses
function processResponses() {
  try {
    const selectors = [
      '[data-message-author-role="assistant"]',
      '[data-testid*="conversation-turn"]:has([data-message-author-role="assistant"])',
      '.group.w-full:has([data-message-author-role="assistant"])'
    ];

    let assistantMessages = [];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        assistantMessages = Array.from(elements);
        console.log(`📍 Found ${elements.length} messages with: ${selector}`);
        break;
      }
    }

    if (assistantMessages.length === 0) {
      console.log('❌ No assistant messages found');
      return;
    }

    const lastMessage = assistantMessages[assistantMessages.length - 1];
    const text = lastMessage.innerText || lastMessage.textContent || '';

    if (text.length > 100) {
      console.log(`📝 Processing response (${text.length} chars)...`);
      detectAndLogProducts(lastMessage);
    } else {
      console.log('⚠️ Last response too short');
    }
  } catch (error) {
    console.error('❌ Error in processResponses:', error);
  }
}

// Wait until DOM is stable for 5s without changes before processing
function scheduleFinalProcessing() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const now = Date.now();
    const delay = now - lastChangeTime;

    if (delay >= 5000) {
      console.log('⏱️ 5s passed with no changes. Processing response...');
      processResponses();
    } else {
      console.log(`⏳ Not yet stable (only ${Math.floor(delay / 1000)}s). Waiting...`);
      scheduleFinalProcessing();
    }
  }, 5000); // 5 seconds
}

// Observe page changes
const observer = new MutationObserver(mutations => {
  const relevant = mutations.some(m => m.type === 'childList' && m.addedNodes.length > 0);

  if (relevant) {
    lastChangeTime = Date.now();
    console.log('📌 DOM changed, resetting 5s wait timer...');
    scheduleFinalProcessing();
  }
});

try {
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  console.log('👀 Started observing DOM for response completion...');
} catch (e) {
  console.error('❌ Failed to start MutationObserver:', e);
}

// Backup periodic check every 30s
setInterval(() => {
  console.log('🕒 Backup periodic check...');
  processResponses();
}, 30000);

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  observedElements.forEach(timeoutId => clearTimeout(timeoutId));
  observedElements.clear();
});
function createProductCards(products) {
  if (!products || products.length === 0) {
    console.log('❌ No products to create cards for');
    return;
  }

  console.log(`🎴 Creating cards for ${products.length} products`);

  // Remove existing cards container if any
  if (cardsContainer) {
    cardsContainer.remove();
  }

  // Find the last assistant message
  const assistantMessages = document.querySelectorAll('[data-message-author-role="assistant"]');
  if (assistantMessages.length === 0) {
    console.log('❌ No assistant message found to append cards');
    return;
  }

  const lastMessage = assistantMessages[assistantMessages.length - 1];
  const messageContainer = lastMessage.closest('.group') || lastMessage.parentElement;

  // Create cards container
  cardsContainer = document.createElement('div');
  cardsContainer.style.cssText = `
    margin-top: 20px;
    padding: 16px;
    border-top: 2px solid #e5e7eb;
    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
    border-radius: 12px;
  `;

  // Create "See More" toggle button
  // Create "See More" toggle button
  const toggleButton = document.createElement('button');
  toggleButton.innerHTML = '🛍️ See More Products';
  toggleButton.style.cssText = `
    background: linear-gradient(45deg, #3b82f6, #1d4ed8);
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 16px;
    transition: all 0.3s ease;
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
  `;

  // Create cards row container (initially hidden)
  const cardsRow = document.createElement('div');
  cardsRow.style.cssText = `
    display: none;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 16px;
    margin-top: 16px;
  `;

  let isExpanded = false;

  // Toggle functionality
  toggleButton.addEventListener('click', () => {
    isExpanded = !isExpanded;
    if (isExpanded) {
      cardsRow.style.display = 'grid';
      toggleButton.innerHTML = '🔼 Hide Products';
      toggleButton.style.background = 'linear-gradient(45deg, #ef4444, #dc2626)';
    } else {
      cardsRow.style.display = 'none';
      toggleButton.innerHTML = '🛍️ See More Products';
      toggleButton.style.background = 'linear-gradient(45deg, #3b82f6, #1d4ed8)';
    }
  });

  // Create individual product cards
  products.forEach((product, index) => {
    const card = document.createElement('div');
    const isDarkMode = document.documentElement.classList.contains('dark') || 
                       document.body.classList.contains('dark');
    
    const bgColor = isDarkMode ? '#1f2937' : '#ffffff';
    const textColor = isDarkMode ? '#ffffff' : '#1f2937';
    const borderColor = isDarkMode ? '#374151' : '#e5e7eb';
    
    card.style.cssText = `
      background: ${bgColor};
      border: 1px solid ${borderColor};
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      transition: all 0.3s ease;
      cursor: pointer;
    `;

    // Hover effects
    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-4px)';
      card.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
    });
    
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'translateY(0)';
      card.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
    });

    const priceDisplay = (product.amount !== null && product.currency) 
      ? `$${product.amount} ${product.currency}` 
      : 'Price N/A';
    
    const displayTitle = product.title.length > 50 
      ? product.title.substring(0, 47) + '...' 
      : product.title;

    card.innerHTML = `
      <div style="text-align: center;">
        ${product.imageLink ? `
          <img src="${product.imageLink}" 
               alt="${product.title}" 
               style="
                 width: 100%;
                 max-height: 150px;
                 object-fit: contain;
                 border-radius: 8px;
                 margin-bottom: 12px;
                 background: ${isDarkMode ? '#374151' : '#f9fafb'};
                 padding: 8px;
               "
               onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"
          />
          <div style="display: none; padding: 20px; color: #6b7280; font-size: 12px;">
            📷 Image not available
          </div>
        ` : `
          <div style="
            height: 150px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: ${isDarkMode ? '#374151' : '#f3f4f6'};
            border-radius: 8px;
            margin-bottom: 12px;
            color: #6b7280;
          ">
            📦 No Image
          </div>
        `}
        
        <h3 style="
          font-size: 14px;
          font-weight: 600;
          color: ${textColor};
          margin: 0 0 8px 0;
          line-height: 1.3;
          min-height: 36px;
        ">${displayTitle}</h3>
        
        <div style="
          font-size: 16px;
          font-weight: 700;
          color: #f59e0b;
          margin-bottom: 12px;
        ">${priceDisplay}</div>
        
        ${product.link ? `
          <a href="${product.link}" 
             target="_blank" 
             rel="noopener noreferrer"
             style="
               background: linear-gradient(45deg, #10b981, #059669);
               color: white;
               text-decoration: none;
               padding: 8px 16px;
               border-radius: 6px;
               font-size: 12px;
               font-weight: 500;
               display: inline-block;
               transition: all 0.2s ease;
             "
             onmouseover="this.style.background='linear-gradient(45deg, #059669, #047857)'"
             onmouseout="this.style.background='linear-gradient(45deg, #10b981, #059669)'"
          >
            🛒 View Product
          </a>
        ` : `
          <div style="color: #6b7280; font-size: 12px; font-style: italic;">
            🔗 Link not available
          </div>
        `}
      </div>
    `;

    cardsRow.appendChild(card);
  });

  // Assemble the complete cards container
  cardsContainer.appendChild(toggleButton);
  cardsContainer.appendChild(cardsRow);

  // Append to message container
  messageContainer.appendChild(cardsContainer);
  
  console.log(`✅ Created ${products.length} product cards`);
}
console.log('✅ Product Detector initialized with enhanced CJ Affiliate integration (Images + Links)...');