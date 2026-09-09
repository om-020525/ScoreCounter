const $ = (s) => document.querySelector(s);
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
const pad = (n) => String(n).padStart(2, "0");
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const mark = (host, on) => host.querySelectorAll("button").forEach((b) => b.classList.toggle("on", on(b)));
const TARGET = 10;

const PHASE_LABEL = {
  fighter: "Play Fighter",
  supporter: "Play Supporter",
  battle: "Battle Phase",
  assign: "Assign Coin",
};
const ORDINALS = ["", "", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth", "Tenth"];
const TURN_PHASES = ["fighter", "supporter"];
const PHASES = ["fighter", "supporter", "battle", "assign"];

const ic = (paths, fill) =>
  `<svg viewBox="0 0 24 24" fill="${fill || "none"}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

const I = {
  play: ic('<path d="M7 4.5l13 7.5-13 7.5z" stroke="none"/>', "currentColor"),
  edit: ic('<path d="M12.5 20H21"/><path d="M16.8 3.7a2.1 2.1 0 013 3L7.4 19.1 3 20.3l1.2-4.4z"/>'),
  gear: ic('<path d="M4 7.5h9M18.5 7.5H20M4 16.5h1.5M11 16.5h9"/><circle cx="15.5" cy="7.5" r="2.4"/><circle cx="8" cy="16.5" r="2.4"/>'),
  grip: ic('<circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/>', "currentColor"),
  check: ic('<path d="M20 6.5L9.5 17 4 11.5"/>'),
  cross: ic('<path d="M18 6L6 18M6 6l12 12"/>'),
  pencil: ic('<path d="M4 20h4l10.5-10.5a2.1 2.1 0 10-3-3L5 17z"/>'),
  trash: ic('<path d="M3.5 6.5h17M9 6.5V4h6v2.5M18.5 6.5l-1 13.5h-11l-1-13.5"/>'),
  plus: ic('<path d="M12 5v14M5 12h14"/>'),
  minus: ic('<path d="M5 12h14"/>'),
  arrow: ic('<path d="M4 12h13M12 6.5l5.5 5.5L12 17.5"/>'),
  chevrons: ic('<path d="M5 5l7 7-7 7M13 5l7 7-7 7"/>'),
};

const S = {
  mode: "edit",
  order: "fixed",
  music: false,
  volume: 30,
  voice: true,
  voiceVolume: 100,
  players: [],
  draft: null,
  round: 1,
  tiebreak: 0,
  phase: "fighter",
  turn: 0,
  coin: null,
  result: null,
};

const el = {
  list: $("#list"),
  adder: $("#adder"),
  phase: $("#phaseLabel"),
  round: $("#roundLabel"),
  mode: $("#modeBtn"),
  settings: $("#settingsBtn"),
  panel: $("#settingsPanel"),
  order: $("#orderToggle"),
  musicToggle: $("#musicToggle"),
  volume: $("#volume"),
  volValue: $("#volValue"),
  voiceToggle: $("#voiceToggle"),
  voiceVolume: $("#voiceVolume"),
  voiceValue: $("#voiceValue"),
  next: $("#nextBtn"),
  endFight: $("#endFightBtn"),
  overlay: $("#overlay"),
  vTitle: $("#verdictTitle"),
  vSub: $("#verdictSub"),
};

const save = () => localStorage.setItem("starpath", JSON.stringify(S));

function load() {
  try {
    Object.assign(S, JSON.parse(localStorage.getItem("starpath")) || {});
    S.draft = null;
  } catch (e) {
    /* empty */
  }
}

const leaders = () => {
  const max = S.players.reduce((m, p) => Math.max(m, p.score), 0);
  return { max, tied: S.players.filter((p) => p.score === max) };
};

const reorder = () =>
  S.players.sort((a, b) => (b.id === S.coin) - (a.id === S.coin) || b.score - a.score);

const tieName = () => `${S.tiebreak > 1 ? (ORDINALS[S.tiebreak] || `#${S.tiebreak}`) + " " : ""}Tie Breaker`;
const roundName = () => (S.tiebreak ? tieName() : `Round ${pad(S.round)}`);

const rim = (n, r) =>
  Array.from({ length: n }, (_, i) => {
    const h = (2 * Math.PI * r) / n + 1;
    return `<i style="height:${h.toFixed(2)}px;margin-top:${(-h / 2).toFixed(2)}px;transform:rotateZ(${((360 / n) * i).toFixed(2)}deg) translateX(${r.toFixed(2)}px) rotateY(90deg)"></i>`;
  }).join("");

const coinBody = (edge) =>
  `<span class="coin-inner"><svg class="face moon" viewBox="0 0 40 40"><use href="#face-moon"/></svg><svg class="face sun" viewBox="0 0 40 40"><use href="#face-sun"/></svg><span class="rim">${edge}</span></span>`;

const PLATE = 0.47;
const ROW_COIN = coinBody(rim(26, 42 * PLATE));
const BIG_COIN = coinBody(rim(40, 78 * PLATE));

function coinCell(p, pickable) {
  return `<button class="coin${S.coin === p.id ? " dark" : ""}${pickable ? " pick" : ""}" data-act="coin" data-id="${p.id}" ${pickable ? "" : 'tabindex="-1"'}>${ROW_COIN}</button>`;
}

function draftRow() {
  return `<div class="row draft">
    <span></span>
    <input class="field" id="draftName" placeholder="Player name" value="${esc(S.draft.name)}" autocomplete="off">
    <span></span>
    <input class="field num" id="draftScore" type="number" value="${S.draft.score}">
    <span class="acts">
      <button class="act ok" data-act="commit" title="Save">${I.check}</button>
      <button class="act no" data-act="cancel" title="Cancel">${I.cross}</button>
    </span>
  </div>`;
}

const played = (ph, i) => {
  if (S.mode !== "play") return false;
  const now = PHASES.indexOf(S.phase);
  const at = PHASES.indexOf(ph);
  return now > at || (now === at && i <= S.turn);
};

const slotCell = (i) =>
  `<span class="slots">${TURN_PHASES.map((ph) => {
    const now = S.mode === "play" && ph === S.phase && i === S.turn;
    return `<i class="slot${played(ph, i) ? " lit" : ""}${now ? " now" : ""}"></i>`;
  }).join("")}</span>`;

const stepCell = (p) =>
  `<span class="steps${S.mode === "play" && S.phase === "battle" ? "" : " off"}"><button class="act step" data-act="inc" data-id="${p.id}" title="Add a spirit">${I.plus}</button><button class="act step" data-act="dec" data-id="${p.id}" title="Take a spirit">${I.minus}</button></span>`;

function playerRow(p, i) {
  const listed = S.mode !== "edit";
  const cycling = S.mode === "play" && TURN_PHASES.includes(S.phase);
  const current = cycling && S.turn === i;
  const lead = listed
    ? `<span class="marker">${I.arrow}</span>`
    : `<button class="grip" data-act="grip" title="Drag to reorder">${I.grip}</button>`;

  const row = `<div class="row${current ? " current" : ""}${cycling && !current ? " dimmed" : ""}" data-id="${p.id}">
    ${lead}
    <span class="name">${esc(p.name)}</span>
    ${listed ? slotCell(i) : "<span></span>"}
    <span class="score">${p.score}</span>
    ${
      listed
        ? coinCell(p, S.mode === "play" && S.phase === "assign")
        : `<span class="acts"><button class="act edit" data-act="edit" data-id="${p.id}">${I.pencil}</button><button class="act del" data-act="del" data-id="${p.id}">${I.trash}</button></span>`
    }
  </div>`;

  return listed ? `<div class="lane">${row}${stepCell(p)}</div>` : row;
}

function addButton(hero) {
  return `<button class="add-btn${hero ? " hero" : ""}" data-act="add">${I.plus}${hero ? "<span>Add first player</span>" : ""}</button>`;
}

function render() {
  document.body.className = "mode-" + S.mode + (S.tiebreak ? " tiebreak" : "");

  el.list.innerHTML = S.players
    .map((p, i) => (S.mode === "edit" && S.draft && S.draft.id === p.id ? draftRow() : playerRow(p, i)))
    .join("");
  if (S.mode === "edit" && S.draft && !S.draft.id) el.list.insertAdjacentHTML("beforeend", draftRow());

  const showAdd = S.mode === "edit" && !S.draft;
  el.adder.innerHTML = showAdd ? addButton(!S.players.length) : "";

  const editing = S.mode === "edit";
  const quitting = S.mode === "play";
  el.mode.innerHTML = editing ? I.check : quitting ? I.cross : I.edit;
  el.mode.title = editing ? "Done editing" : quitting ? "Quit game" : "Edit players";
  el.mode.classList.toggle("accent", editing);
  el.mode.classList.toggle("quit", quitting);
  el.settings.innerHTML = I.gear;
  el.next.innerHTML = S.mode === "ready" ? "<span>Start</span>" : I.chevrons;

  el.round.textContent = editing ? "Editing" : S.mode === "ready" ? "Ready" : roundName();
  el.phase.textContent = PHASE_LABEL[S.phase];
  el.phase.classList.toggle("hidden", S.mode !== "play");
  el.next.classList.toggle("off", editing || !!S.result || !S.players.length);
  el.endFight.classList.toggle("off", S.mode !== "play" || S.phase !== "fighter" || !!S.result);

  mark(el.order, (b) => b.dataset.order === S.order);
  mark(el.musicToggle, (b) => (b.dataset.music === "on") === S.music);
  mark(el.voiceToggle, (b) => (b.dataset.voice === "on") === S.voice);
  showVolume(el.volume, el.volValue, S.volume);
  showVolume(el.voiceVolume, el.voiceValue, S.voiceVolume);

  renderVerdict();
  if (S.result) fall(S.result.kind === "win" ? CONFETTI : SNOW);
  else stopFall();
  applyMusic();
  callPhase();
  if (S.draft) {
    const f = $("#draftName");
    if (f) f.focus();
  }
}

function renderVerdict() {
  const r = S.result;
  el.overlay.classList.toggle("hidden", !r);
  el.overlay.classList.toggle("stalemate", !!r && r.kind === "stalemate");
  if (!r) return;
  const pts = `${r.score} ${r.score === 1 ? "spirit" : "spirits"}`;
  const tail = r.kind === "win" ? `${r.names[0]} takes the crown on ${pts}` : `${r.names.join(" & ")} stand tied on ${pts}`;
  el.vTitle.textContent = r.kind === "win" ? `${r.names[0]} now Rules the Universe` : "Universe Ended in a Stalemate";
  el.vSub.textContent =
    r.reason === "endfight"
      ? `The power balance collapsed since ${r.ender} was unable to fight anymore, and ${tail}.`
      : `Crossed the Starpath with ${pts}.`;
}

function finish(reason) {
  const { max, tied } = leaders();
  const kind = tied.length === 1 ? "win" : "stalemate";
  const ender = reason === "endfight" ? S.players[S.turn].name : null;
  S.result = { kind, reason, ender, names: tied.map((p) => p.name), score: max };
  save();
  render();
}

function enterReady() {
  if (!S.players.length) return;
  S.draft = null;
  S.mode = "ready";
  S.round = 1;
  S.tiebreak = 0;
  S.phase = "fighter";
  S.turn = 0;
  S.result = null;
  S.coin = S.players[0].id;
  if (S.order === "auto") reorder();
}

function endRound() {
  const { max, tied } = leaders();
  if (max >= TARGET && tied.length === 1) return finish("target");
  if (max >= TARGET || S.tiebreak) S.tiebreak++;
  else S.round++;
  if (S.order === "auto") reorder();
  S.phase = "fighter";
  S.turn = 0;
}

function next() {
  const last = S.players.length - 1;
  if (S.mode === "ready") {
    S.mode = "play";
  } else if (TURN_PHASES.includes(S.phase)) {
    if (S.turn < last) S.turn++;
    else {
      S.phase = S.phase === "fighter" ? "supporter" : "battle";
      S.turn = 0;
    }
  } else if (S.phase === "battle") {
    S.phase = "assign";
  } else {
    endRound();
  }
  if (!S.result) {
    save();
    render();
  }
}

function commitDraft() {
  const name = $("#draftName").value.trim();
  if (!name) return $("#draftName").focus();
  const score = Math.max(0, parseInt($("#draftScore").value, 10) || 0);
  if (S.draft.id) Object.assign(S.players.find((p) => p.id === S.draft.id), { name, score });
  else S.players.push({ id: uid(), name, score });
  S.draft = null;
  if (!S.coin) S.coin = S.players[0].id;
  save();
  render();
}

function removePlayer(id) {
  S.players = S.players.filter((p) => p.id !== id);
  if (S.coin === id) S.coin = S.players.length ? S.players[0].id : null;
  save();
  render();
}

function setCoin(id) {
  S.coin = id;
  document.querySelectorAll('[data-act="coin"]').forEach((c) => c.classList.toggle("dark", c.dataset.id === id));
  save();
}

function bump(id, delta) {
  const p = S.players.find((x) => x.id === id);
  p.score = Math.max(0, p.score + delta);
  save();
  render();
}

document.addEventListener("click", (e) => {
  const hit = e.target.closest("[data-act]");
  const act = hit && hit.dataset.act;

  if (!e.target.closest("#settingsPanel") && !e.target.closest("#settingsBtn")) {
    el.panel.classList.add("hidden");
    el.settings.classList.remove("on");
  }

  if (!act) return;
  const id = hit.dataset.id;

  if (act === "add") {
    S.draft = { id: null, name: "", score: 0 };
    render();
  } else if (act === "commit") commitDraft();
  else if (act === "cancel") {
    S.draft = null;
    render();
  } else if (act === "edit") {
    const p = S.players.find((x) => x.id === id);
    S.draft = { id, name: p.name, score: p.score };
    render();
  } else if (act === "del") removePlayer(id);
  else if (act === "inc") bump(id, 1);
  else if (act === "dec") bump(id, -1);
  else if (act === "coin" && S.phase === "assign" && S.mode === "play") setCoin(id);
  else if (act === "rematch") {
    S.players.forEach((p) => (p.score = 0));
    enterReady();
    save();
    render();
  } else if (act === "toEdit") {
    S.mode = "edit";
    S.result = null;
    save();
    render();
  }
});

el.mode.addEventListener("click", () => {
  if (S.mode === "ready") {
    S.mode = "edit";
    S.result = null;
  } else enterReady();
  save();
  render();
});

el.settings.addEventListener("click", () => {
  const open = el.panel.classList.toggle("hidden");
  el.settings.classList.toggle("on", !open);
});

const segmented = (host, apply) =>
  host.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    apply(b);
    save();
    render();
  });

segmented(el.order, (b) => {
  S.order = b.dataset.order;
  if (S.order === "auto" && S.mode === "play") reorder();
});
segmented(el.musicToggle, (b) => (S.music = b.dataset.music === "on"));
segmented(el.voiceToggle, (b) => (S.voice = b.dataset.voice === "on"));

el.next.addEventListener("click", next);
el.endFight.addEventListener("click", () => finish("endfight"));

el.list.addEventListener("keydown", (e) => {
  if (!S.draft) return;
  if (e.key === "Enter") commitDraft();
  if (e.key === "Escape") {
    S.draft = null;
    render();
  }
});

document.addEventListener("keydown", (e) => {
  if (S.mode === "edit" || S.result || e.target.matches("input")) return;
  if (e.key === "ArrowRight" || e.key === "Enter") next();
});

let dragging = null;

el.list.addEventListener("pointerdown", (e) => {
  const grip = e.target.closest(".grip");
  if (grip) grip.closest(".row").draggable = true;
});

el.list.addEventListener("dragstart", (e) => {
  const row = e.target.closest(".row");
  if (!row || !row.draggable) return e.preventDefault();
  dragging = row;
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", row.dataset.id);
  requestAnimationFrame(() => row.classList.add("dragging"));
});

el.list.addEventListener("dragover", (e) => {
  if (!dragging) return;
  e.preventDefault();
  const over = e.target.closest(".row");
  if (!over || over === dragging) return;
  const box = over.getBoundingClientRect();
  el.list.insertBefore(dragging, e.clientY > box.top + box.height / 2 ? over.nextSibling : over);
});

el.list.addEventListener("dragend", () => {
  if (!dragging) return;
  const ids = [...el.list.querySelectorAll(".row[data-id]")].map((r) => r.dataset.id);
  S.players.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  dragging = null;
  save();
  render();
});

const TINTS = ["#eec269", "#ffe6a6", "#dfe3f0", "#c9922a", "#ffffff"];
const canvas = $("#confetti");
let raf = null;
let bits = [];
let falling = null;

const CONFETTI = {
  count: 170,
  seed: (spread) => ({
    x: Math.random() * canvas.width,
    y: spread ? Math.random() * canvas.height : -20 - Math.random() * 60,
    w: 5 + Math.random() * 8,
    h: 4 + Math.random() * 6,
    vx: -1 + Math.random() * 2,
    vy: 1.8 + Math.random() * 3,
    a: Math.random() * 6,
    va: -0.14 + Math.random() * 0.28,
    tint: TINTS[(Math.random() * TINTS.length) | 0],
  }),
  step(ctx, b) {
    b.x += b.vx;
    b.y += b.vy;
    b.a += b.va;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.a);
    ctx.fillStyle = b.tint;
    ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
    ctx.restore();
    return b.y > canvas.height + 20;
  },
};

const MIST = (() => {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(238, 244, 255, 0.95)");
  grad.addColorStop(1, "rgba(238, 244, 255, 0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return c;
})();

const SNOW = {
  count: 190,
  seed: (spread) => ({
    x: Math.random() * canvas.width,
    y: spread ? Math.random() * canvas.height : -20 - Math.random() * 70,
    r: 3.5 + Math.random() * 6.5,
    vy: 0.7 + Math.random() * 2,
    o: 0.35 + Math.random() * 0.45,
  }),
  step(ctx, b) {
    b.y += b.vy;
    ctx.globalAlpha = b.o;
    ctx.drawImage(MIST, b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
    ctx.globalAlpha = 1;
    return b.y > canvas.height + b.r;
  },
};

function sizeCanvas() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}

function fall(spec) {
  if (falling === spec) return;
  stopFall();
  falling = spec;
  sizeCanvas();
  bits = Array.from({ length: spec.count }, () => spec.seed(true));
  const ctx = canvas.getContext("2d");
  const frame = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    bits.forEach((b, i) => {
      if (spec.step(ctx, b)) bits[i] = spec.seed(false);
    });
    raf = requestAnimationFrame(frame);
  };
  frame();
}

function stopFall() {
  if (!raf) return;
  cancelAnimationFrame(raf);
  raf = null;
  falling = null;
  canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
}

addEventListener("resize", () => {
  if (raf) sizeCanvas();
});

const SIGNS = [
  ["Aries", "top:8%;left:2%", 1, 88, 121, [[84,2,1],[7,20,4],[60,20,4],[2,93,3],[9,110,1],[17,117,1]], [[0,2],[1,3],[2,1],[3,4],[4,5]]],
  ["Gemini", "top:10%;right:2%", 1, 84, 151, [[16,2,4],[51,9,3],[2,59,3],[14,84,4],[59,103,3],[70,138,3],[18,142,4],[80,147,1]], [[0,1],[0,2],[2,3],[3,4],[3,6],[4,5],[5,7]]],
  ["Cancer", "top:25%;left:5%", 0.9, 146, 140, [[142,2,3],[87,52,2],[2,64,2],[56,69,4],[32,136,3]], [[0,1],[1,3],[3,2],[3,4]]],
  ["Libra", "top:23%;right:4%", 0.9, 144, 122, [[52,2,2],[120,39,2],[2,48,3],[30,90,1],[124,93,1],[140,101,2],[33,118,1]], [[0,1],[0,2],[1,4],[2,3],[3,6],[4,5]]],
  ["Scorpio", "top:48%;left:2%", 1, 116, 125, [[28,2,1],[2,10,2],[39,11,2],[7,45,2],[25,51,2],[49,57,3],[71,73,2],[79,81,1],[84,96,2],[112,106,2],[49,107,1],[69,113,2],[92,121,4]], [[0,1],[0,2],[1,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,12],[11,10],[12,9],[12,11]]],
  ["Aquarius", "top:46%;right:2%", 1, 123, 156, [[119,2,1],[71,25,3],[23,39,2],[6,55,1],[2,61,1],[40,67,2],[10,102,4],[33,117,1],[35,128,3],[41,152,1]], [[0,1],[1,2],[2,3],[2,5],[3,4],[4,6],[6,7],[7,8],[8,9]]],
  ["Leo", "top:34%;left:26%", 0.7, 199, 145, [[122,2,2],[141,6,1],[105,31,2],[109,50,3],[132,60,1],[26,84,2],[143,88,3],[51,107,3],[2,134,1],[195,141,4]], [[0,1],[0,2],[2,3],[3,4],[3,5],[4,6],[5,7],[6,9],[7,8]]],
  ["Sagittarius", "top:36%;right:24%", 0.7, 135, 133, [[103,2,2],[18,11,3],[96,31,2],[62,39,4],[131,42,2],[74,81,2],[2,98,3],[66,99,4],[98,114,4],[14,115,4],[80,125,2],[6,129,3]], [[0,2],[2,3],[2,4],[3,1],[3,5],[5,7],[7,9],[7,10],[9,6],[9,11],[10,8]]],
  ["Taurus", "top:70%;left:14%", 0.85, 142, 121, [[138,2,1],[108,43,3],[89,56,1],[70,65,1],[86,67,1],[81,79,1],[2,117,3]], [[0,1],[1,2],[2,4],[3,6],[4,3],[4,5]]],
  ["Virgo", "top:62%;right:13%", 0.8, 93, 182, [[81,2,3],[80,35,2],[15,53,1],[74,56,1],[50,62,2],[75,95,1],[45,104,4],[89,120,2],[25,123,1],[52,154,1],[65,158,2],[2,162,4],[35,178,1]], [[0,1],[1,3],[3,4],[3,5],[4,2],[4,6],[5,7],[6,8],[7,10],[8,11],[9,12],[10,9]]],
  ["Pisces", "bottom:8%;left:33%", 0.85, 183, 121, [[25,2,1],[16,59,1],[179,62,1],[122,70,3],[168,73,1],[71,80,1],[54,82,2],[161,86,1],[140,87,3],[12,91,1],[20,106,1],[2,117,1]], [[0,1],[1,9],[3,8],[4,2],[5,3],[6,5],[7,4],[8,7],[9,10],[9,11],[10,6],[10,11]]],
  ["Capricorn", "bottom:9%;right:30%", 0.85, 154, 104, [[2,2,1],[150,3,1],[46,13,2],[142,15,3],[69,17,1],[130,32,4],[14,43,2],[20,54,4],[47,78,1],[89,88,1],[74,100,1]], [[0,2],[0,6],[2,4],[3,1],[5,3],[6,7],[7,8],[8,10],[9,5],[10,9]]],
];

const MAG = [0, 2, 3, 4.5, 6];
const LOOSE = 90;
const LINE_HOLD = 2800;
const LINE_FADE = 1400;
const SHOW_CIRCUITS = false;

const noise = (i, s) => (((Math.sin((i + 1) * s) * 43758.5453) % 1) + 1) % 1;

function starDot(cls, left, top, mag, i) {
  const d = MAG[mag];
  return `<i class="star${cls}" style="left:${left};top:${top};width:${d}px;height:${d}px;margin:${-d / 2}px 0 0 ${-d / 2}px;--tw:${(3.4 + noise(i, 91.7) * 5).toFixed(1)}s;--fx:${(noise(i, 51.3) * 60 - 30).toFixed(1)}px;--fy:${(noise(i, 84.1) * 48 - 24).toFixed(1)}px;--fd:${(12 + noise(i, 22.7) * 14).toFixed(1)}s;animation-delay:-${(noise(i, 27.3) * 8).toFixed(1)}s,-${(noise(i, 66.9) * 20).toFixed(1)}s"></i>`;
}

function drawSky() {
  const signs = SIGNS.map(([name, at, k, w, h, pts, eds], i) => {
    const r = (s) => noise(i, s);
    const stars = pts.map(([x, y, m], j) => starDot(m > 3 ? " glint" : "", `${(x * k).toFixed(1)}px`, `${(y * k).toFixed(1)}px`, m, i * 31 + j)).join("");
    const seg = eds
      .map(([a, b]) => `<line x1="${(pts[a][0] * k).toFixed(1)}" y1="${(pts[a][1] * k).toFixed(1)}" x2="${(pts[b][0] * k).toFixed(1)}" y2="${(pts[b][1] * k).toFixed(1)}"/>`)
      .join("");
    return `<div class="sign" data-sign="${name}" style="${at};width:${(w * k).toFixed(0)}px;height:${(h * k).toFixed(0)}px;--rot:${(r(41.7) * 16 - 8).toFixed(2)}deg;--dur:${(14 + r(19.3) * 10).toFixed(1)}s;--o:${(0.68 + r(55.5) * 0.3).toFixed(2)};animation-delay:-${(r(7.7) * 12).toFixed(1)}s"><svg class="lines" width="${(w * k).toFixed(0)}" height="${(h * k).toFixed(0)}">${seg}</svg>${stars}</div>`;
  }).join("");

  const loose = Array.from({ length: LOOSE }, (_, i) => {
    const m = noise(i, 63.1) > 0.94 ? 3 : noise(i, 11.5) > 0.62 ? 2 : 1;
    return starDot(" drift", `${(noise(i, 15.7) * 100).toFixed(2)}%`, `${(noise(i, 47.9) * 100).toFixed(2)}%`, m, i + 500);
  }).join("");

  $(".sky").insertAdjacentHTML("beforeend", `<div class="dust">${loose}</div>${signs}`);
  roam();
  traceLines();
}

const rand = (lo, hi) => lo + Math.random() * (hi - lo);
const WAVE_STEP = 7;
const WAVES = [5, 6, 7, 8];
const AMPS = [0.14, 0.18, 0.22, 0.26, 0.3];

// a wide ring around the middle of the sky, anchored on the sign's home spot
function orbit(home, w, h) {
  const rx = w * rand(0.28, 0.36);
  const ry = Math.min(rx / rand(1.3, 1.62), h * 0.34);
  const dx = home[0] - w / 2;
  const dy = home[1] - h / 2;
  const spin = Math.atan2(dy / ry, dx / rx);
  const way = Math.random() < 0.5 ? 1 : -1;
  const tip = [-Math.sin(spin) * rx * way, Math.cos(spin) * ry * way];
  const unit = Math.hypot(tip[0], tip[1]);
  return { rx, ry, dx, dy, spin, way, reach: Math.hypot(dx / rx, dy / ry), tip: [tip[0] / unit, tip[1] / unit] };
}

// a wave rippling all the way round the ring, with home parked on a crest so the curve
// leaves and re-enters it on the same tangent whichever wave is chosen
function circuit(o, waves, amp) {
  const base = o.reach / (1 + amp);
  const n = waves * WAVE_STEP;
  const p = Array.from({ length: n }, (_, i) => {
    const t = ((i / n) * Math.PI * 2) * o.way;
    const f = base * (1 + amp * Math.cos(waves * t));
    return [Math.cos(o.spin + t) * o.rx * f - o.dx, Math.sin(o.spin + t) * o.ry * f - o.dy];
  });
  return spline(p, o.tip);
}

// centripetal catmull-rom, which keeps uneven spacing from pinching the curve into cusps
function spline(p, tip) {
  const n = p.length;
  const at = (i) => p[(i + n) % n];
  const gap = (a, b) => Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1]));
  const xy = ([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`;
  const segs = [];
  for (let i = 0; i < n; i++) {
    const [a, b, c, e] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const [d1, d2, d3] = [gap(a, b), gap(b, c), gap(c, e)];
    segs.push([
      [0, 1].map((k) => (d1 * d1 * c[k] - d2 * d2 * a[k] + (2 * d1 * d1 + 3 * d1 * d2 + d2 * d2) * b[k]) / (3 * d1 * (d1 + d2))),
      [0, 1].map((k) => (d3 * d3 * b[k] - d2 * d2 * e[k] + (2 * d3 * d3 + 3 * d3 * d2 + d2 * d2) * c[k]) / (3 * d3 * (d3 + d2))),
      c,
    ]);
  }

  // aim the handles on either side of home down one fixed line, so whichever loop comes
  // next picks up on exactly the heading the last one arrived with
  const reach = (h, from) => Math.hypot(h[0] - from[0], h[1] - from[1]);
  const home = p[0];
  const head = segs[0];
  const tail = segs[n - 1];
  head[0] = [home[0] + tip[0] * reach(head[0], home), home[1] + tip[1] * reach(head[0], home)];
  tail[1] = [home[0] - tip[0] * reach(tail[1], home), home[1] - tip[1] * reach(tail[1], home)];

  return "M0,0" + segs.map(([c1, c2, end]) => ` C${xy(c1)} ${xy(c2)} ${xy(end)}`).join("") + "Z";
}

