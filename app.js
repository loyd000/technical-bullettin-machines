// ─── Category Configuration ───────────────────────────────────────────────────

const SPREADSHEET_BASE =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vR-zTswjtNyquFlZ4lF0RFl0teWYbN3UuaFj0Qk21xQsrhLB41vcITFPvMqjGLL8Z4lVbHrX4K9FNVw/pub";

const DEFAULT_CATEGORY_ICON = "[ ]";
const CATEGORY_INDEX_SHEET = "Categories";

const FALLBACK_CATEGORIES = [
  { id: "four-wheel-tractor",      label: "Four-Wheel Tractor",       icon: "🚜", gid: "0"          },
  { id: "hammer-mill",             label: "Hammer Mill",              icon: "🔨", gid: "1307150758" },
  { id: "seed-broadcaster",        label: "Seed Broadcaster",         icon: "🌱", gid: "307768010"  },
  { id: "biomass-shredder",        label: "Biomass Shredder",         icon: "🌿", gid: "2046159304" },
  { id: "mechanical-rice-thresher",label: "Mechanical Rice Thresher", icon: "🌾", gid: "1878617399" },
];

// ─── Cache-busted URL builders ────────────────────────────────────────────────
// P2: Use a 5-minute rounded timestamp so the browser can cache within that window
const CACHE_TTL_MS = 5 * 60 * 1000;
function cacheBustStamp() {
  return Math.floor(Date.now() / CACHE_TTL_MS) * CACHE_TTL_MS;
}

function sheetUrl(gid) {
  return `${SPREADSHEET_BASE}?gid=${gid}&single=true&output=csv&_=${cacheBustStamp()}`;
}

function namedSheetUrl(sheetName) {
  return `${SPREADSHEET_BASE}?single=true&output=csv&sheet=${encodeURIComponent(sheetName)}&_=${cacheBustStamp()}`;
}

// ─── UI References ─────────────────────────────────────────────────────────────

const ui = {
  homeView: document.getElementById("homeView"),
  categoryView: document.getElementById("categoryView"),
  categoryGrid: document.getElementById("categoryGrid"),
  backBtn: document.getElementById("backBtn"),
  categoryEyebrow: document.getElementById("categoryEyebrow"),
  categoryTitle: document.getElementById("categoryTitle"),
  categorySearch: document.getElementById("categorySearch"),
  categorySearchClear: document.getElementById("categorySearchClear"),
  categorySearchStatus: document.getElementById("categorySearchStatus"),
  searchInput: document.getElementById("searchInput"),
  brandFilter: document.getElementById("brandFilter"),
  machineList: document.getElementById("machineList"),
  listCount: document.getElementById("listCount"),
  machineA: document.getElementById("machineA"),
  machineB: document.getElementById("machineB"),
  differencesOnly: document.getElementById("differencesOnly"),
  compareBody: document.getElementById("compareBody"),
  machineAHeading: document.getElementById("machineAHeading"),
  machineBHeading: document.getElementById("machineBHeading"),
  machineAImageHeading: document.getElementById("machineAImageHeading"),
  machineBImageHeading: document.getElementById("machineBImageHeading"),
  machineAPhoto: document.getElementById("machineAPhoto"),
  machineBPhoto: document.getElementById("machineBPhoto"),
  machineAPhotoPlaceholder: document.getElementById("machineAPhotoPlaceholder"),
  machineBPhotoPlaceholder: document.getElementById("machineBPhotoPlaceholder"),
  cardTemplate: document.getElementById("machineCardTemplate"),
  tabButtons: document.querySelectorAll(".tab-btn"),
  tabPanels: document.querySelectorAll(".tab-panel"),
};

// ─── App State ────────────────────────────────────────────────────────────────

let state = {
  categories: [],
  machines: [],
  visibleMachines: [],
  currentCategoryId: null,
};

const categoryCache = new Map(); // Map<gid, { data, cachedAt }>
const CATEGORY_CACHE_TTL = 5 * 60 * 1000;

function fetchWithTimeout(url, ms = 10000) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  return fetch(url, { signal: ac.signal }).finally(() => clearTimeout(timer));
}

// ─── Entry Point & Router ─────────────────────────────────────────────────────

async function init() {
  bindEvents();
  await loadCategories();
  route();
  window.addEventListener("hashchange", route);
}

