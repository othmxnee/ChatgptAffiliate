console.log("🚀 Extension started — observing ChatGPT responses");

const keywords = ['buy', 'price', 'Amazon', 'Walmart', 'order', 'product'];
const tooltipContainer = document.createElement('div');
tooltipContainer.id = 'affiliate-tooltip-container';
tooltipContainer.style.position = 'absolute';
tooltipContainer.style.zIndex = '9999';
tooltipContainer.style.pointerEvents = 'none';
document.body.appendChild(tooltipContainer);

const processedParagraphs = new WeakSet();
const observedParagraphs = new Map();

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType !== 1) continue;

      // Check for various text elements
      const textElements = [
        'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 
        'DIV', 'SPAN', 'LI', 'TD', 'TH'
      ];
      
      if (textElements.includes(node.tagName)) {
        handleTextElement(node);
      } else if (node.querySelectorAll) {
        // Look for all possible text containers
        const selector = textElements.map(tag => tag.toLowerCase()).join(', ');
        node.querySelectorAll(selector).forEach(element => handleTextElement(element));
      }
    }
  }
});

observer.observe(document.body, { childList: true, subtree: true });

function handleTextElement(element) {
  // Skip if already processed
  if (processedParagraphs.has(element)) return;
  
  // Skip if element doesn't contain text or contains only child elements without direct text
  const directText = getDirectTextContent(element);
  if (!directText || directText.trim().length < 3) return;
  
  // Skip if element has too many child elements (likely a container, not content)
  if (element.children.length > 5) return;
  
  // Skip script, style, and other non-content elements
  const skipTags = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED'];
  if (skipTags.includes(element.tagName)) return;
  
  if (observedParagraphs.has(element)) clearTimeout(observedParagraphs.get(element));

  const timeoutId = setTimeout(() => {
    const fullText = directText.trim();
    if (fullText.length > 5) {
      console.log(`✅ Stable text element detected (${element.tagName}):`, fullText);
      addKeywordHighlights(element);
      processedParagraphs.add(element);
    }
    observedParagraphs.delete(element);
  }, 800);

  observedParagraphs.set(element, timeoutId);
}

function getDirectTextContent(element) {
  // Get only direct text content, not from deep nested children
  let text = '';
  for (let node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent;
    } else if (node.nodeType === Node.ELEMENT_NODE && node.children.length <= 2) {
      // Include text from simple nested elements (like <strong>, <em>, etc.)
      text += node.textContent;
    }
  }
  return text;
}

function addKeywordHighlights(element) {
  const originalText = element.textContent;
  
  // Find all keyword matches first
  const allMatches = [];
  
  keywords.forEach(keyword => {
    // Create a fresh regex for each keyword to avoid state issues
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    let match;
    
    // Reset regex lastIndex to ensure we start from beginning
    regex.lastIndex = 0;
    
    while ((match = regex.exec(originalText)) !== null) {
      allMatches.push({
        text: match[0],
        index: match.index,
        keyword: keyword
      });
      
      // Prevent infinite loop on zero-width matches
      if (match.index === regex.lastIndex) {
        regex.lastIndex++;
      }
    }
  });
  
  console.log(`Found ${allMatches.length} keyword matches:`, allMatches);
  
  if (allMatches.length === 0) return;
  
  // Sort matches by index to process them in order
  allMatches.sort((a, b) => a.index - b.index);
  
  // Create overlay container
  const overlay = document.createElement('div');
  overlay.className = 'affiliate-overlay';
  overlay.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 1;
  `;
  
  // Make parent relative if not already
  const computedStyle = window.getComputedStyle(element);
  if (computedStyle.position === 'static') {
    element.style.position = 'relative';
  }
  
  // Create a canvas for text measurement
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const styles = window.getComputedStyle(element);
  context.font = `${styles.fontWeight} ${styles.fontSize} ${styles.fontFamily}`;
  
  // Process each match
  allMatches.forEach((matchData, index) => {
    const { text: matchText, index: matchIndex, keyword } = matchData;
    
    // Create highlight span
    const highlightSpan = document.createElement('span');
    highlightSpan.textContent = matchText;
    highlightSpan.className = 'affiliate-keyword';
    highlightSpan.dataset.keyword = keyword;
    highlightSpan.style.cssText = `
      position: absolute;
      color: #0066cc;
      background: rgba(0, 123, 255, 0.1);
      text-decoration: underline;
      cursor: pointer;
      pointer-events: auto;
      border-radius: 3px;
      padding: 1px 2px;
      font-weight: 500;
      z-index: 2;
      white-space: nowrap;
    `;
    
    // Calculate position using canvas text measurement
    const beforeText = originalText.substring(0, matchIndex);
    const beforeWidth = context.measureText(beforeText).width;
    const matchWidth = context.measureText(matchText).width;
    
    // Position the highlight
    highlightSpan.style.left = beforeWidth + 'px';
    highlightSpan.style.width = matchWidth + 'px';
    highlightSpan.style.top = '0px';
    highlightSpan.style.height = '1.2em';
    
    // Add event listeners
    highlightSpan.addEventListener('mouseenter', (e) => showTooltip(e.target, keyword));
    highlightSpan.addEventListener('mouseleave', () => hideTooltip());
    
    overlay.appendChild(highlightSpan);
    
    console.log(`Added highlight for "${matchText}" (${keyword}) at position ${beforeWidth}px`);
  });
  
  // Add overlay to element
  if (overlay.children.length > 0) {
    element.appendChild(overlay);
  }
}

// Removed getTextWidth function as we now use canvas directly in addKeywordHighlights

function showTooltip(anchor, keyword) {
  const rect = anchor.getBoundingClientRect();
  
  // Detect theme (light/dark mode)
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

  // Position tooltip
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const tooltipWidth = 320;
  const tooltipHeight = 200;
  
  let left = rect.left + window.scrollX;
  let top = rect.bottom + window.scrollY + 5;
  
  // Adjust if tooltip goes off screen
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
}

function hideTooltip() {
  tooltipContainer.style.display = 'none';
}

// Clean up on page navigation
window.addEventListener('beforeunload', () => {
  observedParagraphs.forEach(timeoutId => clearTimeout(timeoutId));
  observedParagraphs.clear();
});