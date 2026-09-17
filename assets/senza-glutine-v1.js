/**
 * La Bussola — Senza Glutine information integration (additive overlay)
 *
 *  LOCATION 1 — the existing moving bandeau after the Hero: the Senza Glutine
 *               message joins the sequence as native items (TEXT ONLY).
 *  LOCATION 3 — the real Pizza Customizer: TEXT ONLY warning under the
 *               Impasto choice while "Senza Glutine" is selected.
 *  LOCATION 4 — the existing Mezzo Metro special-request popup: TEXT ONLY
 *               information element inside the popup.
 *
 * (LOCATION 2 — the full visual as continuation of the Hero journey — lives
 *  in hero-personalization.js / hero-personalization.css.)
 *
 * The wording below is the exact written content of the supplied reference;
 * only size / hierarchy / line breaks differ per location.
 * Purely additive: React internals, cart, data and pricing are untouched.
 */
(function () {
  "use strict";

  var T_TITLE = "BASE PIZZA SENZA GLUTINE";
  var T_PRICE = "aggiunta € 3,00";
  var T_NB = "N.B.:";
  /* LOCATION 1 — fixed sentence, verbatim, rendered with the bandeau's own typography */
  var T_BAND = "N.B. : LA PIZZA SENZA GLUTINE NON ADATTO PER INTOLLERANTI/ALLERGICI/CELIACI, POICHÈ IL PRODOTTO È A STRETTO CONTATTO CON ALTRE FARINE";
  var WARNING = "NON ADATTO PER INTOLLERANTI/ALLERGICI/CELIACI, POICHÈ IL PRODOTTO È A STRETTO CONTATTO CON ALTRE FARINE";

  var style = document.createElement("style");
  style.textContent = [
    /* Location 3 — native footnote of the Impasto step in the real customizer */
    ".lb-sg-warn{position:relative;margin:14px auto 2px;max-width:460px;width:calc(100% - 8px);",
    "padding:10px 18px 11px;text-align:center;",
    "font-family:'Cormorant Garamond',Georgia,'Times New Roman',serif;font-size:12.5px;line-height:1.62;letter-spacing:.015em;",
    "color:rgb(247 243 235 / .95);",
    "border-top:1px solid rgb(217 163 95 / .25);border-bottom:1px solid rgb(217 163 95 / .25);",
    "opacity:0;transition:opacity .45s ease;}",
    ".lb-sg-warn::before{content:'';position:absolute;top:-8px;left:50%;width:1px;height:16px;",
    "background:linear-gradient(to bottom, rgba(217,163,95,0), rgba(217,163,95,.65));}",
    ".lb-sg-warn.lb-sg-on{opacity:1;}",
    ".lb-sg-warn b{color:#d9a35f;font-weight:600;letter-spacing:.06em;}",
    "@media (max-width:700px){",
    ".lb-sg-warn{font-size:11.5px;padding:9px 12px 10px;max-width:400px;}",
    "}"
  ].join("\n");
  document.head.appendChild(style);

  /* ---------------- LOCATION 1 — bandeau items -------------------------- */
  function addBandeau() {
    var track = document.querySelector(".animate-marquee");
    if (!track) return false;
    if (track.getAttribute("data-sg")) return true;
    var groups = track.children;
    for (var gI = 0; gI < groups.length; gI++) {
      var group = groups[gI];
      var sample = group.firstElementChild;
      if (!sample) continue;
      /* the COMPLETE warning, as one native bandeau item, subtly emphasized */
      var clone = sample.cloneNode(true);
      var phrase = clone.querySelector("span");
      if (phrase) {
        /* the complete fixed sentence, pinned to the EXACT typographic
           classes of the existing bandeau items (same family, size, weight,
           style, spacing, colour) so it reads as one of them — never
           truncated, never restyled */
        phrase.className = "px-8 font-serif text-lg italic text-white/80 whitespace-nowrap";
        phrase.textContent = T_BAND;
      }
      group.appendChild(clone);
    }
    track.setAttribute("data-sg", "1");
    return true;
  }

  /* ---------------- LOCATION 3 — real customizer warning ---------------- */
  function syncCustomizer() {
    var cust = document.querySelector(".lb-customizer");
    var existing = document.querySelector(".lb-sg-warn");
    if (!cust) {
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
      return;
    }
    var btns = cust.querySelectorAll("button"), sg = null, selected = false;
    for (var i = 0; i < btns.length; i++) {
      if ((btns[i].textContent || "").indexOf("Senza Glutine") !== -1) {
        sg = btns[i];
        selected = btns[i].className.indexOf("from-gold") !== -1;
        break;
      }
    }
    if (!sg || !selected) {
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
      return;
    }
    var step = sg.parentElement && sg.parentElement.parentElement;
    if (!step) return;
    if (!existing) {
      var w = document.createElement("p");
      w.className = "lb-sg-warn";
      var b = document.createElement("b");
      b.textContent = T_NB;
      w.appendChild(b);
      w.appendChild(document.createTextNode(" " + WARNING));
      step.appendChild(w);
      requestAnimationFrame(function () { requestAnimationFrame(function () { w.classList.add("lb-sg-on"); }); });
    } else {
      if (existing.parentNode !== step) step.appendChild(existing);
      existing.classList.add("lb-sg-on");
    }
  }

  /* ---------------- LOCATION 4 — Mezzo Metro popup note ----------------- */
  function syncPopup() {
    /* the Mezzo Metro popup carries no Senza Glutine block: any leftover
       element from an older build is removed and nothing is inserted */
    var existing = document.querySelector(".lb-sg-mmp");
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
  }

  /* ---------------- lifecycle ------------------------------------------- */
  var queued = false;
  function sync() {
    queued = false;
    addBandeau();
    syncCustomizer();
    syncPopup();
  }
  function queue() {
    if (!queued) { queued = true; setTimeout(sync, 60); }
  }

  function boot() {
    if (!addBandeau()) setTimeout(boot, 120);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { setTimeout(boot, 30); });
  } else {
    setTimeout(boot, 30);
  }

  try {
    new MutationObserver(queue).observe(document.documentElement, {
      childList: true, subtree: true, attributes: true, attributeFilter: ["class"]
    });
  } catch (e) {}
  document.addEventListener("click", queue, true);
  window.addEventListener("resize", queue);
})();