function route() {
  const hash = window.location.hash;
  const match = hash.match(/^#category=([^&]+)/);
  if (match) {
    const categoryId = decodeURIComponent(match[1]);
    const category = state.categories.find((c) => c.id === categoryId);
    if (category) {
      openCategory(category);
      return;
    }
    // Unknown category ID in URL — clean the hash and fall through to home
    history.replaceState("", "", location.pathname + location.search);
  }
  showHomeView();
}

// ─── Home View ────────────────────────────────────────────────────────────────

function renderCategoryGrid() {
  ui.categoryGrid.innerHTML = "";
  if (state.categories.length === 0) {
    ui.categoryGrid.innerHTML =
      '<p class="empty-state">No machine categories are available yet.</p>';
    return;
  }

  state.categories.forEach((cat, index) => {
    // Only use photo_url from the sheet — no hardcoded fallback images
    const photoUrl = (cat.photo_url && /^https?:\/\//i.test(cat.photo_url.trim()))
      ? cat.photo_url.trim()
      : "";

    const card = document.createElement("button");
    card.type = "button";
    card.className = "category-card";
    card.setAttribute("role", "listitem");
    card.dataset.id = cat.id;
    card.style.animationDelay = `${index * 60}ms`;

    // Bug #10: aria-label gives screen readers a concise card description
    card.setAttribute("aria-label", cat.label);

    if (photoUrl) {
      card.innerHTML = `
        <div class="cat-photo-wrap">
          <img
            class="cat-photo"
            src="${escapeHtml(photoUrl)}"
            alt="${escapeHtml(cat.label)}"
            loading="lazy"
          />
          <div class="cat-photo-overlay" aria-hidden="true"></div>
        </div>
        <div class="cat-label-wrap">
          <span class="cat-label">${escapeHtml(cat.label)}</span>
          <span class="cat-arrow" aria-hidden="true">→</span>
        </div>
      `;
      // Bug #18: use addEventListener instead of inline onerror (CSP-safe)
      const img = card.querySelector(".cat-photo");
      img.addEventListener("error", () => {
        img.parentElement.classList.add("cat-photo-error");
        img.style.display = "none";
      });
    } else {
      // No photo_url — show a styled placeholder
      card.innerHTML = `
        <div class="cat-photo-wrap cat-photo-placeholder-wrap">
          <div class="cat-placeholder">
            <svg class="cat-placeholder-icon" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="6" y="10" width="36" height="28" rx="3" stroke="currentColor" stroke-width="2"/>
              <circle cx="17" cy="21" r="4" stroke="currentColor" stroke-width="2"/>
              <path d="M6 32l9-8 7 6 5-4 9 8" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
            </svg>
            <span class="cat-placeholder-text">No image</span>
          </div>
        </div>
        <div class="cat-label-wrap">
          <span class="cat-label">${escapeHtml(cat.label)}</span>
          <span class="cat-arrow" aria-hidden="true">→</span>
        </div>
      `;
    }

    card.addEventListener("click", () => {
      window.location.hash = `#category=${cat.id}`;
    });

    ui.categoryGrid.appendChild(card);
  });
}

async function loadCategories() {
  ui.categoryGrid.innerHTML =
    '<p class="empty-state loading-state" aria-live="polite" aria-busy="true">Loading categories...</p>';

  try {
    const discoveredCategories = await loadCategoriesFromSheet();
    state.categories = discoveredCategories.length > 0 ? discoveredCategories : [...FALLBACK_CATEGORIES];
  } catch {
    state.categories = [...FALLBACK_CATEGORIES];
  }

  renderCategoryGrid();
}

async function loadCategoriesFromSheet() {
  const response = await fetchWithTimeout(namedSheetUrl(CATEGORY_INDEX_SHEET));
  if (!response.ok) {
    throw new Error(`Failed to load category index: ${response.status}`);
  }

  const csvText = await response.text();
  return parseCategorySheetCsv(csvText);
}

function parseCategorySheetCsv(csvText) {
  const rows = parseCsv(csvText);
  if (rows.length < 2) return [];

  const headers = rows[0].map((value) => normalizeSpecKey(value));
  const fallbackByGid = new Map(FALLBACK_CATEGORIES.map((category) => [String(category.gid), category]));
  const categories = [];

  rows.slice(1).forEach((row) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = String(row[index] || "").trim();
    });

    const gid = record.gid;
    const label = normalizeCategoryLabel(record.label);
    if (!gid || !label) return;

    const fallbackCategory = fallbackByGid.get(gid);
    categories.push({
      id: record.id || fallbackCategory?.id || slugifyCategoryId(label),
      label,
      icon: record.icon || fallbackCategory?.icon || DEFAULT_CATEGORY_ICON,
      gid,
      // photo_url comes from the sheet column — empty string if not set
      photo_url: record.photo_url || "",
    });
  });

  return categories;
}

function normalizeCategoryLabel(label) {
  return String(label || "").replace(/\s+/g, " ").trim();
}

function slugifyCategoryId(label) {
  return String(label)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function showHomeView() {
  ui.homeView.hidden = false;
  ui.categoryView.hidden = true;
  state.currentCategoryId = null;
  document.title = "Machine Specifications";

  // Reset the home-page category search so it starts fresh every time
  if (ui.categorySearch) {
    ui.categorySearch.value = "";
    filterCategoryGrid();
  }
}

// ─── Category View ────────────────────────────────────────────────────────────

function openCategory(category) {
  const alreadyOpen = state.currentCategoryId === category.id;

  state.currentCategoryId = category.id;

  ui.categoryEyebrow.textContent = "Machine Category";
  ui.categoryTitle.textContent = category.label;
  document.title = `${category.label} — Machine Specifications`;

  ui.homeView.hidden = true;
  ui.categoryView.hidden = false;

  if (alreadyOpen) {
    ui.searchInput.value = "";
    ui.brandFilter.value = "";
    applyFilters();
    return;
  }

  state.machines = [];
  state.visibleMachines = [];

  ui.searchInput.value = "";
  ui.brandFilter.innerHTML = `<option value="">All brands</option>`;
  setActiveTab("machineListPanel");

  loadCategory(category);
}

async function loadCategory(category) {
  const cached = categoryCache.get(category.gid);
  if (cached && Date.now() - cached.cachedAt < CATEGORY_CACHE_TTL) {
    setMachines(cached.data);
    restoreDeepLinkState();
    return;
  }
  renderListLoading();

  try {
    const sheetsData = await loadMachinesFromSheets(category.gid);
    if (sheetsData.length > 0) {
      categoryCache.set(category.gid, { data: sheetsData, cachedAt: Date.now() });
      setMachines(sheetsData);
      restoreDeepLinkState();
      return;
    }
    renderListError(
      "No machine data found for this category. Check that the Google Sheet tab is published and contains rows.",
    );
  } catch (err) {
    renderListError(err.message);
  }
}

function restoreDeepLinkState() {
  const hash = window.location.hash;
  const compareMatch = hash.match(/&compare=([^&]+)/);
  if (compareMatch) {
    const parts = compareMatch[1].split(",");
    if (parts.length < 2) return;
    const [idA, idB] = parts;
    if (idA) ui.machineA.value = idA;
    if (idB) ui.machineB.value = idB;
    setActiveTab("comparePanel");
    renderCompareTable();
  }
}

// ─── Data Loading ─────────────────────────────────────────────────────────────

async function loadMachinesFromSheets(gid) {
  const response = await fetchWithTimeout(sheetUrl(gid));
  if (!response.ok) throw new Error(`Failed to load Google Sheets CSV: ${response.status}`);

  const csvText = await response.text();
  const matrix = parseCsv(csvText);
  return mapSpecMatrixToMachines(matrix);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        value += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
      continue;
    }

    value += char;
  }

  // #2: trim the last cell to strip any trailing \r or whitespace
  if (value.length > 0 || row.length > 1) {
    row.push(value.trim());
    rows.push(row);
  }

  return rows;
}

