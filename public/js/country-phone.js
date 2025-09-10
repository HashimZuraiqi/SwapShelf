// public/js/country-phone.js
// Connects #country <select> with intl-tel-input on #phone.
// Excludes IL, renames PS -> "Palestine". Robust against slow/missing CDN loads.

(function () {
  const VER = "18.6.1";
  const CSS_URL   = `https://cdn.jsdelivr.net/npm/intl-tel-input@${VER}/build/css/intlTelInput.css`;
  const JS_URL    = `https://cdn.jsdelivr.net/npm/intl-tel-input@${VER}/build/js/intlTelInput.min.js`;
  const UTILS_URL = `https://cdn.jsdelivr.net/npm/intl-tel-input@${VER}/build/js/utils.js`;

  const onReady = (fn) =>
    document.readyState === "loading"
      ? document.addEventListener("DOMContentLoaded", fn, { once: true })
      : fn();

  function ensureCSS(href) {
    if (!document.querySelector(`link[rel="stylesheet"][href="${href}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      document.head.appendChild(link);
    }
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if ([...document.scripts].some((s) => s.src === src)) return resolve();
      const el = document.createElement("script");
      el.src = src;
      el.async = false;
      el.onload = () => resolve();
      el.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.body.appendChild(el);
    });
  }

  async function ensureITI() {
    // CSS first so the UI renders correctly
    ensureCSS(CSS_URL);

    // If already present, nothing else to do.
    if (window.intlTelInput && window.intlTelInputGlobals) return;

    // Load core lib then utils.
    await loadScript(JS_URL);
    await loadScript(UTILS_URL);
  }

  function populateSelect(selectEl, data) {
    // keep a single placeholder
    selectEl.innerHTML = "";
    const ph = document.createElement("option");
    ph.value = "";
    ph.disabled = true;
    ph.selected = true;
    ph.textContent = "Select your country";
    selectEl.appendChild(ph);

    const list = data
      .filter((c) => c.iso2 !== "il")
      .map((c) => (c.iso2 === "ps" ? { ...c, name: "Palestine" } : c))
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const c of list) {
      const opt = document.createElement("option");
      opt.value = c.name;
      opt.dataset.iso2 = c.iso2.toUpperCase();
      opt.dataset.dial = c.dialCode;
      opt.textContent = `${c.name} (${c.iso2.toUpperCase()}) — +${c.dialCode}`;
      selectEl.appendChild(opt);
    }
  }

  function setFlagBadge(phoneEl, iso2) {
    const wrap = phoneEl.closest(".iti");
    const flag = wrap && wrap.querySelector(".iti__selected-flag");
    if (flag) flag.setAttribute("data-iso2", (iso2 || "").toUpperCase());
  }

  function chooseByIso2(selectEl, iso2) {
    const opt = selectEl.querySelector(
      `option[data-iso2="${(iso2 || "").toUpperCase()}"]`
    );
    if (opt) selectEl.value = opt.value;
  }

  onReady(async () => {
    const countrySelect = document.getElementById("country");
    const phoneInput    = document.getElementById("phone");
    if (!countrySelect || !phoneInput) return;

    try {
      // Load the library if the page forgot to include it.
      await ensureITI();

      // Initialize the widget
      const iti = window.intlTelInput(phoneInput, {
        initialCountry: "jo",
        separateDialCode: true,
        nationalMode: false,
        autoPlaceholder: "polite",
        excludeCountries: ["il"],
        utilsScript: UTILS_URL, // safe even if already loaded
      });

      // Make sure the wrapper lays out nicely next to your left icon
      const wrap = phoneInput.closest(".iti");
      if (wrap) {
        wrap.style.width = "100%";
        wrap.style.display = "block";
      }
      const parent = phoneInput.closest(".input-container");
      if (parent) parent.classList.add("has-iti");

      // Build the country <select>
      populateSelect(countrySelect, window.intlTelInputGlobals.getCountryData());

      // Initial sync
      const preIso = countrySelect.selectedOptions[0]?.dataset.iso2 || null;
      if (preIso) {
        iti.setCountry(preIso.toLowerCase());
        setFlagBadge(phoneInput, preIso);
      } else {
        const { iso2 } = iti.getSelectedCountryData();
        chooseByIso2(countrySelect, iso2);
        setFlagBadge(phoneInput, iso2);
      }

      // Keep in sync both ways
      countrySelect.addEventListener("change", () => {
        const iso2 = countrySelect.selectedOptions[0]?.dataset.iso2 || "";
        if (iso2) {
          iti.setCountry(iso2.toLowerCase());
          setFlagBadge(phoneInput, iso2);
        }
      });

      phoneInput.addEventListener("countrychange", () => {
        const { iso2 } = iti.getSelectedCountryData();
        chooseByIso2(countrySelect, iso2);
        setFlagBadge(phoneInput, iso2);
      });

      // Normalize to E.164 on blur if valid
      phoneInput.addEventListener("blur", () => {
        if (iti.isValidNumber()) phoneInput.value = iti.getNumber();
      });
    } catch (e) {
      console.error("[country-phone] failed to initialize:", e);
    }
  });
})();