function roam() {
  const sky = $(".sky");
  const box = sky.getBoundingClientRect();
  const signs = [...document.querySelectorAll(".sign")];
  const homes = signs.map((s) => {
    const r = s.getBoundingClientRect();
    return [r.left - box.left + r.width / 2, r.top - box.top + r.height / 2];
  });
  const board = SHOW_CIRCUITS ? circuitBoard(sky, homes) : null;
  const gauge = document.createElementNS("http://www.w3.org/2000/svg", "path");

  signs.forEach((sign, i) => {
    const o = orbit(homes[i], box.width, box.height);
    const pool = WAVES.flatMap((waves) =>
      AMPS.map((amp) => {
        const d = circuit(o, waves, amp);
        gauge.setAttribute("d", d);
        return { d, len: gauge.getTotalLength() };
      })
    );
    const pace = rand(28, 42);
    let live = null;
    let last = -1;

    const lap = () => {
      let k = (Math.random() * pool.length) | 0;
      if (k === last) k = (k + 1) % pool.length;
      last = k;
      sign.style.offsetPath = `path("${pool[k].d}")`;
      if (board) board.children[i].setAttribute("d", pool[k].d);
      const run = sign.animate([{ offsetDistance: "0%" }, { offsetDistance: "100%" }], {
        duration: (pool[k].len / pace) * 1000,
        easing: "linear",
        fill: "forwards",
      });
      run.onfinish = lap;
      if (live) live.cancel();
      live = run;
    };
    lap();
  });
}

