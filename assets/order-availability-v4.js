/**
 * La Bussola Italia — Order Availability Engine
 * 
 * Handles:
 * - Timezone-aware open/closed status (Europe/Rome)
 * - Auto-refreshing status timer
 * - Future order date/time selection
 * - WhatsApp message timing injection
 * - Immediate order blocking when closed
 * - Confirmation notice before WhatsApp
 * - Status badge DOM updates
 */
(function () {
  "use strict";

  // ═══════════════════════════════════════════════════════════
  // 1. OPENING HOURS — Single source of truth
  // ═══════════════════════════════════════════════════════════
  var PERIODS = [
    { start: 12, end: 14, label: "Pranzo" },
    { start: 18, end: 23, label: "Cena" }
  ];

  // ═══════════════════════════════════════════════════════════
  // 2. ROME TIME HELPER
  // ═══════════════════════════════════════════════════════════
  function romeNow() {
    try {
      var now = new Date();
      var str = now.toLocaleString("en-US", { timeZone: "Europe/Rome" });
      return new Date(str);
    } catch (e) {
      return new Date();
    }
  }

  function romeFractional(rome) {
    return rome.getHours() + rome.getMinutes() / 60;
  }

  function romeDateStr(rome) {
    var y = rome.getFullYear();
    var m = String(rome.getMonth() + 1).padStart(2, "0");
    var d = String(rome.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }

  // ═══════════════════════════════════════════════════════════
  // 3. OPEN/CLOSED CHECK
  // ═══════════════════════════════════════════════════════════
  function checkOpen() {
    var rome = romeNow();
    var t = romeFractional(rome);
    for (var i = 0; i < PERIODS.length; i++) {
      if (t >= PERIODS[i].start && t < PERIODS[i].end) {
        return true;
      }
    }
    return false;
  }

  function getCurrentServiceLabel() {
    var rome = romeNow();
    var t = romeFractional(rome);
    for (var i = 0; i < PERIODS.length; i++) {
      if (t >= PERIODS[i].start && t < PERIODS[i].end) {
        return PERIODS[i].label;
      }
    }
    return null;
  }

  // ═══════════════════════════════════════════════════════════
  // 4. NEXT OPENING TIME
  // ═══════════════════════════════════════════════════════════
  function getNextOpen() {
    var rome = romeNow();
    var t = romeFractional(rome);
    for (var i = 0; i < PERIODS.length; i++) {
      if (t < PERIODS[i].start) {
        return { hour: PERIODS[i].start, minute: 0, label: PERIODS[i].label, tomorrow: false };
      }
    }
    return { hour: PERIODS[0].start, minute: 0, label: PERIODS[0].label, tomorrow: true };
  }

  // ═══════════════════════════════════════════════════════════
  // 5. AVAILABLE TIME SLOTS FOR A DATE
  // ═══════════════════════════════════════════════════════════
  function getAvailableSlots(dateStr) {
    var rome = romeNow();
    var todayStr = romeDateStr(rome);
    var isToday = dateStr === todayStr;
    var nowFrac = romeFractional(rome);
    var slots = [];

    for (var p = 0; p < PERIODS.length; p++) {
      var period = PERIODS[p];
      var startMin = period.start * 60;
      var endMin = period.end * 60;

      for (var m = startMin; m < endMin; m += 15) {
        if (isToday && m <= nowFrac * 60) continue;
        var h = Math.floor(m / 60);
        var mi = m % 60;
        slots.push(
          String(h).padStart(2, "0") + ":" + String(mi).padStart(2, "0")
        );
      }
    }
    return slots;
  }

  // ═══════════════════════════════════════════════════════════
  // 6. VALIDATE FUTURE TIME
  // ═══════════════════════════════════════════════════════════
  function validateFutureTime(dateStr, timeStr) {
    if (!dateStr || !timeStr) {
      return { valid: false, error: "Seleziona data e orario." };
    }

    var parts = timeStr.split(":");
    var h = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10);
    var frac = h + m / 60;

    var withinHours = false;
    for (var i = 0; i < PERIODS.length; i++) {
      if (frac >= PERIODS[i].start && frac < PERIODS[i].end) {
        withinHours = true;
        break;
      }
    }
    if (!withinHours) {
      return { valid: false, error: "L'orario selezionato \u00e8 fuori dagli orari di apertura." };
    }

    var rome = romeNow();
    var todayStr = romeDateStr(rome);
    if (dateStr === todayStr) {
      var nowFrac = romeFractional(rome);
      if (frac <= nowFrac) {
        return { valid: false, error: "L'orario selezionato \u00e8 nel passato." };
      }
    }

    return { valid: true };
  }

  // ═══════════════════════════════════════════════════════════
  // 7. GLOBAL STATE
  // ═══════════════════════════════════════════════════════════
  window.__oa = {
    isOpen: checkOpen(),
    timingMode: "immediate",
    futureDate: "",
    futureTime: "",
    lastChecked: Date.now()
  };

  // ═══════════════════════════════════════════════════════════
  // 8. TIMER — Refresh every 30 seconds
  // ═══════════════════════════════════════════════════════════
  setInterval(function () {
    window.__oa.isOpen = checkOpen();
    window.__oa.lastChecked = Date.now();
    updateStatusBadges();
  }, 30000);

  // ═══════════════════════════════════════════════════════════
  // 9. STATUS BADGE DOM UPDATES
  // ═══════════════════════════════════════════════════════════
  function updateStatusBadges() {
    var isOpen = window.__oa.isOpen;
    var spans = document.querySelectorAll("span");
    for (var i = 0; i < spans.length; i++) {
      var text = spans[i].textContent.trim();
      if (text === "Aperto ora" || text.indexOf("Chiuso ora") === 0) {
        var span = spans[i];
        var targetText = isOpen ? "Aperto ora" : "Chiuso ora (12-14 / 18-23)";
        var hasCorrectText = span.textContent.trim() === targetText;
        var dot = span.previousElementSibling;
        var dotOk = dot && dot.classList.contains("rounded-full") && (
          (isOpen && dot.className.indexOf("bg-emerald-400") !== -1) ||
          (!isOpen && dot.className.indexOf("bg-amber-400") !== -1)
        );
        if (hasCorrectText && dotOk) continue;
        span.textContent = targetText;
        if (dot && dot.classList.contains("rounded-full")) {
          if (isOpen) {
            dot.className = dot.className.replace("bg-amber-400", "bg-emerald-400 animate-pulse");
          } else {
            dot.className = dot.className.replace("bg-emerald-400 animate-pulse", "bg-amber-400");
          }
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 10. FORMAT ITALIAN DATE
  // ═══════════════════════════════════════════════════════════
  function formatItalianDate(dateStr) {
    var days = ["Domenica", "Luned\u00ec", "Marted\u00ec", "Mercoled\u00ec", "Gioved\u00ec", "Venerd\u00ec", "Sabato"];
    var months = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
    var d = new Date(dateStr + "T12:00:00");
    return days[d.getDay()] + " " + d.getDate() + " " + months[d.getMonth()];
  }

  // ═══════════════════════════════════════════════════════════
  // 11. INJECT TIMING UI INTO CHECKOUT
  // ═══════════════════════════════════════════════════════════
  var timingInjected = false;

  function injectTimingUI() {
    if (timingInjected) return;

    var isOpen = window.__oa.isOpen;

    var checkoutForms = document.querySelectorAll("form");
    var form = null;
    for (var i = 0; i < checkoutForms.length; i++) {
      var text = checkoutForms[i].textContent || "";
      if (text.indexOf("Invia con WhatsApp") !== -1 || text.indexOf("Ordina con WhatsApp") !== -1 || text.indexOf("WhatsApp") !== -1 || text.indexOf("Consegna a domicilio") !== -1 || text.indexOf("Ritiro in pizzeria") !== -1) {
        form = checkoutForms[i];
        break;
      }
    }
    if (!form) return;

    var existingContainer = form.querySelector("[data-oa-timing]");
    if (existingContainer) {
      timingInjected = true;
      return;
    }

    var submitBtn = null;
    var btns = form.querySelectorAll("button");
    for (var j = 0; j < btns.length; j++) {
      if (btns[j].textContent.indexOf("WhatsApp") !== -1 || btns[j].type === "submit" && btns[j].textContent.indexOf("Invia") !== -1) {
        submitBtn = btns[j];
        break;
      }
    }
    if (!submitBtn) return;

    timingInjected = true;

    var today = romeDateStr(romeNow());

    var container = document.createElement("div");
    container.setAttribute("data-oa-timing", "1");
    container.style.cssText = "margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.08);";

    if (!isOpen) {
      var nextOpen = getNextOpen();
      var nextStr = String(nextOpen.hour).padStart(2, "0") + ":" + String(nextOpen.minute).padStart(2, "0");
      var whenStr = nextOpen.tomorrow ? "domani" : "oggi";

      container.innerHTML =
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">' +
          '<span style="width:8px;height:8px;border-radius:50%;background:#fbbf24;display:inline-block;"></span>' +
          '<span style="font-size:13px;font-weight:600;color:#fbbf24;">Il locale \u00e8 chiuso</span>' +
        '</div>' +
        '<p style="font-size:12px;color:#a39a8e;margin-bottom:10px;">' +
          'Gli ordini immediati non sono disponibili, ma puoi programmare il tuo ordine: prossimo orario di apertura ' + whenStr + ' alle ' + nextStr + '.' +
        '</p>' +
        '<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">' +
          '<span style="font-size:12px;color:#d4a853;font-weight:500;">\u23F0 Ordina per pi\u00f9 tardi</span>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
          '<div>' +
            '<label style="display:block;font-size:11px;color:#a39a8e;margin-bottom:4px;">Data</label>' +
            '<input type="date" data-oa-date min="' + today + '" value="' + today + '" ' +
              'style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:8px 10px;font-size:13px;color:white;box-sizing:border-box;outline:none;">' +
          '</div>' +
          '<div>' +
            '<label style="display:block;font-size:11px;color:#a39a8e;margin-bottom:4px;">Orario richiesto</label>' +
            '<select data-oa-time ' +
              'style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:8px 10px;font-size:13px;color:white;box-sizing:border-box;outline:none;color-scheme:dark;">' +
              '<option value="">Seleziona orario...</option>' +
            '</select>' +
          '</div>' +
        '</div>' +
        '<p data-oa-time-display style="font-size:11px;color:#a39a8e;margin-top:8px;min-height:16px;"></p>' +
        '<p style="font-size:11px;color:#a39a8e;margin-top:4px;font-style:italic;">' +
          'L\'orario di preparazione sar\u00e0 confermato dal locale tramite WhatsApp in risposta a questo ordine.' +
        '</p>';
    } else {
      container.innerHTML =
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">' +
          '<span style="width:8px;height:8px;border-radius:50%;background:#34d399;display:inline-block;animation:pulse 2s infinite;"></span>' +
          '<span style="font-size:13px;font-weight:500;color:#34d399;">Aperto ora</span>' +
        '</div>' +
        '<div style="display:flex;gap:8px;margin-bottom:10px;">' +
          '<button type="button" data-oa-mode="immediate" ' +
            'style="flex:1;border:1px solid rgba(52,211,153,0.3);background:rgba(52,211,153,0.1);border-radius:8px;padding:8px;font-size:12px;color:#34d399;cursor:pointer;font-weight:500;">' +
            'Ordina ora' +
          '</button>' +
          '<button type="button" data-oa-mode="future" ' +
            'style="flex:1;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.03);border-radius:8px;padding:8px;font-size:12px;color:#a39a8e;cursor:pointer;">' +
            'Ordina per pi\u00f9 tardi' +
          '</button>' +
        '</div>' +
        '<div data-oa-future-panel style="display:none;">' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
            '<div>' +
              '<label style="display:block;font-size:11px;color:#a39a8e;margin-bottom:4px;">Data</label>' +
              '<input type="date" data-oa-date min="' + today + '" value="' + today + '" ' +
                'style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:8px 10px;font-size:13px;color:white;box-sizing:border-box;outline:none;">' +
            '</div>' +
            '<div>' +
              '<label style="display:block;font-size:11px;color:#a39a8e;margin-bottom:4px;">Orario richiesto</label>' +
              '<select data-oa-time ' +
                'style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:8px 10px;font-size:13px;color:white;box-sizing:border-box;outline:none;color-scheme:dark;">' +
                '<option value="">Seleziona orario...</option>' +
              '</select>' +
            '</div>' +
          '</div>' +
          '<p data-oa-time-display style="font-size:11px;color:#a39a8e;margin-top:8px;min-height:16px;"></p>' +
          '<p style="font-size:11px;color:#a39a8e;margin-top:4px;font-style:italic;">' +
            'Questo \u00e8 l\'orario richiesto. Il locale confermer\u00e0 l\'orario di preparazione tramite WhatsApp.' +
          '</p>' +
        '</div>';
    }

    submitBtn.parentNode.insertBefore(container, submitBtn);

    if (!isOpen) {
      /* [Part 11] make the closed-state notice stand out gently */
      container.style.background = "rgba(251,191,36,0.06)";
      container.style.border = "1px solid rgba(251,191,36,0.28)";
      container.style.borderRadius = "10px";
      container.style.padding = "12px";
    }
    wireTimingEvents(container, submitBtn);

    /* [UI FIX] custom listbox replaces native popup presentation */
    enhanceTimeSelect();
    enhanceDatePicker();
  }

  // ═══════════════════════════════════════════════════════════
  // 12. WIRE TIMING EVENTS
  // ═══════════════════════════════════════════════════════════
  function wireTimingEvents(container, submitBtn) {
    var isOpen = window.__oa.isOpen;

    var dateInput = container.querySelector("[data-oa-date]");
    var timeSelect = container.querySelector("[data-oa-time]");
    var timeDisplay = container.querySelector("[data-oa-time-display]");
    var futurePanel = container.querySelector("[data-oa-future-panel]");

    function populateSlots() {
      if (!dateInput || !timeSelect) return;
      var slots = getAvailableSlots(dateInput.value);
      timeSelect.innerHTML = '<option value="">Seleziona orario...</option>';
      for (var i = 0; i < slots.length; i++) {
        var opt = document.createElement("option");
        opt.value = slots[i];
        opt.textContent = slots[i];
        timeSelect.appendChild(opt);
      }
    }

    if (dateInput) {
      dateInput.addEventListener("change", function () {
        populateSlots();
        if (timeDisplay) timeDisplay.textContent = "";
      });
      populateSlots();
    }

    if (timeSelect) {
      timeSelect.addEventListener("change", function () {
        if (timeSelect.value && dateInput) {
          var dayLabel = formatItalianDate(dateInput.value);
          timeDisplay.textContent = "\u23F0 " + dayLabel + " \u2014 " + timeSelect.value;
          window.__oa.futureDate = dateInput.value;
          window.__oa.futureTime = timeSelect.value;
          if (!isOpen) {
            window.__oa.timingMode = "future";
          }
        } else {
          timeDisplay.textContent = "";
        }
      });
    }

    if (!isOpen) {
      window.__oa.timingMode = "future";
    }

    var modeButtons = container.querySelectorAll("[data-oa-mode]");
    for (var i = 0; i < modeButtons.length; i++) {
      modeButtons[i].addEventListener("click", function () {
        var mode = this.getAttribute("data-oa-mode");
        window.__oa.timingMode = mode;

        for (var j = 0; j < modeButtons.length; j++) {
          if (modeButtons[j].getAttribute("data-oa-mode") === mode) {
            modeButtons[j].style.borderColor = "rgba(212,168,83,0.3)";
            modeButtons[j].style.background = "rgba(212,168,83,0.1)";
            modeButtons[j].style.color = "#d4a853";
            modeButtons[j].style.fontWeight = "500";
          } else {
            modeButtons[j].style.borderColor = "rgba(255,255,255,0.1)";
            modeButtons[j].style.background = "rgba(255,255,255,0.03)";
            modeButtons[j].style.color = "#a39a8e";
            modeButtons[j].style.fontWeight = "normal";
          }
        }

        if (futurePanel) {
          futurePanel.style.display = mode === "future" ? "block" : "none";
        }
      });
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 13. WHATSAPP URL INTERCEPTOR
  // ═══════════════════════════════════════════════════════════
  var _origOpen = window.open;

  window.open = function (url) {
    if (typeof url === "string" && url.indexOf("wa.me/") !== -1 && url.indexOf("text=") !== -1) {

      if (!window.__oa.isOpen && window.__oa.timingMode === "immediate") {
        alert(
          "Il locale \u00e8 attualmente chiuso.\n\n" +
          "Gli ordini immediati non sono disponibili.\n" +
          "Seleziona un orario futuro per procedere con l'ordine."
        );
        return null;
      }

      if (window.__oa.timingMode === "future") {
        var validation = validateFutureTime(window.__oa.futureDate, window.__oa.futureTime);
        if (!validation.valid) {
          alert((!window.__oa.isOpen ? "Il locale \u00e8 chiuso.\n\n" : "Ordine non valido:\n\n") + validation.error);
          return null;
        }
      }

      try {
        var separator = "\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500";
        var timingBlock = "";
        var noticeBlock = "\n\u2139\uFE0F L'orario di preparazione sar\u00e0 confermato dal locale tramite WhatsApp in risposta a questo ordine.";

        if (window.__oa.timingMode === "future" && window.__oa.futureDate && window.__oa.futureTime) {
          var dayLabel = formatItalianDate(window.__oa.futureDate);
          timingBlock = separator + "\n\u23F0 ORARIO RICHIESTO\n" + dayLabel + " \u2014 " + window.__oa.futureTime;
        } else {
          timingBlock = separator + "\n\u23F0 ORARIO\nIl prima possibile";
        }

        var idx = url.indexOf("text=");
        var textPart = url.substring(idx + 5);
        var decoded = decodeURIComponent(textPart);
        decoded = decoded.replace(/\nGrazie!/, "\n" + timingBlock + "\n" + noticeBlock + "\n\nGrazie!");
        var newUrl = url.substring(0, idx + 5) + encodeURIComponent(decoded);

        return _origOpen.call(window, newUrl, "_blank");
      } catch (e) {
        return _origOpen.call(window, url, "_blank");
      }
    }

    return _origOpen.call(window, url);
  };

  // ═══════════════════════════════════════════════════════════
  // 14. MUTATION OBSERVER (debounced to avoid infinite loops)
  // ═══════════════════════════════════════════════════════════
  var _observerBusy = false;
  var _observerTimer = null;

  var observer = new MutationObserver(function () {
    if (_observerBusy) return;
    _observerBusy = true;

    clearTimeout(_observerTimer);
    _observerTimer = setTimeout(function () {
      updateStatusBadges();

      var fixedOverlays = document.querySelectorAll(".fixed.inset-0");
      for (var i = 0; i < fixedOverlays.length; i++) {
        var text = fixedOverlays[i].textContent || "";
        if (text.indexOf("Invia con WhatsApp") !== -1 || text.indexOf("Ordina con WhatsApp") !== -1 || text.indexOf("Consegna a domicilio") !== -1) {
          injectTimingUI();
          break;
        }
      }

      _observerBusy = false;
    }, 200);
  });

  observer.observe(document.body, { childList: true, subtree: true });


  /* ═══════════════════════════════════════════════════════════
   * 16. CUSTOM TIME DROPDOWN — UI presentation layer only
   *
   * Root cause of the white/blank popup (proven on live): the
   * injected <select> carries color:white + translucent bg, and
   * the page's effective color-scheme computes to "normal" (the
   * dark meta is overridden by the compiled CSS), so Chromium
   * paints the native dropdown LIGHT while <option> text inherits
   * WHITE → invisible options, empty panel with a scrollbar.
   *
   * Fix: keep the native <select> as the hidden, untouched source
   * of truth (populateSlots, change handler, __oa.futureTime,
   * future-order validation, WhatsApp interceptor all keep
   * operating on it) and present a custom accessible listbox
   * that mirrors it 1:1. Presentation grouping: PRANZO 12:00–14:00
   * and CENA 18:00–23:00 (labels only — slot data comes from the
   * engine unchanged).
   * ═══════════════════════════════════════════════════════════ */
  function enhanceTimeSelect() {
    var sel = document.querySelector("select[data-oa-time]");
    if (!sel || sel.__lbEnh) return;
    sel.__lbEnh = true;

    /* keep the native control functional but out of UI + a11y tree */
    sel.tabIndex = -1;
    sel.setAttribute("aria-hidden", "true");
    sel.style.cssText += ";position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden;";

    var wrap = document.createElement("div");
    wrap.style.cssText = "position:relative;";
    sel.parentNode.insertBefore(wrap, sel);
    wrap.appendChild(sel);

    var btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("aria-haspopup", "listbox");
    btn.setAttribute("aria-expanded", "false");
    btn.style.cssText =
      "width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;" +
      "background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);" +
      "border-radius:8px;padding:8px 10px;font-size:13px;color:#ffffff;box-sizing:border-box;" +
      "outline:none;cursor:pointer;text-align:left;";
    btn.innerHTML =
      '<span data-lb-label style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#a39a8e;">Seleziona orario...</span>' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d4a853" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="m6 9 6 6 6-6"/></svg>';

    var list = document.createElement("div");
    list.setAttribute("role", "listbox");
    list.setAttribute("aria-label", "Orario richiesto");
    list.setAttribute("tabindex", "0");
    list.style.cssText =
      "display:none;position:static;width:100%;margin-top:4px;" +   /* [unified in-flow] expands the form instead of covering it */
      "background:#171008;border:1px solid rgba(255,255,255,0.10);border-radius:12px;" +
      "box-shadow:0 12px 48px rgba(0,0,0,0.85);max-height:240px;overflow-y:auto;overflow-x:hidden;" +
      "padding:4px 0;overscroll-behavior:contain;box-sizing:border-box;";

    wrap.appendChild(btn);
    wrap.appendChild(list);

    var items = [];
    var activeIdx = -1;

    function slotGroup(v) {
      var h = parseInt(v.split(":")[0], 10);
      return (h >= 12 && h < 14) ? "PRANZO" : "CENA";
    }

    function rebuild() {
      items = [];
      list.innerHTML = "";
      var group = null, groupEl = null;
      for (var i = 0; i < sel.options.length; i++) {
        var o = sel.options[i];
        if (!o.value) continue; /* skip the placeholder */
        var g = slotGroup(o.value);
        if (g !== group) {
          group = g;
          groupEl = document.createElement("div");
          groupEl.setAttribute("role", "group");
          groupEl.setAttribute("aria-label", g === "PRANZO" ? "Pranzo 12:00-14:00" : "Cena 18:00-23:00");
          var head = document.createElement("div");
          head.setAttribute("aria-hidden", "true");
          head.textContent = g + " · " + (g === "PRANZO" ? "12:00 – 14:00" : "18:00 – 23:00");
          head.style.cssText =
            "padding:8px 14px 4px;font-size:10px;letter-spacing:0.18em;color:#d4a853;" +
            "font-weight:500;text-transform:uppercase;";
          groupEl.appendChild(head);
          list.appendChild(groupEl);
        }
        var it = document.createElement("div");
        it.setAttribute("role", "option");
        it.setAttribute("tabindex", "-1");
        it.id = "lb-time-opt-" + items.length + "-" + String(Math.floor(Math.random() * 1e6));
        it.setAttribute("data-value", o.value);
        it.style.cssText =
          "display:flex;align-items:center;justify-content:space-between;gap:10px;" +
          "padding:8px 14px;font-size:13px;font-weight:300;color:#e8ddd0;cursor:pointer;line-height:1.4;";
        var label = document.createElement("span");
        label.textContent = o.value;
        it.appendChild(label);
        var selected = (o.value === sel.value);
        if (selected) {
          it.setAttribute("aria-selected", "true");
          var check = document.createElement("span");
          check.textContent = "✓";
          check.style.color = "#d4a853";
          it.appendChild(check);
        }
        (function (node, val) {
          node.addEventListener("click", function () { pick(val); });
        })(it, o.value);
        (function (node) {
          node.addEventListener("mouseenter", function () {
            for (var k = 0; k < items.length; k++) if (items[k].el === node) { setActive(k, false); break; }
          });
        })(it);
        groupEl.appendChild(it);
        items.push({ el: it, value: o.value });
      }
      updateLabel();
    }

    function setActive(idx, scroll) {
      activeIdx = idx;
      for (var i = 0; i < items.length; i++) {
        var on = (i === idx);
        var isSelected = items[i].el.getAttribute("aria-selected") === "true";
        items[i].el.style.background = on ? "rgba(217,163,95,0.15)" : "";
        items[i].el.style.color = (on || isSelected) ? "#ffffff" : "#e8ddd0";
        items[i].el.style.fontWeight = isSelected ? "500" : "300";
      }
      if (activeIdx >= 0 && items[activeIdx]) {
        list.setAttribute("aria-activedescendant", items[activeIdx].el.id);
        if (scroll) items[activeIdx].el.scrollIntoView({ block: "nearest" });
      } else {
        list.removeAttribute("aria-activedescendant");
      }
    }

    function open() {
      if (list.style.display === "block") return;
      list.style.display = "block";
      btn.setAttribute("aria-expanded", "true");
      var startIdx = 0;
      for (var i = 0; i < items.length; i++) if (items[i].value === sel.value) { startIdx = i; break; }
      setActive(startIdx, true);
      list.focus();
    }

    function close(refocus) {
      list.style.display = "none";
      btn.setAttribute("aria-expanded", "false");
      setActive(-1, false);
      if (refocus) btn.focus();
    }

    function pick(v) {
      sel.value = v;
      /* the engine's own change handler runs — identical to native selection */
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      updateLabel();
      close(true);
    }

    function updateLabel() {
      var l = btn.querySelector("[data-lb-label]");
      var o = sel.options[sel.selectedIndex];
      var has = !!(o && o.value);
      l.textContent = has ? o.value : "Seleziona orario...";
      l.style.color = has ? "#ffffff" : "#a39a8e";
    }

    btn.addEventListener("click", function () {
      if (list.style.display === "block") { close(true); } else { open(); }
    });
    btn.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        open();
      }
    });
    list.addEventListener("keydown", function (e) {
      if (!items.length) return;
      if (e.key === "Escape") {
        e.preventDefault(); e.stopPropagation(); close(true);
      } else if (e.key === "ArrowDown") {
        e.preventDefault(); e.stopPropagation();
        setActive(Math.min(items.length - 1, Math.max(0, activeIdx + 1)), true);
      } else if (e.key === "ArrowUp") {
        e.preventDefault(); e.stopPropagation();
        setActive(Math.max(0, activeIdx - 1), true);
      } else if (e.key === "Home") {
        e.preventDefault(); setActive(0, true);
      } else if (e.key === "End") {
        e.preventDefault(); setActive(items.length - 1, true);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault(); e.stopPropagation();
        if (activeIdx >= 0 && items[activeIdx]) pick(items[activeIdx].value);
      }
    });
    document.addEventListener("mousedown", function (e) {
      if (list.style.display === "block" && !wrap.contains(e.target)) close(false);
    });

    /* stay in sync when populateSlots() refreshes the native options */
    new MutationObserver(function () { rebuild(); }).observe(sel, { childList: true });

    rebuild();
  }

  /* ═══════════════════════════════════════════════════════════
   * 17. CUSTOM DATE PICKER (Italian) — UI presentation layer only
   *
   * Root cause of the French calendar: the injected native
   * <input type="date"> popup is rendered by the BROWSER/OS in the
   * user's own UI locale (e.g. French "août / lu ma me…"). A page
   * lang attribute cannot change it. Fix: same technique as the
   * time selector — keep the native input hidden as the untouched
   * value source (YYYY-MM-DD + change events, min-date rule) and
   * present a custom Italian calendar that matches the site.
   * Day disabling uses the same rule as the engine: dates before
   * today (Europe/Rome) are not allowed.
   * ═══════════════════════════════════════════════════════════ */
  var LB_MONTHS = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno",
                   "Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
  var LB_DAYS_SHORT = ["Lun","Mar","Mer","Gio","Ven","Sab","Dom"];
  var LB_DAYS_LONG = ["Lunedì","Martedì","Mercoledì","Giovedì","Venerdì","Sabato","Domenica"];

  function lbPad(n) { return String(n).padStart(2, "0"); }

  function enhanceDatePicker() {
    var inp = document.querySelector("input[data-oa-date]");
    if (!inp || inp.__lbEnh) return;
    inp.__lbEnh = true;

    /* keep native control out of UI/a11y tree — never openable */
    inp.readOnly = true;
    inp.tabIndex = -1;
    inp.setAttribute("aria-hidden", "true");
    inp.style.cssText += ";position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden;";

    var wrap = document.createElement("div");
    wrap.style.cssText = "position:relative;";
    inp.parentNode.insertBefore(wrap, inp);
    wrap.appendChild(inp);

    var btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("aria-haspopup", "dialog");
    btn.setAttribute("aria-expanded", "false");
    btn.style.cssText =
      "width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;" +
      "background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);" +
      "border-radius:8px;padding:8px 10px;font-size:13px;color:#ffffff;box-sizing:border-box;" +
      "outline:none;cursor:pointer;text-align:left;";
    btn.innerHTML =
      '<span data-lb-dlabel style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#a39a8e;">Seleziona data...</span>' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d4a853" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="m6 9 6 6 6-6"/></svg>';

    var pop = document.createElement("div");
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-label", "Seleziona la data");
    pop.style.cssText =
      "display:none;position:static;width:100%;margin-top:4px;" +   /* [unified in-flow] expands the form instead of covering it */
      "background:#171008;border:1px solid rgba(255,255,255,0.10);border-radius:12px;" +
      "box-shadow:0 12px 48px rgba(0,0,0,0.85);padding:10px;box-sizing:border-box;";

    wrap.appendChild(btn);
    wrap.appendChild(pop);

    /* Escape anywhere inside the popover closes the calendar only */
    pop.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close(true);
      }
    });

    var view = { y: 0, m: 0 };   /* month being displayed */
    var focusDay = null;         /* DOM element with visual focus */

    function romeTodayStr() { return romeDateStr(romeNow()); }
    function parseYmd(s) {
      var p = String(s || "").split("-");
      if (p.length !== 3) return null;
      var y = parseInt(p[0], 10), m = parseInt(p[1], 10), d = parseInt(p[2], 10);
      if (!y || !m || !d) return null;
      return { y: y, m: m, d: d };
    }
    function fmtYmd(o) { return o.y + "-" + lbPad(o.m) + "-" + lbPad(o.d); }
    function sameYmd(a, b) { return !!a && !!b && a.y === b.y && a.m === b.m && a.d === b.d; }

    function updateLabel() {
      var l = btn.querySelector("[data-lb-dlabel]");
      var v = parseYmd(inp.value);
      if (v) { l.textContent = v.d + " " + LB_MONTHS[v.m - 1] + " " + v.y; l.style.color = "#ffffff"; }
      else { l.textContent = "Seleziona data..."; l.style.color = "#a39a8e"; }
    }

    function setFocusDay(el) {
      if (focusDay && focusDay.parentNode) focusDay.style.outline = "";
      focusDay = el || null;
      if (focusDay) {
        focusDay.style.outline = "2px solid rgba(212,168,83,0.8)";
        focusDay.style.outlineOffset = "-2px";
      }
    }

    function build() {
      var today = parseYmd(romeTodayStr());
      var selected = parseYmd(inp.value);
      var base = selected || today;
      if (view.y === 0 && view.m === 0) { view.y = base.y; view.m = base.m; }

      var minY = today.y, minM = today.m;
      var atMin = (view.y * 12 + view.m) <= (minY * 12 + minM);

      pop.innerHTML = "";

      /* header */
      var head = document.createElement("div");
      head.style.cssText = "display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;";
      var prev = document.createElement("button");
      prev.type = "button";
      prev.setAttribute("aria-label", "Mese precedente");
      prev.textContent = "‹";
      prev.style.cssText = "width:28px;height:28px;border-radius:9999px;border:1px solid " +
        (atMin ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.14)") + ";background:transparent;color:" +
        (atMin ? "rgba(232,221,208,0.25)" : "#e8ddd0") + ";font-size:16px;line-height:1;cursor:" +
        (atMin ? "default" : "pointer") + ";";
      if (atMin) prev.setAttribute("aria-disabled", "true"); else prev.disabled = false;
      var title = document.createElement("span");
      title.textContent = LB_MONTHS[view.m - 1] + " " + view.y;
      title.setAttribute("aria-live", "polite");
      title.style.cssText = "font-family:'Playfair Display',Georgia,serif;font-size:14px;color:#d4a853;font-weight:600;letter-spacing:0.04em;";
      var next = document.createElement("button");
      next.type = "button";
      next.setAttribute("aria-label", "Mese successivo");
      next.textContent = "›";
      next.style.cssText = "width:28px;height:28px;border-radius:9999px;border:1px solid rgba(255,255,255,0.14);background:transparent;color:#e8ddd0;font-size:16px;line-height:1;cursor:pointer;";
      head.appendChild(prev); head.appendChild(title); head.appendChild(next);
      pop.appendChild(head);

      prev.addEventListener("click", function () {
        if (atMin) return;
        view.m--; if (view.m < 1) { view.m = 12; view.y--; }
        build(); refocusGrid();
      });
      next.addEventListener("click", function () {
        view.m++; if (view.m > 12) { view.m = 1; view.y++; }
        build(); refocusGrid();
      });

      /* weekdays */
      var wd = document.createElement("div");
      wd.style.cssText = "display:grid;grid-template-columns:repeat(7,1fr);margin-bottom:2px;";
      for (var i = 0; i < 7; i++) {
        var w = document.createElement("span");
        w.textContent = LB_DAYS_SHORT[i];
        w.setAttribute("aria-hidden", "true");
        w.style.cssText = "text-align:center;font-size:9.5px;letter-spacing:0.08em;text-transform:uppercase;color:#a39a8e;padding:4px 0;";
        wd.appendChild(w);
      }
      pop.appendChild(wd);

      /* grid */
      var grid = document.createElement("div");
      grid.setAttribute("role", "grid");
      grid.setAttribute("aria-label", LB_MONTHS[view.m - 1] + " " + view.y);
      grid.setAttribute("tabindex", "0");
      grid.style.cssText = "display:grid;grid-template-columns:repeat(7,1fr);row-gap:2px;outline:none;";
      var first = new Date(view.y, view.m - 1, 1);
      var offset = (first.getDay() + 6) % 7;      /* Monday-first */
      var nDays = new Date(view.y, view.m, 0).getDate();
      var cells = [];
      for (var b = 0; b < offset; b++) {
        var blank = document.createElement("span");
        grid.appendChild(blank);
      }
      for (var d = 1; d <= nDays; d++) {
        (function (dd) {
          var o = { y: view.y, m: view.m, d: dd };
          var dow = (new Date(view.y, view.m - 1, dd).getDay() + 6) % 7;
          var before = fmtYmd(o) < romeTodayStr();
          var isToday = sameYmd(o, today);
          var isSel = sameYmd(o, parseYmd(inp.value));
          var c = document.createElement("button");
          c.type = "button";
          c.setAttribute("role", "gridcell");
          c.setAttribute("tabindex", "-1");
          c.setAttribute("aria-label", LB_DAYS_LONG[dow] + " " + dd + " " + LB_MONTHS[view.m - 1] + " " + view.y + (isToday ? ", oggi" : "") + (isSel ? ", selezionata" : ""));
          c.textContent = String(dd);
          c.dataset.date = fmtYmd(o);
          var base_style =
            "height:30px;display:flex;align-items:center;justify-content:center;font-size:12.5px;" +
            "border-radius:8px;background:transparent;border:1px solid transparent;color:#e8ddd0;" +
            "font-weight:300;cursor:pointer;padding:0;";
          if (isToday) c.setAttribute("aria-current", "date");   /* always expose today */
          if (before) {
            c.setAttribute("aria-disabled", "true");
            c.disabled = true;
            c.style.cssText = base_style + "color:rgba(232,221,208,0.25);cursor:default;";
          } else if (isSel) {
            c.setAttribute("aria-selected", "true");
            /* selected + today: gold fill with a fine noir ring to keep "oggi" readable */
            c.style.cssText = base_style + "background:#d4a85f;color:#171008;font-weight:600;" +
              (isToday ? "box-shadow:inset 0 0 0 2px #171008, inset 0 0 0 3px #d4a85f;" : "");
          } else if (isToday) {
            c.style.cssText = base_style + "border-color:rgba(212,168,83,0.55);";
          } else {
            c.style.cssText = base_style;
          }
          if (!before) {
            c.addEventListener("mouseenter", function () { if (!c.getAttribute("aria-selected")) c.style.background = "rgba(217,163,95,0.15)"; });
            c.addEventListener("mouseleave", function () { if (!c.getAttribute("aria-selected")) c.style.background = "transparent"; });
            c.addEventListener("click", function () { pick(dd); });
          }
          grid.appendChild(c);
          cells.push(c);
        })(d);
      }
      pop.appendChild(grid);

      /* footer */
      var foot = document.createElement("div");
      foot.style.cssText = "display:flex;align-items:center;justify-content:space-between;margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.06);";
      var oggi = document.createElement("button");
      oggi.type = "button";
      oggi.textContent = "Oggi";
      oggi.style.cssText = "font-size:11px;color:#d4a85f;background:transparent;border:none;cursor:pointer;letter-spacing:0.06em;";
      var chiudi = document.createElement("button");
      chiudi.type = "button";
      chiudi.textContent = "Chiudi ✕";
      chiudi.setAttribute("aria-label", "Chiudi il calendario");
      chiudi.style.cssText = "font-size:11px;color:#a39a8e;background:transparent;border:none;cursor:pointer;";
      foot.appendChild(oggi); foot.appendChild(chiudi);
      pop.appendChild(foot);

      oggi.addEventListener("click", function () {
        var t = parseYmd(romeTodayStr());
        view.y = t.y; view.m = t.m;
        pick(t.d);
      });
      chiudi.addEventListener("click", function () { close(true); });

      /* keyboard on grid */
      grid.addEventListener("keydown", function (e) {
        var enabled = cells.filter(function (c) { return !c.disabled; });
        var cur = enabled.indexOf(focusDay);
        var delta = 0;
        if (e.key === "ArrowLeft") delta = -1;
        else if (e.key === "ArrowRight") delta = 1;
        else if (e.key === "ArrowUp") delta = -7;
        else if (e.key === "ArrowDown") delta = 7;
        else if (e.key === "Enter" || e.key === " ") {
          e.preventDefault(); e.stopPropagation();
          if (focusDay && !focusDay.disabled) pick(parseInt(focusDay.textContent, 10));
          return;
        } else if (e.key === "Escape") {
          e.preventDefault(); e.stopPropagation(); close(true); return;
        } else if (e.key === "PageUp") { e.preventDefault(); prev.click(); return; }
        else if (e.key === "PageDown") { e.preventDefault(); next.click(); return; }
        if (delta !== 0 && enabled.length) {
          e.preventDefault(); e.stopPropagation();
          var idx = cur < 0 ? 0 : Math.min(enabled.length - 1, Math.max(0, cur + delta));
          setFocusDay(enabled[idx]);
          enabled[idx].scrollIntoView({ block: "nearest" });
        }
      });
      grid.addEventListener("focus", function () {
        if (!focusDay) {
          var sel = cells.filter(function (c) { return c.getAttribute("aria-selected") === "true"; })[0];
          setFocusDay(sel || cells.filter(function (c) { return !c.disabled; })[0]);
        }
      });

      /* if the popover is open but focus was lost by the rebuild, keep keyboard control inside */
      if (pop.style.display === "block" && !pop.contains(document.activeElement)) refocusGrid();

      /* restore visual focus after rebuild */
      if (focusDay && focusDay.dataset && cells.some(function (c) { return c.dataset.date === focusDay.dataset.date; })) {
        var same = cells.filter(function (c) { return c.dataset.date === focusDay.dataset.date; })[0];
        setFocusDay(same);
      } else {
        setFocusDay(cells.filter(function (c) { return c.getAttribute("aria-selected") === "true"; })[0] ||
                    cells.filter(function (c) { return !c.disabled; })[0]);
      }
    }

    function refocusGrid() {
      var g = pop.querySelector('[role="grid"]');
      if (g) g.focus();
    }

    function open() {
      if (pop.style.display === "block") return;
      build();
      pop.style.display = "block";
      btn.setAttribute("aria-expanded", "true");
      var g = pop.querySelector('[role="grid"]');
      if (g) g.focus();
    }
    function close(refocus) {
      pop.style.display = "none";
      btn.setAttribute("aria-expanded", "false");
      setFocusDay(null);
      if (refocus) btn.focus();
    }
    function pick(day) {
      var o = { y: view.y, m: view.m, d: day };
      if (fmtYmd(o) < romeTodayStr()) return;   /* never allow a past date */
      inp.value = fmtYmd(o);                     /* internal format preserved */
      inp.dispatchEvent(new Event("change", { bubbles: true }));  /* engine refreshes slots */
      updateLabel();
      close(true);
    }

    btn.addEventListener("click", function () {
      if (pop.style.display === "block") close(true); else open();
    });
    btn.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault(); e.stopPropagation(); open();
      }
    });
    document.addEventListener("mousedown", function (e) {
      if (pop.style.display === "block" && !wrap.contains(e.target)) close(false);
    });

    updateLabel();
  }
  // ═══════════════════════════════════════════════════════════
  // 15. INITIAL BADGE UPDATE
  // ═══════════════════════════════════════════════════════════
  setTimeout(updateStatusBadges, 1000);
  setTimeout(updateStatusBadges, 3000);
  setTimeout(enhanceTimeSelect, 1000); setTimeout(enhanceDatePicker, 1000);
  setTimeout(enhanceTimeSelect, 3500); setTimeout(enhanceDatePicker, 3500);

})();
