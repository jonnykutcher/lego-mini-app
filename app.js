// ===============================
// Telegram WebApp
// ===============================
const tg = window.Telegram?.WebApp;
try { tg?.expand(); } catch (_) {}

// ===============================
// localStorage keys
// ===============================
const LS_DATA_KEY = "lego";                   // statuses + owned minifigs
const LS_CUSTOM_SETS_KEY = "legoSetsCustom";  // user-added sets only
const LS_MINIFIGS_KEY = "legoMinifigsCustom"; // overrides per set: { [setId]: [minifigs...] }

// ===============================
// Current UI state
// ===============================
let currentSeries = null;
let currentOpenSetId = null;

// ===============================
// Base sets (built-in)
// minifigs: [{id,name,image}]
//
// You can keep BASE_SETS minimal.
// ===============================
const BASE_SETS = [
  {
    id: "76218",
    series: "Marvel",
    name: "Sanctum Sanctorum",
    image: "",
    minifigs: [
      { id: "sh789", name: "Doctor Strange", image: "" },
      { id: "sh790", name: "Wong", image: "" }
    ]
  },
  {
    id: "41630",
    series: "BrickHeadz",
    name: "Jack Skellington & Sally",
    image: "",
    minifigs: []
  }
];

// ===============================
// Runtime sets (base + custom, no duplicates)
// ===============================
let legoSets = [];

// ===============================
// Statuses + owned minifigs
// data[setId] = { status: "new"|"used"|"wishlist", minifigs: { [figId]: true/false } }
// ===============================
const data = JSON.parse(localStorage.getItem(LS_DATA_KEY) || "{}");

function saveData() {
  localStorage.setItem(LS_DATA_KEY, JSON.stringify(data));
}

// ===============================
// Helpers
// ===============================
function $(id) { return document.getElementById(id); }