function circuitBoard(sky, homes) {
  const paths = homes.map(([x, y]) => `<path transform="translate(${x.toFixed(1)},${y.toFixed(1)})"/>`).join("");
  sky.insertAdjacentHTML("beforeend", `<svg class="circuits">${paths}</svg>`);
  return $(".circuits");
}

function traceLines() {
  const signs = [...document.querySelectorAll(".sign")];
  let last = -1;
  const cycle = () => {
    let pick = (Math.random() * signs.length) | 0;
    if (pick === last) pick = (pick + 1) % signs.length;
    last = pick;
    signs[pick].classList.add("lit");
    setTimeout(() => signs[pick].classList.remove("lit"), LINE_HOLD);
    setTimeout(cycle, LINE_HOLD + LINE_FADE + 1500 + Math.random() * 4500);
  };
  setTimeout(cycle, 3000);
}

const EXTS = ["mp3", "ogg", "wav", "m4a"];
const vol = () => S.volume / 100;

function showVolume(slider, out, v) {
  slider.value = v;
  slider.style.setProperty("--fill", v + "%");
  out.textContent = v + "%";
}

function track(file, loop, eager) {
  const a = new Audio();
  let i = 0;
  a.loop = loop;
  a.preload = eager ? "auto" : "none";
  a.addEventListener("error", () => {
    if (++i < EXTS.length) {
      a.src = `Music/${file}.${EXTS[i]}`;
      a.load();
    }
  });
  a.src = `Music/${file}.${EXTS[0]}`;
  return a;
}

