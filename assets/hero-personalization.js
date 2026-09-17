/* ==========================================================================
 * La Bussola — Hero personalization demonstration (fix #14, phase 3)
 *
 * A silent visual tutorial inside the Hero's own visual area. It teaches the
 * real journey, in the real order:
 *
 *   a pizza in the menu  ->  its `✦ PERSONALIZZA` control  ->  the click
 *   ->  the real circular customization panel  ->  Crudo / Rucola / Porcini
 *   ->  Impasto choice  ->  the pizza visibly customized  ->
 *   `Aggiungi al Carrello`  ->  `Aggiunto al Carrello!`  ->  back to the Hero
 *
 * AUTHENTICITY
 *   Every element is real DOM carrying class strings copied verbatim from the
 *   shipped bundle, so the CSS that styles them already exists in
 *   /assets/index-64dcfff5.css: menu row, `lb-cta-pill` control, the panel's
 *   backdrop/header/orbit/rings/chips/Impasto row/total/button and its real
 *   confirmation state. Product names, ingredients, prices, supplement names,
 *   prices, images and dough options are the production data strings. The only
 *   imagery is the site's own, plus the four verified Phase-1 topping layers,
 *   revealed one at a time on ONE persistent Margherita base — never a
 *   crossfade of complete pizza images. No screenshots, no rasterised UI,
 *   no video, no libraries.
 *
 * SAFETY
 *   The stage is aria-hidden and pointer-events:none: it is never clickable,
 *   dispatches no events, and touches neither cart, localStorage, the real
 *   customizer, checkout nor WhatsApp. It pauses while the real customizer is
 *   open, while the tab is hidden and while the Hero is off-screen, and stands
 *   aside completely under prefers-reduced-motion. It sets
 *   window.__lbHeroPersonalization, which the shipped Hero rotation honours so
 *   one persistent object stays on screen; if a stale cached bundle ignores the
 *   flag, every step re-checks the base <img> and abandons the scene.
 * ========================================================================== */
