(() => {
  if (window.__p3d) return; window.__p3d = true;
  const DEF = {trans:10, mode:2, ana:0, aspect:0, swap:false, eyes:0, depth:0, zoom:1, px:0, py:0, sat:1, con:1, gam:1, bri:1};
  let acc = 0, lastT = performance.now(), boundVid = null;
  let S = {...DEF}, on = false, vid = null, cv = null, gl = null, U = {}, tex = null, host = null, sh = null, loopId = 0;

  const save = () => { try { chrome.storage.local.set({p3d:S}); } catch(e){} };
  try { chrome.storage.local.get('p3d', r => { if (r && r.p3d) { const o = {...r.p3d}; delete o.mode; Object.assign(S, o); syncPanel(); } }); } catch(e){}
  try { chrome.storage.onChanged.addListener(c => { if (c.p3d) { const o = {...c.p3d.newValue}; delete o.mode; Object.assign(S, o); syncPanel(); } }); } catch(e){}
  try { chrome.runtime.onMessage.addListener(m => { if (m && m.cmd === 'toggle') toggle(); }); } catch(e){}

  const VS = `attribute vec2 p; varying vec2 uv; void main(){ uv=vec2(p.x*.5+.5, .5-p.y*.5); gl_Position=vec4(p,0.,1.); }`;
  const FS = `precision mediump float;
varying vec2 uv; uniform sampler2D tex;
uniform float mode, shift, swp, ana, bri, zoom, sat, con, gam; uniform vec2 ew, pan;
vec3 grade(vec3 c){ float y=dot(c,vec3(.299,.587,.114)); c=mix(vec3(y),c,sat); c=(c-.5)*con+.5; return pow(max(c,0.),vec3(1./gam)); }
vec3 eye(float e, vec2 q){
  if (q.x<0.||q.x>1.||q.y<0.||q.y>1.) return vec3(0.);
  vec2 c;
  if (mode < .5) c = vec2(q.x*.5+e*.5, q.y);
  else if (mode < 1.5) c = vec2(q.x, q.y*.5+e*.5);
  else c = q;
  return texture2D(tex, c).rgb;
}
void main(){
  float a = swp; vec2 q = (uv-.5)/zoom + .5 + pan;
  vec3 L = eye(a, q + vec2(shift*ew.x,0.));
  vec3 R = eye(1.-a, q - vec2(shift*ew.y,0.));
  L = grade(L); R = grade(R);
  vec3 o;
  if (ana < .5) {
    o.r = dot(L, vec3( .437, .449, .164)) + dot(R, vec3(-.011,-.032,-.007));
    o.g = dot(L, vec3(-.062,-.062,-.024)) + dot(R, vec3( .377, .761, .009));
    o.b = dot(L, vec3(-.048,-.050,-.017)) + dot(R, vec3(-.026,-.093,1.234));
  } else if (ana < 1.5) { o = vec3(L.r, R.g, R.b); }
  else if (ana < 2.5) { float gL = dot(L, vec3(.299,.587,.114)), gr = dot(R, vec3(.299,.587,.114)); o = vec3(gL, gr, gr); }
  else { float gL = dot(L, vec3(.299,.587,.114)), gr = dot(R, vec3(.299,.587,.114)); o = vec3(gL, 0., gr); }
  gl_FragColor = vec4(clamp(o*bri,0.,1.),1.);
}`;

  function initGL() {
    cv = document.createElement('canvas');
    cv.style.cssText = 'position:absolute;pointer-events:none;background:#000;';
    gl = cv.getContext('webgl', {antialias:false});
    if (!gl) return false;
    const mk = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) console.error('[3D]', gl.getShaderInfoLog(o)); return o; };
    const pr = gl.createProgram(); gl.attachShader(pr, mk(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, mk(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr); gl.useProgram(pr);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
    const l = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0);
    tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    for (const n of ['mode','shift','swp','ana','bri','zoom','sat','con','gam','ew','pan']) U[n] = gl.getUniformLocation(pr, n);
    return true;
  }

  function pickVideo() {
    let best = null, ba = 0;
    for (const v of document.querySelectorAll('video')) {
      const r = v.getBoundingClientRect(), a = r.width * r.height;
      if (a > ba && v.videoWidth && r.bottom > 0 && r.top < innerHeight) { best = v; ba = a; }
    }
    return best;
  }

  const resetTrans = () => { acc = 0; lastT = performance.now(); };
  function bind(v) {
    if (boundVid === v) return;
    if (boundVid) for (const ev of ['seeking','emptied','loadstart']) boundVid.removeEventListener(ev, resetTrans);
    boundVid = v;
    for (const ev of ['seeking','emptied','loadstart']) v.addEventListener(ev, resetTrans);
    resetTrans();
  }
  const prog = () => S.trans > 0 ? Math.min(1, acc / (S.trans*1000)) : 1;
  const effDepth = () => S.depth * prog();

  let stTxt = '';
  function status(msg) { msg = msg || ''; if (sh && msg !== stTxt) { stTxt = msg; sh.getElementById('st').textContent = msg; } }

  function frame() {
    if (!on) return;
    const v = (vid && vid.isConnected && vid.videoWidth) ? vid : (vid = pickVideo());
    schedule();
    if (!v) { if (cv.parentNode) cv.remove(); status('Nessun video in questa pagina'); return; }
    bind(v);
    const now = performance.now(); if (!v.paused) acc += now - lastT; lastT = now;
    const vw = v.videoWidth, vh = v.videoHeight;
    let ar;
    if (S.mode == 0) { const e = (vw/2)/vh; ar = S.aspect==1 ? vw/vh : S.aspect==2 ? e : (e < 1.5 ? vw/vh : e); }
    else if (S.mode == 1) { const e = vw/(vh/2); ar = S.aspect==1 ? vw/vh : S.aspect==2 ? e : (e > 3.2 ? vw/vh : e); }
    else ar = vw/vh;
    const W = v.offsetWidth, H = v.offsetHeight; if (!W || !H) return;
    const w = Math.min(W, H*ar), h = w/ar, dpr = devicePixelRatio || 1;
    if (cv.previousSibling !== v) v.parentNode.insertBefore(cv, v.nextSibling);
    cv.style.left = (v.offsetLeft + (W-w)/2) + 'px'; cv.style.top = (v.offsetTop + (H-h)/2) + 'px';
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    const bw = Math.round(w*dpr), bh = Math.round(h*dpr);
    if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; gl.viewport(0, 0, bw, bh); }
    if (v.readyState < 2) return;
    try {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, v);
    } catch (e) { status('Video non accessibile (protetto o di altro dominio)'); cv.remove(); return; }
    const pg = prog();
    status(pg < 1 ? 'Transizione: ora ' + (effDepth()>0?'+':'') + effDepth().toFixed(1) + '% → ' + S.depth.toFixed(1) + '%' : '');
    gl.uniform1f(U.mode, S.mode); gl.uniform1f(U.shift, effDepth()/100); gl.uniform1f(U.swp, S.swap?1:0);
    gl.uniform1f(U.ana, S.ana); gl.uniform1f(U.bri, S.bri); gl.uniform1f(U.zoom, S.zoom);
    gl.uniform1f(U.sat, S.sat); gl.uniform1f(U.con, S.con); gl.uniform1f(U.gam, S.gam);
    gl.uniform2f(U.ew, S.eyes==1?2:S.eyes==2?0:1, S.eyes==2?2:S.eyes==1?0:1); gl.uniform2f(U.pan, S.px, S.py);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (!cv.parentNode) v.parentNode.insertBefore(cv, v.nextSibling);
  }
  function schedule() {
    cancelAnimationFrame(loopId);
    loopId = requestAnimationFrame(frame);
  }

  // ---------- pannello ----------
  const SL = [['depth','Profondità (fine)',-30,30,.05],['trans','Transizione s',0,60,1],['zoom','Zoom',1,4,.01],['px','◀ ▶',-.5,.5,.002,true],['py','▲ ▼',-.5,.5,.002],['sat','Colore',.5,3,.02],['con','Contrasto',.7,1.8,.02],['gam','Gamma',.6,2,.02],['bri','Luminosità',.6,1.8,.02]];
  function buildPanel() {
    host = document.createElement('div');
    host.style.cssText = 'position:fixed;top:12px;right:12px;z-index:2147483647;';
    sh = host.attachShadow({mode:'open'});
    sh.innerHTML = `<style>
      .p{font:12px system-ui,sans-serif;color:#eee;background:rgba(16,16,22,.93);border:1px solid #333;border-radius:10px;padding:8px 10px;width:290px}
      .h{display:flex;justify-content:space-between;align-items:center;font-weight:600;margin-bottom:4px}
      .r{display:flex;align-items:center;gap:6px;margin:3px 0}.r span:first-child{width:74px;color:#aaa}
      input[type=range]{flex:1;accent-color:#ff4d4d;min-width:0}select,button{background:#22222c;color:#eee;border:1px solid #3a3a46;border-radius:5px;padding:2px 4px;font:inherit}
      #st{color:#ff8a8a;margin-top:4px}.v{width:46px;text-align:right}.hide .b{display:none}
    </style><div class="p" id="pn"><div class="h"><span>3D anaglifo</span><span><button id="mn">_</button> <button id="x">✕</button></span></div><div class="b">
      <div class="r"><span>Formato</span><select id="mode"><option value="0">Side-by-Side</option><option value="1">Top-Bottom</option><option value="2">2D</option></select></div>
      <div class="r"><span>Anaglifo</span><select id="ana"><option value="0">R/C Dubois</option><option value="1">R/C colore</option><option value="2">R/C grigio</option><option value="3">R/Blu</option></select></div>
      <div class="r"><span>Larghezza</span><select id="aspect"><option value="0">Auto</option><option value="1">Mezzo</option><option value="2">Pieno</option></select></div>
      <div class="r"><span>Sposta</span><select id="eyes"><option value="0">Entrambi</option><option value="1">Solo sx</option><option value="2">Solo dx</option></select><label><input type="checkbox" id="swap"> scambia occhi</label></div>
      ${SL.map(s => `<div class="r"><span>${s[1]}</span><input type="range" id="${s[0]}" min="${s[2]}" max="${s[3]}" step="${s[4]}"><span class="v" id="${s[0]}V"></span></div>`).join('')}
      <div class="r"><button id="rv">reset vista</button><button id="rc">reset colori</button><button id="rd">profondità 0</button></div>
      <div style="color:#888">Alt+3 on/off · Alt+←/→ profondità · Alt+H pannello</div>
    </div><div id="st"></div></div>`;
    for (const id of ['mode','ana','aspect','eyes']) sh.getElementById(id).onchange = e => { S[id] = +e.target.value; save(); };
    sh.getElementById('swap').onchange = e => { S.swap = e.target.checked; save(); };
    for (const s of SL) sh.getElementById(s[0]).oninput = e => { S[s[0]] = s[5] ? -(+e.target.value) : +e.target.value; syncPanel(); save(); };
    sh.getElementById('rv').onclick = () => { S.zoom = 1; S.px = 0; S.py = 0; syncPanel(); save(); };
    sh.getElementById('rc').onclick = () => { S.sat = S.con = S.gam = S.bri = 1; syncPanel(); save(); };
    sh.getElementById('rd').onclick = () => { S.depth = 0; syncPanel(); save(); };
    sh.getElementById('mn').onclick = () => sh.getElementById('pn').classList.toggle('hide');
    sh.getElementById('x').onclick = () => toggle(false);
    syncPanel();
  }
  function syncPanel() {
    if (!sh) return;
    for (const id of ['mode','ana','aspect','eyes']) sh.getElementById(id).value = S[id];
    sh.getElementById('swap').checked = S.swap;
    for (const s of SL) {
      const v = s[5] ? -S[s[0]] : S[s[0]];
      sh.getElementById(s[0]).value = v;
      sh.getElementById(s[0]+'V').textContent = s[0]==='depth' ? (S.depth>0?'+':'')+S.depth.toFixed(1)+'%' : s[0]==='trans' ? (+v)+' s' : (+v).toFixed(2);
    }
  }
  function placeHost() { const p = document.fullscreenElement || document.documentElement; if (host && host.parentNode !== p) p.appendChild(host); }
  document.addEventListener('fullscreenchange', placeHost);

  function toggle(force) {
    on = typeof force === 'boolean' ? force : !on;
    if (on) {
      resetTrans();
      if (!pickVideo()) { on = false; return; }   // frame senza video: ignora
      if (!gl && !initGL()) { on = false; return; }
      if (!host) buildPanel();
      placeHost(); host.style.display = '';
      vid = pickVideo(); frame();
    } else {
      cancelAnimationFrame(loopId);
      if (cv) cv.remove();
      if (host) host.style.display = 'none';
    }
  }

  window.addEventListener('keydown', e => {
    if (!e.altKey) return;
    if (!on) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      S.depth = Math.max(-30, Math.min(30, Math.round((S.depth + (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 1 : .1))*100)/100));
      syncPanel(); save();
    } else if (e.key === 'h' || e.key === 'H') { e.preventDefault(); host.style.display = host.style.display === 'none' ? '' : 'none'; }
  }, true);
})();
