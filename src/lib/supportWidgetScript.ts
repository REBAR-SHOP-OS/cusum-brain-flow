export interface SupportWidgetScriptConfig {
  brandName?: string | null;
  brandColor?: string | null;
  welcomeMessage?: string | null;
  widgetKey?: string | null;
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  const source = normalized.length === 3
    ? normalized.split("").map((value) => value + value).join("")
    : normalized.padEnd(6, "0").slice(0, 6);

  const r = Number.parseInt(source.slice(0, 2), 16);
  const g = Number.parseInt(source.slice(2, 4), 16);
  const b = Number.parseInt(source.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function buildSupportWidgetScript(config: SupportWidgetScriptConfig, chatUrl: string): string {
  const brandColor = typeof config.brandColor === "string" ? config.brandColor : "#635bff";
  const brandSoft = hexToRgba(brandColor, 0.12);
  const brandBorder = hexToRgba(brandColor, 0.2);
  const brandShadow = hexToRgba(brandColor, 0.34);
  const brandGlow = hexToRgba(brandColor, 0.18);
  const cfgJson = JSON.stringify({
    brandName: config.brandName,
    brandColor,
    welcomeMessage: config.welcomeMessage,
    widgetKey: config.widgetKey,
    chatUrl,
  });

  return `(function(){
if(window.__support_widget_loaded) return;
window.__support_widget_loaded = true;
var cfg = ${cfgJson};
var state = { open:false, convoId:null, visitorToken:null, lastTs:null, polling:null, heartbeat:null, currentPage:window.location.href, unread:0, started:false, loading:false, typingEl:null };
var QUICK_PROMPTS = ['Get a quote', 'Product pricing', 'Delivery info'];
function getCurrentPage(){ return window.location.href; }
function esc(s){ var d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; }
function formatTime(ts){ var d = ts ? new Date(ts) : new Date(); return d.toLocaleTimeString([], { hour:'numeric', minute:'2-digit' }); }
function scrollMessages(){ messages.scrollTop = messages.scrollHeight; }
function setBubbleIcon(open){
  bubble.innerHTML = (open
    ? '<span class="sw-bubble-ring"></span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg><span id="sw-badge"></span>'
    : '<span class="sw-bubble-ring"></span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg><span id="sw-badge"></span>');
  badge = document.getElementById('sw-badge');
  updateBadge();
}
function updateBadge(){
  if(!badge) return;
  if(state.unread > 0 && !state.open){
    badge.textContent = state.unread > 9 ? '9+' : String(state.unread);
    badge.classList.add('show');
  } else {
    badge.classList.remove('show');
  }
}
function showWelcomeCard(){
  if(document.getElementById('sw-welcome')) return;
  var welcome = document.createElement('div');
  welcome.id = 'sw-welcome';
  welcome.className = 'sw-welcome-card';
  welcome.innerHTML =
    '<div class="sw-welcome-badge">AI chat concierge</div>' +
    '<h4>' + esc(cfg.brandName || 'Support') + '</h4>' +
    '<p>' + esc(cfg.welcomeMessage || 'Ask about pricing, delivery, products, or your next project.') + '</p>' +
    '<div class="sw-chip-row">' +
      QUICK_PROMPTS.map(function(prompt){ return '<button class="sw-chip" data-prompt="' + esc(prompt) + '">' + esc(prompt) + '</button>'; }).join('') +
    '</div>';
  messages.appendChild(welcome);
}
function hideWelcomeCard(){
  var welcome = document.getElementById('sw-welcome');
  if(welcome) welcome.remove();
}
function setComposerState(disabled){
  input.disabled = disabled;
  sendBtn.disabled = disabled || !input.value.trim();
  attachBtn.disabled = disabled;
}
function removeTyping(){
  if(state.typingEl && state.typingEl.parentNode) state.typingEl.parentNode.removeChild(state.typingEl);
  state.typingEl = null;
}
function showTyping(){
  removeTyping();
  hideWelcomeCard();
  var row = document.createElement('div');
  row.className = 'sw-row assistant';
  row.innerHTML =
    '<div class="sw-avatar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg></div>' +
    '<div class="sw-bubble-wrap">' +
      '<div class="sw-bubble assistant typing"><span></span><span></span><span></span></div>' +
      '<div class="sw-meta">Support is typing...</div>' +
    '</div>';
  messages.appendChild(row);
  state.typingEl = row;
  scrollMessages();
}
function appendMessage(type, text, imageUrl, createdAt){
  hideWelcomeCard();
  var row = document.createElement('div');
  var assistant = type !== 'visitor';
  row.className = 'sw-row ' + (assistant ? 'assistant' : 'visitor');
  var html = assistant
    ? '<div class="sw-avatar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg></div>'
    : '';
  html += '<div class="sw-bubble-wrap"><div class="sw-bubble ' + (assistant ? 'assistant' : 'visitor') + '"></div><div class="sw-meta">' + (assistant ? 'Support concierge' : 'You') + ' · ' + formatTime(createdAt) + '</div></div>';
  row.innerHTML = html;
  var bubble = row.querySelector('.sw-bubble');
  if(imageUrl){
    var img = document.createElement('img');
    img.src = imageUrl;
    img.className = 'sw-image';
    img.alt = 'Shared image';
    img.onclick = function(){ window.open(imageUrl, '_blank'); };
    bubble.appendChild(img);
    var link = document.createElement('a');
    link.className = 'sw-image-link';
    link.href = imageUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Open image';
    bubble.appendChild(link);
  } else {
    bubble.textContent = text || '';
  }
  messages.appendChild(row);
  scrollMessages();
}
async function startConversation(){
  if(state.started || state.loading) return;
  state.loading = true;
  setComposerState(true);
  try {
    var r = await fetch(cfg.chatUrl + '?action=start', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ widget_key:cfg.widgetKey, visitor_name:'Visitor', visitor_email:null, current_page:state.currentPage })
    });
    var d = await r.json();
    if(d.conversation_id){
      state.started = true;
      state.convoId = d.conversation_id;
      state.visitorToken = d.visitor_token;
      await pollMessages();
      startPolling();
      startHeartbeat();
    }
  } catch(_e) {
    appendMessage('bot', 'We could not start the conversation right now. Please try again in a moment.', null, new Date().toISOString());
  } finally {
    state.loading = false;
    setComposerState(false);
  }
}
async function sendMsg(){
  var txt = input.value.trim();
  if(!txt || !state.convoId || state.loading) return;
  input.value = '';
  input.style.height = 'auto';
  sendBtn.disabled = true;
  appendMessage('visitor', txt, null, new Date().toISOString());
  showTyping();
  try {
    await fetch(cfg.chatUrl + '?action=send', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ conversation_id:state.convoId, visitor_token:state.visitorToken, content:txt, current_page:state.currentPage })
    });
  } catch(_e) {
    removeTyping();
    appendMessage('bot', 'Connection error. Please try again.', null, new Date().toISOString());
  }
}
async function uploadImage(file){
  if(!file || !state.convoId || state.loading) return;
  if(!file.type.startsWith('image/')){ window.alert('Only images are supported'); return; }
  if(file.size > 5 * 1024 * 1024){ window.alert('Image must be under 5MB'); return; }
  var reader = new FileReader();
  reader.onload = async function(){
    appendMessage('visitor', null, reader.result, new Date().toISOString());
    showTyping();
    try {
      await fetch(cfg.chatUrl + '?action=upload', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ conversation_id:state.convoId, visitor_token:state.visitorToken, image_data:reader.result, file_name:file.name })
      });
    } catch(_e) {
      removeTyping();
      appendMessage('bot', 'Image upload failed. Please try again.', null, new Date().toISOString());
    }
  };
  reader.readAsDataURL(file);
}
async function pollMessages(){
  if(!state.convoId) return;
  try {
    var url = cfg.chatUrl + '?action=poll&conversation_id=' + encodeURIComponent(state.convoId) + '&visitor_token=' + encodeURIComponent(state.visitorToken);
    if(state.lastTs) url += '&after=' + encodeURIComponent(state.lastTs);
    var r = await fetch(url);
    var d = await r.json();
    if(d.messages && d.messages.length){
      d.messages.forEach(function(m){
        if(m.sender_type !== 'visitor' && m.sender_type !== 'system' && m.content_type !== 'system'){
          removeTyping();
          appendMessage(m.sender_type, m.content_type === 'image' ? null : m.content, m.content_type === 'image' ? m.content : null, m.created_at);
          if(!state.open){ state.unread += 1; updateBadge(); }
        }
        state.lastTs = m.created_at;
      });
    }
  } catch(_e){}
}
function startPolling(){
  if(state.polling) clearInterval(state.polling);
  state.polling = setInterval(function(){ pollMessages(); }, 2500);
}
function startHeartbeat(){
  if(state.heartbeat) clearInterval(state.heartbeat);
  state.heartbeat = setInterval(async function(){
    if(!state.convoId) return;
    try {
      await fetch(cfg.chatUrl + '?action=heartbeat', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ conversation_id:state.convoId, visitor_token:state.visitorToken, current_page:getCurrentPage() })
      });
    } catch(_e){}
  }, 30000);
}
setInterval(function(){ state.currentPage = getCurrentPage(); }, 2000);
window.addEventListener('popstate', function(){ state.currentPage = getCurrentPage(); });

var style = document.createElement('style');
style.textContent = \`
#sw-bubble,#sw-panel,#sw-panel *{box-sizing:border-box;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
#sw-bubble{position:fixed;right:22px;bottom:22px;z-index:99999;width:64px;height:64px;border:none;border-radius:999px;cursor:pointer;color:#fff;background:linear-gradient(135deg, ${brandColor} 0%, ${brandColor} 100%);box-shadow:0 18px 42px ${brandShadow};display:flex;align-items:center;justify-content:center;transition:transform .2s ease,box-shadow .2s ease}
#sw-bubble:hover{transform:scale(1.06);box-shadow:0 22px 54px ${brandShadow}}
#sw-bubble svg{position:relative;z-index:2;width:26px;height:26px;stroke:currentColor}
.sw-bubble-ring{position:absolute;inset:5px;border-radius:999px;border:1px solid rgba(255,255,255,.24)}
#sw-badge{position:absolute;top:-2px;right:-2px;z-index:3;min-width:22px;height:22px;padding:0 6px;border-radius:999px;background:#ef4444;color:#fff;font-size:11px;font-weight:700;display:none;align-items:center;justify-content:center;box-shadow:0 10px 20px rgba(239,68,68,.32)}
#sw-badge.show{display:flex}
#sw-panel{position:fixed;right:22px;bottom:98px;z-index:99999;width:388px;max-height:min(680px,calc(100vh - 128px));display:none;flex-direction:column;border-radius:30px;overflow:hidden;background:#ffffff;border:1px solid rgba(15,23,42,.08);box-shadow:0 32px 90px rgba(15,23,42,.28)}
#sw-panel.open{display:flex;animation:sw-slide-up .22s ease-out}
@keyframes sw-slide-up{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
#sw-header{position:relative;padding:18px 18px 16px;background:linear-gradient(135deg, ${brandColor} 0%, #0ea5e9 100%);color:#fff}
#sw-header:before{content:'';position:absolute;inset:0;background:radial-gradient(circle at top right, rgba(255,255,255,.22), transparent 34%)}
#sw-header-row{position:relative;display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
#sw-header-main{display:flex;gap:12px;min-width:0}
.sw-header-avatar{width:44px;height:44px;border-radius:16px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.16);backdrop-filter:blur(6px)}
.sw-header-avatar svg{width:20px;height:20px;stroke:currentColor}
.sw-header-copy{min-width:0}
.sw-header-copy h3{margin:0;font-size:15px;font-weight:700;display:flex;align-items:center;gap:8px}
.sw-live-pill{display:inline-flex;align-items:center;gap:6px;padding:4px 9px;border-radius:999px;background:rgba(255,255,255,.14);font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
.sw-live-pill:before{content:'';width:7px;height:7px;border-radius:999px;background:#34d399;box-shadow:0 0 0 4px rgba(52,211,153,.18)}
.sw-header-copy p{margin:6px 0 0;font-size:12px;line-height:1.55;color:rgba(255,255,255,.88)}
.sw-header-tags{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.sw-header-tag{padding:6px 10px;border-radius:999px;background:rgba(255,255,255,.12);font-size:11px;font-weight:600}
#sw-close{position:relative;z-index:2;width:34px;height:34px;border:none;border-radius:999px;background:rgba(255,255,255,.12);color:#fff;cursor:pointer;font-size:20px;line-height:1;transition:background .2s ease}
#sw-close:hover{background:rgba(255,255,255,.2)}
#sw-messages{flex:1;overflow-y:auto;padding:16px;background:radial-gradient(circle at top, ${brandSoft}, transparent 22%),linear-gradient(180deg,#fbfdff 0%,#f8fafc 100%)}
#sw-messages::-webkit-scrollbar{width:6px}
#sw-messages::-webkit-scrollbar-thumb{background:rgba(100,116,139,.25);border-radius:999px}
.sw-welcome-card{border:1px solid rgba(15,23,42,.07);background:rgba(255,255,255,.86);border-radius:28px;padding:18px;box-shadow:0 10px 30px rgba(15,23,42,.08)}
.sw-welcome-badge{display:inline-flex;align-items:center;padding:6px 10px;border-radius:999px;background:${brandSoft};color:${brandColor};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em}
.sw-welcome-card h4{margin:14px 0 6px;font-size:18px;line-height:1.2;color:#0f172a}
.sw-welcome-card p{margin:0;color:#475569;font-size:13px;line-height:1.6}
.sw-chip-row{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}
.sw-chip{border:1px solid ${brandBorder};background:#fff;color:${brandColor};padding:9px 12px;border-radius:999px;font-size:12px;font-weight:600;cursor:pointer;transition:transform .15s ease,background .15s ease}
.sw-chip:hover{transform:translateY(-1px);background:${brandSoft}}
.sw-row{display:flex;gap:10px;margin-top:12px;max-width:88%}
.sw-row.visitor{margin-left:auto;justify-content:flex-end}
.sw-avatar{width:34px;height:34px;flex-shrink:0;border-radius:14px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg, ${brandColor} 0%, #0ea5e9 100%);color:#fff;box-shadow:0 10px 24px ${brandGlow}}
.sw-avatar svg{width:16px;height:16px;stroke:currentColor}
.sw-bubble-wrap{min-width:0}
.sw-bubble{border-radius:24px;padding:13px 15px;font-size:13px;line-height:1.6;word-break:break-word;overflow-wrap:anywhere;box-shadow:0 8px 24px rgba(15,23,42,.06)}
.sw-bubble.visitor{background:linear-gradient(135deg, ${brandColor} 0%, #0ea5e9 100%);color:#fff;border-bottom-right-radius:8px}
.sw-bubble.assistant{background:rgba(255,255,255,.92);color:#0f172a;border:1px solid rgba(15,23,42,.06);border-bottom-left-radius:8px}
.sw-meta{margin-top:6px;padding:0 4px;font-size:11px;color:#64748b}
.sw-row.visitor .sw-meta{text-align:right}
.sw-bubble.typing{display:flex;align-items:center;gap:6px;min-width:74px}
.sw-bubble.typing span{width:8px;height:8px;border-radius:999px;background:#94a3b8;animation:sw-wave 1.4s ease-in-out infinite}
.sw-bubble.typing span:nth-child(2){animation-delay:.14s}
.sw-bubble.typing span:nth-child(3){animation-delay:.28s}
@keyframes sw-wave{0%,60%,100%{transform:translateY(0);opacity:.45}30%{transform:translateY(-5px);opacity:1}}
.sw-image{display:block;max-width:220px;width:100%;border-radius:18px;border:1px solid rgba(15,23,42,.08);cursor:pointer}
.sw-image-link{display:inline-flex;margin-top:10px;color:${brandColor};font-size:12px;font-weight:600;text-decoration:none}
#sw-input-area{display:flex;align-items:flex-end;gap:10px;padding:14px 16px;border-top:1px solid rgba(15,23,42,.06);background:rgba(255,255,255,.96)}
#sw-attach{width:44px;height:44px;flex-shrink:0;border-radius:16px;border:1px solid rgba(15,23,42,.09);background:#fff;color:#64748b;cursor:pointer;font-size:18px;transition:background .15s ease,color .15s ease}
#sw-attach:hover{background:#f8fafc;color:#0f172a}
#sw-input-shell{flex:1;border:1px solid rgba(15,23,42,.08);background:#fff;border-radius:24px;padding:10px 12px;box-shadow:0 8px 24px rgba(15,23,42,.04)}
#sw-input{width:100%;min-height:54px;max-height:110px;border:none;outline:none;resize:none;background:transparent;color:#0f172a;font-size:13px;line-height:1.5}
#sw-input::placeholder{color:#94a3b8}
#sw-subtext{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:8px;font-size:11px;color:#64748b}
#sw-subtext .sw-subtext-copy{min-width:0;flex:1;line-height:1.4}
#sw-subtext .sw-subtext-pill{display:inline-flex;flex-shrink:0;align-items:center;justify-content:center;padding:6px 10px;border-radius:999px;background:${brandSoft};color:${brandColor};font-weight:600;white-space:nowrap}
#sw-send{height:44px;padding:0 16px;border:none;border-radius:16px;background:linear-gradient(135deg, ${brandColor} 0%, #0ea5e9 100%);color:#fff;font-size:12px;font-weight:700;cursor:pointer;box-shadow:0 14px 28px ${brandGlow};transition:transform .15s ease,opacity .15s ease}
#sw-send:hover:not(:disabled){transform:translateY(-1px)}
#sw-send:disabled,#sw-attach:disabled{opacity:.5;cursor:not-allowed}
@media(max-width:480px){
  #sw-panel{right:12px;left:12px;bottom:92px;width:auto;max-height:min(680px,calc(100vh - 112px))}
  #sw-bubble{right:16px;bottom:16px}
  #sw-subtext{flex-direction:column}
}
\`;
document.head.appendChild(style);

var bubble = document.createElement('button');
bubble.id = 'sw-bubble';
bubble.setAttribute('aria-label', 'Open support chat');
document.body.appendChild(bubble);

var panel = document.createElement('div');
panel.id = 'sw-panel';
panel.innerHTML =
  '<div id="sw-header">' +
    '<div id="sw-header-row">' +
      '<div id="sw-header-main">' +
        '<div class="sw-header-avatar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg></div>' +
        '<div class="sw-header-copy">' +
          '<h3>Support <span class="sw-live-pill">Live</span></h3>' +
          '<p>Modern website support for quotes, products, delivery, and custom project guidance.</p>' +
          '<div class="sw-header-tags"><span class="sw-header-tag">AI-assisted</span><span class="sw-header-tag">Fast replies</span></div>' +
        '</div>' +
      '</div>' +
      '<button id="sw-close" type="button">&times;</button>' +
    '</div>' +
  '</div>' +
  '<div id="sw-messages"></div>' +
  '<div id="sw-input-area">' +
    '<button id="sw-attach" type="button" title="Upload image">📎</button>' +
    '<input id="sw-file" type="file" accept="image/*" style="display:none" />' +
    '<div id="sw-input-shell">' +
      '<textarea id="sw-input" rows="2" placeholder="Tell us what you need help with..."></textarea>' +
      '<div id="sw-subtext"><span class="sw-subtext-copy">Ask about pricing, delivery, products, or custom fabrication.</span><span class="sw-subtext-pill">AI-guided support</span></div>' +
    '</div>' +
    '<button id="sw-send" type="button" disabled>Send</button>' +
  '</div>';
document.body.appendChild(panel);

var badge = null;
var messages = document.getElementById('sw-messages');
var input = document.getElementById('sw-input');
var sendBtn = document.getElementById('sw-send');
var attachBtn = document.getElementById('sw-attach');
var fileInput = document.getElementById('sw-file');
setBubbleIcon(false);
showWelcomeCard();

bubble.onclick = async function(){
  state.open = !state.open;
  panel.classList.toggle('open', state.open);
  setBubbleIcon(state.open);
  if(state.open){
    state.unread = 0;
    updateBadge();
    input.focus();
    if(!state.started) await startConversation();
  }
};
document.getElementById('sw-close').onclick = function(){
  state.open = false;
  panel.classList.remove('open');
  setBubbleIcon(false);
};
messages.addEventListener('click', function(e){
  var chip = e.target.closest('.sw-chip');
  if(!chip || state.loading) return;
  input.value = chip.getAttribute('data-prompt') || '';
  sendBtn.disabled = !input.value.trim();
  sendMsg();
});
input.oninput = function(){
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 110) + 'px';
  sendBtn.disabled = state.loading || !input.value.trim();
};
input.onkeydown = function(e){
  if(e.key === 'Enter' && !e.shiftKey){
    e.preventDefault();
    sendMsg();
  }
};
sendBtn.onclick = sendMsg;
attachBtn.onclick = function(){ fileInput.click(); };
fileInput.onchange = function(){
  var file = fileInput.files && fileInput.files[0];
  if(file) uploadImage(file);
  fileInput.value = '';
};
})();`;
}
