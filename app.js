const tg = window.Telegram.WebApp;
tg.expand();

/* ===============================
   ТЕКУЩАЯ СЕРИЯ
================================ */
let currentSeries = null;

/* ===============================
   НАБОРЫ LEGO
================================ */
const legoSets = [
  {
    id: "76218",
    series: "Marvel",
    name: "Sanctum Sanctorum",
    minifigs: [
      "Doctor Strange",
      "Wong",
      "Iron Man",
      "Spider-Man"
    ]
  },
  {
    id: "76193",
    series: "Marvel",
    name: "The Guardian's Ship",
    minifigs: [
      "Star-Lord",
      "Gamora",
      "Rocket",
      "Thor"
    ]
  },
  {
    id: "41630",
    series: "BrickHeadz",
    name: "Jack Skellington & Sally",
    minifigs: []
  }
];

/* ===============================
   ЛОКАЛЬНОЕ ХРАНЕНИЕ
================================ */
const data = JSON.parse(localStorage.getItem("lego")) || {};

function save() {
  localStorage.setItem("lego", JSON.stringify(data));
}

/* ===============================
   ВЫБОР СЕРИИ
================================ */
function selectSeries(series) {
  currentSeries = series;

  document.getElementById("start-screen").classList.add("hidden");
  document.getElementById("catalog-screen").classList.remove("hidden");

  render();
}

/* ===============================
   ОТРИСОВКА КАТАЛОГА
================================ */
function render(filter = "") {
  const catalog = document.getElementById("catalog");
  catalog.innerHTML = "";

  legoSets
    .filter(set =>
      set.series === currentSeries &&
      (
        set.id.includes(filter) ||
        set.name.toLowerCase().includes(filter.toLowerCase())
      )
    )
    .forEach(set => {
      const status = data[set.id]?.status || null;

      const card = document.createElement("div");
      card.className = "card";

      card.innerHTML = `
        <strong>${set.id}</strong> — ${set.name}
        <div class="buttons">
  <button
    class="status-btn status-new ${status === "new" ? "active" : ""}"
    onclick="setStatus('${set.id}', 'new')">
    Есть новое
  </button>

  <button
    class="status-btn status-used ${status === "used" ? "active" : ""}"
    onclick="setStatus('${set.id}', 'used')">
    Есть БУ
  </button>

  <button
    class="status-btn status-wishlist ${status === "wishlist" ? "active" : ""}"
    onclick="setStatus('${set.id}', 'wishlist')">
    Купить
  </button>

  <button onclick="openModal('${set.id}')">
    Открыть 🔍
  </button>
</div>
      `;

      catalog.appendChild(card);
    });
}

/* ===============================
   СТАТУС НАБОРА
================================ */
function setStatus(id, status) {
  data[id] = data[id] || { minifigs: {} };
  data[id].status = status;
  save();
  render(document.getElementById("search").value);
}

/* ===============================
   МОДАЛЬНОЕ ОКНО
================================ */
function openModal(id) {
  const set = legoSets.find(s => s.id === id);
  const modal = document.getElementById("modal");
  const title = document.getElementById("modal-title");
  const minifigsDiv = document.getElementById("minifigs");

  title.textContent = `${set.id} — ${set.name}`;
  minifigsDiv.innerHTML = "";

  data[id] = data[id] || { minifigs: {} };

  if (set.minifigs.length === 0) {
    minifigsDiv.innerHTML = "<em>В этом наборе нет минифигурок</em>";
  } else {
    set.minifigs.forEach(fig => {
      const owned = data[id].minifigs[fig];

      const row = document.createElement("div");
      row.innerHTML = `
        <label>
          <input type="checkbox"
            ${owned ? "checked" : ""}
            onchange="toggleMinifig('${id}', '${fig}')">
          ${fig}
        </label>
      `;
      minifigsDiv.appendChild(row);
    });
  }

  modal.classList.remove("hidden");
}

function closeModal() {
  document.getElementById("modal").classList.add("hidden");
}

/* ===============================
   МИНИФИГУРКИ
================================ */
function toggleMinifig(setId, fig) {
  data[setId].minifigs[fig] = !data[setId].minifigs[fig];
  save();
}

/* ===============================
   ПОИСК
================================ */
document.getElementById("search").addEventListener("input", e => {
  render(e.target.value);
});
