console.log('🔍 ChatGPT Product Detector loaded and waiting for full response...');

let processedResponses = new Set();
const SERVER_URL = 'http://localhost:3000/detect-products';
let debounceTimer = null;
let lastChangeTime = Date.now();

// Highlight detected products
function highlightProducts(element, products) {
  if (!products || !Array.isArray(products) || products.length === 0) {
    console.log('❌ No products to highlight');
    return;
  }

  try {
    let html = element.innerHTML;
    console.log('🎯 Highlighting', products.length, 'products');

    products.forEach(product => {
      if (!product || typeof product !== 'string') return;

      const cleanProduct = product.trim();
      if (cleanProduct.length < 3) return;

      try {
        const regex = new RegExp(`(${cleanProduct.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        html = html.replace(regex, `<span class="product-highlight" style="background-color: #ffeb3b; font-weight: bold; padding: 2px 4px; border-radius: 3px; border: 1px solid #fbc02d; color: #333;">$1</span>`);
        console.log(`✅ Highlighted: "${cleanProduct}"`);
      } catch {
        console.log(`⚠️ Could not highlight: "${cleanProduct}"`);
      }
    });

    element.innerHTML = html;
  } catch (error) {
    console.error('❌ Error in highlightProducts:', error);
  }
}

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
    }

    console.groupEnd();
  } catch (error) {
    console.error('❌ Error detecting products:', error);
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

console.log('✅ Product Detector initialized and waiting for stable responses...');