(function () {
  "use strict";

  window.__lbHeroPersonalization = true;

  var DIR = "/assets/hero-personalization/";
  var LAYERS = ["margherita-crudo.layer.png", "margherita-crudo-rucola.layer.png",
                "margherita-crudo-rucola-porcini.layer.png", "margherita-final.layer.png"];
  var BASE_IMG = "/products/pizza-margherita.png";
  var BASE_RE = /(^|\/)products\/pizza-margherita\.png(\?|#|$)/i;
  var EASE = "cubic-bezier(.22,.61,.36,1)";
  var TRAVEL = "cubic-bezier(.32,.72,.28,1)";

  /* ---- production data, verbatim from the shipped bundle ---------------- */
  var SECTION = { numeral: "I", name: "PIZZE CLASSICHE", tagline: "La tradizione, sempre." };
  var ROWS = [
    { name: "Margherita", ingredients: "Pomodoro, Fior Di Latte", price: 5, image: "/products/th/margherita.jpeg", target: true },
    { name: "Marinara", ingredients: "Pomodoro, Olio, Aglio, Basilico, Origano", price: 5, image: "/products/th/marinara.jpeg" }
  ];
  /* the real eight orbit chips, with the real labels, prices and images */
  var CHIPS = [
    { id: "porcini",    name: "Porcini",    dp: "+1€", image: "/supplement-assets/porcini.png",    layer: 2, add: 2, x: -45,  y: -135 },
    { id: "crudo",      name: "Crudo",      dp: "+1€", image: "/supplement-assets/crudo.png",      layer: 0, add: 1, x: 135,  y: -115 },
    { id: "burrata",    name: "Burrata",    dp: "+1€", image: "/supplement-assets/burrata.png",    x: 220,  y: -35 },
    { id: "bresaola",   name: "Bresaola",   dp: "+1€", image: "/supplement-assets/bresaola.png",   x: 245,  y: 55 },
    { id: "rucola",     name: "Rucola",     dp: "+1€", image: "/supplement-assets/rucola.png",     layer: 1, add: 1, x: 190,  y: 135 },
    { id: "olive",      name: "Olive",      dp: "+1€", image: "/supplement-assets/olive.png",      x: -190, y: 135 },
    { id: "mozzarella", name: "Mozzarella", dp: "+1€", image: "/supplement-assets/mozzarella.png", x: -245, y: 55 },
    { id: "bufala",     name: "Bufala",     dp: "+1€", image: "/supplement-assets/bufala.png",     x: -220, y: -35 }
  ];
  var DOUGHS = [
    { id: "classico", name: "Classico", price: 0 }, { id: "integrale", name: "Integrale", price: 1 },
    { id: "senza-glutine", name: "Senza Glutine", price: 3 }, { id: "doppio-impasto", name: "Doppio Impasto", price: 1 },
    { id: "tirata", name: "Tirata", price: 1.5 }
  ];

  /* ---- shipped class strings (copied, never invented) ------------------- */
  var C = {
    row: "group flex items-center justify-between gap-3 border-b border-white/5 py-3.5 cursor-pointer hover:border-gold/30 transition-colors",
    rowL: "flex items-center gap-3.5 min-w-0 flex-1",
    thumb: "h-11 w-11 shrink-0 rounded-lg border border-white/10 object-cover sm:h-14 sm:w-14 group-hover:scale-105 transition-transform",
    name: "font-serif text-[15px] sm:text-base leading-tight text-white group-hover:text-gold transition-colors",
    ing: "mt-1 text-[12px] font-light leading-snug text-warm-gray",
    price: "font-serif text-[15px] font-medium text-cream tabular-nums",
    pill: "flex items-center justify-center rounded-full border transition-all duration-300 whitespace-nowrap shrink-0 lb-cta-pill border-gold/25 text-gold-light hover:border-gold/60 hover:bg-gold/10",
    secHead: "mb-6 flex items-baseline gap-4", secNum: "font-serif text-3xl text-gold/30 font-bold",
    secName: "font-serif text-2xl text-gold-gradient sm:text-3xl font-medium",
    secTag: "text-[11px] uppercase tracking-[0.2em] text-warm-gray",
    secRule: "mt-3 h-px w-full bg-gradient-to-r from-gold/40 via-gold/15 to-transparent",
    grid: "grid gap-x-12 gap-y-1 md:grid-cols-2",
    root: "relative bg-[#070605] flex flex-col justify-between select-none",
    backdrop: "pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat opacity-95",
    shade: "pointer-events-none absolute inset-0 bg-gradient-to-b from-[#070605]/80 via-transparent to-[#070605]/90",
    head: "relative z-20 w-full px-5 py-3.5 flex items-center justify-between border-b border-gold/15 bg-noir/70 backdrop-blur-md",
    brand: "font-serif text-lg sm:text-xl font-bold tracking-wider text-gold-light",
    nav: "hidden sm:flex items-center gap-8 text-xs tracking-[0.2em] uppercase font-serif",
    navOn: "text-gold font-bold border-b-2 border-gold pb-1", navOff: "text-warm-gray hover:text-gold-light transition-colors",
    cart: "flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-gold/40 bg-gold/10 hover:bg-gold/20 text-gold-light transition-all text-xs tracking-wider uppercase font-serif",
    close: "p-1.5 rounded-full border border-white/10 text-warm-gray hover:text-white hover:border-gold/50 transition-colors",
    main: "relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-1 my-auto w-full mx-auto min-h-0",
    ring: "rounded-[50%] border border-gold/30 shadow-[0_0_20px_rgba(217,163,95,0.15)]",
    ring2: "absolute rounded-[50%] border border-gold/10 border-dashed",
    floaty: "relative flex items-center justify-center",
    shadow: "absolute bg-black/85 blur-lg rounded-[50%] transform scale-y-75",
    glow: "absolute bg-gold/20 blur-md rounded-[50%]",
    title: "font-serif text-2xl sm:text-3xl font-bold tracking-widest text-gold-light uppercase drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]",
    chip: "group relative flex flex-col items-center justify-center transition-all duration-200",
    halo: "absolute -inset-2 rounded-full border border-gold/70 shadow-[0_0_20px_rgba(217,163,95,0.8)] animate-pulse pointer-events-none",
    discOff: "rounded-full p-1.5 flex items-center justify-center transition-all duration-200 bg-[#18130d]/90 border border-gold/30 hover:border-gold/70 shadow-[0_4px_12px_rgba(0,0,0,0.7)]",
    discOn: "rounded-full p-1.5 flex items-center justify-center transition-all duration-200 bg-gradient-to-b from-[#3a2717] to-[#1a120b] border-2 border-gold shadow-[0_0_18px_rgba(217,163,95,0.7)]",
    labOff: "mt-1 text-[11px] font-serif font-semibold tracking-wide whitespace-nowrap transition-colors text-warm-cream group-hover:text-gold",
    labOn: "mt-1 text-[11px] font-serif font-semibold tracking-wide whitespace-nowrap transition-colors text-gold-light font-bold",
    cprice: "text-[10px] font-sans font-medium text-gold/90 -mt-0.5",
    step: "mt-1.5 sm:mt-2 w-full flex flex-col items-center",
    stepLab: "text-[10px] uppercase tracking-[0.25em] text-warm-gray mb-1 font-medium font-serif",
    chipRow: "flex items-center justify-center flex-wrap gap-1.5 px-2",
    dOff: "px-3 py-1 rounded-full text-xs font-serif transition-all duration-200 bg-[#18130d] border border-gold/25 text-warm-cream hover:border-gold/60 hover:text-white",
    dOn: "px-3 py-1 rounded-full text-xs font-serif transition-all duration-200 bg-gradient-to-r from-gold to-ember text-noir font-bold shadow-[0_0_12px_rgba(217,163,95,0.4)]",
    dPOff: "ml-1 text-[10px] font-sans text-gold", dPOn: "ml-1 text-[10px] font-sans text-noir/80",
    totalWrap: "mt-2", total: "font-serif text-2xl sm:text-3xl font-extrabold text-gold tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]",
    addWrap: "mt-2 w-full max-w-xs sm:max-w-sm px-2",
    add: "w-full py-3 px-6 rounded-full font-serif font-bold text-sm sm:text-base tracking-wider transition-all duration-300 flex items-center justify-center gap-2 shadow-[0_6px_22px_rgba(217,163,95,0.4)] bg-gradient-to-r from-gold-light via-gold to-ember text-noir hover:brightness-110 active:scale-98 hover:shadow-[0_8px_30px_rgba(217,163,95,0.6)]",
    addDone: "w-full py-3 px-6 rounded-full font-serif font-bold text-sm sm:text-base tracking-wider transition-all duration-300 flex items-center justify-center gap-2 shadow-[0_6px_22px_rgba(217,163,95,0.4)] bg-emerald-600 text-white scale-95"
  };

  /* ---- timeline, ms from cycle start; 16.8s demo + a still Hero beat ----- */
  var K_FLOOR = 0.84;       /* the composition is never squeezed below this */
  var TRAV_PX = 150;       /* travel budget: enough for the footer, never enough to
                             cut the top of the pizza out of the area */
  /* the explanatory journey runs at 1.25x: every beat and duration before
     the Senza Glutine moment is the old value x0.8, so the sequence, the
     visual states and the relative rhythm are unchanged, only quicker */
  var T = {
    cardIn: 336, cardDur: 496,
    cue: 1840, cueDur: 512, press: 2400, pressDur: 224,
    swapOut: 2680, swapIn: 2776, swapDur: 496, settle: 3320,
    crudo: 3760, crudoTap: 4256, crudoSel: 4432,
    rucola: 5320, rucolaTap: 5816, rucolaSel: 5992,
    porcini: 6840, porciniTap: 7336, porciniSel: 7512,
    dough: 8360, doughTap: 8856, doughSel: 9032,
    sg: 9760, sgTap: 10256, sgSel: 10432,
    travel: 13872, add: 14376, addTap: 14896, added: 15120,
    /* the Senza Glutine moment keeps its EXACT current rhythm — same 900ms
       dissolve-in, same 3900ms hold, same 620ms dissolve-out; only its
       start follows the quicker journey. After the image, a short natural
       breath (~0.25s) hands back to the Hero, and the loop restarts
       ~0.4s after the image is gone — no dead gap, no hard cut */
    moment: 15760, momentDur: 900, momentOut: 19660,
    out: 19740, outDur: 660, end: 20680
  };

  /* ---- tiny DOM helpers ------------------------------------------------- */
  function h(tag, cls, kids, attrs) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (attrs) for (var k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    if (kids) for (var i = 0; i < kids.length; i++) {
      var c = kids[i];
      if (c == null) continue;
      n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return n;
  }
  function svg(nodes, cls) {
    var NS = "http://www.w3.org/2000/svg";
    var s = document.createElementNS(NS, "svg");
    s.setAttribute("xmlns", NS); s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("fill", "none");
    s.setAttribute("stroke", "currentColor"); s.setAttribute("stroke-width", "2");
    s.setAttribute("stroke-linecap", "round"); s.setAttribute("stroke-linejoin", "round");
    if (cls) s.setAttribute("class", cls);
    for (var i = 0; i < nodes.length; i++) {
      var e = document.createElementNS(NS, nodes[i][0]);
      for (var k in nodes[i][1]) e.setAttribute(k, nodes[i][1][k]);
      s.appendChild(e);
    }
    return s;
  }
  var IC = {
    sparkles: [["path", { d: "M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" }], ["path", { d: "M20 3v4" }], ["path", { d: "M22 5h-4" }], ["path", { d: "M4 17v2" }], ["path", { d: "M5 18H3" }]],
    bag: [["path", { d: "M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" }], ["path", { d: "M3 6h18" }], ["path", { d: "M16 10a4 4 0 0 1-8 0" }]],
    check: [["path", { d: "M20 6 9 17l-5-5" }]],
    x: [["path", { d: "M18 6 6 18" }], ["path", { d: "m6 6 12 12" }]]
  };
  function euro(n) { return "€ " + n.toFixed(2).replace(".", ","); }
  function eu(n) { return n === 0 ? "—" : n.toFixed(2).replace(".", ",") + "€"; }

  /* commit the final keyframe, then drop the animation (no inherited fill) */
  function animate(el, frames, dur, ease, done) {
    if (!el) return;
    if (!el.animate) { commit(el, frames[frames.length - 1]); if (done) done(); return; }
    var a = el.animate(frames, { duration: dur, easing: ease || EASE, fill: "forwards" });
    a.finished.then(function () { commit(el, frames[frames.length - 1]); try { a.cancel(); } catch (e) {} if (done) done(); },
                    function () { if (done) done(); });
  }
  function commit(el, f) { for (var k in f) if (k !== "offset" && k !== "easing") el.style[k] = f[k]; }
  function op(el, v) { if (el) el.style.opacity = v; }

  /* ---- module state ----------------------------------------------------- */
  var hero, stage, menu, cust, cue, pill, chips = {}, doughs = {}, totalEl, addEl, sg, sgImg, miniLayers = [], pizzaImg,
      geo, timers = [], running = false, ready = false, cuePos = { x: 0, y: 0 }, scheduled = null, tries = 0;

  function reduced() { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } }
  function heroBase() {
    if (!hero) hero = document.getElementById("hero");
    if (!hero) return null;
    var imgs = hero.querySelectorAll("img");
    for (var i = 0; i < imgs.length; i++) {
      var s = imgs[i].currentSrc || imgs[i].src || "";
      if (BASE_RE.test(s)) return imgs[i];
    }
    return imgs.length && imgs[0].alt === "Margherita" ? imgs[0] : null;
  }
  /* the Hero's own visual column: the region the quick-pizza carousel occupies */
  function column() {
    var b = heroBase();
    if (!b) return null;
    return b.closest(".relative.w-full.max-w-sm") || b.parentElement;
  }
  function busy() { return !!document.querySelector(".lb-customizer, [role='dialog']"); }
  function onScreen() {
    if (document.hidden || !hero) return false;
    var vh = window.innerHeight || 0;
    /* the demonstration is only worth running while it can actually be seen */
    var r = (stage || column() || hero).getBoundingClientRect();
    var seen = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
    return seen >= Math.min(r.height, vh) * 0.72;
  }

  /* STATE A / STATE B-F: the old quick-pizza foreground is suppressed for the
     length of the journey and restored afterwards. Layout is untouched (the
     elements keep their boxes, so nothing reflows and the Hero comes back
     byte-identical); only their painting is turned off, so the journey is the
     sole foreground content of the visual area. */
  function takeover(on) {
    var col = column();
    if (!col) return;
    if (on) col.classList.add("lbhp-takesover"); else col.classList.remove("lbhp-takesover");
    /* the Hero's scroll hint bows out with the old foreground while the
       journey (incl. the Senza Glutine beat) owns the visual area */
    if (!hero) return;
    var hint = hero._lbhpHint;
    if (hint === undefined) {
      hint = null;
      var bs = hero.querySelectorAll("button");
      for (var i = 0; i < bs.length; i++) {
        if (/^Scorri/i.test((bs[i].textContent || "").trim())) { hint = bs[i]; break; }
      }
      hero._lbhpHint = hint;
    }
    if (hint) {
      hint.style.transition = "opacity .4s ease";
      hint.style.opacity = on ? "0" : "";
      hint.style.pointerEvents = on ? "none" : "";
    }
  }

  /* ---- geometry: all measured, nothing hardcoded to a device ------------ */
  function natH(el) {                 /* the element's own height, ignoring the fit scale */
    if (!el) return 0;
    var t = el.style.transform;
    el.style.transform = "none";
    var v = Math.max(el.offsetHeight || 0, el.scrollHeight || 0);
    el.style.transform = t;
    return v;
  }
  function natW(el) {
    if (!el) return 0;
    var t = el.style.transform;
    el.style.transform = "none";
    var v = Math.max(el.offsetWidth || 0, el.scrollWidth || 0);
    el.style.transform = t;
    return v;
  }
  function measure() {
    if (stage) { menu && (menu._nat = null); cust && (cust._nat = null); }
    var col = column();
    var cr = col ? col.getBoundingClientRect() : hero.getBoundingClientRect();
    var hr = hero.getBoundingClientRect();
    var w = Math.round(Math.max(260, Math.min(420, cr.width))), h0 = Math.round(cr.height);
    if (geo && Math.abs(w - geo._w) < 6 && Math.abs(h0 - geo._h) < 8) { w = geo._w; h0 = geo._h; }
    /* the height the tallest scene actually needs, read from its own
       untransformed box: the composition sizes the area, not the other way */
    var need = stage ? Math.max(natH(stage.querySelector(".lbhp-menu-inner")),
                                natH(stage.querySelector(".lbhp-cust-inner"))) + 14 : 570;
    need = Math.round(need);
    /* the area may borrow the Hero's empty space above and below the column,
       bounded by the fixed header, the Hero's edge and any Hero copy that sits
       above it — so the scene keeps its real size without touching anything */
    var hdr = document.querySelector("header");
    var ceil = Math.max(hr.top + 10, hdr ? hdr.getBoundingClientRect().bottom + 14 : hr.top + 10);
    var cand = hero.querySelectorAll("h1, h2, p, a, button, span");
    for (var q = 0; q < cand.length; q++) {
      var e = cand[q];
      if (e.closest(".lbhp-stage") || (col && col.contains(e))) continue;
      var b = e.getBoundingClientRect();
      if (!b.width || b.bottom > cr.top + 2) continue;
      if (b.left > cr.right - 4 || b.right < cr.left + 4) continue;
      ceil = Math.max(ceil, b.bottom + 12);
    }
    /* the same rule downward: the Hero's own scroll hint and any element that
       starts below the column bounds the area, so nothing ever overlaps it */
    var flr = hr.bottom - 16;
    for (var z = 0; z < cand.length; z++) {
      var e2 = cand[z];
      if (e2.closest(".lbhp-stage") || (col && col.contains(e2))) continue;
      var b2 = e2.getBoundingClientRect();
      if (!b2.width || b2.top < cr.bottom - 2) continue;
      if (b2.left > cr.right - 4 || b2.right < cr.left + 4) continue;
      flr = Math.min(flr, b2.top - 12);
    }
    var up = Math.max(0, Math.round(cr.top - ceil));
    var down = Math.max(0, Math.round(flr - cr.bottom));
    /* borrow the empty space evenly above and below, so the composition stays
       centred on the region the quick pizza occupied */
    var grow = Math.max(0, Math.min(need - cr.height, up + down));
    var u = Math.round(Math.min(up, grow / 2));
    var d = Math.round(Math.min(down, grow - u));
    u = Math.round(Math.min(up, grow - d));
    var h = Math.round(cr.height + u + d);
    /* the site's own responsive rule for the panel, applied to the space we
       actually have (the real sheet uses the narrow composition below 700px) */
    var wide = w >= 470 && h >= 560;
    var nar = window.matchMedia && window.matchMedia("(max-width:700px)").matches;
    var ow = wide ? 620 : w - 12;
    /* on a phone the wheel is a touch tighter so the whole explanatory
       scene — orbit, title, dough, total and Add-to-Cart — fits the
       measured area without clipping or ever travelling into the
       statistics; the desktop composition keeps its size */
    var r = Math.max(70, Math.min(nar ? 104 : 120, ow / 2 - 30));
    var oh = wide ? 330 : (nar ? 2 * r + 56 : 2 * r + 76);
    var pz = wide ? 1 : 0.5;
    return { w: w, h: h, up: u, down: d, need: need, _w: w, _h: h0, wide: wide, ow: ow, oh: oh, r: r, pz: pz,
             chip: wide ? 58 : 50, cimg: wide ? 42 : 36, _ceil: Math.round(ceil),
             pw: Math.round(270 * pz), ph: Math.round(175 * pz), scroll: 0 };
  }

  /* ---- scene 1: a real slice of the menu -------------------------------- */
  function buildMenu() {
    var head = h("div", C.secHead, [
      h("span", C.secNum, [SECTION.numeral]),
      h("div", "min-w-0 flex-1", [
        h("div", "flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1", [
          h("h3", C.secName, [SECTION.name]),
          h("span", C.secTag, [SECTION.tagline])]),
        h("div", C.secRule)])]);
    var rows = h("div", "space-y-1");
    pill = null;
    ROWS.forEach(function (rw) {
      var thumb = h("img", C.thumb, null, { src: rw.image, alt: rw.name, decoding: "async", draggable: "false" });
      thumb.addEventListener("error", function () { thumb.style.display = "none"; });
      var tail = [h("span", C.price, [euro(rw.price)])];
      if (rw.target) {
        pill = h("span", C.pill + " lbhp-pill", [svg(IC.sparkles, "w-3.5 h-3.5"), h("span", null, ["PERSONALIZZA"])]);
        tail.push(pill);
      }
      rows.appendChild(h("div", C.row + (rw.target ? " lbhp-row-target" : " lbhp-extra"), [
        h("div", C.rowL, [thumb, h("div", "min-w-0 flex-1", [
          h("div", "flex items-center gap-2", [h("p", C.name, [rw.name])]),
          h("p", C.ing, [rw.ingredients])])]),
        h("div", "flex items-center gap-3 shrink-0", tail)]));
    });
    return h("div", "lbhp-scene lbhp-menu", [h("div", "lbhp-menu-inner", [head, rows])]);
  }

  /* ---- scene 2: the real customization panel ---------------------------- */
  function buildCust() {
    var g = geo, i;
    chips = {}; doughs = {}; miniLayers = [];

    /* the orbit: the two real rings, the persistent pizza, the eight chips */
    var pizza = h("div", C.floaty, null);
    pizza.className = "lbhp-pizza " + C.floaty;
    pizza.style.width = g.pw + "px"; pizza.style.height = g.ph + "px";
    pizzaImg = h("img", null, null, { src: BASE_IMG, alt: "Margherita", decoding: "async", draggable: "false" });
    pizzaImg.style.cssText = "display:block;width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 10px 20px rgba(0,0,0,.85))";
    pizza.appendChild(pizzaImg);
    for (i = 0; i < LAYERS.length; i++) {
      var l = h("img", "lbhp-layer", null, { src: DIR + LAYERS[i], alt: "", "aria-hidden": "true", decoding: "async", draggable: "false" });
      pizza.appendChild(l); miniLayers.push(l);
    }
    var sh = h("div", C.shadow); sh.style.cssText = "width:" + Math.round(g.pw * 0.88) + "px;height:" + Math.round(g.pw * 0.1) + "px;bottom:-" + Math.round(g.pw * 0.02) + "px;left:50%;margin-left:-" + Math.round(g.pw * 0.44) + "px";
    var gl = h("div", C.glow); gl.style.cssText = "width:" + Math.round(g.pw * 0.66) + "px;height:" + Math.round(g.pw * 0.08) + "px;bottom:-" + Math.round(g.pw * 0.01) + "px;left:50%;margin-left:-" + Math.round(g.pw * 0.33) + "px";
    pizza.appendChild(sh); pizza.appendChild(gl);

    var ringA = Math.round(g.ow * 0.84), ringB = Math.round(g.wide ? g.oh * 0.76 : g.ow * 0.62);
    var r1 = h("div", C.ring); r1.style.width = ringA + "px"; r1.style.height = ringB + "px";
    var r2 = h("div", C.ring2); r2.style.width = (ringA + 14) + "px"; r2.style.height = (ringB + 14) + "px";
    var orbit = h("div", "lbhp-orbit", [h("div", "lbhp-rings", [r1, r2]), pizza]);
    orbit.style.width = g.ow + "px"; orbit.style.height = g.oh + "px";

    for (i = 0; i < CHIPS.length; i++) {
      var c = CHIPS[i], cx, cy;
      if (g.wide) { cx = c.x; cy = c.y; }
      else {
        var P = [[0, -1], [0.707, -0.707], [1, 0], [0.707, 0.707], [0, 1], [-0.707, 0.707], [-1, 0], [-0.707, -0.707]][i];
        cx = Math.round(P[0] * g.r); cy = Math.round(P[1] * g.r);
      }
      var im = h("img", null, null, { src: c.image, alt: c.name, decoding: "async", draggable: "false" });
      im.style.cssText = "width:" + g.cimg + "px;height:" + g.cimg + "px;object-fit:contain;border-radius:9999px";
      im.addEventListener("error", function (e) { e.target.style.visibility = "hidden"; });
      var disc = h("div", C.discOff, [im]);
      disc.style.width = g.chip + "px"; disc.style.height = g.chip + "px";
      var halo = h("div", "lbhp-halo");
      var lab = h("span", C.labOff, [c.name]);
      var wrap = h("div", "lbhp-chipbox", [halo, disc, lab, h("span", C.cprice, [c.dp])]);
      var el = h("div", C.chip + " lbhp-chip", [wrap]);
      var tx = cx - g.chip / 2 - 2, ty = cy - g.chip / 2 - 8;
      el.style.transform = "translate(" + tx + "px," + ty + "px)";
      orbit.appendChild(el);
      chips[c.id] = { el: el, box: wrap, disc: disc, halo: halo, lab: lab, tx: tx, ty: ty, data: c };
    }

    var drow = h("div", C.chipRow);
    for (i = 0; i < DOUGHS.length; i++) {
      var d = DOUGHS[i], on = d.id === "classico";
      var kids = [h("span", null, [d.name])];
      if (d.price > 0) kids.push(h("span", on ? C.dPOn : C.dPOff, ["+" + eu(d.price)]));
      var b = h("span", on ? C.dOn : C.dOff, kids);
      doughs[d.id] = { el: b, data: d }; drow.appendChild(b);
    }
    var impasto = h("div", C.step, [h("p", C.stepLab, ["Impasto choice"]), drow]);

    totalEl = h("span", C.total + " lbhp-total", ["5,00€"]);
    addEl = h("span", C.add + " lbhp-add", [h("span", null, ["Aggiungi al Carrello"]), svg(IC.bag, "w-4 h-4")]);

    return h("div", "lbhp-scene lbhp-cust", [
      h("div", "lbhp-cust-inner", [h("main", C.main, [
        orbit, h("h2", C.title, ["\u2018", "Margherita", "\u2019"]), impasto,
        h("div", C.totalWrap, [totalEl]), h("div", C.addWrap, [addEl])])])]);
  }

  function build() {
    var col = column();
    if (!hero || !heroBase() || !col) return false;
    col.classList.add("lbhp-dedicated");   /* the old quick-pizza Hero is retired */
    geo = measure();
    stage = h("div", "lbhp-stage", null, { "aria-hidden": "true" });
    menu = buildMenu(); cust = buildCust(); cue = h("div", "lbhp-cue");
    /* the Senza Glutine moment is a scene of the SAME explanatory stage —
       same slot, same anchor, same alignment as the Menu Card and the
       Customizer; the scenes simply replace each other */
    sg = h("div", "lbhp-scene lbhp-sg", null, { "aria-hidden": "true" });
    sg.appendChild(h("div", "lbhp-sg-veil"));
    sgImg = h("img", "lbhp-sg-img", null, { src: "/assets/senza-glutine-base.png?v=20260918", alt: "", decoding: "async", draggable: "false" });
    sg.appendChild(sgImg);
    stage.appendChild(menu); stage.appendChild(cust); stage.appendChild(sg); stage.appendChild(cue);
    col.appendChild(stage);
    return true;
  }
  function place() {
    var col = column();
    if (!stage || !col) return;
    if (stage.parentNode !== col) col.appendChild(stage);
    stage.style.top = geo.up ? "-" + geo.up + "px" : "";
    stage.style.bottom = geo.down ? "-" + geo.down + "px" : "";
  }

  /* what the area still cannot hold travels inside it — the same controlled
     vertical scroll the real panel uses on a phone — instead of being crushed */
  function travel(y, dur) {
    var inner = cust && cust.querySelector(".lbhp-cust-inner");
    if (!inner) return;
    var k = +(cust.dataset.k || 1);
    var pre = k < 0.999 ? "scale(" + k.toFixed(3) + ") " : "";
    var from = "translateY(" + (parseInt(inner.dataset.y, 10) || 0) + "px)";
    var to = "translateY(" + y + "px)";
    inner.dataset.y = y;
    animate(inner, [{ transform: pre + from }, { transform: pre + to }], dur || 520);
  }

  /* the line the scene may never cross upward: the bottom of the Hero
     statistics row, read live from the DOM */
  function statsLine() {
    var st = hero && hero.querySelector(".hero-stat");
    if (!st || !st.parentElement) return geo ? (geo._ceil || 0) : 0;
    return Math.round(st.parentElement.getBoundingClientRect().bottom) + 12;
  }

  /* the travel is decided at the beat, from the boxes on screen right now:
     only what pokes below the area slides in, and the wheel's top may come
     down to the statistics line but never rise above it */
  function travelNeed(dur) {
    var inner = cust && cust.querySelector(".lbhp-cust-inner");
    if (!inner || !stage) return;
    var yNow = parseInt(inner.dataset.y, 10) || 0;
    var ir = inner.getBoundingClientRect(), sr = stage.getBoundingClientRect();
    var over = Math.ceil(ir.bottom - yNow - sr.bottom + 6);
   if (over <= 4) return;
    var topEl = cust.querySelector(".lbhp-orbit") || cust.querySelector(".lbhp-pizza");
    var head = topEl ? Math.max(0, Math.floor(topEl.getBoundingClientRect().top - yNow - statsLine())) : 0;
    var need = Math.min(over, head);
   if (need > 4) travel(-need, dur || 520);
  }

  /* fit each scene into the available Hero area by measuring, never by device */
  function fit(force) {
    geo.scroll = 0;
    /* on phones the whole explanatory composition is eased down a touch so the
       scene breathes inside the visible Hero area; desktop keeps its size */
    var NAR = window.matchMedia && window.matchMedia("(max-width:700px)").matches;
    [menu, cust].forEach(function (sc) {
      if (!sc) return;
      var inner = sc === cust ? sc.querySelector(".lbhp-cust-inner") : sc.firstChild;
      if (!inner) return;
      var cache = sc._nat;
      if (force || !cache) { cache = sc._nat = { h: natH(inner), w: natW(inner) }; }
      var yWas = sc === cust ? (parseInt(inner.dataset.y, 10) || 0) : 0;
      inner.dataset.y = "0";
      /* one uniform factor for the whole scene. It is chosen from the boxes the
         browser actually lays out (so the centring of a scaled box counts), and
         it is reduced only until the scene fits; if even the floor of the floor
         would take the type below the site's own size, the leftover slides
         inside the area instead — capped so the top of the pizza stays in. */
      var k = Math.min(1, (geo.w - 8) / (cache.w || 1));
      if (NAR) k = Math.min(k, 1) * 0.9;
      for (var pass = 0; pass < 3; pass++) {
        inner.style.transform = "scale(" + k.toFixed(3) + ")";
        var rr = inner.getBoundingClientRect(), sr = sc.getBoundingClientRect();
        var over = Math.ceil(rr.bottom - sr.bottom + 6);
        if (over <= 0) break;
        var allow = 0;
        if (sc === cust) {
          var pz = sc.querySelector(".lbhp-pizza");
          if (pz) allow = Math.max(0, Math.ceil(pz.getBoundingClientRect().top - sr.top - 6));
          allow = Math.min(allow, TRAV_PX);
        }
        var cut = Math.max(0, over - allow);
        var kn = cut > 0 ? k * (rr.height - cut) / rr.height : k;
        if (kn < K_FLOOR) kn = K_FLOOR;
        if (Math.abs(kn - k) < 0.002) { k = kn; break; }
        k = kn;
      }
      var rr2 = inner.getBoundingClientRect(), sr2 = sc.getBoundingClientRect();
      var over2 = Math.ceil(rr2.bottom - sr2.bottom + 6);
      if (sc === cust && over2 > 4) {
        /* the inward slide is capped at the headroom above the scene: the
           pizza never travels up into the Hero statistics, only the part
           that was already below the line moves inside the area */
        /* the top of the wheel — the highest content of the scene — may
           only come down to the statistics line, never above it */
        var topEl = sc.querySelector(".lbhp-orbit") || sc.querySelector(".lbhp-pizza");
        var head = topEl ? Math.max(0, Math.floor(topEl.getBoundingClientRect().top - statsLine())) : 0;
        geo.scroll = Math.min(over2, head);
      }
      inner.dataset.k = k.toFixed(3); sc.dataset.k = k.toFixed(3);
      inner.dataset.y = yWas;
      inner.style.transform = ((yWas ? "translateY(" + yWas + "px) " : "") +
        (k < 0.999 ? "scale(" + k.toFixed(3) + ")" : "none"));
    });
  }
  function kOf(sc) { return parseFloat(sc && sc.dataset.k ? sc.dataset.k : 1) || 1; }

  /* ---- the cue: a soft gold tap indicator -------------------------------- */
  function cueTo(target, dur, after) {
    if (!cue || !target || !stage) { if (after) after(); return; }
    var b = target.getBoundingClientRect(), sb = stage.getBoundingClientRect();
    if (!b.width) { if (after) after(); return; }
    var k = parseFloat(cue.parentNode === stage ? (target.closest(".lbhp-scene") || {}).dataset ? (target.closest(".lbhp-scene").dataset.k || 1) : 1 : 1) || 1;
    void k;                                   /* positions are measured after transform, so no correction needed */
    var nx = b.left + b.width / 2 - sb.left, ny = b.top + b.height / 2 - sb.top;
    var from = "translate(" + cuePos.x.toFixed(1) + "px," + cuePos.y.toFixed(1) + "px)";
    var to = "translate(" + nx.toFixed(1) + "px," + ny.toFixed(1) + "px)";
    cue.style.opacity = "1";
    animate(cue, [{ transform: from }, { transform: to }], dur, TRAVEL);
    cuePos = { x: nx, y: ny };
    cue.style.transform = to;
    if (after) timers.push(setTimeout(after, dur));
  }
  function tap() {
    if (!cue) return;
    cue.classList.remove("lbhp-tap"); void cue.offsetWidth; cue.classList.add("lbhp-tap");
    timers.push(setTimeout(function () { cue.classList.remove("lbhp-tap"); }, 460));
  }

  /* ---- state appliers: only the site's own classes are swapped ---------- */
  function setChip(id, on) {
    var c = chips[id]; if (!c) return;
    c.disc.className = on ? C.discOn : C.discOff;
    c.disc.style.width = geo.chip + "px"; c.disc.style.height = geo.chip + "px";
    c.halo.className = on ? "lbhp-halo " + C.halo : "lbhp-halo";
    c.lab.className = on ? C.labOn : C.labOff;
    c.el.style.transform = "translate(" + c.tx + "px," + c.ty + "px)" + (on ? " scale(1.05)" : "");
    c.el.style.zIndex = on ? "3" : "";
  }
  function setDough(id) {
    for (var k in doughs) {
      var d = doughs[k], on = k === id;
      d.el.className = on ? C.dOn : C.dOff;
      var p = d.el.children[1];
      if (p && d.data.price > 0) p.className = on ? C.dPOn : C.dPOff;
    }
  }
  function setAdd(on) {
    if (!addEl) return;
    addEl.className = (on ? C.addDone : C.add) + " lbhp-add" + (on ? " lbhp-added" : "");
    var keep = on ? null : null;
    var kids = on ? [svg(IC.check, "w-5 h-5"), h("span", null, ["Aggiunto al Carrello!"])]
                  : [h("span", null, ["Aggiungi al Carrello"]), svg(IC.bag, "w-4 h-4")];
    while (addEl.firstChild) addEl.removeChild(addEl.firstChild);
    for (var q = 0; q < kids.length; q++) addEl.appendChild(kids[q]);
    if (cust) cust._nat = null; fit(true);
  }
  function showLayer(i, dur) {
    var l = miniLayers[i]; if (!l) return;
    animate(l, [{ opacity: 0 }, { opacity: 1 }], dur || 460);
    l.style.opacity = "1";
  }
  function setTotal(v) {
    if (!totalEl) return;
    animate(totalEl, [{ transform: "none" }, { transform: "scale(1.07)" }, { transform: "none" }], 340);
    totalEl.textContent = eu(v);
  }

  /* ---- choreography ----------------------------------------------------- */
  function at(ms, fn) { timers.push(setTimeout(function () { if (running) fn(); }, ms)); }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  function reset() {
    [menu, cust, cue].forEach(function (e) { op(e, 0); });
    miniLayers.forEach(function (l) { l.style.opacity = "0"; });
    for (var k in chips) setChip(k, false);
    setDough("classico"); setAdd(false);
    if (pill) pill.classList.remove("lbhp-press");
    if (cue) { cue.classList.remove("lbhp-tap"); cue.style.transform = "translate(0,0)"; }
    cuePos = { x: -40, y: -40 };
    if (cue) { cue.style.left = "0px"; cue.style.top = "0px"; }
    setTotal(5);
    resetSg();
    fit();
  }

  function resetSg() {
    if (sg) op(sg, 0);
    if (sgImg) { sgImg.style.opacity = "0"; sgImg.style.transform = ""; }
  }

  function cycle() {
    if (!running) return;
    clearTimers();
    if (!heroBase()) { stop(); schedule(1500); return; }
    geo = measure(); place(); reset();
    stage.style.opacity = ""; stage.style.transform = "";
    stage.classList.add("lbhp-on");
    takeover(true);                                   /* the old foreground bows out */

    /* 01-03 — a real pizza card in the menu, its control clearly visible */
    at(T.cardIn, function () {
      fit(true);
      var k = kOf(menu), inner = menu.firstChild;
      animate(menu, [{ opacity: 0 }, { opacity: 1 }], T.cardDur);
      animate(inner, [{ transform: "translateY(16px) scale(" + (k * 0.99).toFixed(3) + ")" },
                      { transform: "translateY(0) scale(" + k.toFixed(3) + ")" }], T.cardDur);
      op(menu, 1);
    });
    /* 04 — the cue arrives and presses that control */
    at(T.cue, function () { cueTo(pill, T.cueDur, tap); });
    at(T.press, function () { if (pill) pill.classList.add("lbhp-press"); });
    at(T.press + T.pressDur, function () { if (pill) pill.classList.remove("lbhp-press"); });
    /* 05 — the panel opens: the card recedes as the orbit expands into place */
    at(T.swapOut, function () {
      animate(menu, [{ opacity: 1 }, { opacity: 0 }], 460);
      animate(menu.firstChild, [{ transform: "scale(" + kOf(menu).toFixed(3) + ")" },
                                 { transform: "scale(" + (kOf(menu) * 0.965).toFixed(3) + ")" }], 460);
      op(menu, 0); op(cue, 0);
    });
    at(T.swapIn, function () {
      fit(true);
      var k = kOf(cust), inner = cust.querySelector(".lbhp-cust-inner");
      animate(cust, [{ opacity: 0 }, { opacity: 1 }], T.swapDur);
      animate(inner, [{ transform: "scale(" + (k * 0.9).toFixed(3) + ")" }, { transform: "scale(" + k.toFixed(3) + ")" }], T.swapDur);
      animate(stage, [{ transform: "scale(.985)" }, { transform: "scale(1)" }], T.swapDur);
      op(cust, 1);
      stage.style.transform = "scale(1)";
    });
    at(T.settle, function () {
      animate(cue, [{ opacity: 0 }, { opacity: 1 }], 260);
      cue.style.opacity = "1";
      cue.style.transform = "translate(" + (geo.w / 2).toFixed(0) + "px," + (geo.h - 12) + "px)";
      cuePos = { x: geo.w / 2, y: geo.h - 12 };
    });
    /* 06-09 — real ingredients chosen one by one; the pizza accumulates them */
    [["crudo", T.crudo, T.crudoSel, 6], ["rucola", T.rucola, T.rucolaSel, 7],
     ["porcini", T.porcini, T.porciniSel, 8]].forEach(function (st) {
      at(st[1], function () { var c = chips[st[0]]; if (c) cueTo(c.box, 520, tap); });
      at(st[2], function () {
        var c = chips[st[0]]; if (!c) return;
        setChip(st[0], true);
        if (c.data.layer != null) showLayer(c.data.layer, 470);
        setTotal(st[3]);
      });
    });
    /* 10 — Impasto: the real UI state and its price response, no invented photo */
    at(T.dough, function () { var d = doughs.integrale; if (d) cueTo(d.el, 520, tap); });
    at(T.doughSel, function () { setDough("integrale"); setTotal(9); });
    /* 10b — Senza Glutine: the real selection, plus the information beat */
    at(T.sg, function () { var d = doughs["senza-glutine"]; if (d) cueTo(d.el, 520, tap); });
    at(T.sgSel, function () {
      setDough("senza-glutine"); setTotal(11);
      /* on a phone the beat travels into view with the same controlled slide
         the journey already uses for the footer */
      travelNeed(620);
    });
    /* 10c — the journey continues into the Senza Glutine visual moment:
       the Hero bows out behind a noir veil while the supplied visual
       dissolves in, holds, then hands back to the normal page flow */
    at(T.moment, function () {
      if (!sg) return;
      /* the explanatory customizer finishes and the Senza Glutine scene
         takes over THE SAME STAGE SLOT — the stage geometry, not the
         viewport, positions it on both desktop and mobile */
      animate(cust, [{ opacity: 1 }, { opacity: 0 }], T.momentDur);
      animate(cue, [{ opacity: +cue.style.opacity || 1 }, { opacity: 0 }], 260);
      animate(sg, [{ opacity: 0 }, { opacity: 1 }], T.momentDur);
      op(sg, 1);
      animate(sgImg, [{ opacity: 0, transform: "scale(.96)" }, { opacity: 1, transform: "scale(1)" }], T.momentDur);
    });
    at(T.momentOut, function () {
      if (!sg) return;
      animate(sg, [{ opacity: 1 }, { opacity: 0 }], 620);
      animate(sgImg, [{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(1.015)" }], 620);
      op(sg, 0);
    });
    /* 11-12 — Aggiungi al Carrello, then the real confirmation state. On a
       phone the footer sits below the area, so the scene slides up to show it,
       exactly as the real panel scrolls; on desktop there is nothing to do. */
    at(T.travel, function () { travelNeed(520); });
    at(T.add, function () { if (addEl) cueTo(addEl, 560, tap); });
    at(T.added, function () { setAdd(true); showLayer(3, 520); });
    /* STATE F: the scene leaves first, the untouched Hero foreground returns a
       beat later — the two foregrounds are never painted at the same time */
    at(T.out, function () {
      /* the customizer already handed over to the artwork at T.moment */
      animate(cue, [{ opacity: +cue.style.opacity || 0 }, { opacity: 0 }], 260);
      op(cust, 0); op(cue, 0);
    });
    at(T.out + T.outDur + 130, function () {
      takeover(false);
      stage.classList.remove("lbhp-on");
      var inner = cust && cust.querySelector(".lbhp-cust-inner");
      if (inner) { inner.dataset.y = "0"; inner.style.transform = ""; }
      stage.style.transform = ""; reset();
    });
    at(T.end, cycle);
  }

  /* ---- lifecycle -------------------------------------------------------- */
  function preloadThen(cb) {
    var need = [BASE_IMG, "/builder-backdrop-reference.jpg", "/assets/senza-glutine-base.png?v=20260917"];
    ROWS.forEach(function (r) { need.push(r.image); });
    CHIPS.forEach(function (c) { need.push(c.image); });
    LAYERS.forEach(function (f) { need.push(DIR + f); });
    var n = need.length, done = 0, gone = false;
    need.forEach(function (u) {
      var im = new Image();
      var fin = function () { if (!gone && ++done === n) { gone = true; cb(); } };
      im.onload = fin; im.onerror = fin; im.src = u;
    });
    setTimeout(function () { if (!gone) { gone = true; cb(); } }, 2800);
  }
  function start() {
    if (running || !ready || reduced() || !stage) return;
    if (!heroBase() || !onScreen() || busy()) { schedule(700); return; }
    running = true; cycle();
  }
  function stop() {
    running = false; clearTimers(); takeover(false); resetSg();
    if (!stage) return;
    [menu, cust].forEach(function (sc) {
      if (sc && +getComputedStyle(sc).opacity > 0.02) animate(sc, [{ opacity: +getComputedStyle(sc).opacity }, { opacity: 0 }], 300, "linear");
    });
    op(menu, 0); op(cust, 0);
    stage.classList.remove("lbhp-on");
  }
  function schedule(ms) {
    if (scheduled) return;
    scheduled = setTimeout(function () { scheduled = null; start(); }, ms);
  }
  function relayout() {
    if (!stage) return;
    var g = measure();
    if (Math.abs(g.w - geo.w) > 8 || Math.abs(g.h - geo.h) > 14) {
      var was = running; stop();
      geo = g; fit(true);
      if (Math.abs(g.ow - (geo._ow || g.ow)) > 30 || g.wide !== geo.wide) {
        if (stage.parentNode) stage.parentNode.removeChild(stage); stage = null;
        if (build()) { ready = true; if (was) start(); }
      } else if (was) start();
    } else fit(true);
    geo._ow = g.ow;
  }
  function boot() {
    if (stage || reduced() || tries++ > 240) return;
    hero = document.getElementById("hero");
    if (!hero || !heroBase()) { setTimeout(boot, 70); return; }
    if (!build()) { setTimeout(boot, 70); return; }
    preloadThen(function () { ready = true; start(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(boot, 40); });
  else boot();

  document.addEventListener("visibilitychange", function () { if (document.hidden) stop(); else schedule(600); });
  var sc;
  window.addEventListener("scroll", function () {
    if (running && (!onScreen() || busy())) stop();
    else if (!running && ready) schedule(500);
    clearTimeout(sc);
    sc = setTimeout(function () { try { relayout(); } catch (e) {} }, 180);
  }, { passive: true });
  var rz;
  window.addEventListener("resize", function () { clearTimeout(rz); rz = setTimeout(relayout, 200); }, { passive: true });
  try {
    var mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    var onMQ = function () { if (mq.matches) { stop(); if (stage && stage.parentNode) stage.parentNode.removeChild(stage); stage = null; } else if (!stage) { ready = false; tries = 0; boot(); } else schedule(400); };
    if (mq.addEventListener) mq.addEventListener("change", onMQ); else if (mq.addListener) mq.addListener(onMQ);
  } catch (e) {}
  try {
    var seen = 0;
    new MutationObserver(function () {
      var now = Date.now();
      if (now - seen < 180) return;
      seen = now;
      if (busy()) { if (running) stop(); return; }
      if (ready && stage) place();
      if (!running && ready && !reduced()) schedule(700);
    }).observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) {}
})();
