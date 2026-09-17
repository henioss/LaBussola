/**
 * La Bussola — Address Autocomplete (Geoapify free tier, no rebuild needed)
 *
 * Self-contained script that enhances the checkout address input with
 * autocomplete suggestions via the Geoapify Geocoding API.
 *
 * Privacy: requests only fire after the user types ≥ 3 characters (debounced).
 * No analytics, no tracking. Results are ephemeral (no persistence).
 */
(function () {
  "use strict";

  /* ── Geoapify configuration ─────────────────────────────────── */
  var API_KEY    = "ef6efdaa4db14c07b848803dc884fd7f";
  var ENDPOINT   = "https://api.geoapify.com/v1/geocode/autocomplete";
  var BIAS       = "proximity:11.0864,44.5031";   // Bazzano piazza
  var MIN_CHARS  = 3;
  var DEBOUNCE   = 300;   // ms
  var LIMIT      = 5;
  var TIMEOUT    = 4000;  // ms — hard cap

  /* ── Bazzano bounding box (simple point-in-rect) ───────────── */
  var BAZ_LON_MIN = 11.064, BAZ_LON_MAX = 11.108;
  var BAZ_LAT_MIN = 44.488, BAZ_LAT_MAX = 44.518;

  /* ── React-compatible input setter ──────────────────────────── */
  var nativeSetter =
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value") &&
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;

  function reactSetInputValue(input, val) {
    if (!nativeSetter) { input.value = val; return; }
    nativeSetter.call(input, val);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  /* ── Zone detection (Bazzano = 0, Fuori Bazzano = 1) ───────── */
  function detectZone(lat, lon) {
    if (lat >= BAZ_LAT_MIN && lat <= BAZ_LAT_MAX &&
        lon >= BAZ_LON_MIN && lon <= BAZ_LON_MAX) {
      return 0;
    }
    return 1;
  }

  function autoSelectZone(zoneIndex) {
    /* [FIX - audit follow-up] the old layout-class selector
       (div[class*="grid"][class*="grid-cols-2"] button) matched MENU CARD
       buttons behind the checkout overlay — clicking them silently added
       pizzas/opened the customizer, and the real zone buttons were never
       touched (zone stayed "Bazzano" for outside addresses).
       Match the delivery-zone buttons by their visible text instead. */
    var zoneButtons = Array.prototype.slice
      .call(document.querySelectorAll("button"))
      .filter(function (b) {
        var t = (b.textContent || "").trim();
        var r = b.getBoundingClientRect();                   // visible only
        if (r.width === 0 || r.height === 0) return false;    // (rect-based: works inside fixed panels)
        return (/^Bazzano/.test(t) || /^Fuori Bazzano/.test(t)) &&
               t.indexOf("\u20ac") !== -1;                  // has € price
      });
    var bazzano = zoneButtons.filter(function (b) {
      return /^Bazzano/.test((b.textContent || "").trim());
    })[0];
    var fuori = zoneButtons.filter(function (b) {
      return /^Fuori Bazzano/.test((b.textContent || "").trim());
    })[0];
    var target = zoneIndex === 0 ? bazzano : fuori;
    if (target && !target.className.toString().includes("from-gold")) {
      target.click();
    }
  }

  /* ── State ──────────────────────────────────────────────────── */
  var activeInput  = null;
  var wrapper      = null;
  var dropdown     = null;
  var suggestions  = [];
  var activeIdx    = -1;
  var debounceTmr  = null;
  var abortCtrl    = null;
  var isSetUp      = false;

  /* ── Styles (injected once) ─────────────────────────────────── */
  function injectStyles() {
    if (document.getElementById("ga-styles")) return;
    var s = document.createElement("style");
    s.id = "ga-styles";
    s.textContent =
      "@keyframes ga-spin{to{transform:rotate(360deg)}}" +
      ".ga-wrap{position:relative}" +
      ".ga-dd{display:none;position:absolute;z-index:9999;width:100%;" +
        "margin-top:4px;border-radius:12px;border:1px solid rgba(255,255,255,0.10);" +
        "background:#171008;box-shadow:0 12px 48px rgba(0,0,0,0.85);" +
        "max-height:260px;overflow-y:auto;overflow-x:hidden;" +
        "backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)}" +
      ".ga-dd-open{display:block}" +
      ".ga-loading{display:flex;align-items:center;gap:8px;padding:12px 16px;" +
        "font-size:12px;font-weight:300;color:#a09888}" +
      ".ga-spinner{width:14px;height:14px;border:2px solid #d9a35f;" +
        "border-top-color:transparent;border-radius:50%;animation:ga-spin .6s linear infinite}" +
      ".ga-item{display:flex;align-items:flex-start;gap:10px;padding:10px 16px;" +
        "cursor:pointer;font-size:13px;font-weight:300;line-height:1.4;" +
        "color:#e8ddd0;transition:background .12s,color .12s;list-style:none}" +
      ".ga-item:hover,.ga-item-active{background:rgba(217,163,95,0.15);color:#fff}" +
      ".ga-item svg{margin-top:2px;flex-shrink:0;transition:stroke .12s}" +
      ".ga-item:hover svg,.ga-item-active svg{stroke:#d9a35f!important}" +
      ".ga-empty{padding:12px 16px;font-size:12px;font-weight:300;color:#a09888}" +
      ".ga-footer{border-top:1px solid rgba(255,255,255,0.06);" +
        "padding:4px 16px;font-size:9px;font-weight:300;color:rgba(160,152,136,0.5)}";
    document.head.appendChild(s);
  }

  /* ── Dropdown rendering ─────────────────────────────────────── */
  function showLoading() {
    if (!dropdown) return;
    dropdown.innerHTML =
      '<div class="ga-loading"><span class="ga-spinner"></span>Ricerca\u2026</div>';
    dropdown.classList.add("ga-dd-open");
  }

  function showResults(items) {
    if (!dropdown) return;
    dropdown.innerHTML = "";
    items.forEach(function (item, i) {
      var li = document.createElement("div");
      li.className = "ga-item" + (i === activeIdx ? " ga-item-active" : "");
      li.innerHTML =
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" ' +
          'stroke="' + (i === activeIdx ? "#d9a35f" : "#a09888") + '" stroke-width="2">' +
          '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>' +
          '<circle cx="12" cy="10" r="3"/></svg>' +
        "<span>" + escHtml(item.label) + "</span>";
      li.addEventListener("mousedown", function (e) {
        e.preventDefault();
        e.stopPropagation();
        pickItem(item);
      });
      li.addEventListener("mouseenter", function () {
        setActive(i);
      });
      dropdown.appendChild(li);
    });
    var footer = document.createElement("div");
    footer.className = "ga-footer";
    footer.textContent = "\u00a9 OpenStreetMap contributors \u00b7 Powered by Geoapify";
    dropdown.appendChild(footer);
    dropdown.classList.add("ga-dd-open");
  }

  function showNoResults() {
    if (!dropdown) return;
    dropdown.innerHTML =
      '<div class="ga-empty">Nessun indirizzo trovato. Controlla la scritta o scegli la zona qui sotto.</div>';
    dropdown.classList.add("ga-dd-open");
  }

  function showUnavailable() {
    if (!dropdown) return;
    dropdown.innerHTML =
      '<div class="ga-empty">La ricerca non \u00e8 disponibile. Scrivi l\u2019indirizzo completo e seleziona la zona.</div>';
    dropdown.classList.add("ga-dd-open");
  }

  function hideDropdown() {
    if (dropdown) dropdown.classList.remove("ga-dd-open");
    suggestions = [];
    activeIdx = -1;
    /* [FIX P3-03] cancel anything in flight so a late API response
       cannot re-open the dropdown after the user clicked away */
    try { clearTimeout(debounceTmr); } catch (e) {}
    try { if (abortCtrl) abortCtrl.abort(); } catch (e) {}
  }

  function setActive(idx) {
    if (!dropdown) return;
    activeIdx = idx;
    var items = dropdown.querySelectorAll(".ga-item");
    items.forEach(function (el, i) {
      if (i === idx) {
        el.classList.add("ga-item-active");
        el.querySelector("svg").setAttribute("stroke", "#d9a35f");
        el.scrollIntoView({ block: "nearest" });
      } else {
        el.classList.remove("ga-item-active");
        el.querySelector("svg").setAttribute("stroke", "#a09888");
      }
    });
  }

  /* ── Pick an item ───────────────────────────────────────────── */
  function pickItem(item) {
    if (!activeInput) return;
    reactSetInputValue(activeInput, item.label);
    hideDropdown();
    activeInput.focus();
    /* auto-detect zone from coordinates */
    if (typeof item.lat === "number" && typeof item.lon === "number") {
      var z = detectZone(item.lat, item.lon);
      autoSelectZone(z);
    }
  }

  /* ── API call ───────────────────────────────────────────────── */
  function fetchSuggestions(query) {
    if (abortCtrl) abortCtrl.abort();
    abortCtrl = new AbortController();
    var sig = abortCtrl.signal;
    var timer = setTimeout(function () { abortCtrl.abort(); }, TIMEOUT);

    fetch(
      ENDPOINT +
        "?text=" + encodeURIComponent(query) +
        "&apiKey=" + API_KEY +
        "&filter=countrycode:it" +
        "&lang=it" +
        "&limit=" + LIMIT +
        "&bias=" + BIAS,
      { signal: sig }
    )
      .then(function (r) {
        clearTimeout(timer);
        if (!r.ok) throw new Error(r.status);
        return r.json();
      })
      .then(function (d) {
        if (sig.aborted) return;
        var items = [];
        (d.features || []).forEach(function (f) {
          var p = f.properties;
          if (
            p &&
            typeof p.formatted === "string" &&
            typeof p.lat === "number" &&
            typeof p.lon === "number"
          ) {
            items.push({ label: p.formatted.trim(), lat: p.lat, lon: p.lon });
          }
        });
        if (items.length > 0) {
          suggestions = items;
          activeIdx = 0;
          showResults(items);
        } else {
          suggestions = [];
          showNoResults();
        }
      })
      .catch(function () {
        clearTimeout(timer);
        if (!sig.aborted) showUnavailable();
      });
  }

  /* ── Setup autocomplete on an input ─────────────────────────── */
  function setupAutocomplete(input) {
    if (input._gaBound) return;
    input._gaBound = true;

    /* Wrap in a relative container */
    var wrap = document.createElement("div");
    wrap.className = "ga-wrap";
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);

    /* Create dropdown */
    dropdown = document.createElement("div");
    dropdown.className = "ga-dd";
    wrap.appendChild(dropdown);

    activeInput = input;

    /* Input event — debounced search */
    input.addEventListener("input", function () {
      var q = input.value.trim();
      if (q.length < MIN_CHARS) {
        hideDropdown();
        return;
      }
      showLoading();
      clearTimeout(debounceTmr);
      debounceTmr = setTimeout(function () {
        fetchSuggestions(q);
      }, DEBOUNCE);
    });

    /* Keyboard navigation */
    input.addEventListener("keydown", function (e) {
      if (!dropdown || !dropdown.classList.contains("ga-dd-open")) return;
      if (suggestions.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        var next = (activeIdx + 1) % suggestions.length;
        setActive(next);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        var prev = activeIdx <= 0 ? suggestions.length - 1 : activeIdx - 1;
        setActive(prev);
      } else if (e.key === "Enter") {
        if (activeIdx >= 0 && activeIdx < suggestions.length) {
          e.preventDefault();
          pickItem(suggestions[activeIdx]);
        }
      } else if (e.key === "Escape" || e.key === "Tab") {
        hideDropdown();
      }
    });

    /* Focus restore */
    input.addEventListener("focus", function () {
      if (suggestions.length > 0) {
        dropdown.classList.add("ga-dd-open");
      }
    });

    /* Close on outside click [FIX P3-03: mousedown + click + blur] */
    document.addEventListener("mousedown", function (e) {
      if (wrapper && !wrapper.contains(e.target)) {
        hideDropdown();
      }
    });
    document.addEventListener("click", function (e) {
      if (wrapper && !wrapper.contains(e.target)) {
        hideDropdown();
      }
    });
    input.addEventListener("blur", function () {
      setTimeout(function () {
        if (wrapper && !wrapper.contains(document.activeElement)) {
          hideDropdown();
        }
      }, 150);
    });
  }

  /* ── Helpers ────────────────────────────────────────────────── */
  function escHtml(s) {
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function findAddressInput() {
    /* Match by placeholder — the production bundle uses this exact text */
    var inputs = document.querySelectorAll('input[placeholder*="Via Zanasi"]');
    for (var i = 0; i < inputs.length; i++) {
      if (!inputs[i]._gaBound) return inputs[i];
    }
    return null;
  }

  /* ── Main: MutationObserver ─────────────────────────────────── */
  function check() {
    if (isSetUp && activeInput && document.body.contains(activeInput)) return;
    isSetUp = false;

    var input = findAddressInput();
    if (input) {
      injectStyles();
      setupAutocomplete(input);
      wrapper = input.parentNode;
      isSetUp = true;
    }
  }

  /* Initial check + observe DOM changes */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { setInterval(check, 300); });
  } else {
    setInterval(check, 300);
  }
})();
