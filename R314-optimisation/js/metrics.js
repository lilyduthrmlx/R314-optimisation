/* metrics.js — widget d'évaluation des performances (client-side) */
(function(){
  // --- État global et Helpers ---
  const state = {
    fcp: null, lcp: null, cls: 0,
    totalBlockingTime: 0, // approx: somme (longTask - 50ms)
    totalRequests: 0,
    totalBytes: 0,
    nav: null
  };
  
  // Helper: formatters
  const fmtMs = v => v === null ? '-' : `${v.toFixed(0)} ms`;
  const fmtKB = v => v === null ? '-' : `${(v / 1024).toFixed(1)} KB`;
  const fmtCls = v => v ? v.toFixed(3) : '-';

  // --- Fonctions de collecte ---
  function collectResources() {
    const entries = performance.getEntriesByType('resource');
    state.totalRequests = entries.length + 1; // +1 pour le document HTML
    
    let total = 0;
    for (const r of entries) {
      // Utilisation du transfertSize si disponible, sinon encodedBodySize. Fallback à 0.
      total += r.transferSize || r.encodedBodySize || 0;
    }
    state.totalBytes = total;
  }

  function collectNavigation() {
    state.nav = performance.getEntriesByType('navigation')[0] || null;
  }
  
  // --- Mise à jour de l'UI ---
  let panel;
  function update() {
    collectResources();
    collectNavigation();
    
    if (!panel) return; // Sécurité au cas où l'update est appelée avant le DOMContentLoaded
    
    const $ = id => panel.querySelector(`#${id}`);

    // Mise à jour de tous les éléments d'un coup avec une syntaxe plus courte
    $('m-fcp').textContent = fmtMs(state.fcp);
    $('m-lcp').textContent = fmtMs(state.lcp);
    $('m-cls').textContent = fmtCls(state.cls);
    $('m-tbt').textContent = fmtMs(state.totalBlockingTime);
    $('m-req').textContent = state.totalRequests || '-';
    $('m-bytes').textContent = state.totalBytes ? fmtKB(state.totalBytes) : '-';
  }

  // --- Observers de Performance (Web Vitals) ---
  try {
    // Regroupement des Observers dans une seule structure de données
    const observers = [
      { type: 'paint', buffered: true, cb: (e) => {
        if (e.name === 'first-contentful-paint' && state.fcp === null) {
          state.fcp = e.startTime;
          return true; // Déconnecter après FCP
        }
        return false;
      }},
      { type: 'largest-contentful-paint', buffered: true, cb: (e) => {
        // Utilisation de l'opérateur de coalescence nulle (??) pour une gestion plus stricte des valeurs
        state.lcp = e.renderTime ?? e.loadTime ?? e.startTime;
        return false;
      }},
      { type: 'layout-shift', buffered: true, cb: (e) => {
        if (!e.hadRecentInput) state.cls += e.value;
        return false;
      }},
    ];

    for (const { type, buffered, cb } of observers) {
      const po = new PerformanceObserver((list) => {
        let disconnectNeeded = false;
        for (const e of list.getEntries()) {
          if (cb(e)) disconnectNeeded = true;
        }
        update();
        if (disconnectNeeded) po.disconnect();
      });
      po.observe({ type, buffered });
      
      // Gestion de la déconnexion LCP sur 'hidden'
      if (type === 'largest-contentful-paint') {
        addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'hidden') po.takeRecords();
        });
      }
    }

    // Long Tasks TBT
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        state.totalBlockingTime += Math.max(0, e.duration - 50);
      }
      update();
    }).observe({ entryTypes: ['longtask'] });
    
  } catch (err) {
    // Gérer les environnements sans PerformanceObserver (très anciens)
    console.warn("PerformanceObserver not supported.", err);
  }

  // --- Initialisation de l'UI et Gestion des événements ---
  function createPanel() {
    panel = document.createElement('div');
    panel.id = 'perf-panel';
    
    // Simplification des styles - utilise une approche compacte
    Object.assign(panel.style, {
      position: 'fixed', right: '16px', bottom: '16px', zIndex: 9999,
      width: '320px', maxWidth: '90vw',
      fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial',
      background: 'rgba(10,12,28,.9)', color: '#E8ECF1', border: '1px solid rgba(255,255,255,.12)',
      borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,.5)',
      backdropFilter: 'blur(6px) saturate(120%)', padding: '12px 14px'
    });

    panel.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px">
        <strong style="letter-spacing:.2px">Évaluation perfs</strong>
        <div>
          <button id="perf-refresh" style="background:#7C5CFF;color:white;border:0;border-radius:8px;padding:6px 10px;cursor:pointer">Mesurer</button>
          <button id="perf-close" style="background:transparent;color:#c9d1d9;border:1px solid rgba(255,255,255,.2);border-radius:8px;padding:6px 8px;margin-left:6px;cursor:pointer">×</button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px">
        <div><div style="opacity:.8">FCP</div><div id="m-fcp" style="font-weight:600">-</div></div>
        <div><div style="opacity:.8">LCP</div><div id="m-lcp" style="font-weight:600">-</div></div>
        <div><div style="opacity:.8">CLS</div><div id="m-cls" style="font-weight:600">-</div></div>
        <div><div style="opacity:.8">TBT (≈)</div><div id="m-tbt" style="font-weight:600">-</div></div>
        <div><div style="opacity:.8">Requêtes</div><div id="m-req" style="font-weight:600">-</div></div>
        <div><div style="opacity:.8">Poids total</div><div id="m-bytes" style="font-weight:600">-</div></div>
      </div>
      <div style="margin-top:8px;font-size:12px;opacity:.8">
        <div id="m-note">Cliquez sur <em>Mesurer</em> après vos modifications.</div>
      </div>
    `;
    
    // Gestion des clics via l'Event Delegation (plus propre)
    panel.addEventListener('click', (e) => {
      const { id } = e.target;
      if (id === 'perf-refresh') update();
      else if (id === 'perf-close') panel.remove();
    });

    document.body.appendChild(panel);
    
    // Mise à jour initiale après que le panneau est attaché
    update();
  }

  document.addEventListener('DOMContentLoaded', createPanel);
  
  // Mise à jour finale après le chargement de toutes les ressources
  addEventListener('load', () => {
    // Utilisation d'un court délai pour s'assurer que toutes les ressources sont comptées
    setTimeout(update, 100); 
  });
})();
