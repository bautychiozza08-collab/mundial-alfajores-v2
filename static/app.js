const groups = ["A", "B", "C", "D"];
let alfajores = [];
let currentEditId = null;

const groupsContainer = document.getElementById("groupsContainer");
const generateBtn = document.getElementById("generateBracket");
const saveFixtureBtn = document.getElementById("saveFixture");
const resetBtn = document.getElementById("resetAll");
const statusEl = document.getElementById("status");

const modal = document.getElementById("modal");
const closeModal = document.getElementById("closeModal");
const modalImg = document.getElementById("modalImg");
const modalTitle = document.getElementById("modalTitle");
const editName = document.getElementById("editName");
const editScore = document.getElementById("editScore");
const editPrice = document.getElementById("editPrice");
const editPlace = document.getElementById("editPlace");
const editDate = document.getElementById("editDate");
const editOpinion = document.getElementById("editOpinion");
const saveAlfajorBtn = document.getElementById("saveAlfajor");

const qfMatches = [
  ["qf-1-a","qf-1-b"],
  ["qf-2-a","qf-2-b"],
  ["qf-3-a","qf-3-b"],
  ["qf-4-a","qf-4-b"]
];

const nextMap = {
  "qf-1": "sf-1-a",
  "qf-2": "sf-1-b",
  "qf-3": "sf-2-a",
  "qf-4": "sf-2-b",
  "sf-1": "final-a",
  "sf-2": "final-b",
  "final": "champion"
};

function setStatus(text){ statusEl.textContent = text; }
function imgUrl(path){ return path ? `/static/${path}` : ""; }

function emptyImage(){
  return `<div class="alfajor-img empty" title="Subir foto"></div>`;
}

function imageHtml(alfajor){
  return alfajor.foto
    ? `<img class="alfajor-img" src="${imgUrl(alfajor.foto)}" title="Cambiar foto">`
    : emptyImage();
}

async function loadState(){
  const res = await fetch("/api/state");
  const data = await res.json();
  alfajores = data.alfajores;
  renderGroups();
  applySlots(data.slots || {});
  setStatus("Mundial cargado desde la base ✅");
}

function renderGroups(){
  groupsContainer.innerHTML = "";

  groups.forEach(group => {
    const box = document.createElement("div");
    box.className = "group";
    box.dataset.group = group;

    const groupAlfajores = alfajores
      .filter(a => a.grupo === group)
      .sort((a,b) => a.posicion - b.posicion);

    box.innerHTML = `
      <h2>Grupo ${group}</h2>
      <div class="table-header">
        <span>POS</span>
        <span>Alfajor</span>
      </div>
      ${groupAlfajores.map(a => `
        <div class="team-row" data-id="${a.id}">
          <div class="position">${a.posicion}°</div>
          <div class="alfajor-card">
            <label class="photo-label">
              ${imageHtml(a)}
              <input type="file" class="hidden-file photo-input" accept="image/*" data-id="${a.id}">
            </label>
            <div class="alfajor-fields">
              <input class="name-input" value="${escapeHtml(a.nombre)}" data-id="${a.id}">
              <div class="card-mini-info">
                <div class="card-mini-line">⭐ ${a.puntaje && Number(a.puntaje) > 0 ? a.puntaje : "Sin puntaje"}</div>
                <div class="card-mini-line">💲 ${a.precio ? escapeHtml(a.precio) : "Sin precio"}</div>
                <div class="card-mini-line card-opinion">💬 ${a.opinion ? escapeHtml(a.opinion) : "Sin opinión todavía"}</div>
              </div>
              <div class="row-actions">
                <button class="edit-btn" data-id="${a.id}">Editar</button>
                <button class="up-btn" data-id="${a.id}">↑</button>
                <button class="down-btn" data-id="${a.id}">↓</button>
              </div>
            </div>
          </div>
        </div>
      `).join("")}
    `;

    groupsContainer.appendChild(box);
  });
}

function escapeHtml(text){
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function getAlfajor(id){
  return alfajores.find(a => Number(a.id) === Number(id));
}

async function updateName(id, nombre){
  const a = getAlfajor(id);
  if(!a) return;

  a.nombre = nombre;
  await saveAlfajor(a, false);
}

async function saveAlfajor(a, show = true){
  await fetch(`/api/alfajor/${a.id}`, {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      nombre:a.nombre,
      puntaje:a.puntaje || 0,
      opinion:a.opinion || "",
      precio:a.precio || "",
      lugar:a.lugar || "",
      fecha:a.fecha || ""
    })
  });

  if(show) setStatus("Alfajor guardado ✅");
}

async function uploadPhoto(id, file){
  const form = new FormData();
  form.append("foto", file);

  const res = await fetch(`/api/alfajor/${id}/foto`, {
    method:"POST",
    body:form
  });

  const data = await res.json();
  if(data.ok){
    const a = getAlfajor(id);
    a.foto = data.foto;
    renderGroups();
    setStatus("Foto subida ✅");
  }
}

async function moveAlfajor(id, dir){
  const a = getAlfajor(id);
  if(!a) return;

  const groupItems = alfajores
    .filter(x => x.grupo === a.grupo)
    .sort((x,y) => x.posicion - y.posicion);

  const index = groupItems.findIndex(x => x.id === a.id);
  const target = groupItems[index + dir];

  if(!target) return;

  const oldPos = a.posicion;
  a.posicion = target.posicion;
  target.posicion = oldPos;

  await fetch(`/api/alfajor/${a.id}/position`, {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({grupo:a.grupo, posicion:a.posicion})
  });

  await fetch(`/api/alfajor/${target.id}/position`, {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({grupo:target.grupo, posicion:target.posicion})
  });

  renderGroups();
}

