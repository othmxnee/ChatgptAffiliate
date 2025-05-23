console.log("🚀 Extension started — observing ChatGPT responses");

const tooltipContainer = document.createElement('div');
tooltipContainer.id = 'affiliate-tooltip-container';
tooltipContainer.style.position = 'absolute';
tooltipContainer.style.zIndex = '9999';
tooltipContainer.style.pointerEvents = 'none';
document.body.appendChild(tooltipContainer);

const processedParagraphs = new WeakSet();
const observedParagraphs = new Map();
let currentTooltipTimeout;
let isTooltipHovered = false;
let currentKeyword = null;

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType !== 1) continue;

      const textElements = [
        'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 
        'DIV', 'SPAN', 'LI', 'TD', 'TH'
      ];
      
      if (textElements.includes(node.tagName)) {
        handleTextElement(node);
      } else if (node.querySelectorAll) {
        const selector = textElements.map(tag => tag.toLowerCase()).join(', ');
        node.querySelectorAll(selector).forEach(element => handleTextElement(element));
      }
    }
  }
});

observer.observe(document.body, { childList: true, subtree: true });

async function detectProductsInText(text) {
  try {
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: 'detectProducts', text: text },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        }
      );
    });

    return response.success ? response.products : [];

  } catch (error) {
    console.error("Error communicating with background:", error);
    return [];
  }
}

function handleTextElement(element) {
  if (processedParagraphs.has(element)) return;
  
  if (element.textContent.includes('contentReference') || 
      element.textContent.includes('oaicite') ||
      element.querySelector('[data-citation]') ||
      element.closest('[data-testid*="conversation"]') === null) return;
  
  const directText = getDirectTextContent(element);
  if (!directText || directText.trim().length < 3) return;
  
  if (element.children.length > 5) return;
  
  const skipTags = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED'];
  if (skipTags.includes(element.tagName)) return;
  
  if (observedParagraphs.has(element)) clearTimeout(observedParagraphs.get(element));

  const timeoutId = setTimeout(async () => {
    const currentText = getDirectTextContent(element);
    if (currentText && currentText.trim().length > 5 && 
        !currentText.includes('contentReference')) {
      
      const detectedProducts = await detectProductsInText(currentText);
      
      if (detectedProducts.length > 0) {
        addKeywordHighlights(element, detectedProducts);
        processedParagraphs.add(element);
      }
    }
    observedParagraphs.delete(element);
  }, 1200);

  observedParagraphs.set(element, timeoutId);
}

function getDirectTextContent(element) {
  let text = '';
  for (let node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent;
    } else if (node.nodeType === Node.ELEMENT_NODE && node.children.length <= 2) {
      text += node.textContent;
    }
  }
  return text;
}

function addKeywordHighlights(element, products) {
  // Remove existing highlights first
  element.querySelectorAll('.affiliate-keyword').forEach(el => {
    el.replaceWith(el.textContent);
  });

  if (products.length === 0) return;

  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        if (node.textContent.includes('contentReference')) {
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

  textNodes.forEach(textNode => {
    const text = textNode.textContent;
    const matches = [];
    
    products.forEach(product => {
      const regex = new RegExp(`\\b${escapeRegExp(product)}\\b`, 'gi');
      let match;
      
      while ((match = regex.exec(text)) !== null) {
        matches.push({
          text: match[0],
          index: match.index,
          length: match[0].length,
          keyword: product
        });
        
        if (match.index === regex.lastIndex) {
          regex.lastIndex++;
        }
      }
    });

    if (matches.length === 0) return;

    matches.sort((a, b) => b.index - a.index);

    const fragment = document.createDocumentFragment();
    let lastIndex = text.length;

    matches.forEach(match => {
      if (lastIndex > match.index + match.length) {
        const afterText = text.substring(match.index + match.length, lastIndex);
        fragment.insertBefore(document.createTextNode(afterText), fragment.firstChild);
      }

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

      highlightSpan.addEventListener('mouseenter', (e) => {
        clearTimeout(currentTooltipTimeout);
        showTooltip(e.target, match.keyword);
      });
      
      highlightSpan.addEventListener('mouseleave', (e) => {
        currentTooltipTimeout = setTimeout(() => {
          if (!isTooltipHovered) {
            hideTooltip();
          }
        }, 200);
      });
      
      fragment.insertBefore(highlightSpan, fragment.firstChild);

      lastIndex = match.index;
    });

    if (lastIndex > 0) {
      const beforeText = text.substring(0, lastIndex);
      fragment.insertBefore(document.createTextNode(beforeText), fragment.firstChild);
    }

    textNode.parentNode.replaceChild(fragment, textNode);
  });
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function showTooltip(anchor, keyword) {
  currentKeyword = keyword;
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
        <span style="background: #0066cc; color: white; font-size: 10px; padding: 2px 6px; border-radius: 10px; margin-left: 8px;">AI Detected</span>
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
  
  const tooltipDiv = tooltipContainer.firstElementChild;
  tooltipDiv.addEventListener('mouseenter', () => {
    isTooltipHovered = true;
    clearTimeout(currentTooltipTimeout);
  });
  
  tooltipDiv.addEventListener('mouseleave', () => {
    isTooltipHovered = false;
    currentTooltipTimeout = setTimeout(() => {
      hideTooltip();
    }, 100);
  });
}

function hideTooltip() {
  tooltipContainer.style.display = 'none';
  isTooltipHovered = false;
  currentKeyword = null;
}

// Clean up on page navigation
window.addEventListener('beforeunload', () => {
  observedParagraphs.forEach(timeoutId => clearTimeout(timeoutId));
  observedParagraphs.clear();
});

// Rescan after initial load
setTimeout(() => {
  const elements = document.querySelectorAll('p, div, span, h1, h2, h3, h4, h5, h6');
  for (const element of elements) {
    if (!processedParagraphs.has(element) && !observedParagraphs.has(element)) {
      const text = getDirectTextContent(element);
      if (text && text.trim().length > 5 && 
          !text.includes('contentReference')) {
        handleTextElement(element);
      }
    }
  }
}, 3000);

// Scroll handler
let scrollTimeout;
window.addEventListener('scroll', () => {
  clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(() => {
    const elements = document.querySelectorAll('p, div, span, h1, h2, h3, h4, h5, h6');
    for (const element of elements) {
      if (!processedParagraphs.has(element) && !observedParagraphs.has(element)) {
        const text = getDirectTextContent(element);
        if (text && text.trim().length > 5 && 
            !text.includes('contentReference')) {
          handleTextElement(element);
        }
      }
    }
  }, 1000);
});