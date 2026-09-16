(function() {
  const currentPath = window.location.pathname.toLowerCase();
  
  // Only show on course/lesson pages, privacy, about, disclaimer, terms.
  const isTargetPage = currentPath.includes("course") || 
                       currentPath.includes("lesson") || 
                       currentPath.includes("programming") || 
                       currentPath.includes("privacy-policy") || 
                       currentPath.includes("about") || 
                       currentPath.includes("disclaimer") || 
                       currentPath.includes("terms-conditions");

  if (!isTargetPage) return;

  let contextText = "Click here for your doubts";
  if (currentPath.includes("privacy")) contextText = "Click here for Privacy questions";
  else if (currentPath.includes("about")) contextText = "Click here for About questions";
  else if (currentPath.includes("disclaimer")) contextText = "Click here for Disclaimer questions";
  else if (currentPath.includes("terms")) contextText = "Click here for Terms questions";

  // Create Widget Container
  const widgetContainer = document.createElement('div');
  widgetContainer.id = "shortstudy-ai-widget";
  widgetContainer.style.position = "fixed";
  widgetContainer.style.bottom = "20px";
  widgetContainer.style.right = "20px";
  widgetContainer.style.zIndex = "9999";
  widgetContainer.style.display = "flex";
  widgetContainer.style.flexDirection = "column";
  widgetContainer.style.alignItems = "center";
  widgetContainer.style.cursor = "pointer";
  widgetContainer.style.transition = "transform 0.3s ease";
  
  // Icon
  const iconDiv = document.createElement('div');
  iconDiv.style.width = "60px";
  iconDiv.style.height = "60px";
  iconDiv.style.borderRadius = "50%";
  iconDiv.style.background = "#2B3A32";
  iconDiv.style.display = "flex";
  iconDiv.style.justifyContent = "center";
  iconDiv.style.alignItems = "center";
  iconDiv.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)";
  iconDiv.style.border = "2px solid #F2C94C";
  iconDiv.innerHTML = `<img src="favicon.png" alt="ShortStudy AI" style="width: 32px; height: 32px; filter: drop-shadow(0 0 2px rgba(255,255,255,0.5));">`;
  
  // Text
  const textDiv = document.createElement('div');
  textDiv.style.marginTop = "8px";
  textDiv.style.background = "#F2C94C";
  textDiv.style.color = "#2B3A32";
  textDiv.style.padding = "4px 10px";
  textDiv.style.borderRadius = "12px";
  textDiv.style.fontSize = "12px";
  textDiv.style.fontWeight = "bold";
  textDiv.style.fontFamily = "'Kalam', cursive";
  textDiv.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
  textDiv.style.whiteSpace = "nowrap";
  textDiv.textContent = contextText;

  widgetContainer.appendChild(iconDiv);
  widgetContainer.appendChild(textDiv);
  
  // Hover effect
  widgetContainer.onmouseenter = () => widgetContainer.style.transform = "scale(1.05)";
  widgetContainer.onmouseleave = () => widgetContainer.style.transform = "scale(1)";

  // Chat Window
  const chatWindow = document.createElement('div');
  chatWindow.style.position = "fixed";
  chatWindow.style.bottom = "100px";
  chatWindow.style.right = "20px";
  chatWindow.style.width = "320px";
  chatWindow.style.height = "420px";
  chatWindow.style.background = "#fff";
  chatWindow.style.borderRadius = "16px";
  chatWindow.style.boxShadow = "0 8px 24px rgba(0,0,0,0.2)";
  chatWindow.style.display = "none";
  chatWindow.style.flexDirection = "column";
  chatWindow.style.overflow = "hidden";
  chatWindow.style.zIndex = "9999";
  chatWindow.style.border = "1px solid #e2e8f0";

  chatWindow.innerHTML = `
    <div style="background: #2B3A32; color: #F2C94C; padding: 16px; font-family: 'Kalam', cursive; font-size: 18px; display: flex; justify-content: space-between; align-items: center;">
      <span>ShortStudy AI Assistant</span>
      <button id="ss-ai-close" style="background: none; border: none; color: #F2C94C; font-size: 20px; cursor: pointer;">&times;</button>
    </div>
    <div id="ss-ai-messages" style="flex: 1; padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; background: #fafafa; font-family: 'Work Sans', sans-serif; font-size: 14px;">
      <div style="background: #e2e8f0; color: #0f172a; padding: 10px 14px; border-radius: 12px 12px 12px 0; align-self: flex-start; max-width: 85%;">
        Hello! I'm the ShortStudy AI. How can I help you today?
      </div>
    </div>
    <form id="ss-ai-form" style="display: flex; border-top: 1px solid #e2e8f0; padding: 12px; background: #fff;">
      <input type="text" id="ss-ai-input" placeholder="Type your question..." style="flex: 1; padding: 10px 14px; border: 1px solid #cbd5e1; border-radius: 20px; outline: none; font-family: 'Work Sans', sans-serif; font-size: 14px;">
      <button type="submit" style="background: #2B3A32; color: #F2C94C; border: none; border-radius: 50%; width: 40px; height: 40px; margin-left: 8px; cursor: pointer; display: flex; justify-content: center; align-items: center;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
      </button>
    </form>
  `;

  document.body.appendChild(widgetContainer);
  document.body.appendChild(chatWindow);

  const messagesDiv = document.getElementById("ss-ai-messages");
  const form = document.getElementById("ss-ai-form");
  const input = document.getElementById("ss-ai-input");

  widgetContainer.onclick = () => {
    chatWindow.style.display = chatWindow.style.display === "none" ? "flex" : "none";
    if (chatWindow.style.display === "flex") input.focus();
  };

  document.getElementById("ss-ai-close").onclick = () => {
    chatWindow.style.display = "none";
  };

  const addMessage = (text, isUser = false) => {
    const msgDiv = document.createElement('div');
    msgDiv.style.padding = "10px 14px";
    msgDiv.style.maxWidth = "85%";
    msgDiv.style.fontFamily = "'Work Sans', sans-serif";
    msgDiv.style.fontSize = "14px";
    msgDiv.style.lineHeight = "1.5";
    
    if (isUser) {
      msgDiv.style.background = "#2B3A32";
      msgDiv.style.color = "#fff";
      msgDiv.style.borderRadius = "12px 12px 0 12px";
      msgDiv.style.alignSelf = "flex-end";
    } else {
      msgDiv.style.background = "#e2e8f0";
      msgDiv.style.color = "#0f172a";
      msgDiv.style.borderRadius = "12px 12px 12px 0";
      msgDiv.style.alignSelf = "flex-start";
    }
    
    msgDiv.textContent = text;
    messagesDiv.appendChild(msgDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  };

  form.onsubmit = async (e) => {
    e.preventDefault();
    const query = input.value.trim();
    if (!query) return;

    addMessage(query, true);
    input.value = "";
    
    // Strict Guardrails Client-Side Processing
    const lowerQuery = query.toLowerCase();
    
    // Guardrail 1
    const devPatterns = ["who is the developer", "who built", "who made", "who created", "developer name", "who is the creator"];
    if (devPatterns.some(p => lowerQuery.includes(p))) {
      setTimeout(() => addMessage("Gaurav Fartiyal"), 400);
      return;
    }

    // Guardrail 2
    const privatePatterns = ["private", "backend", "database", "firebase config", "api key", "password", "secret"];
    if (privatePatterns.some(p => lowerQuery.includes(p))) {
      setTimeout(() => addMessage("Sorry, The content is not publicly available."), 400);
      return;
    }

    // Pass to backend if no guardrail triggered
    const loadingId = "loading-" + Date.now();
    const loadingDiv = document.createElement('div');
    loadingDiv.id = loadingId;
    loadingDiv.style.alignSelf = "flex-start";
    loadingDiv.style.fontStyle = "italic";
    loadingDiv.style.color = "#64748b";
    loadingDiv.style.fontSize = "12px";
    loadingDiv.textContent = "Typing...";
    messagesDiv.appendChild(loadingDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    try {
      const res = await fetch("/api/ai/doubt-solver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doubt: query })
      });
      const data = await res.json();
      document.getElementById(loadingId).remove();
      addMessage(data.solution || "I could not find an answer for that.");
    } catch (err) {
      document.getElementById(loadingId).remove();
      addMessage("Sorry, I am currently unable to connect to the server.");
    }
  };

})();
