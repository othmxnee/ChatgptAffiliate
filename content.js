console.log("🚀 Extension started — observing ChatGPT responses");

const keywords = ['buy', 'price', 'Amazon', 'Walmart', 'order', 'product','airpods'];
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
  
  // Skip ChatGPT internal elements and citations
  if (element.textContent.includes('contentReference') || 
      element.textContent.includes('oaicite') ||
      element.querySelector('[data-citation]') ||
      element.closest('[data-testid*="conversation"]') === null) return;
  
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
    // Double-check the element is still valid and hasn't changed
    const currentText = getDirectTextContent(element);
    if (currentText && currentText.trim().length > 5 && 
        !currentText.includes('contentReference') && 
        !currentText.includes('oaicite')) {
      console.log(`✅ Stable text element detected (${element.tagName}):`, currentText.trim());
      addKeywordHighlights(element);
      processedParagraphs.add(element);
    }
    observedParagraphs.delete(element);
  }, 1200);

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
  // Skip if element already has highlights
  if (element.querySelector('.affiliate-keyword')) return;
  
  // Final check for ChatGPT internal content
  if (element.textContent.includes('contentReference') || 
      element.textContent.includes('oaicite') ||
      element.textContent.includes(':contentReference')) {
    console.log('⚠️ Skipping element with ChatGPT internal content');
    return;
  }
  
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        // Skip text nodes that contain ChatGPT citations or internal markup
        if (node.textContent.includes('contentReference') || 
            node.textContent.includes('oaicite') ||
            node.textContent.includes(':contentReference')) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    },
    false
  );

  const textNodes = [];
  let node;
  while (node = walker.nextNode()) {
    if (node.textContent.trim().length > 0) {
      textNodes.push(node);
    }
  }

  // Process each text node
  textNodes.forEach(textNode => {
    const text = textNode.textContent;
    const matches = [];
    
    // Find all keyword matches in this text node
    keywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      let match;
      
      while ((match = regex.exec(text)) !== null) {
        matches.push({
          text: match[0],
          index: match.index,
          length: match[0].length,
          keyword: keyword
        });
        
        if (match.index === regex.lastIndex) {
          regex.lastIndex++;
        }
      }
    });

    if (matches.length === 0) return;

    // Sort matches by index (reverse order for replacement)
    matches.sort((a, b) => b.index - a.index);

    // Create a document fragment to hold the new content
    const fragment = document.createDocumentFragment();
    let lastIndex = text.length;

    // Process matches in reverse order to maintain indices
    matches.forEach(match => {
      // Add text after this match
      if (lastIndex > match.index + match.length) {
        const afterText = text.substring(match.index + match.length, lastIndex);
        fragment.insertBefore(document.createTextNode(afterText), fragment.firstChild);
      }

      // Create highlighted span
      const highlightSpan = document.createElement('span');
      highlightSpan.textContent = match.text;
      highlightSpan.className = 'affiliate-keyword';
      highlightSpan.dataset.keyword = match.keyword;
      highlightSpan.style.cssText = `
        color: rgb(204, 204, 0);
        text-decoration: underline;
        cursor: pointer;
        font-weight: 500;
      `;

      // Add event listeners
      highlightSpan.addEventListener('mouseenter', (e) => showTooltip(e.target, match.keyword));
      highlightSpan.addEventListener('mouseleave', () => hideTooltip());
      
      fragment.insertBefore(highlightSpan, fragment.firstChild);

      lastIndex = match.index;
    });

    // Add text before first match
    if (lastIndex > 0) {
      const beforeText = text.substring(0, lastIndex);
      fragment.insertBefore(document.createTextNode(beforeText), fragment.firstChild);
    }

    // Replace the original text node with the fragment
    textNode.parentNode.replaceChild(fragment, textNode);
    
    console.log(`Added ${matches.length} highlights in text node`);
  });
}

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

// Add additional observer for delayed content
setTimeout(() => {
  // Re-scan for any missed content after page is more stable
  document.querySelectorAll('p, div, span, h1, h2, h3, h4, h5, h6').forEach(element => {
    if (!processedParagraphs.has(element) && !observedParagraphs.has(element)) {
      const text = getDirectTextContent(element);
      if (text && text.trim().length > 5 && 
          !text.includes('contentReference') && 
          !text.includes('oaicite')) {
        handleTextElement(element);
      }
    }
  });
}, 3000);

// Also scan when user stops scrolling (content is likely stable)
let scrollTimeout;
window.addEventListener('scroll', () => {
  clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(() => {
    document.querySelectorAll('p, div, span, h1, h2, h3, h4, h5, h6').forEach(element => {
      if (!processedParagraphs.has(element) && !observedParagraphs.has(element)) {
        const text = getDirectTextContent(element);
        if (text && text.trim().length > 5 && 
            !text.includes('contentReference') && 
            !text.includes('oaicite')) {
          handleTextElement(element);
        }
      }
    });
  }, 1000);
});