function mapSpecMatrixToMachines(matrix) {
  if (!Array.isArray(matrix) || matrix.length === 0) return [];

  const maxCols = matrix.reduce((max, row) => Math.max(max, row.length), 0);
  const machineColumns = [];

  for (let col = 1; col < maxCols; col += 1) {
    const hasAnyData = matrix.some((row) => String(row[col] || "").trim() !== "");
    if (hasAnyData) machineColumns.push(col);
  }

  // Build an ordered row descriptor array shared across all machines.
  // Each entry is either a section header or a spec row (with a reference to the raw matrix row).
  // Duplicate labels in different sections stay as separate entries — no merging.
  const rowInfo = [];
  matrix.forEach((row) => {
    const rawLabel = String(row[0] || "").trim();
    if (!rawLabel) return;
    const hasData = machineColumns.some((col) => String(row[col] || "").trim() !== "");
    if (!hasData) {
      if (!isPhotoKey(normalizeSpecKey(rawLabel))) {
        rowInfo.push({ type: "section", label: rawLabel, row });
      }
    } else {
      const key = normalizeSpecKey(rawLabel);
      if (key) {
        if (isPhotoKey(key)) {
          rowInfo.push({ type: "photo", label: rawLabel, key, row });
        } else {
          rowInfo.push({ type: "spec", label: rawLabel, key, row });
        }
      }
    }
  });

  return machineColumns
    .map((col, index) => mapColumnToMachine(matrix, col, index + 1, rowInfo))
    .filter(Boolean);
}

function mapColumnToMachine(matrix, colIndex, machineNumber, rowInfo) {
  // flat raw: for search/filter and meta-field extraction (brand, model, etc.)
  const raw = {};
  // specEntries: ordered display list, one entry per sheet row, no merging of duplicate labels
  const specEntries = [];

  rowInfo.forEach((info) => {
    if (info.type === "section") {
      specEntries.push({ type: "section", label: info.label });
      return;
    }
    const rawValue = String(info.row[colIndex] || "").trim();
    // flat raw keeps last value for each key (used only for brand/model/ID extraction)
    if (rawValue) raw[info.key] = rawValue;
    if (info.type === "spec") {
      specEntries.push({ type: "spec", label: info.label, key: info.key, value: rawValue });
    }
  });

  const brand = raw.brand || "Unknown";
  const model = raw.model || raw.test_no || `Machine ${machineNumber}`;
  const category = raw.agricultural_machinery || raw.category || "Machine";
  const machineName = [brand, model].filter(Boolean).join(" ").trim();
  const slugBase =
    raw.test_no ||
    [brand, model]
      .filter(Boolean)
      .join("-")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  const id = slugBase || `machine-${machineNumber}-col-${colIndex}`;

  // Build flat specs from specEntries for search/filter — duplicate keys keep the first
  // non-empty value (no | merging, since display uses specEntries instead)
  const specs = {};
  specEntries.forEach((entry) => {
    if (entry.type === "spec" && entry.value && !(entry.key in specs)) {
      specs[entry.key] = entry.value;
    }
  });
  
  // Include photo URLs in specs purely for logic (they are excluded from display automatically)
  Object.keys(raw).forEach((key) => {
    if (isPhotoKey(key) && raw[key] && !(key in specs)) {
      specs[key] = raw[key];
    }
  });
  // HP alias — B4: also push to specEntries so it appears in detail/compare tables
  const kwRaw = String(specs.rated_maximum_power_kw || "").trim();
  if (kwRaw) {
    let hpValue = "";
    if (kwRaw.includes("-")) {
      const parts = kwRaw.split("-").map(p => parseFloat(p.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        hpValue = `${(parts[0] * 1.34102).toFixed(1)} - ${(parts[1] * 1.34102).toFixed(1)}`;
      }
    } else {
      const kwNum = parseFloat(kwRaw);
      if (!isNaN(kwNum)) hpValue = (kwNum * 1.34102).toFixed(1);
    }
    if (hpValue) {
      specs.engine_power_hp = hpValue;
      specEntries.push({ type: "spec", label: "Engine Power (HP)", key: "engine_power_hp", value: hpValue });
    }
  }

  return {
    id,
    name: machineName || `Machine ${machineNumber}`,
    brand,
    model,
    category,
    specs,
    specEntries,
  };
}

function normalizeSpecKey(label) {
  return String(label)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[%]/g, "percent")
    .replace(/[+]/g, "plus")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s/g, "_")
    .replace(/^_+|_+$/g, "");
}