function normalizeMinifigs(minifigs) {
  if (!Array.isArray(minifigs)) return [];
  return minifigs.map(f => {
    if (typeof f === "string") return { id: f, name: f, image: "" };
    if (f && typeof f === "object") {
      return {
        id: String(f.id ?? f.name ?? "").trim() || "unknown",
        name: String(f.name ?? f.id ?? "").trim() || "Unknown",
        image: String(f.image ?? "").trim()
      };
    }
    return { id: "unknown", name: "Unknown", image: "" };
  });
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// for onclick attributes
function escapeAttr(str) {
  return String(str).replaceAll("\\", "\\\\").replaceAll("'", "\\'");
}

function slug(name) {
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "fig";
}

// ===============================
// Custom sets storage
// ===============================
function loadCustomSets() {
  const arr = JSON.parse(localStorage.getItem(LS_CUSTOM_SETS_KEY) || "[]");
  return Array.isArray(arr) ? arr : [];
}

function saveCustomSets(arr) {
  localStorage.setItem(LS_CUSTOM_SETS_KEY, JSON.stringify(arr));
}

// ===============================
// Minifigs overrides storage
// { [setId]: [ {id,name,image}, ... ] }
// ===============================
function loadMinifigsOverrides() {
  const obj = JSON.parse(localStorage.getItem(LS_MINIFIGS_KEY) || "{}");
  return obj && typeof obj === "object" ? obj : {};
}

function saveMinifigsOverrides(obj) {
  localStorage.setItem(LS_MINIFIGS_KEY, JSON.stringify(obj));
}

function getMinifigsForSet(set) {
  const overrides = loadMinifigsOverrides();
  if (Array.isArray(overrides[set.id])) return normalizeMinifigs(overrides[set.id]);
  return normalizeMinifigs(set.minifigs);
}

function setMinifigsForSet(setId, list) {
  const overrides = loadMinifigsOverrides();
  overrides[setId] = normalizeMinifigs(list);
  saveMinifigsOverrides(overrides);
}

// ===============================
// Build runtime sets without duplicates
// ===============================
function rebuildSets() {
  const custom = loadCustomSets();
  const byId = new Map();

  // base first
  for (const s of BASE_SETS) {
    const set = {
      id: String(s.id),
      series: String(s.series),
      name: String(s.name),
      image: String(s.image || ""),
      minifigs: normalizeMinifigs(s.minifigs),
      _isCustom: false
    };
    byId.set(set.id, set);
  }

  // then custom (ignore duplicates)
  for (const s of custom) {
    const id = String(s.id || "").trim();
    if (!id) continue;
    if (byId.has(id)) continue;

    const set = {
      id,
      series: String(s.series || ""),
      name: String(s.name || ""),
      image: String(s.image || ""),
      minifigs: normalizeMinifigs(s.minifigs),
      _isCustom: true
    };
    byId.set(set.id, set);
  }

  legoSets = Array.from(byId.values());
}

rebuildSets();

// ===============================
// Series selection
// ===============================
function selectSeries(series) {
  currentSeries = series;
  $("start-screen")?.classList.add("hidden");
  $("catalog-screen")?.classList.remove("hidden");
  render($("search")?.value || "");
}

// ===============================
// Render catalog
// ===============================
function render(filter = "") {
  const catalog = $("catalog");
  if (!catalog) return;

  catalog.innerHTML = "";
  const q = String(filter || "").trim().toLowerCase();

  legoSets
    .filter(set => set.series === currentSeries)
    .filter(set => !q || set.id.toLowerCase().includes(q) || set.name.toLowerCase().includes(q))
    .forEach(set => {
      const status = data[set.id]?.status || null;

      const card = document.createElement("div");
      card.className = "card";

      const imageHTML = set.image
        ? `<img src="${set.image}" alt="${escapeHtml(set.name)}">`
        : "";

      const deleteBtnHTML = set._isCustom
        ? `<button class="delete-btn" onclick="deleteSet('${escapeAttr(set.id)}')">Удалить ❌</button>`
        : "";

      card.innerHTML = `
        ${imageHTML}
        <strong>${escapeHtml(set.id)}</strong> — ${escapeHtml(set.name)}
        <div class="buttons">
          <button class="status-btn status-new ${status === "new" ? "active" : ""}"
                  onclick="setStatus('${escapeAttr(set.id)}','new')">Есть новое</button>

          <button class="status-btn status-used ${status === "used" ? "active" : ""}"
                  onclick="setStatus('${escapeAttr(set.id)}','used')">Есть БУ</button>

          <button class="status-btn status-wishlist ${status === "wishlist" ? "active" : ""}"
                  onclick="setStatus('${escapeAttr(set.id)}','wishlist')">Купить</button>

          <button onclick="openModal('${escapeAttr(set.id)}')">Открыть 🔍</button>

          ${deleteBtnHTML}
        </div>
      `;

      catalog.appendChild(card);
    });
}

// ===============================
// Set status
// ===============================
function setStatus(id, status) {
  data[id] = data[id] || { minifigs: {} };
  data[id].status = status;
  saveData();
  render($("search")?.value || "");
}

// ===============================
// Modal (minifigs) - button is INSIDE list, at bottom
// ===============================
function renderAddMinifigTile(minifigsDiv) {
  const tile = document.createElement("button");
  tile.id = "add-minifig-btn-inlist";
  tile.className = "add-minifig-tile";
  tile.type = "button";
  tile.textContent = "➕ Добавить минифигурку";
  tile.addEventListener("click", () => {
    $("add-minifig-form")?.classList.remove("hidden");
  });
  minifigsDiv.appendChild(tile);
}

function openModal(id) {
  const set = legoSets.find(s => s.id === id);
  if (!set) return;

  currentOpenSetId = id;

  const modal = $("modal");
  const title = $("modal-title");
  const minifigsDiv = $("minifigs");
  if (!modal || !title || !minifigsDiv) return;

  title.textContent = `${set.id} — ${set.name}`;
  minifigsDiv.innerHTML = "";

  data[id] = data[id] || { minifigs: {} };

  const figs = getMinifigsForSet(set);

  if (!figs.length) {
    const empty = document.createElement("div");
    empty.innerHTML = `<em>В этом наборе нет минифигурок</em>`;
    minifigsDiv.appendChild(empty);
  } else {
    figs.forEach(fig => {
      const figId = String(fig.id);
      const owned = !!data[id].minifigs[figId];

      const row = document.createElement("div");
      row.className = "minifig-row";

      const imgHtml = fig.image
        ? `<img class="minifig-img" src="${fig.image}" alt="${escapeHtml(fig.name)}">`
        : `<div class="minifig-img placeholder"></div>`;

      row.innerHTML = `
        ${imgHtml}
        <div class="minifig-info">
          <div class="minifig-code"><strong>${escapeHtml(fig.id)}</strong></div>
          <div class="minifig-name">${escapeHtml(fig.name)}</div>
        </div>
        <label class="minifig-own">
          <input type="checkbox" ${owned ? "checked" : ""} onchange="toggleMinifig('${escapeAttr(id)}','${escapeAttr(figId)}')">
          Есть
        </label>
        <button class="minifig-del-btn" onclick="deleteMinifig('${escapeAttr(figId)}')">🗑</button>
      `;

      minifigsDiv.appendChild(row);
    });
  }

  // Add tile at bottom (always)
  renderAddMinifigTile(minifigsDiv);

  modal.classList.remove("hidden");
}

function closeModal() {
  $("modal")?.classList.add("hidden");
  // optional: hide minifig add form when closing modal
  closeAddMinifigForm();
}

function toggleMinifig(setId, figId) {
  data[setId] = data[setId] || { minifigs: {} };
  data[setId].minifigs[figId] = !data[setId].minifigs[figId];
  saveData();
}

// ===============================
// Delete minifig from current set (overrides storage)
// ===============================
function deleteMinifig(figId) {
  if (!currentOpenSetId) return;

  const set = legoSets.find(s => s.id === currentOpenSetId);
  if (!set) return;

  const figs = getMinifigsForSet(set).filter(f => String(f.id) !== String(figId));
  setMinifigsForSet(currentOpenSetId, figs);

  // remove owned mark if existed
  if (data[currentOpenSetId]?.minifigs?.[figId]) {
    delete data[currentOpenSetId].minifigs[figId];
    saveData();
  }

  openModal(currentOpenSetId);
}

// ===============================
// Delete custom set
// ===============================
function deleteSet(id) {
  const set = legoSets.find(s => s.id === id);
  if (!set || !set._isCustom) {
    alert("Этот набор нельзя удалить (он базовый).");
    return;
  }

  if (!confirm(`Удалить набор ${id}?`)) return;

  // remove from custom sets storage
  const custom = loadCustomSets().filter(s => String(s.id) !== id);
  saveCustomSets(custom);

  // remove per-set minifigs overrides if existed
  const overrides = loadMinifigsOverrides();
  if (overrides[id]) {
    delete overrides[id];
    saveMinifigsOverrides(overrides);
  }

  // remove status for set
  if (data[id]) {
    delete data[id];
    saveData();
  }

  rebuildSets();
  render($("search")?.value || "");
}

// ===============================
// Add set form + Drag&Drop image for SET
// ===============================
function setupAddSetForm() {
  const addBtn = $("add-set-btn");
  const form = $("add-set-form");
  const saveBtn = $("save-new-set");

  const dropArea = $("drop-area");
  const fileElem = $("fileElem");
  const preview = $("preview");

  function clearPreview() {
    if (!preview) return;
    preview.src = "";
    preview.classList.add("hidden");
  }

  function handleFile(file) {
    if (!file || !preview) return;
    if (!file.type || !file.type.startsWith("image/")) {
      alert("Пожалуйста, выберите изображение.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      preview.src = reader.result; // base64
      preview.classList.remove("hidden");
    };
    reader.readAsDataURL(file);
  }

  if (addBtn && form) {
    addBtn.addEventListener("click", () => form.classList.remove("hidden"));
  }

  // expose closeAddForm for HTML onclick
  window.closeAddForm = function closeAddForm() {
    form?.classList.add("hidden");
    clearPreview();
    if ($("new-id")) $("new-id").value = "";
    if ($("new-name")) $("new-name").value = "";
    if ($("new-minifigs")) $("new-minifigs").value = "";
  };

  if (dropArea && fileElem) {
    dropArea.addEventListener("click", () => fileElem.click());
    dropArea.addEventListener("dragover", e => { e.preventDefault(); dropArea.classList.add("hover"); });
    dropArea.addEventListener("dragleave", e => { e.preventDefault(); dropArea.classList.remove("hover"); });
    dropArea.addEventListener("drop", e => {
      e.preventDefault();
      dropArea.classList.remove("hover");
      const file = e.dataTransfer?.files?.[0];
      handleFile(file);
    });
    fileElem.addEventListener("change", e => handleFile(e.target?.files?.[0]));
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      const id = String($("new-id")?.value || "").trim();
      const series = String($("new-series")?.value || "").trim();
      const name = String($("new-name")?.value || "").trim();
      const minifigsText = String($("new-minifigs")?.value || "").trim();
      const image = preview?.src ? preview.src : "";

      if (!id || !series || !name) {
        alert("Заполните ID, серию и название набора!");
        return;
      }

      // prevent duplicates
      if (legoSets.some(s => s.id === id)) {
        alert("Набор с таким ID уже существует.");
        return;
      }

      // minifigs: comma separated names -> objects with generated id (can edit later)
      const minifigs = minifigsText
        ? minifigsText.split(",")
            .map(x => x.trim())
            .filter(Boolean)
            .map(n => ({ id: slug(n), name: n, image: "" }))
        : [];

      const newSet = { id, series, name, image, minifigs };

      const custom = loadCustomSets();
      custom.push(newSet);
      saveCustomSets(custom);

      // cleanup
      window.closeAddForm();

      rebuildSets();
      render($("search")?.value || "");
    });
  }
}

