const tg = window.Telegram.WebApp;
tg.expand();

/* 🧱 ТУТ ТЫ ДОБАВЛЯЕШЬ НАБОРЫ */
const legoSets = [
  {
    id: "76218",
    name: "Sanctum Sanctorum",
    minifigs: [
      "Doctor Strange",
      "Wong",
      "Iron Man",
      "Spider-Man"
    ]
  }
];

/* 📦 НЕ ТРОГАЙ НИЖЕ */
const data = JSON.parse(localStorage.getItem("lego")) || {};

function save() {
  localStorage.setItem("lego", JSON.stringify(data));
}

function render(filter = "") {
  const catalog = document.getElementById("catalog");
  catalog.innerHTML = "";

  legoSets
    .filter(set =>
      set.id.includes(filter) ||
      set.name.toLowerCase().includes(filter.toLowerCase())
    )
    .forEach(set => {
      const status = data[set.id]?.status || "none";

      const card = document.createElement("div");
      card.className = "card";

      card.innerHTML = `
        <strong>${set.id}</strong> — ${set.name}
        <div class="buttons">
          <button onclick="setStatus('${set.id}', 'owned')">
            Есть ${status === "owned" ? "✅" : ""}
          </button>
          <button onclick="setStatus('${set.id}', 'wishlist')">
            Купить ${status === "wishlist" ? "🛒" : ""}
          </button>
          <button onclick="openModal('${set.id}')">
            Открыть →
          </button>
        </div>
      `;

      catalog.appendChild(card);
    });
}

function setStatus(id, status) {
  data[id] = data[id] || { minifigs: {} };
  data[id].status = status;
  save();
  render(document.getElementById("search").value);
}

function openModal(id) {
  const set = legoSets.find(s => s.id === id);
  const modal = document.getElementById("modal");
  const title = document.getElementById("modal-title");
  const minifigsDiv = document.getElementById("minifigs");

  title.textContent = `${set.id} — ${set.name}`;
  minifigsDiv.innerHTML = "";

  data[id] = data[id] || { minifigs: {} };

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

  modal.classList.remove("hidden");
}

function closeModal() {
  document.getElementById("modal").classList.add("hidden");
}

function toggleMinifig(setId, fig) {
  data[setId].minifigs[fig] = !data[setId].minifigs[fig];
  save();
}

document.getElementById("search").addEventListener("input", e => {
  render(e.target.value);
});

render();
