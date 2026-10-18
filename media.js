// Shared project media (videos + image galleries) for every theme.
//   PortfolioMedia.html(project, root)  -> markup for project.media (empty string if none)
//   PortfolioMedia.wire(scope)          -> autoplay videos while visible, open images in a viewer
// Themes style .pm* classes to match; the base layout and the viewer are injected here.
(function () {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const css = document.createElement('style');
  css.textContent = `
.pm { margin:14px 0 4px; display:grid; gap:10px; }
.pm figure { margin:0; }
.pm video { display:block; width:auto; max-width:100%; height:auto; max-height:min(62vh, 560px); background:#000; }
.pm figcaption { font-size:13px; margin-top:6px; opacity:.75; line-height:1.4; }
.pm-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(150px, 1fr)); gap:8px; }
.pm-img { display:block; width:100%; padding:0; border:0; background:none; cursor:zoom-in; color:inherit; font:inherit; text-align:left; }
.pm-img img { display:block; width:100%; aspect-ratio:16/10; object-fit:cover; object-position:top; }
.pm-img.tall img { object-fit:contain; background:rgba(127,127,127,.12); }
.pm-lead .pm-img img { aspect-ratio:auto; max-height:60vh; object-fit:contain; }
.pm-lb { border:0; padding:0; background:transparent; max-width:96vw; max-height:96vh; color:#fff; }
.pm-lb::backdrop { background:rgba(0,0,0,.86); }
.pm-lb img { display:block; max-width:94vw; max-height:84vh; margin:0 auto; }
.pm-lb p { text-align:center; margin:10px 0 0; font:14px/1.4 system-ui, sans-serif; }
.pm-lb .pm-x, .pm-lb .pm-nav { position:fixed; background:rgba(255,255,255,.12); color:#fff; border:0; font:22px/1 system-ui, sans-serif; width:44px; height:44px; cursor:pointer; }
.pm-lb .pm-x { top:16px; right:16px; } .pm-lb .pm-prev { left:16px; top:50%; } .pm-lb .pm-next { right:16px; top:50%; }
.pm-lb button:focus-visible { outline:2px solid #fff; outline-offset:2px; }`;
  document.head.appendChild(css);

  function html(p, root = '') {
    const m = p.media || []; if (!m.length) return '';
    const vids = m.filter(x => x.type === 'video'), imgs = m.filter(x => x.type === 'image');
    const v = vids.map(x => `<figure class="pm-video"><video src="${root}${x.src}"${x.w ? ` width="${x.w}" height="${x.h}"` : ''} muted loop playsinline preload="metadata" controls aria-label="${esc(x.caption || p.title)}"></video>${x.caption ? `<figcaption>${esc(x.caption)}</figcaption>` : ''}</figure>`).join('');
    const btn = (x, i) => `<button type="button" class="pm-img${x.tall ? ' tall' : ''}" data-pm-i="${i}" aria-label="Open image: ${esc(x.caption || p.title)}"><img src="${root}${x.src}" alt="${esc(x.caption || p.title)}" loading="lazy" decoding="async"></button>`;
    const [lead, ...rest] = imgs;
    const g = imgs.length ? `<div class="pm-gallery" data-pm-set="${esc(JSON.stringify(imgs.map(x => [root + x.src, x.caption || ''])))}">
      <figure class="pm-lead">${btn(lead, 0)}${lead.caption ? `<figcaption>${esc(lead.caption)}</figcaption>` : ''}</figure>
      ${rest.length ? `<div class="pm-grid">${rest.map((x, i) => btn(x, i + 1)).join('')}</div>` : ''}</div>` : '';
    return `<div class="pm">${v}${g}</div>`.replace(/>\s+</g, '><');
  }

  // Viewer: one <dialog>, reused. Arrow keys / buttons step through the gallery it was opened from.
  let lb, set = [], at = 0;
  function show() { lb.querySelector('img').src = set[at][0]; lb.querySelector('img').alt = set[at][1]; lb.querySelector('p').textContent = set[at][1];
    lb.querySelectorAll('.pm-nav').forEach(b => b.hidden = set.length < 2); }
  function viewer() {
    if (lb) return lb;
    lb = document.createElement('dialog'); lb.className = 'pm-lb';
    lb.innerHTML = '<button type="button" class="pm-x" aria-label="Close">×</button><button type="button" class="pm-nav pm-prev" aria-label="Previous image">‹</button><img alt=""><p></p><button type="button" class="pm-nav pm-next" aria-label="Next image">›</button>';
    document.body.appendChild(lb);
    lb.addEventListener('click', e => { if (e.target === lb || e.target.closest('.pm-x')) lb.close();
      if (e.target.closest('.pm-prev')) { at = (at - 1 + set.length) % set.length; show(); }
      if (e.target.closest('.pm-next')) { at = (at + 1) % set.length; show(); } });
    lb.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') { at = (at - 1 + set.length) % set.length; show(); } if (e.key === 'ArrowRight') { at = (at + 1) % set.length; show(); } });
    return lb;
  }

  // Play muted videos only while they're mostly on screen; respect reduced motion.
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => {
    const v = e.target; if (e.isIntersecting && e.intersectionRatio > .4) { if (!reduce && !v.dataset.userPaused) v.play().catch(() => {}); } else if (!v.paused) { v.dataset.ioPause = 1; v.pause(); }
  }), { threshold: [0, .4, .8] }) : null;

  function wire(scope = document) {
    scope.querySelectorAll('.pm video:not([data-pm-wired])').forEach(v => { v.dataset.pmWired = 1; if (io) io.observe(v);
      // A pause we didn't cause by scrolling away is the visitor's choice: don't autoplay that video again.
      v.addEventListener('pause', () => { if (v.dataset.ioPause) delete v.dataset.ioPause; else v.dataset.userPaused = 1; });
      v.addEventListener('play', () => { delete v.dataset.userPaused; }); });
    scope.querySelectorAll('.pm-gallery:not([data-pm-wired])').forEach(g => { g.dataset.pmWired = 1;
      g.addEventListener('click', e => { const b = e.target.closest('[data-pm-i]'); if (!b) return;
        set = JSON.parse(g.dataset.pmSet); at = +b.dataset.pmI; viewer(); show(); lb.showModal(); }); });
  }

  window.PortfolioMedia = { html, wire };
})();