function getQualified(){
  const firsts = [];
  const seconds = [];

  groups.forEach(group => {
    const groupItems = alfajores
      .filter(a => a.grupo === group)
      .sort((a,b) => a.posicion - b.posicion);

    firsts.push(groupItems[0]);
    seconds.push(groupItems[1]);
  });

  return { firsts, seconds };
}

function generateBracket(){
  const { firsts, seconds } = getQualified();

  const pairings = [
    [firsts[0], seconds[1]],
    [firsts[2], seconds[3]],
    [firsts[1], seconds[0]],
    [firsts[3], seconds[2]]
  ];

  clearKnockout(false);

  pairings.forEach((pair, i) => {
    const [aId, bId] = qfMatches[i];
    setSlot(aId, pair[0]);
    setSlot(bId, pair[1]);
  });

  saveFixture();
  setStatus("Cuartos generados ✅");
}

function setSlot(id, team){
  const el = document.getElementById(id);
  if (!el) return;

  if(!team){
    el.innerHTML = "-";
    el.dataset.id = "";
  }else{
    el.innerHTML = `${team.foto ? `<img class="slot-img" src="${imgUrl(team.foto)}">` : ""}<span>${escapeHtml(team.nombre)}</span>`;
    el.dataset.id = team.id;
  }

  el.classList.remove("selected");
}

function getMatchKey(id){
  const parts = id.split("-");
  if (parts[0] === "qf") return `qf-${parts[1]}`;
  if (parts[0] === "sf") return `sf-${parts[1]}`;
  if (parts[0] === "final") return "final";
  return null;
}

function handleWinnerClick(btn){
  const team = getAlfajor(btn.dataset.id);
  if(!team) return;

  const matchKey = getMatchKey(btn.id);
  if (!matchKey) return;

  const nextId = nextMap[matchKey];
  if (!nextId) return;

  btn.parentElement.querySelectorAll("button").forEach(s => s.classList.remove("selected"));
  btn.classList.add("selected");

  setSlot(nextId, team);
  saveFixture();
}

function collectSlots(){
  const slots = {};
  document.querySelectorAll(".team-slot, .champion").forEach(btn => {
    slots[btn.id] = {
      id: btn.dataset.id || "",
      selected: btn.classList.contains("selected")
    };
  });
  return slots;
}

async function saveFixture(){
  await fetch("/api/fixture", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({slots: collectSlots()})
  });
  setStatus("Fixture guardado ✅");
}

function applySlots(slots){
  Object.entries(slots).forEach(([id, data]) => {
    const team = getAlfajor(data.id);
    const el = document.getElementById(id);
    if(!el) return;

    if(team) setSlot(id, team);
    el.classList.toggle("selected", Boolean(data.selected));
  });
}

function clearKnockout(alsoQf = true){
  document.querySelectorAll(".team-slot, .champion").forEach(btn => {
    if (!alsoQf && btn.id.startsWith("qf")) return;

    btn.classList.remove("selected");
    btn.dataset.id = "";

    if (btn.id.startsWith("qf")) btn.innerHTML = "-";
    else if (btn.id.startsWith("sf")) btn.innerHTML = "Finalista";
    else if (btn.id.startsWith("final")) btn.innerHTML = "Finalista";
    else if (btn.id === "champion") btn.innerHTML = "Alfajor campeón";
  });
}

function openEdit(id){
  const a = getAlfajor(id);
  if(!a) return;

  currentEditId = id;
  modalImg.src = a.foto ? imgUrl(a.foto) : "";
  modalTitle.textContent = a.nombre;
  editName.value = a.nombre || "";
  editScore.value = a.puntaje || "";
  editPrice.value = a.precio || "";
  editPlace.value = a.lugar || "";
  editDate.value = a.fecha || "";
  editOpinion.value = a.opinion || "";
  modal.classList.remove("hidden");
}

async function saveModal(){
  const a = getAlfajor(currentEditId);
  if(!a) return;

  a.nombre = editName.value;
  a.puntaje = editScore.value;
  a.precio = editPrice.value;
  a.lugar = editPlace.value;
  a.fecha = editDate.value;
  a.opinion = editOpinion.value;

  await saveAlfajor(a, true);
  modal.classList.add("hidden");
  await loadState();
}

async function resetAll(){
  if(!confirm("¿Reiniciar todo el torneo?")) return;
  await fetch("/api/reset", {method:"DELETE"});
  await loadState();
}

document.addEventListener("input", e => {
  if(e.target.classList.contains("name-input")){
    updateName(e.target.dataset.id, e.target.value);
  }
});

document.addEventListener("change", e => {
  if(e.target.classList.contains("photo-input")){
    const file = e.target.files[0];
    if(file) uploadPhoto(e.target.dataset.id, file);
  }
});

document.addEventListener("click", e => {
  const slot = e.target.closest(".team-slot, .champion");
  if(slot) handleWinnerClick(slot);

  const edit = e.target.closest(".edit-btn");
  if(edit) openEdit(edit.dataset.id);

  const up = e.target.closest(".up-btn");
  if(up) moveAlfajor(up.dataset.id, -1);

  const down = e.target.closest(".down-btn");
  if(down) moveAlfajor(down.dataset.id, 1);
});

generateBtn.addEventListener("click", generateBracket);
saveFixtureBtn.addEventListener("click", saveFixture);
resetBtn.addEventListener("click", resetAll);
closeModal.addEventListener("click", () => modal.classList.add("hidden"));
saveAlfajorBtn.addEventListener("click", saveModal);

loadState();