// ─── Events ───────────────────────────────────────────────────────────────────

function debounce(fn, delay) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function updateCompareHash() {
  const currentHash = window.location.hash;
  if (!currentHash.startsWith("#category=")) return;
  const hashBase = currentHash.split("&")[0];
  const a = ui.machineA.value;
  const b = ui.machineB.value;
  if (a || b) {
    history.replaceState(null, "", `${hashBase}&compare=${a},${b}`);
  } else {
    history.replaceState(null, "", hashBase);
  }
}

function filterCategoryGrid() {
  const keyword = (ui.categorySearch.value || "").trim().toLowerCase();
  const cards = ui.categoryGrid.querySelectorAll(".category-card");
  let visibleCount = 0;

  cards.forEach((card) => {
    const label = (card.getAttribute("aria-label") || "").toLowerCase();
    const matches = !keyword || label.includes(keyword);
    card.hidden = !matches;
    if (matches) visibleCount += 1;
  });

  // Toggle clear button visibility
  if (ui.categorySearchClear) {
    ui.categorySearchClear.hidden = !keyword;
  }

  // Update status text for screen readers & empty state
  if (ui.categorySearchStatus) {
    if (keyword && visibleCount === 0) {
      ui.categorySearchStatus.textContent = `No categories match "${keyword}".`;
      ui.categorySearchStatus.hidden = false;
    } else if (keyword) {
      ui.categorySearchStatus.textContent = `Showing ${visibleCount} of ${cards.length} categories.`;
      ui.categorySearchStatus.hidden = false;
    } else {
      ui.categorySearchStatus.hidden = true;
    }
  }
}

const debouncedFilterCategories = debounce(filterCategoryGrid, 150);
const debouncedApplyFilters = debounce(applyFilters, 200);

function bindEvents() {
  // B3: clear hash cleanly instead of leaving #home in URL
  ui.backBtn.addEventListener("click", () => {
    history.pushState("", "", location.pathname + location.search);
    showHomeView();
  });

  // Home-page category search
  if (ui.categorySearch) {
    ui.categorySearch.addEventListener("input", debouncedFilterCategories);
  }
  if (ui.categorySearchClear) {
    ui.categorySearchClear.addEventListener("click", () => {
      ui.categorySearch.value = "";
      filterCategoryGrid();
      ui.categorySearch.focus();
    });
  }

  ui.searchInput.addEventListener("input", debouncedApplyFilters);
  ui.brandFilter.addEventListener("change", applyFilters);

  ui.machineA.addEventListener("change", () => {
    updateCompareHash();
    renderCompareTable();
  });
  ui.machineB.addEventListener("change", () => {
    updateCompareHash();
    renderCompareTable();
  });
  
  ui.differencesOnly.addEventListener("change", applyDiffHighlight);

  // F1: Copy shareable compare URL
  const copyLinkBtn = document.getElementById("copyLinkBtn");
  if (copyLinkBtn) {
    copyLinkBtn.addEventListener("click", copyCompareLink);
  }

  // F5: Manual data refresh
  const refreshBtn = document.getElementById("refreshBtn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", refreshCurrentCategory);
  }
  
  ui.tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setActiveTab(button.dataset.target);
    });
  });

  const scrollTopBtn = document.getElementById("scrollTopBtn");
  if (scrollTopBtn) {
    window.addEventListener("scroll", () => {
      scrollTopBtn.hidden = window.scrollY <= 400;
    });
    scrollTopBtn.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }
}

function setActiveTab(targetId) {
  ui.tabPanels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.id === targetId);
  });

  ui.tabButtons.forEach((button) => {
    const isActive = button.dataset.target === targetId;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });
}

// ─── Machine State ────────────────────────────────────────────────────────────

function setMachines(data) {
  if (!Array.isArray(data)) {
    renderListError("Data must be an array of machines.");
    return;
  }

  // P1: Reset built flag so cards get rebuilt for new data
  ui.machineList.dataset.built = "";
  ui.machineList.innerHTML = "";

  state.machines = data
    .filter((machine) => machine && machine.id && machine.name && machine.specs)
    .map((machine) => ({
      id: String(machine.id),
      name: String(machine.name),
      brand: machine.brand ? String(machine.brand) : "Unknown",
      model: machine.model ? String(machine.model) : "",
      category: machine.category ? String(machine.category) : "",
      specs: machine.specs,
      specEntries: machine.specEntries || null,
    }));

  state.visibleMachines = [...state.machines];

  populateBrandOptions();
  populateCompareOptions();
  renderMachineList();
  renderCompareTable();
}

function populateBrandOptions() {
  const brands = [...new Set(state.machines.map((m) => m.brand))].sort((a, b) =>
    a.localeCompare(b),
  );

  ui.brandFilter.innerHTML = `<option value="">All brands</option>`;
  brands.forEach((brand) => {
    const option = document.createElement("option");
    option.value = brand;
    option.textContent = brand;
    ui.brandFilter.appendChild(option);
  });
}

function populateCompareOptions() {
  ui.machineA.innerHTML = "";
  ui.machineB.innerHTML = "";

  const placeholderA = document.createElement("option");
  placeholderA.value = "";
  placeholderA.textContent = "Select machine";
  ui.machineA.appendChild(placeholderA);

  const placeholderB = document.createElement("option");
  placeholderB.value = "";
  placeholderB.textContent = "Select machine";
  ui.machineB.appendChild(placeholderB);

  state.machines.forEach((machine) => {
    const optionA = document.createElement("option");
    optionA.value = machine.id;
    optionA.textContent = machine.name;
    ui.machineA.appendChild(optionA);

    const optionB = document.createElement("option");
    optionB.value = machine.id;
    optionB.textContent = machine.name;
    ui.machineB.appendChild(optionB);
  });

  if (state.machines.length > 1) {
    ui.machineA.value = state.machines[0].id;
    ui.machineB.value = state.machines[1].id;
    return;
  }

  ui.machineA.value = "";
  ui.machineB.value = "";
}

