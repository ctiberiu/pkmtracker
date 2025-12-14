const MAX_ID = 1025;
const STORAGE_KEY = "dex_caught_v4";
const INITIAL_BATCH = 100;
const BATCH_SIZE = 100;

const genRanges = [
  { gen:1, s:1,   e:151 },
  { gen:2, s:152, e:251 },
  { gen:3, s:252, e:386 },
  { gen:4, s:387, e:493 },
  { gen:5, s:494, e:649 },
  { gen:6, s:650, e:721 },
  { gen:7, s:722, e:809 },
  { gen:8, s:810, e:905 },
  { gen:9, s:906, e:1025 },
];
const genById = (id)=>{
  for (const r of genRanges){ if (id>=r.s && id<=r.e) return r.gen; }
  return null;
}
const officialArtwork = (id) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;

const typeColors = {
  normal: "#A8A77A", fire: "#EE8130", water: "#6390F0", electric: "#F7D02C", grass: "#7AC74C",
  ice: "#96D9D6", fighting: "#C22E28", poison: "#A33EA1", ground: "#E2BF65", flying: "#A98FF3",
  psychic: "#F95587", bug: "#A6B91A", rock: "#B6A136", ghost: "#735797", dragon: "#6F35FC",
  dark: "#705746", steel: "#B7B7CE", fairy: "#D685AD"
};

let caught = loadCaught();
let idToName = new Map();
let idToTypes = new Map();
let typeList = [];

let filteredIds = [];
let activeTypeFilters = new Set();
let renderIndex = 0;
const gridEl = document.getElementById("grid");
const activeFiltersEl = document.getElementById("activeFilters");
const counterEl = document.getElementById("counter");

function loadCaught(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(arr);
  }catch(e){ console.warn("Failed to load storage", e); return new Set(); }
}
function saveCaught(){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(caught)));
  }catch(e){ console.warn("Failed to save storage", e); }
}

async function fetchAllNames(){
  const limit = 1100;
  const res = await fetch(`https://pokeapi.co/api/v2/pokemon?limit=${limit}`);
  const data = await res.json();
  const list = data.results || [];
  for(const p of list){
    const m = p.url.match(/\/pokemon\/(\d+)\/?$/);
    if(!m) continue;
    const id = parseInt(m[1], 10);
    if(id>=1 && id<=MAX_ID){
      let nm = p.name.replace(/-/g, ' ');
      nm = nm.split(' ').map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(' ');
      idToName.set(id, nm);
    }
  }
}
async function fetchAllTypes(){
  const res = await fetch("https://pokeapi.co/api/v2/type");
  const data = await res.json();
  const resources = (data.results || []).filter(t => !/(shadow|unknown)/i.test(t.name));
  for(const t of resources){
    try{
      const r = await fetch(t.url);
      const td = await r.json();
      const typeName = td.name;
      typeList.push(typeName);
      for(const rel of td.pokemon){
        const m = rel.pokemon.url.match(/\/pokemon\/(\d+)\/?$/);
        if(!m) continue;
        const id = parseInt(m[1], 10);
        if(id<1 || id>MAX_ID) continue;
        const arr = idToTypes.get(id) || [];
        if(!arr.includes(typeName)) arr.push(typeName);
        idToTypes.set(id, arr);
      }
    }catch(e){ console.warn("Type fetch failed", t.name, e); }
  }
  typeList.sort();
}

function populateTypeDropdown(){
  const sel = document.getElementById("type");
  while (sel.options.length > 1) sel.remove(1);
  for(const t of typeList){
    const opt = document.createElement("option");
    opt.value = t; opt.textContent = t[0].toUpperCase()+t.slice(1);
    sel.appendChild(opt);
  }
}

function renderActiveFiltersBar(){
  activeFiltersEl.innerHTML = "";
  const genVal = document.getElementById("gen").value;
  if(genVal !== "all"){
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.style.borderColor = "#39516a";
    chip.innerHTML = `Gen ${genVal} <span class="x" title="Remove">✕</span>`;
    chip.querySelector(".x").addEventListener("click", ()=>{
      document.getElementById("gen").value = "all";
      resetAndRender();
    });
    activeFiltersEl.appendChild(chip);
  }
  for(const t of activeTypeFilters){
    const chip = document.createElement("span");
    chip.className = "chip";
    const color = typeColors[t] || "#2b3748";
    chip.style.borderColor = color;
    chip.innerHTML = `${t[0].toUpperCase()+t.slice(1)} <span class="x" title="Remove">✕</span>`;
    chip.querySelector(".x").addEventListener("click", ()=>{
      activeTypeFilters.delete(t);
      resetAndRender();
    });
    activeFiltersEl.appendChild(chip);
  }
}