const TRACKS = {
  prelude: track("prelude", true),
  game: track("gameplay", true),
  tiebreak: track("tiebreaker", true),
  stalemate: track("stalemate", true),
  win: track("win", true),
};

const VOICES = {
  fighter: track("Voices/Play-your-fighter", false, true),
  supporter: track("Voices/Play-your-supporter", false, true),
  battle: track("Voices/Battle-Phase", false, true),
  assign: track("Voices/Who-gets-the-coin-this-time", false, true),
};

let fadeId = 0;

function fadeTo(a, to, ms, done) {
  const id = ++fadeId;
  a.dataset.fade = id;
  const from = a.volume;
  const t0 = performance.now();
  const step = (now) => {
    if (a.dataset.fade != id) return;
    const k = ms ? Math.min(1, (now - t0) / ms) : 1;
    a.volume = Math.min(1, Math.max(0, from + (to - from) * k));
    if (k < 1) requestAnimationFrame(step);
    else if (done) done();
  };
  requestAnimationFrame(step);
}

const hush = (a, ms) => fadeTo(a, 0, ms, () => a.pause());

function start(a) {
  a.dataset.fade = ++fadeId;
  a.currentTime = 0;
  a.volume = vol();
  a.play().catch(() => {});
}

function cue() {
  if (S.result) return S.result.kind === "win" ? "win" : "stalemate";
  if (S.mode === "play") return S.tiebreak ? "tiebreak" : "game";
  return "prelude";
}