function applyFilters() {
  const keyword = ui.searchInput.value.trim().toLowerCase();
  const brand = ui.brandFilter.value;

  state.visibleMachines = state.machines.filter((machine) => {
    const specValues = Object.values(machine.specs || {}).join(" ");
    const haystack = [machine.name, machine.brand, machine.model, machine.category, specValues]
      .join(" ")
      .toLowerCase();
    const matchesKeyword = !keyword || haystack.includes(keyword);
    const matchesBrand = !brand || machine.brand === brand;
    return matchesKeyword && matchesBrand;
  });

  renderMachineList();
}

// ─── Machine List Rendering ───────────────────────────────────────────────────

function renderMachineList() {
  ui.listCount.textContent = `${state.visibleMachines.length} item${
    state.visibleMachines.length === 1 ? "" : "s"
  }`;

  // P1: Build cards once, then toggle visibility on filter instead of rebuilding DOM
  const visibleIds = new Set(state.visibleMachines.map(m => m.id));

  // If cards are already built, just toggle visibility
  if (ui.machineList.children.length > 0 && ui.machineList.dataset.built === "true") {
    let anyVisible = false;
    Array.from(ui.machineList.children).forEach(el => {
      if (el.classList.contains("empty-state")) { el.remove(); return; }
      const id = el.dataset.machineId;
      const show = id && visibleIds.has(id);
      el.hidden = !show;
      if (show) anyVisible = true;
      // F4: clear previous search highlights
      clearHighlights(el);
    });
    if (!anyVisible) {
      // Remove old empty state if any, then add new one
      const existing = ui.machineList.querySelector(".empty-state");
      if (existing) existing.remove();
      const p = document.createElement("p");
      p.className = "empty-state";
      p.textContent = "No machines match your filters.";
      ui.machineList.appendChild(p);
    }
    return;
  }

  // First render: build all cards
  ui.machineList.innerHTML = "";

  if (state.machines.length === 0) {
    ui.machineList.innerHTML = `<p class="empty-state">No machines match your filters.</p>`;
    return;
  }

  state.machines.forEach((machine) => {
    const card = ui.cardTemplate.content.cloneNode(true);
    const article = card.querySelector(".machine-card");
    article.dataset.machineId = machine.id;
    article.hidden = !visibleIds.has(machine.id);

    const photoPlaceholder = card.querySelector(".machine-photo-placeholder");
    const photo = card.querySelector(".machine-photo");
    const photoUrl = resolveMachinePhotoUrl(machine);
    // A5: omit category from title since user already navigated into that category
    const machineTitle = [machine.brand, machine.model]
      .filter(Boolean)
      .join(" ");

    card.querySelector(".machine-name").textContent = machineTitle || machine.name;
    card.querySelector(".machine-type").textContent = valueOrDash(machine.specs.type);
    card.querySelector(".machine-requested-by").textContent = valueOrDash(
      machine.specs.test_requested_by,
    );

    if (photoUrl) {
      photo.alt = `${machine.name} photo`;
      photo.src = photoUrl;
      photo.hidden = false;
      photoPlaceholder.hidden = true;
      // B1: use addEventListener instead of inline onerror (CSP-safe)
      photo.addEventListener("error", () => {
        photo.hidden = true;
        photoPlaceholder.hidden = false;
      });
    } else {
      photo.hidden = true;
      photoPlaceholder.hidden = false;
    }

    const detailsToggle = card.querySelector(".details-toggle");
    const printBtn = card.querySelector(".print-btn");
    const detailsWrap = card.querySelector(".machine-spec-details");
    const detailTable = buildDetailTable(machine.specEntries, machine.specs);
    detailsWrap.appendChild(detailTable);
    detailsToggle.addEventListener("click", () => {
      const expanded = detailsToggle.getAttribute("aria-expanded") === "true";
      const nextState = !expanded;
      detailsToggle.setAttribute("aria-expanded", String(nextState));
      detailsToggle.textContent = nextState
        ? "Hide detailed specifications"
        : "Show detailed specifications";
      detailsToggle.classList.toggle("is-open", nextState);
      detailsWrap.hidden = !nextState;
      // F4: highlight matching text when expanding
      if (nextState) {
        const keyword = ui.searchInput.value.trim().toLowerCase();
        highlightText(detailsWrap, keyword);
      }
    });

    if (printBtn) {
      printBtn.addEventListener("click", () => {
        printMachineBulletin(machine);
      });
    }

    ui.machineList.appendChild(card);
  });
  ui.machineList.dataset.built = "true";
}

