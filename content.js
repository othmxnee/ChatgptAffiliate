// content.js

console.log('🔍 ChatGPT Product Detector loaded and waiting for full response...');

let processedResponses = new Set();
const SERVER_URL = 'http://localhost:3000/detect-products';
let debounceTimer = null;
let lastChangeTime = Date.now();

// Create tooltip container using your working approach
let tooltipContainer = document.createElement('div');
tooltipContainer.style.cssText = `
  position: absolute;
  z-index: 10000;
  display: none;
  pointer-events: none;
`;
document.body.appendChild(tooltipContainer);

let observedElements = new Map();

function showTooltip(anchor, keyword) {
  const rect = anchor.getBoundingClientRect();
  
  const isDarkMode = document.documentElement.classList.contains('dark') || 
                     document.body.classList.contains('dark') ||
                     window.getComputedStyle(document.body).backgroundColor === 'rgb(52, 53, 65)';
  
  const bgColor = isDarkMode ? '#2d2d2d' : '#fff';
  const textColor = isDarkMode ? '#fff' : '#000';
  const borderColor = isDarkMode ? '#444' : '#ccc';

  tooltipContainer.innerHTML = `
    <div style="
      background: ${bgColor};
      color: ${textColor};
      border: 1px solid ${borderColor};
      padding: 12px;
      width: 320px;
      max-width: 90vw;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      border-radius: 8px;
      font-size: 13px;
      pointer-events: auto;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    ">
      <div style="margin-bottom: 8px;">
        <strong>🔗 Product Links for "${keyword}"</strong>
      </div>
      <div style="margin-bottom: 8px;">
        <a href="https://amazon.com/s?k=${encodeURIComponent(keyword)}" target="_blank" 
           style="color: #0066cc; text-decoration: none; display: block; margin: 4px 0;">
          📦 Amazon Search
        </a>
        <a href="https://walmart.com/search?q=${encodeURIComponent(keyword)}" target="_blank"
           style="color: #0066cc; text-decoration: none; display: block; margin: 4px 0;">
          🛒 Walmart Search
        </a>
      </div>
      <details style="margin-top: 8px;">
        <summary style="cursor: pointer; padding: 4px 0; font-weight: 500;">More options</summary>
        <ul style="margin: 8px 0 0 0; padding-left: 20px;">
          <li style="margin: 4px 0;">
            <a href="https://ebay.com/sch/i.html?_nkw=${encodeURIComponent(keyword)}" target="_blank"
               style="color: #0066cc; text-decoration: none;">eBay Search</a>
          </li>
          <li style="margin: 4px 0;">
            <a href="https://target.com/s?searchTerm=${encodeURIComponent(keyword)}" target="_blank"
               style="color: #0066cc; text-decoration: none;">Target Search</a>
          </li>
          <li style="margin: 4px 0;">
            <a href="https://bestbuy.com/site/searchpage.jsp?st=${encodeURIComponent(keyword)}" target="_blank"
               style="color: #0066cc; text-decoration: none;">Best Buy Search</a>
          </li>
        </ul>
      </details>
      <div style="margin-top: 12px; padding-top: 8px; border-top: 1px solid ${borderColor}; font-size: 11px;">
        <details>
          <summary style="cursor: pointer; color: #666;">Feedback</summary>
          <div style="margin-top: 8px;">
            <textarea placeholder="Your feedback..." style="
              width: 100%; 
              height: 60px; 
              padding: 6px; 
              border: 1px solid ${borderColor}; 
              border-radius: 4px;
              background: ${bgColor};
              color: ${textColor};
              font-size: 12px;
              resize: vertical;
            "></textarea>
            <button style="
              background: #0066cc; 
              color: white; 
              border: none; 
              padding: 6px 12px; 
              border-radius: 4px; 
              cursor: pointer; 
              font-size: 12px;
              margin-top: 6px;
            " onclick="alert('Feedback submitted! (This is a demo)')">
              Submit
            </button>
          </div>
        </details>
      </div>
    </div>
  `;

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const tooltipWidth = 320;
  const tooltipHeight = 200;
  
  let left = rect.left + window.scrollX;
  let top = rect.bottom + window.scrollY + 5;
  
  if (left + tooltipWidth > viewportWidth) {
    left = viewportWidth - tooltipWidth - 10;
  }
  if (left < 10) {
    left = 10;
  }
  
  if (top + tooltipHeight > viewportHeight + window.scrollY) {
    top = rect.top + window.scrollY - tooltipHeight - 5;
  }

  tooltipContainer.style.top = `${top}px`;
  tooltipContainer.style.left = `${left}px`;
  tooltipContainer.style.display = 'block';
  
  console.log(`✅ Tooltip displayed for "${keyword}" at (${left}, ${top})`);
}

function hideTooltip() {
  tooltipContainer.style.display = 'none';
  console.log('👻 Tooltip hidden');
}

