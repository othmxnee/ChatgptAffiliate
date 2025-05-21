console.log("🚀 Starting enhanced observer with debounce on <p> updates");

const observedParagraphs = new Map();

const observer = new MutationObserver((mutations) => {
  mutations.forEach(mutation => {
    mutation.addedNodes.forEach(node => {
      if (node.nodeType !== 1) return;

      // Check if node is <p data-start>
      if (node.tagName === 'P' && node.hasAttribute('data-start')) {
        handleParagraph(node);
      } else if (node.querySelectorAll) {
        // Or find any <p data-start> inside added node
        node.querySelectorAll('p[data-start]').forEach(p => handleParagraph(p));
      }
    });
  });
});

function handleParagraph(p) {
  if (observedParagraphs.has(p)) {
    clearTimeout(observedParagraphs.get(p));
  }

  // Set a debounce to wait for more spans to load
  const timeoutId = setTimeout(() => {
    const fullText = p.innerText.trim();
    if (fullText.length > 5) {
      console.log("✅ Full stable paragraph text detected:", fullText);
      // TODO: Insert tooltip or keyword processing here
    }
    observedParagraphs.delete(p);
  }, 800); // wait 800ms of no new mutations inside this <p>

  observedParagraphs.set(p, timeoutId);
}

observer.observe(document.body, { childList: true, subtree: true });
