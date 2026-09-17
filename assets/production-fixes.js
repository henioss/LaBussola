/**
 * La Bussola Italia — Production Fixes Overlay
 * Source: FINAL_AUDIT_REPORT.md (2026-08-19 forensic audit)
 *
 *  P2-01  Single WhatsApp submission (click lock + wa.me open throttle)
 *  P2-02  Accessible names (aria-label) for icon-only buttons
 *  P3-01  Hero carousel dots: visible width + labels (backstop — .w-2 also restored in CSS)
 *  P3-04  ESC closes cart / customizer (the customizer already ships a
 *          title="Chiudi" button — the audit missed it; no duplicate added)
 *
 * Loaded BEFORE order-availability-v2.js so that engine's window.open
 * wrapper sits on top of ours (validation first, throttle last).
 * Purely additive: no React internals touched, no business logic changed.
 */
(function () {
  "use strict";

  /* ═══════════════════════════════════════════════════════════
   * P2-01a + CART-PRESERVATION — SUBMIT GUARD (capture phase)
   * 1) If the order WOULD be blocked by the availability engine
   *    (closed + immediate, or future mode without date/time),
   *    the click is stopped BEFORE React runs. This keeps the form
   *    and the cart intact — previously React closed the form and
   *    emptied the cart even when window.open() was blocked
   *    (pre-existing bug found while re-testing this fix).
   * 2) Valid first click → accepted; further clicks within 1.5 s
   *    → ignored (duplicate-order lock).
   * The wording matches order-availability-v2.js exactly.
   * ═══════════════════════════════════════════════════════════ */
  var CLICK_LOCK_MS = 1500;
  var lastSubmitAt = 0;
  var lastAlertAt = 0;

  document.addEventListener("click", function (e) {
    try {
      var btn = e.target && e.target.closest ? e.target.closest("button") : null;
      if (!btn) return;
      var t = (btn.textContent || "").trim();
      if (!/INVIA CON WHATSAPP/i.test(t)) return;

      var oa = window.__oa;
      if (oa) {
        var blockedMsg = null;
        if (!oa.isOpen && oa.timingMode === "immediate") {
          blockedMsg =
            "Il locale \u00e8 attualmente chiuso.\n\n" +
            "Gli ordini immediati non sono disponibili.\n" +
            "Seleziona un orario futuro per procedere con l'ordine.";
        } else if (oa.timingMode === "future" && (!oa.futureDate || !oa.futureTime)) {
          blockedMsg = (!oa.isOpen ? "Il locale \u00e8 chiuso.\n\n" : "Ordine non valido:\n\n") +
                       "Seleziona data e orario.";
        }
        if (blockedMsg) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          var a = Date.now();
          if (a - lastAlertAt > 800) { lastAlertAt = a; alert(blockedMsg); }
          return;
        }
      }

      var now = Date.now();
      if (now - lastSubmitAt < CLICK_LOCK_MS) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }
      lastSubmitAt = now;
    } catch (err) { /* never break the page */ }
  }, true);

  /* ═══════════════════════════════════════════════════════════
   * P2-01b — wa.me OPEN THROTTLE (backstop for keyboard/Enter paths)
   * Identical wa.me URL opened twice within 3 s → second open suppressed.
   * ═══════════════════════════════════════════════════════════ */
  var NATIVE_OPEN = window.open.bind(window);
  var lastWaAt = 0;
  var lastWaUrl = "";

  window.open = function (url) {
    try {
      if (typeof url === "string" && url.indexOf("wa.me/") !== -1) {
        var now = Date.now();
        if (url === lastWaUrl && now - lastWaAt < 3000) {
          return null; // duplicate submission — ignore
        }
        lastWaAt = now;
        lastWaUrl = url;
      }
    } catch (err) { /* fall through */ }
    return NATIVE_OPEN.apply(window, arguments);
  };

  /* ═══════════════════════════════════════════════════════════
   * Helpers
   * ═══════════════════════════════════════════════════════════ */
  function qsa(sel, root) {
    try { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
    catch (e) { return []; }
  }
  function visible(el) { return !!el && el.offsetParent !== null; }

  function closeCustomizer() {
    var cz = document.querySelector(".lb-customizer");
    if (!cz) return false;
    /* the customizer ships its own close button (title="Chiudi") */
    var x = cz.querySelector('button[title="Chiudi"]') ||
            qsa("button", cz).filter(function (b) { return b.getAttribute("aria-label") === "Chiudi"; })[0];
    if (x) { x.click(); return true; }
    var menu = qsa("button", cz).filter(function (b) {
      return (b.textContent || "").trim() === "Menu";
    })[0];
    if (menu) { menu.click(); return true; }
    return false;
  }
  function closeCart() {
    var x = qsa('button[aria-label="Chiudi"]').filter(visible)[0];
    if (x) { x.click(); return true; }
    return false;
  }

  /* ═══════════════════════════════════════════════════════════
   * P3-04a — ESC closes overlays (customizer first, then cart)
   * ═══════════════════════════════════════════════════════════ */
  document.addEventListener("keydown", function (e) {
    try {
      if (e.key !== "Escape") return;
      if (document.querySelector(".lb-customizer")) {
        if (closeCustomizer()) { e.preventDefault(); }
        return;
      }
      if (closeCart()) { e.preventDefault(); }
    } catch (err) { /* never break the page */ }
  });

  /* ═══════════════════════════════════════════════════════════
   * P2-02 — Accessible names for icon-only buttons
   * ═══════════════════════════════════════════════════════════ */
  var ICON_LABELS = {
    "lucide-sparkles": "Personalizza",
    "lucide-plus": "Aggiungi al carrello",
    "lucide-minus": "Diminuisci quantità",
    "lucide-x": "Chiudi",
    "lucide-trash-2": "Rimuovi",
    "lucide-instagram": "Instagram",
    "lucide-facebook": "Facebook",
    "lucide-phone": "Chiama la pizzeria",
    "lucide-map-pin": "Indirizzo",
    "lucide-map": "Mappa",
    "lucide-clock": "Orari di apertura",
    "lucide-arrow-up": "Torna all'inizio",
    "lucide-shopping-bag": "Carrello",
    "lucide-shopping-cart": "Carrello",
    "lucide-external-link": "Apri il collegamento",
    "lucide-chevron-left": "Pizza precedente",
    "lucide-chevron-right": "Pizza successiva",
    "lucide-chevron-up": "Elemento precedente",
    "lucide-chevron-down": "Elemento successivo",
    "lucide-menu": "Apri il menu",
    "lucide-search": "Cerca",
    "lucide-send": "Invia",
    "lucide-message-circle": "WhatsApp",
    "lucide-pizza": "Pizza",
    "lucide-navigation": "Naviga verso il locale",
    "lucide-mail": "Email",
    "lucide-info": "Informazioni",
    "lucide-alert-circle": "Avviso"
  };

  function labelButtons() {
    qsa("button").forEach(function (b) {
      try {
        if (b.hasAttribute("aria-label") || b.hasAttribute("title")) return;
        if ((b.textContent || "").trim().length > 0) return; // has visible text

        var svg = b.querySelector("svg");
        var svgClass = svg ? (svg.className && svg.className.baseVal !== undefined ? svg.className.baseVal : svg.className).toString() : "";

        // hero carousel dots (button with h-1.5 + rounded-full, no svg)
        var cls = (b.className || "").toString();
        if (!svg && cls.indexOf("h-1.5") !== -1 && cls.indexOf("rounded-full") !== -1) {
          var parent = b.parentElement;
          var dots = parent ? qsa("button", parent).filter(function (d) {
            var c = (d.className || "").toString();
            return c.indexOf("h-1.5") !== -1 && c.indexOf("rounded-full") !== -1;
          }) : [b];
          var idx = dots.indexOf(b);
          b.setAttribute("aria-label", "Pizza " + (idx + 1) + " di " + dots.length);
          return;
        }

        // lucide icon buttons
        for (var key in ICON_LABELS) {
          if (!Object.prototype.hasOwnProperty.call(ICON_LABELS, key)) continue;
          if (svgClass.indexOf(key) !== -1) {
            var label = ICON_LABELS[key];
            var card = b.closest ? b.closest(".group.flex") : null;
            var nameEl = card ? card.querySelector("p.font-serif") : null;
            var name = nameEl ? nameEl.textContent.trim() : "";
            if (key === "lucide-sparkles" && name) label = "Personalizza " + name;
            if (key === "lucide-plus" && name) label = "Aggiungi " + name + " al carrello";
            b.setAttribute("aria-label", label);
            return;
          }
        }

        // generic fallback from icon name
        if (svgClass.indexOf("lucide-") !== -1) {
          var m = svgClass.match(/lucide-([a-z0-9-]+)/);
          if (m) b.setAttribute("aria-label", m[1].replace(/-/g, " "));
        }
      } catch (e) { /* skip this button */ }
    });
  }

  /* ═══════════════════════════════════════════════════════════
   * P3-01 — carousel dots visibility (inline backstop)
   * Active 24×6 px pill; inactive 8×6 px at the designed hover tone
   * (rgba(255,255,255,.45)) so ● ○ ○ ○ ○ is clearly visible on noir.
   * Rotation, interval and behavior untouched.
   * ═══════════════════════════════════════════════════════════ */
  function fixDots() {
    var hero = document.getElementById("hero");
    if (!hero) return;
    var dots = qsa("button", hero).filter(function (d) {
      var c = (d.className || "").toString();
      return c.indexOf("h-1.5") !== -1 && c.indexOf("rounded-full") !== -1;
    });
    dots.forEach(function (d) {
      var active = d.className.toString().indexOf("w-6") !== -1;
      d.style.width = active ? "24px" : "8px";
      if (!active) d.style.backgroundColor = "rgba(255,255,255,0.45)";
    });
  }

  /* ═══════════════════════════════════════════════════════════
   * Orchestrator — run + observe (debounced, never looping)
   * ═══════════════════════════════════════════════════════════ */
  function enhance() {
    try { labelButtons(); } catch (e) { /* noop */ }
    try { fixDots(); } catch (e) { /* noop */ }
  }

  var busy = false;
  var timer = null;
  var observer = new MutationObserver(function () {
    if (busy) return;
    busy = true;
    clearTimeout(timer);
    timer = setTimeout(function () { enhance(); busy = false; }, 200);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      enhance();
      setTimeout(enhance, 800);
      setTimeout(enhance, 2000);
    });
  } else {
    enhance();
    setTimeout(enhance, 800);
    setTimeout(enhance, 2000);
  }
})();