// ===============================
// Add minifig form + Drag&Drop image for MINIFIG (inside modal)
// ===============================
function setupAddMinifigForm() {
  const form = $("add-minifig-form");
  const saveBtn = $("save-new-mf");

  const dropArea = $("mf-drop-area");
  const fileElem = $("mf-fileElem");
  const preview = $("mf-preview");

  function clearPreview() {
    if (!preview) return;
    preview.src = "";
    preview.classList.add("hidden");
  }

  function handleFile(file) {
    if (!file || !preview) return;
    if (!file.type || !file.type.startsWith("image/")) {
      alert("Пожалуйста, выберите изображение.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      preview.src = reader.result; // base64
      preview.classList.remove("hidden");
    };
    reader.readAsDataURL(file);
  }

  // expose closeAddMinifigForm for HTML onclick
  window.closeAddMinifigForm = function closeAddMinifigForm() {
    form?.classList.add("hidden");
    clearPreview();
    if ($("new-mf-id")) $("new-mf-id").value = "";
    if ($("new-mf-name")) $("new-mf-name").value = "";
  };

  if (dropArea && fileElem) {
    dropArea.addEventListener("click", () => fileElem.click());
    dropArea.addEventListener("dragover", e => { e.preventDefault(); dropArea.classList.add("hover"); });
    dropArea.addEventListener("dragleave", e => { e.preventDefault(); dropArea.classList.remove("hover"); });
    dropArea.addEventListener("drop", e => {
      e.preventDefault();
      dropArea.classList.remove("hover");
      const file = e.dataTransfer?.files?.[0];
      handleFile(file);
    });
    fileElem.addEventListener("change", e => handleFile(e.target?.files?.[0]));
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      if (!currentOpenSetId) {
        alert("Сначала откройте набор.");
        return;
      }

      const mfId = String($("new-mf-id")?.value || "").trim();
      const mfName = String($("new-mf-name")?.value || "").trim();
      const mfImage = preview?.src ? preview.src : "";

      if (!mfId || !mfName) {
        alert("Заполните артикул и название минифигурки.");
        return;
      }

      const set = legoSets.find(s => s.id === currentOpenSetId);
      if (!set) return;

      const figs = getMinifigsForSet(set);

      if (figs.some(f => String(f.id) === mfId)) {
        alert("Минифигурка с таким артикулом уже есть в этом наборе.");
        return;
      }

      figs.push({ id: mfId, name: mfName, image: mfImage });

      setMinifigsForSet(currentOpenSetId, figs);

      // close and rerender modal
      window.closeAddMinifigForm();
      openModal(currentOpenSetId);
    });
  }
}

// ===============================
// Search binding
// ===============================
function setupSearch() {
  const search = $("search");
  if (!search) return;
  search.addEventListener("input", e => render(e.target.value));
}

// ===============================
// Export functions for inline onclick
// ===============================
window.selectSeries = selectSeries;
window.setStatus = setStatus;
window.openModal = openModal;
window.closeModal = closeModal;
window.toggleMinifig = toggleMinifig;
window.deleteSet = deleteSet;
window.deleteMinifig = deleteMinifig;

// ===============================
// Init
// ===============================
setupSearch();
setupAddSetForm();
setupAddMinifigForm();