// specEntries: ordered [{type:'section',label} | {type:'spec',label,key,value}]
// specs: flat object used as fallback when specEntries is unavailable
function buildDetailTable(specEntries, specs) {
  const table = document.createElement("table");
  table.className = "machine-spec-table";
  const body = document.createElement("tbody");

  if (specEntries) {
    let pairBuffer = []; // accumulate spec entries before flushing as paired rows

    const flushPairs = () => {
      for (let i = 0; i < pairBuffer.length; i += 2) {
        const tr = document.createElement("tr");
        appendSpecCells(tr, pairBuffer[i].label, pairBuffer[i].value);
        if (pairBuffer[i + 1]) appendSpecCells(tr, pairBuffer[i + 1].label, pairBuffer[i + 1].value);
        body.appendChild(tr);
      }
      pairBuffer = [];
    };

    specEntries.forEach((entry) => {
      if (entry.type === "section") {
        flushPairs();
        const tr = document.createElement("tr");
        const cell = document.createElement("th");
        cell.colSpan = 4;
        cell.className = "spec-section-header";
        cell.textContent = entry.label;
        tr.appendChild(cell);
        body.appendChild(tr);
      } else {
        pairBuffer.push(entry);
      }
    });
    flushPairs();
  } else {
    // Fallback: flat rendering without sections
    const keys = getFieldKeys(specs, {}).filter((key) => !isPhotoKey(key));
    for (let i = 0; i < keys.length; i += 2) {
      const tr = document.createElement("tr");
      appendSpecCells(tr, humanizeKey(keys[i]), specs[keys[i]]);
      if (keys[i + 1]) appendSpecCells(tr, humanizeKey(keys[i + 1]), specs[keys[i + 1]]);
      body.appendChild(tr);
    }
  }

  table.appendChild(body);
  return table;
}

// label: human-readable column header; value: raw spec value (or empty string)
function appendSpecCells(row, label, value) {
  const labelCell = document.createElement("th");
  const valueCell = document.createElement("td");
  labelCell.textContent = label;
  valueCell.textContent = valueOrDash(value);
  row.appendChild(labelCell);
  row.appendChild(valueCell);
}

// ─── Photo Resolver ───────────────────────────────────────────────────────────
// Reads photo_url directly from machine specs — WordPress media URLs only.
// Returns empty string if not set, triggering the placeholder instead.

function resolveMachinePhotoUrl(machine) {
  const candidates = [
    machine.specs?.photo_url,
    machine.specs?.photo,
    machine.specs?.image_url,
    machine.specs?.image,
    machine.photo_url,
    machine.photoUrl,
    machine.image_url,
    machine.imageUrl,
  ];

  const url = candidates.find(
    (candidate) =>
      typeof candidate === "string" &&
      candidate.trim() !== "" &&
      /^https?:\/\//i.test(candidate.trim()),
  );

  return url ? url.trim() : "";
}

// CSP-safe compare photo setter — uses AbortController to cancel stale error listeners
function setComparePhoto(imgEl, placeholderEl, url, altText) {
  if (imgEl._photoAbort) imgEl._photoAbort.abort();
  const ac = new AbortController();
  imgEl._photoAbort = ac;

  if (url) {
    imgEl.src = url;
    imgEl.alt = altText;
    imgEl.hidden = false;
    placeholderEl.hidden = true;
    imgEl.addEventListener("error", () => {
      imgEl.hidden = true;
      placeholderEl.hidden = false;
    }, { signal: ac.signal, once: true });
  } else {
    imgEl.hidden = true;
    imgEl.removeAttribute("src");
    imgEl.alt = "";
    placeholderEl.hidden = false;
  }
}

// ─── Compare Table ─────────────────────────────────────────────────────────────

function renderCompareTable() {
  const machineA = state.machines.find((machine) => machine.id === ui.machineA.value);
  const machineB = state.machines.find((machine) => machine.id === ui.machineB.value);

  ui.compareBody.innerHTML = "";

  if (!machineA || !machineB) {
    resetCompareDisplay();
    ui.compareBody.innerHTML =
      '<tr><td colspan="3">Select two machines to compare.</td></tr>';
    return;
  }

  if (machineA.id === machineB.id) {
    resetCompareDisplay();
    ui.compareBody.innerHTML =
      '<tr><td colspan="3">Please select two <strong>different</strong> machines to compare.</td></tr>';
    return;
  }

  ui.machineAHeading.textContent = machineA.name;
  ui.machineBHeading.textContent = machineB.name;
  ui.machineAImageHeading.textContent = machineA.name;
  ui.machineBImageHeading.textContent = machineB.name;

  // B2: use addEventListener instead of inline onerror (CSP-safe)
  // Machine A photo
  const urlA = resolveMachinePhotoUrl(machineA);
  setComparePhoto(ui.machineAPhoto, ui.machineAPhotoPlaceholder, urlA, machineA.name);

  // Machine B photo
  const urlB = resolveMachinePhotoUrl(machineB);
  setComparePhoto(ui.machineBPhoto, ui.machineBPhotoPlaceholder, urlB, machineB.name);

  // Use specEntries for position-aligned rendering (handles duplicate labels correctly)
  const entriesA = machineA.specEntries || null;
  const entriesB = machineB.specEntries || [];
  let rowsRendered = 0;

  if (entriesA) {
    entriesA.forEach((entryA, i) => {
      if (entryA.type === "section" || entryA.type === "photo") {
        const tr = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 3;
        cell.className = "compare-section-header";
        cell.textContent = entryA.label;
        tr.appendChild(cell);
        ui.compareBody.appendChild(tr);
        return;
      }
      const entryB = entriesB[i];
      const aValue = valueOrDash(entryA.value);
      const bValue = entryB ? valueOrDash(entryB.value) : "N/A";
      const isDifferent = normalizeForCompare(aValue) !== normalizeForCompare(bValue);
      const tr = document.createElement("tr");
      if (isDifferent) tr.classList.add("is-different");
      tr.innerHTML = `
        <td class="spec-name">${escapeHtml(entryA.label)}</td>
        <td>${escapeHtml(aValue)}</td>
        <td>${escapeHtml(bValue)}</td>
      `;
      ui.compareBody.appendChild(tr);
      rowsRendered += 1;
    });
  } else {
    // Fallback: flat rendering without sections
    const fields = getFieldKeys(machineA.specs, machineB.specs);
    fields.forEach((field) => {
      if (isPhotoKey(field)) return;
      const aValue = valueOrDash(machineA.specs[field]);
      const bValue = valueOrDash(machineB.specs[field]);
      const isDifferent = normalizeForCompare(aValue) !== normalizeForCompare(bValue);
      const tr = document.createElement("tr");
      if (isDifferent) tr.classList.add("is-different");
      tr.innerHTML = `
        <td class="spec-name">${escapeHtml(humanizeKey(field))}</td>
        <td>${escapeHtml(aValue)}</td>
        <td>${escapeHtml(bValue)}</td>
      `;
      ui.compareBody.appendChild(tr);
      rowsRendered += 1;
    });
  }

  if (rowsRendered === 0) {
    ui.compareBody.innerHTML = `<tr><td colspan="3">No specifications available for these machines.</td></tr>`;
  }

  applyDiffHighlight();
}

