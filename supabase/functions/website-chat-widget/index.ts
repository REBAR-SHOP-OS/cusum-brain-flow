import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const CHAT_ENDPOINT = `${SUPABASE_URL}/functions/v1/website-agent`;

const widgetJS = `
(function() {
  if (document.getElementById('rebar-chat-widget')) return;

  var CHAT_URL = '${CHAT_ENDPOINT}';
  var messages = [];
  var isOpen = false;
  var isStreaming = false;

  // Track current page
  function getCurrentPage() { return window.location.href; }

  // --- Styles ---
  var style = document.createElement('style');
  style.textContent = \`
    #rebar-chat-bubble {
      position: fixed; bottom: 20px; right: 20px; z-index: 999999;
      width: 56px; height: 56px; border-radius: 50%;
      background: #E97F0F; color: #fff; border: none; cursor: pointer;
      box-shadow: 0 4px 16px rgba(233,127,15,0.4);
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.2s, box-shadow 0.2s;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    #rebar-chat-bubble:hover { transform: scale(1.08); box-shadow: 0 6px 24px rgba(233,127,15,0.5); }
    #rebar-chat-bubble svg { width: 26px; height: 26px; }

    #rebar-chat-panel {
      position: fixed; bottom: 88px; right: 20px; z-index: 999999;
      width: 380px; max-height: 500px; border-radius: 16px;
      background: #1a1a2e; border: 1px solid #2a2a4a;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      display: none; flex-direction: column; overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      animation: rcSlideUp 0.2s ease-out;
    }
    #rebar-chat-panel.open { display: flex; }

    @keyframes rcSlideUp {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }

    #rebar-chat-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 16px; border-bottom: 1px solid #2a2a4a; background: #16162a;
    }
    #rebar-chat-header span { color: #fff; font-size: 14px; font-weight: 600; }
    #rebar-chat-close {
      background: none; border: none; color: #888; cursor: pointer; font-size: 18px; padding: 4px;
    }
    #rebar-chat-close:hover { color: #fff; }

    #rebar-chat-messages {
      flex: 1; overflow-y: auto; padding: 12px; max-height: 340px;
      display: flex; flex-direction: column; gap: 8px;
    }
    #rebar-chat-messages::-webkit-scrollbar { width: 4px; }
    #rebar-chat-messages::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }

    .rc-msg {
      max-width: 85%; padding: 8px 12px; border-radius: 12px;
      font-size: 13px; line-height: 1.5; word-wrap: break-word; white-space: pre-wrap;
    }
    .rc-msg.user { align-self: flex-end; background: #E97F0F; color: #fff; }
    .rc-msg.assistant { align-self: flex-start; background: #2a2a4a; color: #e0e0e0; }

    .rc-welcome { text-align: center; padding: 32px 16px; color: #888; font-size: 13px; }
    .rc-welcome strong { color: #E97F0F; display: block; margin-bottom: 4px; font-size: 14px; }

    #rebar-chat-input-area {
      display: flex; gap: 6px; padding: 12px; border-top: 1px solid #2a2a4a; background: #16162a;
    }
    #rebar-chat-input {
      flex: 1; border: none; outline: none; background: #2a2a4a; color: #fff;
      border-radius: 8px; padding: 8px 12px; font-size: 13px; resize: none;
      min-height: 36px; max-height: 80px; font-family: inherit;
    }
    #rebar-chat-input::placeholder { color: #666; }
    #rebar-chat-send {
      width: 36px; height: 36px; border-radius: 8px; border: none;
      background: #E97F0F; color: #fff; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: opacity 0.2s; flex-shrink: 0;
    }
    #rebar-chat-send:disabled { opacity: 0.4; cursor: not-allowed; }
    #rebar-chat-send svg { width: 16px; height: 16px; }

    .rc-typing { display: flex; gap: 4px; align-items: center; padding: 8px 12px; }
    .rc-typing span {
      width: 6px; height: 6px; border-radius: 50%; background: #666;
      animation: rcBounce 1.2s infinite;
    }
    .rc-typing span:nth-child(2) { animation-delay: 0.2s; }
    .rc-typing span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes rcBounce {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-4px); }
    }

    @media (max-width: 480px) {
      #rebar-chat-panel { width: calc(100vw - 24px); right: 12px; bottom: 80px; max-height: 70vh; }
    }
  \`;
  document.head.appendChild(style);

  // --- Bubble ---
  var bubble = document.createElement('button');
  bubble.id = 'rebar-chat-bubble';
  bubble.setAttribute('aria-label', 'Chat with us');
  bubble.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  document.body.appendChild(bubble);

  // --- Panel ---
  var panel = document.createElement('div');
  panel.id = 'rebar-chat-panel';
  panel.innerHTML =
    '<div id="rebar-chat-header"><span>💬 Rebar Shop</span><button id="rebar-chat-close">&times;</button></div>' +
    '<div id="rebar-chat-messages"><div class="rc-welcome"><strong>Welcome to Rebar Shop</strong>Ask about our products, services, pricing, or delivery areas.</div></div>' +
    '<div id="rebar-chat-input-area"><textarea id="rebar-chat-input" placeholder="Type a question..." rows="1"></textarea><button id="rebar-chat-send" disabled><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button></div>';
  document.body.appendChild(panel);

  var msgContainer = document.getElementById('rebar-chat-messages');
  var input = document.getElementById('rebar-chat-input');
  var sendBtn = document.getElementById('rebar-chat-send');

  // --- Toggle ---
  bubble.addEventListener('click', function() {
    isOpen = !isOpen;
    panel.classList.toggle('open', isOpen);
    bubble.innerHTML = isOpen
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
    if (isOpen) input.focus();
  });

  document.getElementById('rebar-chat-close').addEventListener('click', function() {
    isOpen = false;
    panel.classList.remove('open');
    bubble.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  });

  // --- Input handling ---
  input.addEventListener('input', function() {
    sendBtn.disabled = !input.value.trim() || isStreaming;
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 80) + 'px';
  });

  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });

  sendBtn.addEventListener('click', sendMessage);

  function addMessage(role, content) {
    // Remove welcome if present
    var welcome = msgContainer.querySelector('.rc-welcome');
    if (welcome) welcome.remove();

    var div = document.createElement('div');
    div.className = 'rc-msg ' + role;
    div.textContent = content;
    msgContainer.appendChild(div);
    msgContainer.scrollTop = msgContainer.scrollHeight;
    return div;
  }

  function showTyping() {
    var div = document.createElement('div');
    div.className = 'rc-msg assistant rc-typing-indicator';
    div.innerHTML = '<div class="rc-typing"><span></span><span></span><span></span></div>';
    msgContainer.appendChild(div);
    msgContainer.scrollTop = msgContainer.scrollHeight;
    return div;
  }

  async function sendMessage() {
    var text = input.value.trim();
    if (!text || isStreaming) return;

    messages.push({ role: 'user', content: text });
    addMessage('user', text);
    input.value = '';
    input.style.height = 'auto';
    sendBtn.disabled = true;
    isStreaming = true;

    var typing = showTyping();
    var assistantContent = '';
    var assistantDiv = null;

    try {
      var resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messages, current_page: getCurrentPage() })
      });

      if (!resp.ok || !resp.body) {
        typing.remove();
        addMessage('assistant', 'Sorry, I\\'m unable to respond right now. Please try again or call us directly.');
        isStreaming = false;
        return;
      }

      var reader = resp.body.getReader();
      var decoder = new TextDecoder();
      var buffer = '';

      while (true) {
        var result = await reader.read();
        if (result.done) break;
        buffer += decoder.decode(result.value, { stream: true });

        var idx;
        while ((idx = buffer.indexOf('\\n')) !== -1) {
          var line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith('\\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          var json = line.slice(6).trim();
          if (json === '[DONE]') break;
          try {
            var parsed = JSON.parse(json);
            var chunk = parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content;
            if (chunk) {
              if (!assistantDiv) {
                typing.remove();
                assistantDiv = addMessage('assistant', '');
              }
              assistantContent += chunk;
              assistantDiv.textContent = assistantContent;
              msgContainer.scrollTop = msgContainer.scrollHeight;
            }
          } catch(e) { break; }
        }
      }

      if (!assistantContent) {
        typing.remove();
        assistantDiv = addMessage('assistant', 'Hi! How can I help you with rebar today?');
        assistantContent = 'Hi! How can I help you with rebar today?';
      }

      messages.push({ role: 'assistant', content: assistantContent });
    } catch(e) {
      typing.remove();
      addMessage('assistant', 'Connection error. Please try again.');
    } finally {
      isStreaming = false;
      sendBtn.disabled = !input.value.trim();
    }
  }
})();
`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
      },
    });
  }

  return new Response(widgetJS, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300",
    },
  });
});
