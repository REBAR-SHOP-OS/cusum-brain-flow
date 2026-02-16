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
  var hasGreeted = false;
  var unreadCount = 0;

  function getCurrentPage() { return window.location.href; }
  function getTime() {
    var d = new Date();
    var h = d.getHours(); var m = d.getMinutes();
    var ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12; h = h ? h : 12;
    return h + ':' + (m < 10 ? '0' : '') + m + ' ' + ampm;
  }

  // --- Styles ---
  var style = document.createElement('style');
  style.textContent = \`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    #rebar-chat-bubble {
      position: fixed; bottom: 24px; right: 24px; z-index: 999999;
      width: 64px; height: 64px; border-radius: 50%;
      background: linear-gradient(135deg, #E97F0F 0%, #F59E0B 100%);
      color: #fff; border: none; cursor: pointer;
      box-shadow: 0 6px 24px rgba(233,127,15,0.45), 0 0 0 0 rgba(233,127,15,0.4);
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      animation: rcPulse 3s ease-in-out infinite;
    }
    #rebar-chat-bubble.rc-open { animation: none; }
    #rebar-chat-bubble:hover { transform: scale(1.1); box-shadow: 0 8px 32px rgba(233,127,15,0.55); }
    #rebar-chat-bubble svg { width: 28px; height: 28px; transition: transform 0.3s, opacity 0.2s; }

    @keyframes rcPulse {
      0%, 100% { box-shadow: 0 6px 24px rgba(233,127,15,0.45), 0 0 0 0 rgba(233,127,15,0.3); }
      50% { box-shadow: 0 6px 24px rgba(233,127,15,0.45), 0 0 0 12px rgba(233,127,15,0); }
    }

    /* Unread badge */
    #rebar-chat-badge {
      position: absolute; top: -4px; right: -4px;
      min-width: 22px; height: 22px; border-radius: 11px;
      background: #EF4444; color: #fff; font-size: 11px; font-weight: 700;
      display: none; align-items: center; justify-content: center;
      padding: 0 6px; font-family: 'Inter', sans-serif;
      box-shadow: 0 2px 8px rgba(239,68,68,0.4);
      animation: rcBadgePop 0.3s cubic-bezier(0.34,1.56,0.64,1);
    }
    #rebar-chat-badge.show { display: flex; }
    @keyframes rcBadgePop {
      from { transform: scale(0); } to { transform: scale(1); }
    }

    /* Teaser bubble */
    #rebar-chat-teaser {
      position: fixed; bottom: 96px; right: 24px; z-index: 999998;
      background: #111827; color: #e5e7eb; border: 1px solid rgba(255,255,255,0.1);
      border-radius: 16px 16px 4px 16px; padding: 12px 16px;
      font-size: 13px; font-family: 'Inter', sans-serif; font-weight: 500;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      max-width: 240px; cursor: pointer;
      animation: rcTeaserIn 0.4s cubic-bezier(0.34,1.56,0.64,1);
      transition: opacity 0.3s, transform 0.3s;
    }
    #rebar-chat-teaser.hide { opacity: 0; transform: translateY(8px); pointer-events: none; }
    #rebar-chat-teaser .rc-teaser-dot {
      display: inline-block; width: 8px; height: 8px; border-radius: 50%;
      background: #22C55E; margin-right: 8px; vertical-align: middle;
      animation: rcDotPulse 1.5s ease-in-out infinite;
    }
    @keyframes rcTeaserIn {
      from { opacity: 0; transform: translateX(20px) scale(0.9); }
      to { opacity: 1; transform: translateX(0) scale(1); }
    }
    @keyframes rcDotPulse {
      0%, 100% { opacity: 1; } 50% { opacity: 0.4; }
    }

    /* Panel */
    #rebar-chat-panel {
      position: fixed; bottom: 100px; right: 24px; z-index: 999999;
      width: 400px; max-height: 560px; border-radius: 20px;
      background: linear-gradient(180deg, #111827 0%, #0f172a 100%);
      border: 1px solid rgba(255,255,255,0.08);
      box-shadow: 0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05) inset;
      display: none; flex-direction: column; overflow: hidden;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      transform-origin: bottom right;
    }
    #rebar-chat-panel.open {
      display: flex;
      animation: rcSlideUp 0.3s cubic-bezier(0.34,1.56,0.64,1);
    }
    @keyframes rcSlideUp {
      from { opacity: 0; transform: translateY(16px) scale(0.96); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    /* Header */
    #rebar-chat-header {
      display: flex; align-items: center; gap: 12px;
      padding: 16px 20px; background: rgba(17,24,39,0.95);
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .rc-header-avatar {
      width: 40px; height: 40px; border-radius: 12px;
      background: linear-gradient(135deg, #E97F0F, #F59E0B);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .rc-header-avatar svg { width: 22px; height: 22px; color: #fff; }
    .rc-header-info { flex: 1; min-width: 0; }
    .rc-header-title { color: #f9fafb; font-size: 15px; font-weight: 700; margin: 0; }
    .rc-header-status {
      display: flex; align-items: center; gap: 6px;
      color: #9ca3af; font-size: 12px; margin-top: 2px;
    }
    .rc-online-dot {
      width: 8px; height: 8px; border-radius: 50%; background: #22C55E;
      animation: rcDotPulse 1.5s ease-in-out infinite; flex-shrink: 0;
    }
    #rebar-chat-close {
      background: rgba(255,255,255,0.06); border: none; color: #9ca3af;
      cursor: pointer; font-size: 18px; padding: 8px; border-radius: 10px;
      transition: background 0.2s, color 0.2s; line-height: 1;
    }
    #rebar-chat-close:hover { background: rgba(255,255,255,0.12); color: #fff; }

    /* Messages */
    #rebar-chat-messages {
      flex: 1; overflow-y: auto; padding: 16px; max-height: 360px;
      display: flex; flex-direction: column; gap: 4px;
    }
    #rebar-chat-messages::-webkit-scrollbar { width: 4px; }
    #rebar-chat-messages::-webkit-scrollbar-track { background: transparent; }
    #rebar-chat-messages::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

    .rc-msg-row {
      display: flex; gap: 8px; max-width: 88%;
      animation: rcMsgIn 0.25s ease-out;
    }
    .rc-msg-row.user { align-self: flex-end; flex-direction: row-reverse; }
    .rc-msg-row.assistant { align-self: flex-start; }
    @keyframes rcMsgIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .rc-bot-avatar {
      width: 28px; height: 28px; border-radius: 8px; flex-shrink: 0;
      background: linear-gradient(135deg, #E97F0F, #F59E0B);
      display: flex; align-items: center; justify-content: center;
      margin-top: 2px;
    }
    .rc-bot-avatar svg { width: 14px; height: 14px; color: #fff; }

    .rc-msg-content { min-width: 0; }
    .rc-msg {
      padding: 10px 14px; border-radius: 16px;
      font-size: 13px; line-height: 1.6; word-wrap: break-word; overflow-wrap: anywhere;
      white-space: pre-wrap;
    }
    .rc-msg.user {
      background: linear-gradient(135deg, #E97F0F 0%, #F59E0B 100%);
      color: #fff; border-bottom-right-radius: 4px;
    }
    .rc-msg.assistant {
      background: rgba(255,255,255,0.06);
      backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
      color: #e5e7eb; border: 1px solid rgba(255,255,255,0.06);
      border-bottom-left-radius: 4px;
    }
    .rc-msg.assistant a { color: #F59E0B; text-decoration: underline; }
    .rc-msg-time {
      font-size: 10px; color: #6b7280; margin-top: 4px;
      padding: 0 4px;
    }
    .rc-msg-row.user .rc-msg-time { text-align: right; }

    /* Welcome */
    .rc-welcome {
      text-align: center; padding: 24px 20px; color: #6b7280;
    }
    .rc-welcome-emoji { font-size: 36px; margin-bottom: 12px; }
    .rc-welcome strong { color: #f9fafb; display: block; font-size: 16px; font-weight: 700; margin-bottom: 4px; }
    .rc-welcome p { font-size: 13px; line-height: 1.5; margin: 0; }

    /* Quick chips */
    .rc-chips {
      display: flex; flex-wrap: wrap; gap: 8px; padding: 0 16px 12px;
      justify-content: center;
    }
    .rc-chips.hidden { display: none; }
    .rc-chip {
      background: rgba(233,127,15,0.1); border: 1px solid rgba(233,127,15,0.25);
      color: #F59E0B; font-size: 12px; font-weight: 600; padding: 7px 14px;
      border-radius: 20px; cursor: pointer; transition: all 0.2s;
      font-family: 'Inter', sans-serif; white-space: nowrap;
    }
    .rc-chip:hover {
      background: rgba(233,127,15,0.2); border-color: #E97F0F;
      transform: scale(1.05);
    }

    /* Typing */
    .rc-typing-row { display: flex; gap: 8px; align-self: flex-start; align-items: flex-end; }
    .rc-typing-bubble {
      background: rgba(255,255,255,0.06); backdrop-filter: blur(8px);
      border: 1px solid rgba(255,255,255,0.06); border-radius: 16px 16px 16px 4px;
      padding: 12px 16px; display: flex; align-items: center; gap: 10px;
    }
    .rc-typing-dots { display: flex; gap: 4px; }
    .rc-typing-dots span {
      width: 7px; height: 7px; border-radius: 50%; background: #6b7280;
      animation: rcWave 1.4s ease-in-out infinite;
    }
    .rc-typing-dots span:nth-child(2) { animation-delay: 0.15s; }
    .rc-typing-dots span:nth-child(3) { animation-delay: 0.3s; }
    @keyframes rcWave {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
      30% { transform: translateY(-6px); opacity: 1; }
    }
    .rc-typing-text { font-size: 11px; color: #6b7280; }

    /* Input */
    #rebar-chat-input-area {
      display: flex; align-items: flex-end; gap: 8px;
      padding: 12px 16px; border-top: 1px solid rgba(255,255,255,0.06);
      background: rgba(17,24,39,0.95);
    }
    #rebar-chat-input {
      flex: 1; border: none; outline: none;
      background: rgba(255,255,255,0.06); color: #f3f4f6;
      border-radius: 12px; padding: 10px 14px; font-size: 13px;
      resize: none; min-height: 40px; max-height: 80px;
      font-family: 'Inter', sans-serif; line-height: 1.4;
      border: 1px solid rgba(255,255,255,0.06);
      transition: border-color 0.2s;
    }
    #rebar-chat-input:focus { border-color: rgba(233,127,15,0.4); }
    #rebar-chat-input::placeholder { color: #4b5563; }
    #rebar-chat-send {
      width: 40px; height: 40px; border-radius: 12px; border: none;
      background: linear-gradient(135deg, #E97F0F, #F59E0B);
      color: #fff; cursor: pointer; display: flex; align-items: center;
      justify-content: center; transition: opacity 0.2s, transform 0.2s;
      flex-shrink: 0;
    }
    #rebar-chat-send:hover:not(:disabled) { transform: scale(1.05); }
    #rebar-chat-send:disabled { opacity: 0.3; cursor: not-allowed; }
    #rebar-chat-send svg { width: 18px; height: 18px; }

    /* Footer */
    .rc-footer {
      text-align: center; padding: 8px; font-size: 10px; color: #374151;
      border-top: 1px solid rgba(255,255,255,0.03);
    }
    .rc-footer span { color: #E97F0F; font-weight: 600; }

    @media (max-width: 480px) {
      #rebar-chat-panel {
        width: calc(100vw - 16px); right: 8px; bottom: 96px;
        max-height: 75vh; border-radius: 20px 20px 12px 12px;
      }
      #rebar-chat-bubble { bottom: 16px; right: 16px; }
      #rebar-chat-teaser { right: 16px; bottom: 88px; }
      #rebar-chat-messages { max-height: none; flex: 1; }
    }
  \`;
  document.head.appendChild(style);

  // --- Bot avatar SVG ---
  var BOT_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>';

  // --- Bubble ---
  var bubble = document.createElement('button');
  bubble.id = 'rebar-chat-bubble';
  bubble.setAttribute('aria-label', 'Chat with us');
  bubble.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span id="rebar-chat-badge"></span>';
  document.body.appendChild(bubble);

  var badge = document.getElementById('rebar-chat-badge');

  // --- Panel ---
  var panel = document.createElement('div');
  panel.id = 'rebar-chat-panel';
  panel.innerHTML =
    '<div id="rebar-chat-header">' +
      '<div class="rc-header-avatar">' + BOT_SVG + '</div>' +
      '<div class="rc-header-info"><div class="rc-header-title">Rebar Shop</div><div class="rc-header-status"><span class="rc-online-dot"></span>Online &middot; replies in seconds</div></div>' +
      '<button id="rebar-chat-close">&times;</button>' +
    '</div>' +
    '<div id="rebar-chat-messages">' +
      '<div class="rc-welcome"><div class="rc-welcome-emoji">\\u{1F44B}</div><strong>Hey there!</strong><p>We\\'re here to help with rebar, mesh, quotes &amp; delivery. Ask us anything!</p></div>' +
    '</div>' +
    '<div class="rc-chips" id="rebar-chat-chips">' +
      '<button class="rc-chip" data-msg="I\\'d like to get a quote">Get a Quote</button>' +
      '<button class="rc-chip" data-msg="Can you check stock availability?">Check Stock</button>' +
      '<button class="rc-chip" data-msg="What areas do you deliver to?">Delivery Areas</button>' +
      '<button class="rc-chip" data-msg="I\\'d like to talk to a sales person">Talk to Sales</button>' +
    '</div>' +
    '<div id="rebar-chat-input-area"><textarea id="rebar-chat-input" placeholder="Type your message..." rows="1"></textarea><button id="rebar-chat-send" disabled><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button></div>' +
    '<div class="rc-footer">Powered by <span>Rebar Shop AI</span></div>';
  document.body.appendChild(panel);

  var msgContainer = document.getElementById('rebar-chat-messages');
  var input = document.getElementById('rebar-chat-input');
  var sendBtn = document.getElementById('rebar-chat-send');
  var chipsContainer = document.getElementById('rebar-chat-chips');

  // --- Quick chips ---
  chipsContainer.addEventListener('click', function(e) {
    var chip = e.target.closest('.rc-chip');
    if (!chip || isStreaming) return;
    var msg = chip.getAttribute('data-msg');
    if (msg) { input.value = msg; sendMessage(); }
  });

  function hideChips() { chipsContainer.classList.add('hidden'); }

  // --- Toggle ---
  bubble.addEventListener('click', function() {
    isOpen = !isOpen;
    panel.classList.toggle('open', isOpen);
    bubble.classList.toggle('rc-open', isOpen);
    bubble.innerHTML = isOpen
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg><span id="rebar-chat-badge"></span>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span id="rebar-chat-badge"></span>';
    badge = document.getElementById('rebar-chat-badge');
    if (isOpen) {
      unreadCount = 0; updateBadge();
      input.focus();
      dismissTeaser();
      if (!hasGreeted && messages.length === 0) { hasGreeted = true; sendInitGreeting(); }
    }
  });

  function updateBadge() {
    if (!badge) return;
    if (unreadCount > 0 && !isOpen) {
      badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
      badge.classList.add('show');
    } else {
      badge.classList.remove('show');
    }
  }

  document.getElementById('rebar-chat-close').addEventListener('click', function() {
    isOpen = false;
    panel.classList.remove('open');
    bubble.classList.remove('rc-open');
    bubble.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span id="rebar-chat-badge"></span>';
    badge = document.getElementById('rebar-chat-badge');
    updateBadge();
  });

  // --- Proactive teaser ---
  var teaserEl = null;
  function showTeaser() {
    if (isOpen || hasGreeted) return;
    if (sessionStorage.getItem('rc_teaser_shown')) return;
    sessionStorage.setItem('rc_teaser_shown', '1');
    teaserEl = document.createElement('div');
    teaserEl.id = 'rebar-chat-teaser';
    teaserEl.innerHTML = '<span class="rc-teaser-dot"></span>Need help with rebar? We\\'re online!';
    teaserEl.addEventListener('click', function() { dismissTeaser(); bubble.click(); });
    document.body.appendChild(teaserEl);
    setTimeout(dismissTeaser, 8000);
  }
  function dismissTeaser() {
    if (teaserEl) { teaserEl.classList.add('hide'); setTimeout(function() { if (teaserEl && teaserEl.parentNode) teaserEl.parentNode.removeChild(teaserEl); teaserEl = null; }, 300); }
  }
  setTimeout(showTeaser, 5000);

  // --- Input ---
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
    var welcome = msgContainer.querySelector('.rc-welcome');
    if (welcome) welcome.remove();

    var row = document.createElement('div');
    row.className = 'rc-msg-row ' + role;

    var html = '';
    if (role === 'assistant') {
      html += '<div class="rc-bot-avatar">' + BOT_SVG + '</div>';
    }
    html += '<div class="rc-msg-content"><div class="rc-msg ' + role + '">' + escapeHtml(content) + '</div><div class="rc-msg-time">' + getTime() + '</div></div>';
    row.innerHTML = html;
    msgContainer.appendChild(row);
    msgContainer.scrollTop = msgContainer.scrollHeight;
    return row.querySelector('.rc-msg');
  }

  function escapeHtml(text) {
    var d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
  }

  function showTyping() {
    var row = document.createElement('div');
    row.className = 'rc-typing-row';
    row.innerHTML = '<div class="rc-bot-avatar">' + BOT_SVG + '</div><div class="rc-typing-bubble"><div class="rc-typing-dots"><span></span><span></span><span></span></div><span class="rc-typing-text">Rebar Shop is typing...</span></div>';
    msgContainer.appendChild(row);
    msgContainer.scrollTop = msgContainer.scrollHeight;
    return row;
  }

  async function sendInitGreeting() {
    isStreaming = true; sendBtn.disabled = true;
    var welcome = msgContainer.querySelector('.rc-welcome');
    if (welcome) welcome.remove();
    var typing = showTyping();
    var assistantContent = '';
    var assistantDiv = null;
    try {
      var resp = await fetch(CHAT_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: '[INIT]' }], current_page: getCurrentPage() })
      });
      if (!resp.ok || !resp.body) {
        typing.remove();
        addMessage('assistant', 'G\\'day! How can I help you with rebar today?');
        messages.push({ role: 'assistant', content: 'G\\'day! How can I help you with rebar today?' });
        isStreaming = false; return;
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
              if (!assistantDiv) { typing.remove(); assistantDiv = addMessage('assistant', ''); }
              assistantContent += chunk;
              assistantDiv.textContent = assistantContent;
              msgContainer.scrollTop = msgContainer.scrollHeight;
            }
          } catch(e) { break; }
        }
      }
      if (!assistantContent) {
        typing.remove();
        addMessage('assistant', 'G\\'day! How can I help you with rebar today?');
        assistantContent = 'G\\'day! How can I help you with rebar today?';
      }
      messages.push({ role: 'assistant', content: assistantContent });
    } catch(e) {
      typing.remove();
      addMessage('assistant', 'G\\'day! How can I help you with rebar today?');
    } finally {
      isStreaming = false; sendBtn.disabled = !input.value.trim();
    }
  }

  async function sendMessage() {
    var text = input.value.trim();
    if (!text || isStreaming) return;

    hideChips();
    messages.push({ role: 'user', content: text });
    addMessage('user', text);
    input.value = ''; input.style.height = 'auto';
    sendBtn.disabled = true; isStreaming = true;

    var typing = showTyping();
    var assistantContent = '';
    var assistantDiv = null;

    try {
      var resp = await fetch(CHAT_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messages, current_page: getCurrentPage() })
      });

      if (!resp.ok || !resp.body) {
        typing.remove();
        addMessage('assistant', 'Sorry, I\\'m unable to respond right now. Please try again or call us directly.');
        isStreaming = false; return;
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
              if (!assistantDiv) { typing.remove(); assistantDiv = addMessage('assistant', ''); }
              assistantContent += chunk;
              assistantDiv.textContent = assistantContent;
              msgContainer.scrollTop = msgContainer.scrollHeight;
            }
          } catch(e) { break; }
        }
      }

      if (!assistantContent) {
        typing.remove();
        addMessage('assistant', 'Hi! How can I help you with rebar today?');
        assistantContent = 'Hi! How can I help you with rebar today?';
      }

      messages.push({ role: 'assistant', content: assistantContent });

      if (!isOpen) { unreadCount++; updateBadge(); }
    } catch(e) {
      typing.remove();
      addMessage('assistant', 'Connection error. Please try again.');
    } finally {
      isStreaming = false; sendBtn.disabled = !input.value.trim();
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