function applyDiffHighlight() {
  const table = document.getElementById("compareTable");
  if (table) table.classList.toggle("highlight-diffs", ui.differencesOnly.checked);
}

function resetCompareDisplay() {
  ui.machineAHeading.textContent = "Machine A";
  ui.machineBHeading.textContent = "Machine B";
  ui.machineAImageHeading.textContent = "Machine A";
  ui.machineBImageHeading.textContent = "Machine B";
  ui.machineAPhoto.hidden = true;
  ui.machineBPhoto.hidden = true;
  ui.machineAPhoto.removeAttribute("src");
  ui.machineBPhoto.removeAttribute("src");
  ui.machineAPhoto.alt = "";
  ui.machineBPhoto.alt = "";
  ui.machineAPhotoPlaceholder.hidden = false;
  ui.machineBPhotoPlaceholder.hidden = false;
}

// ─── F1: Copy Shareable Compare Link ─────────────────────────────────────────────

function copyCompareLink() {
  const btn = document.getElementById("copyLinkBtn");
  const url = window.location.href;
  navigator.clipboard.writeText(url).then(() => {
    const original = btn.innerHTML;
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:0.3rem;"><polyline points="20 6 9 17 4 12"/></svg> Copied!`;
    setTimeout(() => { btn.innerHTML = original; }, 2000);
  }).catch(() => {
    // Fallback for older browsers
    prompt("Copy this link:", url);
  });
}
// ─── F5: Manual Data Refresh ──────────────────────────────────────────────────

async function refreshCurrentCategory() {
  const btn = document.getElementById("refreshBtn");
  if (!state.currentCategoryId) return;
  const category = state.categories.find(c => c.id === state.currentCategoryId);
  if (!category) return;

  categoryCache.delete(category.gid);

  // Visual feedback
  btn.disabled = true;
  btn.textContent = "↺ Refreshing...";

  try {
    await loadCategory(category);
  } finally {
    btn.disabled = false;
    btn.textContent = "↺ Refresh";
  }
}

// ─── F4: Search Highlighting ──────────────────────────────────────────────────

function highlightText(element, keyword) {
  if (!keyword) return;
  // First clear any existing highlights
  clearHighlights(element);
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
  const nodesToReplace = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const lowerText = node.textContent.toLowerCase();
    if (lowerText.includes(keyword)) {
      nodesToReplace.push(node);
    }
  }
  nodesToReplace.forEach(node => {
    const text = node.textContent;
    const regex = new RegExp(`(${escapeRegex(keyword)})`, "gi");
    const frag = document.createDocumentFragment();
    let lastIndex = 0;
    text.replace(regex, (match, p1, offset) => {
      frag.appendChild(document.createTextNode(text.slice(lastIndex, offset)));
      const mark = document.createElement("mark");
      mark.className = "search-highlight";
      mark.textContent = match;
      frag.appendChild(mark);
      lastIndex = offset + match.length;
    });
    if (lastIndex < text.length) {
      frag.appendChild(document.createTextNode(text.slice(lastIndex)));
    }
    node.parentNode.replaceChild(frag, node);
  });
}