function buildCard(id){
  const name = idToName.get(id);
  const types = idToTypes.get(id) || [];
  const gen = genById(id);
  const card = document.createElement("div");
  card.className = `card g${gen} ${caught.has(id) ? "caught" : ""}`;
  card.dataset.id = id;
  card.title = "Click to toggle caught";
  card.innerHTML = `
    <span class="gen-tag" data-gen="${gen}">Gen ${gen}</span>
    <span class="caught-dot"></span>
    <div class="thumb"><img loading="lazy" src="${officialArtwork(id)}" alt="${name}"></div>
    <div class="meta">
      <div class="name">${name}</div>
      <div class="dex">#${String(id).padStart(3,'0')}</div>
      <div class="types">
        ${types.map(t=>`<span class="type" data-type="${t}" style="background:${typeColors[t]||'#263141'}22;border-color:${typeColors[t]||'#2b3748'}">${t}</span>`).join('')}
      </div>
    </div>
  `;
  card.addEventListener("click", () => {
    if(caught.has(id)) caught.delete(id); else caught.add(id);
    saveCaught();
    card.classList.toggle("caught");
  });
  card.querySelector(".gen-tag").addEventListener("click", (e)=>{
    e.stopPropagation();
    const g = String(gen);
    const genSel = document.getElementById("gen");
    genSel.value = g;
    resetAndRender();
  });
  card.querySelectorAll(".type").forEach(el=>{
    el.addEventListener("click", (e)=>{
      e.stopPropagation();
      const t = el.dataset.type;
      activeTypeFilters.add(t);
      document.getElementById("type").value = "all";
      resetAndRender();
    });
  });
  return card;
}

function computeFilteredIds(){
  const q = document.getElementById("search").value.trim().toLowerCase();
  const genFilter = document.getElementById("gen").value;
  const dropdownType = document.getElementById("type").value;
  const caughtFilter = document.getElementById("caught").value;

  const ids = Array.from(idToName.keys()).sort((a,b)=>a-b);
  const out = [];
  for(const id of ids){
    const name = idToName.get(id);
    const types = idToTypes.get(id) || [];
    const gen = genById(id);
    if(!gen) continue;

    if(q && !name.toLowerCase().includes(q)) continue;
    if(genFilter !== "all" && gen.toString() !== genFilter) continue;

    if(dropdownType !== "all"){
      if(!types.includes(dropdownType)) continue;
    } else if(activeTypeFilters.size > 0){
      let hasAny = false;
      for(const t of activeTypeFilters){ if(types.includes(t)) { hasAny = true; break; } }
      if(!hasAny) continue;
    }

    if(caughtFilter === "caught" && !caught.has(id)) continue;
    if(caughtFilter === "uncaught" && caught.has(id)) continue;

    out.push(id);
  }
  return out;
}

function updateCounter(){
  if (!counterEl) return;
  const caughtFilter = document.getElementById("caught").value;
  const total = MAX_ID;
  const caughtCount = caught.size;
  const uncaughtCount = total - caughtCount;

  if (caughtFilter === "caught") {
    counterEl.textContent = `${caughtCount} / ${total}`;
  } else if (caughtFilter === "uncaught") {
    counterEl.textContent = `${uncaughtCount} / ${total}`;
  } else {
    counterEl.textContent = `${total}`;
  }
}

function resetAndRender(){
  filteredIds = computeFilteredIds();
  renderIndex = 0;
  gridEl.innerHTML = "";
  renderActiveFiltersBar();
  appendNextBatch(INITIAL_BATCH);
  updateCounter();
}

function appendNextBatch(batchSize = BATCH_SIZE){
  if(renderIndex >= filteredIds.length) return;
  const to = Math.min(renderIndex + batchSize, filteredIds.length);
  const frag = document.createDocumentFragment();
  for(let i=renderIndex; i<to; i++){
    frag.appendChild(buildCard(filteredIds[i]));
  }
  gridEl.appendChild(frag);
  renderIndex = to;
  updateCounter();
}

function onScrollLoadMore(){
  const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 800;
  if(nearBottom){
    appendNextBatch();
  }
}

document.getElementById("export").addEventListener("click", () => {
  const payload = {
    version: 4,
    createdAt: new Date().toISOString(),
    caught: Array.from(caught)
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "pokedex-progress.json";
  a.click();
  URL.revokeObjectURL(a.href);
});
document.getElementById("importFile").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if(!file) return;
  try{
    const text = await file.text();
    const data = JSON.parse(text);
    const arr = Array.isArray(data) ? data : data.caught;
    if(Array.isArray(arr)){
      caught = new Set(arr.map(x=>parseInt(x,10)).filter(x=>x>=1 && x<=MAX_ID));
      saveCaught();
      resetAndRender();
    }else{
      alert("Invalid file format.");
    }
  }catch(err){
    console.error(err);
    alert("Failed to import file.");
  }finally{
    e.target.value = "";
  }
});
document.getElementById("reset").addEventListener("click", () => {
  if(confirm("Reset caught progress? This clears local data.")){
    localStorage.removeItem(STORAGE_KEY);
    caught = new Set();
    resetAndRender();
  }
});

document.getElementById("search").addEventListener("input", resetAndRender);
document.getElementById("gen").addEventListener("change", resetAndRender);
document.getElementById("type").addEventListener("change", (e)=>{
  activeTypeFilters.clear();
  resetAndRender();
});
document.getElementById("caught").addEventListener("change", resetAndRender);

const toggle = document.getElementById("toggleImages");
const toggleLabel = document.getElementById("hideImagesLabel");
toggle.addEventListener("change", ()=>{
  const active = toggle.checked;
  document.body.classList.toggle("hide-images", active);
  toggleLabel.classList.toggle("active", active);
});

window.addEventListener("scroll", onScrollLoadMore, { passive: true });

async function init(){
  await fetchAllNames();
  await fetchAllTypes();
  populateTypeDropdown();
  resetAndRender();

  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('./sw.js');
    } catch (e) {
      console.warn('Service worker registration failed', e);
    }
  }
}
init();