// Highlight detected products using your working approach
function highlightProducts(element, products) {
  if (!products || !Array.isArray(products) || products.length === 0) {
    console.log('❌ No products to highlight');
    return;
  }

  console.log('🎯 Highlighting', products.length, 'products');
  
  try {
    let html = element.innerHTML;
    
    products.forEach(product => {
      if (!product || typeof product !== 'string') return;
      
      const cleanProduct = product.trim();
      if (cleanProduct.length < 3) return;
      
      try {
        // More precise regex to avoid over-matching
        const escapedProduct = cleanProduct.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b(${escapedProduct})\\b`, 'gi');
        
        html = html.replace(regex, (match) => {
          return `<span class="product-highlight" 
                    data-product="${cleanProduct}" 
                    style="
                      background-color: #ffeb3b; 
                      font-weight: bold; 
                      padding: 2px 6px; 
                      border-radius: 4px; 
                      border: 2px solid #fbc02d; 
                      color: #333; 
                      cursor: pointer;
                      transition: all 0.2s ease;
                    ">${match}</span>`;
        });
        
        console.log(`✅ Highlighted: "${cleanProduct}"`);
      } catch (error) {
        console.log(`⚠️ Could not highlight: "${cleanProduct}"`, error);
      }
    });
    
    element.innerHTML = html;
    
    // Add event listeners using your working approach
    const highlights = element.querySelectorAll('.product-highlight');
    console.log(`🎯 Found ${highlights.length} highlighted elements`);
    
    highlights.forEach((span, index) => {
      console.log(`🔗 Adding events to highlight ${index + 1}: "${span.textContent}"`);
      
      let hoverTimeout;
      
      span.addEventListener('mouseenter', function(e) {
        console.log(`🖱️ Mouse entered: "${this.textContent}"`);
        
        // Clear any existing timeout
        if (hoverTimeout) {
          clearTimeout(hoverTimeout);
        }
        
        // Visual feedback
        this.style.backgroundColor = '#fdd835';
        this.style.transform = 'scale(1.05)';
        
        const productName = this.getAttribute('data-product') || this.textContent.trim();
        
        // Show tooltip immediately
        showTooltip(this, productName);
      });
      
      span.addEventListener('mouseleave', function() {
        console.log(`🖱️ Mouse left: "${this.textContent}"`);
        
        // Reset visual feedback
        this.style.backgroundColor = '#ffeb3b';
        this.style.transform = 'scale(1)';
        
        // Hide tooltip after delay to allow moving to tooltip
        hoverTimeout = setTimeout(() => {
          if (!tooltipContainer.matches(':hover')) {
            hideTooltip();
          }
        }, 300);
      });
      
      span.addEventListener('click', function(e) {
        e.preventDefault();
        console.log(`🖱️ Clicked: "${this.textContent}"`);
        
        const productName = this.getAttribute('data-product') || this.textContent.trim();
        const searchUrl = `https://amazon.com/s?k=${encodeURIComponent(productName)}`;
        window.open(searchUrl, '_blank');
      });
      
      // Store reference for cleanup
      observedElements.set(span, hoverTimeout);
    });
    
    console.log(`✅ Added event listeners to ${highlights.length} highlights`);
    
  } catch (error) {
    console.error('❌ Error in highlightProducts:', error);
  }
}

// Add tooltip hover handling
tooltipContainer.addEventListener('mouseenter', function() {
  console.log('🖱️ Mouse entered tooltip');
});

tooltipContainer.addEventListener('mouseleave', function() {
  console.log('🖱️ Mouse left tooltip');
  hideTooltip();
});

// Send text to server for product detection
async function detectAndLogProducts(responseElement) {
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
      // For testing, add fake products when server fails
      console.log('🧪 Server failed, adding test products...');
      highlightProducts(responseElement, ['iPhone', 'MacBook', 'AirPods', 'Tesla']);
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
    } else {
      console.log('📊 No products detected');
      // For testing purposes, add some fake products
      console.log('🧪 Adding test products for debugging...');
      highlightProducts(responseElement, ['iPhone', 'MacBook', 'AirPods', 'Tesla']);
    }

    console.groupEnd();
  } catch (error) {
    console.error('❌ Error detecting products:', error);
    // For testing, add fake products when server fails
    console.log('🧪 Server failed, adding test products...');
    highlightProducts(responseElement, ['iPhone', 'MacBook', 'AirPods', 'Tesla']);
    processedResponses.delete(textHash); // allow retry
  }
}

// Find and process ChatGPT responses
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

// Handle stable delay (15s of no mutations)
function scheduleFinalProcessing() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const now = Date.now();
    const delay = now - lastChangeTime;

    if (delay >= 5000) {
      console.log('⏱️ 15s passed with no changes. Processing response...');
      processResponses();
    } else {
      console.log(`⏳ Not yet stable (only ${Math.floor(delay / 1000)}s). Waiting...`);
      scheduleFinalProcessing(); // Reschedule
    }
  }, 15000); // 15 seconds
}

// Observe page changes
const observer = new MutationObserver(mutations => {
  const relevant = mutations.some(m => m.type === 'childList' && m.addedNodes.length > 0);

  if (relevant) {
    lastChangeTime = Date.now();
    console.log('📌 DOM changed, resetting 15s wait timer...');
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

console.log('✅ Product Detector initialized with working tooltip system...');