function clearHighlights(element) {
  const marks = element.querySelectorAll("mark.search-highlight");
  marks.forEach(mark => {
    const text = document.createTextNode(mark.textContent);
    mark.parentNode.replaceChild(text, mark);
  });
  // Merge adjacent text nodes after replacing marks
  element.normalize();
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function getFieldKeys(specsA, specsB) {
  const keys = new Set([...Object.keys(specsA || {}), ...Object.keys(specsB || {})]);
  return [...keys];
}

/** Returns true for any spec key that represents a photo/image URL — should never be shown in tables. */
function isPhotoKey(key) {
  return [
    "photo_url", "photo", "image_url", "image",
    "photo_link", "image_link", "machine_photo", "machine_image",
  ].includes(key) || key.endsWith("_photo") || key.endsWith("_image") || key.endsWith("_photo_url") || key.endsWith("_image_url");
}

function renderListLoading() {
  ui.listCount.textContent = "Loading…";
  ui.machineList.innerHTML = `
    <p class="empty-state loading-state" aria-live="polite" aria-busy="true">
      Loading machine data…
    </p>`;
}

function renderListError(message) {
  ui.listCount.textContent = "0 items";
  ui.machineList.innerHTML = `<p class="empty-state">${escapeHtml(message)}</p>`;
}

const KEY_ACRONYMS = {
  pto: "PTO",
  rpm: "RPM",
  kw: "kW",
  hp: "HP",
  lpm: "LPM",
  mm: "mm",
  kn: "kN",
  nm: "Nm",
  cm3: "cm³",
  lph: "L/h",
  cv: "CV",
};

function humanizeKey(key) {
  return String(key)
    .replace(/_/g, " ")
    .replace(/\b\w+/g, (word) => {
      const lower = word.toLowerCase();
      return KEY_ACRONYMS[lower] ?? (word[0].toUpperCase() + word.slice(1));
    });
}

function valueOrDash(value) {
  return value === null || value === undefined || value === "" ? "N/A" : String(value);
}

function normalizeForCompare(value) {
  return String(value).trim().toLowerCase();
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function printMachineBulletin(machine) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Please allow pop-ups to print the machine bulletin.");
    return;
  }

  const pluginUrl = window.TBM_PLUGIN?.pluginUrl || "";
  const baseUrl = pluginUrl || (document.baseURI.endsWith("/") ? document.baseURI : document.baseURI.replace(/\/[^/]*$/, "/"));
  const amtecLogoStr = `${baseUrl}${pluginUrl ? "assets/" : ""}amtec-logo.png`;
  const uplbLogoStr  = `${baseUrl}${pluginUrl ? "assets/" : ""}uplb-logo.png`;

  const photoUrl = resolveMachinePhotoUrl(machine);
  let specRows = "";

  if (machine.specEntries && machine.specEntries.length > 0) {
    machine.specEntries.forEach((entry) => {
      if (entry.type === "section") {
        specRows += `<tr><th colspan="2" class="section-header">${escapeHtml(entry.label)}</th></tr>`;
      } else {
        specRows += `<tr><th>${escapeHtml(entry.label)}</th><td>${escapeHtml(valueOrDash(entry.value))}</td></tr>`;
      }
    });
  } else {
    // Fallback if specEntries missed
    const keys = getFieldKeys(machine.specs, {}).filter((key) => !isPhotoKey(key));
    keys.forEach((key) => {
      specRows += `<tr><th>${escapeHtml(humanizeKey(key))}</th><td>${escapeHtml(valueOrDash(machine.specs[key]))}</td></tr>`;
    });
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(machine.name)} - Specification Bulletin</title>
  <style>
    body { font-family: "Segoe UI", system-ui, sans-serif; color: #1e293b; line-height: 1.5; margin: 0; padding: 2.5rem; }
    .header { margin-bottom: 2rem; border-bottom: 3px solid #d97706; padding-bottom: 1.5rem; }
    .header-logos { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1.5rem; }
    .logo { height: 85px; width: auto; object-fit: contain; }
    .uplb-logo { order: 1; }
    .header-text { order: 2; flex: 1; text-align: center; }
    .amtec-logo { order: 3; }
    .header-title { font-size: 1.15rem; font-weight: 700; color: #1b365d; text-transform: uppercase; margin-bottom: 0.2rem; line-height: 1.3; }
    .header-subtitle { font-size: 0.9rem; color: #475569; line-height: 1.3; }
    
    .machine-meta { text-align: center; }
    .machine-meta h1 { margin: 0.4rem 0; font-size: 2.2rem; color: #1b365d; line-height: 1.1; }
    .brand { color: #d97706; font-weight: 700; font-size: 1.1rem; text-transform: uppercase; letter-spacing: 0.08em; }
    .meta { color: #64748b; font-size: 0.95rem; font-weight: 500; }
    .content { display: flex; gap: 2.5rem; align-items: flex-start; }
    .photo { flex: 0 0 320px; }
    .photo img { width: 100%; border-radius: 8px; border: 1px solid #e2e8f0; object-fit: cover; }
    .specs { flex: 1; }
    table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    th, td { border: 1px solid #cbd5e1; padding: 0.55rem 0.75rem; text-align: left; vertical-align: top; }
    th { width: 38%; color: #475569; font-weight: 600; background: #f8fafc; }
    td { width: 62%; color: #0f172a; }
    .section-header { background: #1b365d; color: #ffffff; text-transform: uppercase; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.06em; padding: 0.5rem 0.75rem; text-align: left; }
    @media print {
      body { padding: 0; }
      .content { display: block; }
      .photo { max-width: 400px; margin: 0 auto 2rem; }
      .section-header { background: #f1f5f9; color: #1e293b; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      th { background: #f8fafc; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .header { border-bottom-color: #1b365d; }
      tr { page-break-inside: avoid; }
    }
    @page { margin: 0.75in; }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-logos">
      <img src="${escapeHtml(uplbLogoStr)}" class="logo uplb-logo" alt="UPLB Logo" onerror="this.style.display='none'"/>
      <div class="header-text">
        <div class="header-title">Agricultural Machinery Testing and Evaluation Center (AMTEC)</div>
        <div class="header-subtitle">University of the Philippines Los Baños<br>College of Engineering and Agro-Industrial Technology</div>
      </div>
      <img src="${escapeHtml(amtecLogoStr)}" class="logo amtec-logo" alt="AMTEC Logo" onerror="this.style.display='none'"/>
    </div>
    <div class="machine-meta">
      <div class="brand">${escapeHtml(machine.brand || 'Equipment')}</div>
      <h1>${escapeHtml(machine.model || machine.name)}</h1>
      <div class="meta">${escapeHtml(machine.category)}</div>
    </div>
  </div>
  <div class="content">
    ${photoUrl ? `<div class="photo"><img src="${escapeHtml(photoUrl)}" alt="Photo"/></div>` : ''}
    <div class="specs">
      <table>
        <tbody>
          ${specRows}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>`;

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.addEventListener("load", () => {
    printWindow.print();
    printWindow.addEventListener("afterprint", () => printWindow.close());
  });
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

init();