let playing = null;
let gestured = false;
let spoken = null;

function applyMusic() {
  if (!S.music) {
    if (playing) Object.values(TRACKS).forEach((a) => hush(a, 400));
    playing = null;
    return;
  }
  if (!gestured) return;
  const want = cue();
  if (want === playing) return;
  const from = playing && TRACKS[playing];
  playing = want;
  if (from) hush(from, from === TRACKS.prelude && want === "game" ? 3500 : 1400);
  start(TRACKS[want]);
}

function callPhase() {
  const at = S.mode === "play" && !S.result ? `${S.round}.${S.tiebreak}.${S.phase}` : null;
  if (!S.voice) Object.values(VOICES).forEach((a) => a.pause());
  if (at === spoken) return;
  spoken = at;
  if (!at || !S.voice || !gestured) return;
  const a = VOICES[S.phase];
  a.currentTime = 0;
  a.volume = S.voiceVolume / 100;
  a.play().catch(() => {});
}

addEventListener("pointerdown", () => {
  gestured = true;
  applyMusic();
}, { once: true });

const slide = (slider, out, apply) =>
  slider.addEventListener("input", () => {
    showVolume(slider, out, +slider.value);
    apply(+slider.value);
    save();
  });

slide(el.volume, el.volValue, (v) => {
  S.volume = v;
  if (playing) {
    const a = TRACKS[playing];
    a.dataset.fade = ++fadeId;
    a.volume = vol();
  }
});

slide(el.voiceVolume, el.voiceValue, (v) => {
  S.voiceVolume = v;
  Object.values(VOICES).forEach((a) => (a.volume = v / 100));
});

drawSky();
$("#verdictCoin").innerHTML = BIG_COIN;
load();
render();
