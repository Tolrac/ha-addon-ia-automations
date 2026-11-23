"use strict";

/* ------------------------------------------------------------------ helpers */
const $ = (sel, el = document) => el.querySelector(sel);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function api(path, opts = {}) {
  const res = await fetch("api/" + path, {
    method: opts.method || "GET",
    headers: opts.body ? { "Content-Type": "application/json" } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch (_) { /* corps vide */ }
  if (!res.ok) throw new Error((data && data.error) || `Erreur ${res.status}`);
  return data;
}

const DOMAIN_LABEL = {
  light: "Lumière", cover: "Ouverture", switch: "Interrupteur", climate: "Climatisation", media_player: "Lecteur multimédia",
  fan: "Ventilateur", lock: "Serrure", vacuum: "Aspirateur", scene: "Scène", script: "Script", input_boolean: "Interrupteur virtuel",
  humidifier: "Humidificateur", water_heater: "Chauffe-eau", siren: "Sirène", button: "Bouton", alarm_control_panel: "Alarme",
  valve: "Vanne", notify: "Notification", automation: "Automatisation", homeassistant: "Home Assistant", tts: "Synthèse vocale",
  persistent_notification: "Notification persistante", camera: "Caméra", number: "Nombre", select: "Sélection", input_number: "Nombre",
  input_select: "Sélection", remote: "Télécommande", lawn_mower: "Tondeuse", input_button: "Bouton virtuel", timer: "Minuteur",
};
const SERVICE_LABEL = {
  turn_on: "Allumer", turn_off: "Éteindre", toggle: "Basculer", open_cover: "Ouvrir l'ouvrant", close_cover: "Fermer l'ouvrant",
  stop_cover: "Arrêter l'ouvrant", set_cover_position: "Régler la position", set_temperature: "Régler la température",
  set_hvac_mode: "Changer le mode", set_preset_mode: "Changer le préréglage", lock: "Verrouiller", unlock: "Déverrouiller",
  media_play: "Lecture", media_pause: "Pause", media_stop: "Arrêt", volume_set: "Régler le volume", volume_mute: "Couper le son",
  play_media: "Lire un média", start: "Démarrer", stop: "Arrêter", return_to_base: "Retourner à la base", press: "Appuyer",
  alarm_arm_away: "Armer (absent)", alarm_arm_home: "Armer (présent)", alarm_arm_night: "Armer (nuit)", alarm_disarm: "Désarmer",
  trigger: "Déclencher", reload: "Recharger", set_value: "Définir la valeur", select_option: "Choisir l'option", open_valve: "Ouvrir la vanne",
  close_valve: "Fermer la vanne", speak: "Prononcer", create: "Créer", dismiss: "Fermer", pause: "Mettre en pause", cancel: "Annuler",
};
const SPECIAL_LABEL = {
  "light.turn_on": "Allumer la lumière", "light.turn_off": "Éteindre la lumière", "light.toggle": "Basculer la lumière",
  "switch.turn_on": "Activer l'interrupteur", "switch.turn_off": "Désactiver l'interrupteur",
  "scene.turn_on": "Activer la scène", "script.turn_on": "Lancer le script", "fan.turn_on": "Allumer le ventilateur",
  "fan.turn_off": "Éteindre le ventilateur", "climate.turn_on": "Allumer le thermostat", "climate.turn_off": "Éteindre le thermostat",
};
const STATE_LABEL = {
  on: "allumé", off: "éteint", open: "ouvert", closed: "fermé", opening: "en ouverture", closing: "en fermeture", home: "à la maison",
  not_home: "absent", playing: "en lecture", paused: "en pause", idle: "inactif", locked: "verrouillé", unlocked: "déverrouillé",
  unavailable: "indisponible", unknown: "inconnu", heat: "chauffage", cool: "refroidissement", auto: "automatique", detected: "détecté",
  armed_away: "armé (absent)", armed_home: "armé (présent)", disarmed: "désarmé", triggered: "déclenché", cleaning: "en nettoyage", docked: "à la base",
};
const WEEKDAY = { mon: "lun.", tue: "mar.", wed: "mer.", thu: "jeu.", fri: "ven.", sat: "sam.", sun: "dim." };
const DOMAIN_COLOR = {
  light: "#f5b400", cover: "#16a8ff", switch: "#8b5cf6", climate: "#ef6c3b", media_player: "#ec4899", fan: "#14b8a6",
  lock: "#64748b", vacuum: "#10b981", scene: "#d946ef", script: "#6366f1", notify: "#0ea5e9", alarm_control_panel: "#ef4444",
};
const domColor = (d) => DOMAIN_COLOR[d] || "#6b7280";

const SVG = {
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4m0-14.2-1.4 1.4M6.3 17.7l-1.4 1.4"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  state: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M10 8.5v7l6-3.5z" fill="currentColor"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
  branch: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="9" r="2"/><path d="M6 7v10M18 11c0 4-6 3-12 6"/></svg>',
  hourglass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9m10-18c0 5-5 6-5 9s5 4 5 9"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 11 12 3l9 8v10h-6v-6H9v6H3z"/></svg>',
  code: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m8 7-5 5 5 5m8-10 5 5-5 5"/></svg>',
  dots: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>',
  pencil: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
  close: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>',
  plusc: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9m4 12a2 2 0 0 0 4 0"/></svg>',
  tick: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg>',
};

/* ------------------------------------------------------------------- state */
const S = {
  auto: null, yaml: "", names: {}, domains: {}, areas: {}, warnings: [], unknown: [],
  view: "resume", yamlEdit: false, busy: false, thinking: false, hideTip: false, chat: [],
};
const EXAMPLES = [
  "Chaque jour au coucher du soleil, ferme les stores et allume le lampadaire",
  "Éteins toutes les lumières à minuit",
  "Si la porte d'entrée reste ouverte 5 minutes, envoie-moi une notification",
  "Allume le chauffage du salon à 18h en semaine",
];

/* -------------------------------------------------------------- description */
const nameOf = (id) => S.names[id] || id;
function entityIds(node) {
  const ids = [];
  const take = (v) => { (Array.isArray(v) ? v : [v]).forEach((x) => typeof x === "string" && x.split(",").forEach((p) => { p = p.trim(); if (p) ids.push(p); })); };
  if (node && typeof node === "object") {
    if (node.entity_id) take(node.entity_id);
    if (node.target && node.target.entity_id) take(node.target.entity_id);
    if (node.data && node.data.entity_id) take(node.data.entity_id);
  }
  return [...new Set(ids)];
}
function chipsFor(node) {
  const chips = entityIds(node).map((id) => ({ name: nameOf(id), domain: id.split(".")[0] }));
  const t = (node && node.target) || {};
  const areas = Array.isArray(t.area_id) ? t.area_id : t.area_id ? [t.area_id] : [];
  areas.forEach((a) => chips.push({ name: S.areas[a] || a, domain: "area" }));
  return chips;
}
const fmtDuration = (d) => {
  if (typeof d === "string") return d.replace(/^00:/, "").replace(/^0/, "");
  if (d && typeof d === "object") {
    const p = [];
    if (d.hours) p.push(`${d.hours} h`);
    if (d.minutes) p.push(`${d.minutes} min`);
    if (d.seconds) p.push(`${d.seconds} s`);
    return p.join(" ") || "0 s";
  }
  return String(d ?? "");
};
const fmtOffset = (o) => {
  if (o === undefined || o === null || o === 0 || o === "0" || o === "00:00:00") return "";
  const s = String(o);
  const neg = s.startsWith("-");
  const body = s.replace("-", "").replace(/^00:/, "").replace(/^0/, "");
  return ` ${body} ${neg ? "avant" : "après"}`;
};
const stateText = (s) => (Array.isArray(s) ? s.map(stateText).join(" ou ") : STATE_LABEL[s] || String(s));
const clock = (t) => String(t).replace(/:00$/, "");

function serviceLabel(svc) {
  const [domain, name] = String(svc).split(".");
  if (domain === "notify") return `Notification: Envoyer à ${String(name).replace(/^mobile_app_/, "").replace(/_/g, " ")}`;
  if (SPECIAL_LABEL[svc]) return `${DOMAIN_LABEL[domain] || domain}: ${SPECIAL_LABEL[svc]}`;
  const label = SERVICE_LABEL[name] || (name || svc).replace(/_/g, " ");
  return `${DOMAIN_LABEL[domain] || domain}: ${label}`;
}
function dataSummary(data) {
  if (!data || typeof data !== "object") return "";
  const map = { brightness_pct: ["Luminosité", "%"], brightness: ["Luminosité", ""], temperature: ["Température", "°"], position: ["Position", "%"], volume_level: ["Volume", ""], color_temp_kelvin: ["Température de couleur", " K"], transition: ["Transition", " s"], message: ["Message", ""], title: ["Titre", ""] };
  return Object.entries(data).filter(([k]) => k !== "entity_id").map(([k, v]) => {
    const m = map[k];
    return m ? `${m[0]} : ${typeof v === "object" ? JSON.stringify(v) : v}${m[1]}` : `${k} : ${typeof v === "object" ? JSON.stringify(v) : v}`;
  }).join(" · ");
}

function describeTrigger(t) {
  const kind = t.trigger || t.platform || "?";
  const base = { icon: "bolt", color: "#1fb5ff", chips: [], rows: [] };
  switch (kind) {
    case "sun": {
      const set = t.event === "sunset";
      return { ...base, icon: "sun", color: "#f5b400", main: `Lorsque le soleil se ${set ? "couche" : "lève"}${fmtOffset(t.offset)}`, rows: [["Événement", (set ? "Coucher" : "Lever") + " de soleil"]] };
    }
    case "time": {
      const at = Array.isArray(t.at) ? t.at.map(clock).join(", ") : clock(t.at);
      return { ...base, icon: "clock", color: "#8b5cf6", main: `À ${at}`, rows: [["Heure", at]] };
    }
    case "time_pattern": {
      const bits = [t.hours && `toutes les ${String(t.hours).replace("/", "")} h`, t.minutes && `toutes les ${String(t.minutes).replace("/", "")} min`, t.seconds && `toutes les ${String(t.seconds).replace("/", "")} s`].filter(Boolean);
      return { ...base, icon: "clock", color: "#8b5cf6", main: `Périodiquement${bits.length ? " : " + bits.join(", ") : ""}`, rows: [] };
    }
    case "state": {
      const chips = chipsFor(t);
      const to = t.to !== undefined && t.to !== null ? ` passe à « ${stateText(t.to)} »` : " change d'état";
      const from = t.from !== undefined && t.from !== null ? ` (depuis « ${stateText(t.from)} »)` : "";
      const dur = t.for ? ` pendant ${fmtDuration(t.for)}` : "";
      return { ...base, icon: "state", color: domColor((chips[0] || {}).domain), main: `Lorsque ${chips.map((c) => c.name).join(", ") || "une entité"}${to}${from}${dur}`, chips, rows: [["Entité", chips.map((c) => c.name).join(", ")]] };
    }
    case "numeric_state": {
      const chips = chipsFor(t);
      const cond = [t.above !== undefined && `dépasse ${t.above}`, t.below !== undefined && `passe sous ${t.below}`].filter(Boolean).join(" et ");
      return { ...base, icon: "state", color: "#16a8ff", main: `Lorsque ${chips.map((c) => c.name).join(", ")} ${cond}${t.for ? " pendant " + fmtDuration(t.for) : ""}`, chips, rows: [["Entité", chips.map((c) => c.name).join(", ")]] };
    }
    case "zone": {
      const chips = chipsFor(t);
      return { ...base, icon: "home", color: "#10b981", main: `Lorsque ${chips.map((c) => c.name).join(", ")} ${t.event === "leave" ? "quitte" : "entre dans"} la zone ${nameOf(t.zone)}`, chips, rows: [["Zone", nameOf(t.zone)]] };
    }
    case "homeassistant":
      return { ...base, icon: "home", color: "#18bcf2", main: t.event === "shutdown" ? "À l'arrêt de Home Assistant" : "Au démarrage de Home Assistant", rows: [] };
    case "event":
      return { ...base, main: `Lorsque l'événement « ${t.event_type} » se produit`, rows: [["Événement", t.event_type]] };
    case "template":
      return { ...base, main: "Lorsqu'un modèle devient vrai", rows: [["Modèle", String(t.value_template || "").slice(0, 40)]] };
    case "webhook":
      return { ...base, main: "À la réception d'un webhook", rows: [["Identifiant", t.webhook_id || ""]] };
    case "calendar":
      return { ...base, icon: "clock", main: `Au ${t.event === "end" ? "terme" : "début"} d'un événement de calendrier`, chips: chipsFor(t), rows: [] };
    default:
      return { ...base, main: `Déclencheur « ${kind} »`, rows: [] };
  }
}

function describeCondition(c) {
  const kind = c.condition || "?";
  const base = { icon: "branch", color: "#8a8ea0", chips: [], rows: [] };
  switch (kind) {
    case "state": {
      const chips = chipsFor(c);
      return { ...base, chips, main: `${chips.map((x) => x.name).join(", ")} est « ${stateText(c.state)} »${c.for ? " depuis " + fmtDuration(c.for) : ""}`, rows: [["Entité", chips.map((x) => x.name).join(", ")], ["État", stateText(c.state)]] };
    }
    case "numeric_state": {
      const chips = chipsFor(c);
      const cond = [c.above !== undefined && `> ${c.above}`, c.below !== undefined && `< ${c.below}`].filter(Boolean).join(" et ");
      return { ...base, chips, main: `${chips.map((x) => x.name).join(", ")} ${cond}`, rows: [["Entité", chips.map((x) => x.name).join(", ")]] };
    }
    case "time": {
      const days = c.weekday ? (Array.isArray(c.weekday) ? c.weekday : [c.weekday]).map((d) => WEEKDAY[d] || d).join(", ") : "";
      const span = c.after || c.before ? `entre ${c.after ? clock(c.after) : "…"} et ${c.before ? clock(c.before) : "…"}` : "";
      return { ...base, icon: "clock", main: ["Heure", span, days && `les ${days}`].filter(Boolean).join(" ") || "Condition horaire", rows: days ? [["Jours", days]] : [] };
    }
    case "sun":
      return { ...base, icon: "sun", main: c.after ? `Après le ${c.after === "sunset" ? "coucher" : "lever"} du soleil` : `Avant le ${c.before === "sunset" ? "coucher" : "lever"} du soleil`, rows: [] };
    case "zone": {
      const chips = chipsFor(c);
      return { ...base, chips, icon: "home", main: `${chips.map((x) => x.name).join(", ")} est dans ${nameOf(c.zone)}`, rows: [] };
    }
    case "template":
      return { ...base, main: "Un modèle est vrai", rows: [["Modèle", String(c.value_template || "").slice(0, 40)]] };
    case "and": case "or": case "not":
      return { ...base, main: { and: "Toutes les conditions sont vraies", or: "Une des conditions est vraie", not: "Aucune des conditions n'est vraie" }[kind], rows: [["Conditions", String((c.conditions || []).length)]] };
    default:
      return { ...base, main: `Condition « ${kind} »`, rows: [] };
  }
}

function describeAction(a) {
  const base = { icon: "play", color: "#1fb5ff", chips: [], rows: [] };
  if (a.action) {
    const dom = String(a.action).split(".")[0];
    const chips = chipsFor(a);
    const data = dataSummary(a.data);
    const rows = [];
    if (chips.length) rows.push(["Cible", chips.map((c) => c.name).join(", ")]);
    if (data) rows.push(["Données", data]);
    return { ...base, color: domColor(dom), lead: "Effectuer l'action", soft: `« ${serviceLabel(a.action)} »`, main: `${serviceLabel(a.action)}`, chips, rows };
  }
  if ("delay" in a) return { ...base, icon: "hourglass", color: "#8a8ea0", main: `Attendre ${fmtDuration(a.delay)}`, rows: [] };
  if (a.wait_template || a.wait_for_trigger) return { ...base, icon: "hourglass", color: "#8a8ea0", main: "Attendre une condition", rows: a.timeout ? [["Délai maximal", fmtDuration(a.timeout)]] : [] };
  if (a.if) return { ...base, icon: "branch", color: "#8a8ea0", main: "Si une condition est vraie", rows: [["Alors", `${(a.then || []).length} action(s)`], ["Sinon", `${(a.else || []).length} action(s)`]] };
  if (a.choose) return { ...base, icon: "branch", color: "#8a8ea0", main: `Choisir selon ${a.choose.length} cas`, rows: [] };
  if (a.repeat) return { ...base, icon: "bolt", color: "#8a8ea0", main: "Répéter des actions", rows: [] };
  if (a.parallel) return { ...base, icon: "bolt", color: "#8a8ea0", main: "Exécuter en parallèle", rows: [] };
  if (a.event) return { ...base, icon: "bell", color: "#8a8ea0", main: `Déclencher l'événement « ${a.event} »`, rows: [] };
  if (a.variables) return { ...base, icon: "code", color: "#8a8ea0", main: "Définir des variables", rows: [] };
  if (a.stop) return { ...base, icon: "bolt", color: "#8a8ea0", main: `Arrêter : ${a.stop}`, rows: [] };
  return { ...base, icon: "code", color: "#8a8ea0", main: "Étape personnalisée", rows: [] };
}

const SECTION = {
  triggers: { label: "Quand", kicker: "QUAND", color: "var(--blue)", describe: describeTrigger },
  conditions: { label: "Et si", kicker: "ET SI", color: "#8a8ea0", describe: describeCondition },
  actions: { label: "Alors faire", kicker: "ALORS FAIRE", color: "var(--amber)", describe: describeAction },
};

/* ----------------------------------------------------------------- rendering */
const chipHtml = (c) => `<span class="chip"><span class="dot" style="--dc:${domColor(c.domain)}"></span>${esc(c.name)}</span>`;
const iconHtml = (d) => `<span class="circle-ico" style="--ic:${d.color}">${SVG[d.icon] || SVG.bolt}</span>`;

function stepSummaryHtml(d) {
  const title = d.lead ? `${esc(d.lead)} <span class="soft">${esc(d.soft)}</span>` : esc(d.main);
  return `<div class="sum-step">${iconHtml(d)}<div class="sum-body"><div class="sum-title">${title}</div>${d.chips.length ? `<div class="chips">${d.chips.map(chipHtml).join("")}</div>` : ""}</div></div>`;
}

function renderResume() {
  let html = '<div class="body">';
  for (const key of ["triggers", "conditions", "actions"]) {
    const list = S.auto[key];
    if (!list.length && key !== "triggers" && key !== "actions") continue;
    html += `<div class="kicker">${SECTION[key].kicker}</div>`;
    html += list.length ? list.map((s) => stepSummaryHtml(SECTION[key].describe(s))).join("") : '<div class="muted">Aucune étape</div>';
  }
  return html + "</div>";
}

function nodeHtml(key, i, step) {
  const d = SECTION[key].describe(step);
  const title = d.lead ? `${d.lead.replace("Effectuer l'action", "")}${d.main}`.trim() : d.main;
  const rows = d.rows.map(([k, v]) => `<div class="node-row"><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join("");
  return `<div class="node">
    <div class="node-head">${iconHtml(d)}<div class="node-title" title="${esc(title)}">${esc(title)}</div>
      <button class="icon-btn" data-menu="${key}:${i}" aria-label="Options">${SVG.dots}</button></div>
    ${rows ? `<div class="node-rows">${rows}</div>` : ""}</div>`;
}

function connectorHtml(key, i) {
  return `<div class="connector"><div class="wire"></div><button class="plus" style="--c:${SECTION[key].color}" data-add="${key}:${i}" aria-label="Ajouter une étape">+</button><div class="wire"></div></div>`;
}

function renderCanvas() {
  let html = '<div class="stage"><div class="card">';
  for (const key of ["triggers", "conditions", "actions"]) {
    const list = S.auto[key];
    if (!list.length && key === "conditions") continue;
    html += `<div class="group-label">${SECTION[key].kicker}</div>`;
    list.forEach((s, i) => {
      html += nodeHtml(key, i, s);
      if (i < list.length - 1 || key !== "actions") html += connectorHtml(key, i + 1);
    });
    if (!list.length) html += `<div class="connector"><button class="plus" style="--c:${SECTION[key].color}" data-add="${key}:0">+</button></div>`;
  }
  return html + "</div></div>";
}

function renderSteps() {
  let html = '<div class="stage"><div class="card">';
  for (const key of ["triggers", "conditions", "actions"]) {
    const list = S.auto[key];
    html += `<div class="sec"><div class="sec-head"><h3>${SECTION[key].label}</h3><div class="sec-tools"><button class="icon-btn" data-add="${key}:${list.length}" aria-label="Ajouter">${SVG.plusc}</button>${SVG.chevron}</div></div>`;
    if (!list.length) html += `<div class="sec-empty">${key === "conditions" ? "S'exécute à chaque fois" : "Aucune étape"}</div>`;
    list.forEach((s, i) => {
      const d = SECTION[key].describe(s);
      html += `<div class="step">${iconHtml(d)}<div class="sum-body"><div class="sum-title">${d.lead ? `${esc(d.lead)} <span class="soft">${esc(d.soft)}</span>` : esc(d.main)}</div>${d.chips.length ? `<div class="chips">${d.chips.map(chipHtml).join("")}</div>` : ""}</div><button class="icon-btn" data-menu="${key}:${i}" aria-label="Options">${SVG.dots}</button></div>`;
    });
    html += "</div>";
  }
  return html + "</div></div>";
}

function highlightYaml(text) {
  return text.replace(/\n+$/, "").split("\n").map((line) => {
    if (/^\s*#/.test(line)) return `<span class="l y-c">${esc(line)}</span>`;
    const m = line.match(/^(\s*(?:-\s+)*)([A-Za-z0-9_\-"']+)(:)(\s*)(.*)$/);
    if (m) {
      const val = m[5];
      let v = esc(val);
      if (/^-?\d+(\.\d+)?$/.test(val)) v = `<span class="y-n">${v}</span>`;
      else if (val) v = `<span class="y-s">${v}</span>`;
      return `<span class="l">${esc(m[1])}<span class="y-k">${esc(m[2])}</span>${m[3]}${esc(m[4])}${v}</span>`;
    }
    return `<span class="l"><span class="y-s">${esc(line)}</span></span>`;
  }).join("");
}

function renderYaml() {
  if (S.yamlEdit) {
    return `<div class="stage"><div class="card"><textarea id="yaml-edit" class="yaml-edit" spellcheck="false">${esc(S.yaml)}</textarea>
      <div class="edit-bar"><button class="btn-ghost" id="yaml-cancel">Annuler</button><button class="btn-add" id="yaml-apply" style="padding:10px 20px;font-size:15px">Appliquer</button></div></div></div>`;
  }
  return `<div class="stage"><div class="card"><div class="yaml-wrap"><pre class="yaml">${highlightYaml(S.yaml)}</pre></div></div></div>`;
}

function renderThread() {
  const el = $("#thread");
  let html = "";
  if (!S.chat.length) {
    html = `<div class="hello"><strong>Dis-le en une phrase.</strong> L'IA rédige les étapes, tu les vérifies à droite, et une touche les ajoute à l'automatisation.<div class="examples">${EXAMPLES.map((x) => `<button class="chip-ex" type="button">${esc(x)}</button>`).join("")}</div></div>`;
  }
  S.chat.forEach((m) => { html += `<div class="msg ${m.role}">${esc(m.text)}${m.sub ? `<span class="sub">${esc(m.sub)}</span>` : ""}</div>`; });
  if (S.thinking) html += '<div class="msg bot typing"><div class="spinner"></div>L\'IA rédige…</div>';
  el.innerHTML = html;
  el.scrollTop = el.scrollHeight;
  $("#send").disabled = S.thinking;
}

function renderResult() {
  const root = $("#result");
  if (!S.auto) {
    root.innerHTML = S.thinking
      ? '<div class="panel"><div class="loading"><div class="spinner"></div>L\'IA rédige les étapes…</div></div>'
      : '<div class="panel empty"><div><strong>Le résultat apparaîtra ici</strong><div class="muted" style="margin-top:6px">Décris une automatisation dans la conversation : les étapes s\'affichent ici pour être vérifiées avant l\'ajout.</div></div></div>';
    return;
  }
  const tabs = [["resume", "Résumé"], ["canvas", "Canevas"], ["steps", "Étapes"], ["yaml", "YAML"]];
  const views = { resume: renderResume, canvas: renderCanvas, steps: renderSteps, yaml: renderYaml };
  const warn = [...S.warnings, ...(S.unknown.length ? [`Entités introuvables dans Home Assistant : ${S.unknown.join(", ")}`] : [])];
  root.innerHTML = `<div class="panel">
    <div class="panel-head"><div class="panel-title"><button class="pill" type="button">Vérifier l'automatisation</button><b>${esc(S.auto.alias)}</b></div><button class="icon-btn" id="close-result" aria-label="Fermer">${SVG.close}</button></div>
    ${S.hideTip ? "" : `<div class="tip">L'IA a rédigé ces étapes directement. Vérifie-les après les avoir ajoutées ; la fonction « Annuler » les supprime toutes.<button id="hide-tip" aria-label="Masquer">×</button></div>`}
    ${warn.length ? `<div class="warn-list"><strong>À vérifier</strong><ul>${warn.map((w) => `<li>${esc(w)}</li>`).join("")}</ul></div>` : ""}
    <div class="tabs">${tabs.map(([k, l]) => `<button class="tab ${S.view === k ? "active" : ""}" data-view="${k}">${l}</button>`).join("")}</div>
    ${S.busy ? '<div class="loading"><div class="spinner"></div>Mise à jour…</div>' : views[S.view]()}
    <div class="footer"><button class="btn-edit" id="edit-yaml" aria-label="Modifier le YAML" title="Modifier le YAML">${SVG.pencil}</button><button class="btn-add" id="add-auto" ${S.busy ? "disabled" : ""}>Ajouter</button></div>
  </div>`;
}

/* ------------------------------------------------------------------ actions */
function setResult(data) {
  S.auto = data.automation; S.yaml = data.yaml; S.names = data.names || {}; S.domains = data.domains || {};
  S.areas = data.areas || {}; S.warnings = data.warnings || []; S.unknown = data.unknown || []; S.yamlEdit = false;
}

function showBanner(msg, error = true) {
  const b = $("#banner");
  b.className = "banner" + (error ? " error" : "");
  b.textContent = msg;
  b.classList.toggle("hidden", !msg);
}

function toast(html, ms = 12000) {
  const el = document.createElement("div");
  el.className = "toast ok";
  el.innerHTML = html;
  $("#toast-zone").appendChild(el);
  if (ms) setTimeout(() => el.remove(), ms);
  return el;
}

async function generate(prompt, current = null, visible = null) {
  S.chat.push({ role: "user", text: visible || prompt });
  S.thinking = true; S.busy = true; showBanner("");
  renderThread(); renderResult();
  try {
    const data = await api("generate", { method: "POST", body: { prompt, current } });
    setResult(data);
    const a = S.auto;
    const n = (k) => a[k].length;
    S.chat.push({
      role: "bot",
      text: `${current ? "Mise à jour faite" : "Voici l'automatisation"} « ${a.alias} » : ${n("triggers")} déclencheur(s), ${n("conditions")} condition(s), ${n("actions")} action(s). Vérifie-la à droite, puis ajoute-la ou demande une modification.`,
      sub: [...S.warnings, ...(S.unknown.length ? [`Entités introuvables : ${S.unknown.join(", ")}`] : [])].join(" · "),
    });
  } catch (err) {
    S.chat.push({ role: "error", text: err.message });
  } finally {
    S.thinking = false; S.busy = false; renderThread(); renderResult();
  }
}

function newAutomation() {
  S.chat = []; S.auto = null; S.view = "resume"; S.yamlEdit = false; showBanner("");
  $("#prompt").value = "";
  renderThread(); renderResult();
  $("#prompt").focus();
}

async function refresh() {
  S.busy = true; renderResult();
  try { setResult({ ...(await api("validate", { method: "POST", body: { automation: S.auto } })), warnings: S.warnings }); }
  catch (err) { showBanner(err.message); }
  finally { S.busy = false; renderResult(); }
}

async function addAutomation() {
  S.busy = true; renderResult();
  try {
    const res = await api("create", { method: "POST", body: { automation: S.auto } });
    const id = res.id;
    const el = toast(`<span class="tick">${SVG.tick}</span><span>Automatisation ajoutée</span><button data-undo>Annuler</button><a href="/config/automation/edit/${esc(id)}" target="_top">Ouvrir</a>`);
    $("[data-undo]", el).onclick = async () => {
      try { await api(`automation/${id}`, { method: "DELETE" }); el.remove(); toast("<span>Automatisation supprimée</span>", 4000); }
      catch (err) { showBanner(err.message); }
    };
  } catch (err) { showBanner(err.message); }
  finally { S.busy = false; renderResult(); }
}

function openDialog(title, hint, onSubmit) {
  const d = $("#dialog");
  d.classList.remove("hidden");
  d.innerHTML = `<div class="dialog" role="dialog" aria-modal="true"><h3>${esc(title)}</h3><div class="muted" style="font-size:14px">${esc(hint)}</div>
    <textarea id="dlg-text" placeholder="Ex. : ajoute une notification sur mon téléphone"></textarea>
    <div class="actions"><button class="btn-ghost" id="dlg-cancel">Annuler</button><button class="btn-add" id="dlg-ok" style="padding:10px 22px;font-size:15px">Envoyer</button></div></div>`;
  const close = () => { d.classList.add("hidden"); d.innerHTML = ""; };
  $("#dlg-cancel").onclick = close;
  d.onclick = (e) => { if (e.target === d) close(); };
  $("#dlg-ok").onclick = () => { const v = $("#dlg-text").value.trim(); if (v) { close(); onSubmit(v); } };
  $("#dlg-text").focus();
}

function mutate(key, fn) { fn(S.auto[key]); refresh(); }

function showMenu(btn, key, i) {
  const m = $("#menu");
  const list = S.auto[key];
  const items = [];
  if (i > 0) items.push(["up", "Monter"]);
  if (i < list.length - 1) items.push(["down", "Descendre"]);
  items.push(["dup", "Dupliquer"], ["del", "Supprimer", true]);
  m.innerHTML = items.map(([a, l, danger]) => `<button data-a="${a}" class="${danger ? "danger" : ""}">${l}</button>`).join("");
  const r = btn.getBoundingClientRect();
  m.style.top = Math.min(r.bottom + 4, innerHeight - 190) + "px";
  m.style.left = Math.max(8, Math.min(r.right - 170, innerWidth - 180)) + "px";
  m.classList.remove("hidden");
  m.onclick = (e) => {
    const a = e.target.dataset.a;
    if (!a) return;
    m.classList.add("hidden");
    mutate(key, (l) => {
      if (a === "up") [l[i - 1], l[i]] = [l[i], l[i - 1]];
      if (a === "down") [l[i + 1], l[i]] = [l[i], l[i + 1]];
      if (a === "dup") l.splice(i + 1, 0, JSON.parse(JSON.stringify(l[i])));
      if (a === "del") l.splice(i, 1);
    });
  };
}

function showHeaderMenu(btn) {
  const m = $("#menu");
  const items = [["new", "Nouvelle automatisation"]];
  if (S.auto) items.push(["copy", "Copier le YAML"]);
  m.innerHTML = items.map(([a, l]) => `<button data-a="${a}">${l}</button>`).join("");
  const r = btn.getBoundingClientRect();
  m.style.top = r.bottom + 4 + "px";
  m.style.left = Math.max(8, r.right - 190) + "px";
  m.classList.remove("hidden");
  m.onclick = async (e) => {
    const a = e.target.dataset.a;
    if (!a) return;
    m.classList.add("hidden");
    if (a === "new") newAutomation();
    if (a === "copy") {
      try { await navigator.clipboard.writeText(S.yaml); toast("<span>YAML copié</span>", 3000); }
      catch (_) { showBanner("Copie impossible : sélectionne le YAML dans l'onglet YAML."); }
    }
  };
}

/* ------------------------------------------------------------------- events */
document.addEventListener("click", (e) => {
  const t = e.target.closest("button, a");
  if (!e.target.closest("#menu")) $("#menu").classList.add("hidden");
  if (!t) return;
  if (t.id === "send") return submitPrompt();
  if (t.id === "new-chat") return newAutomation();
  if (t.id === "header-menu") { e.stopPropagation(); return showHeaderMenu(t); }
  if (t.classList.contains("chip-ex")) { $("#prompt").value = t.textContent; return submitPrompt(); }
  if (t.id === "close-result") { S.auto = null; renderResult(); return; }
  if (t.id === "hide-tip") { S.hideTip = true; renderResult(); return; }
  if (t.dataset.view) { S.view = t.dataset.view; S.yamlEdit = false; renderResult(); return; }
  if (t.id === "edit-yaml") { S.view = "yaml"; S.yamlEdit = true; renderResult(); return; }
  if (t.id === "yaml-cancel") { S.yamlEdit = false; renderResult(); return; }
  if (t.id === "yaml-apply") {
    const text = $("#yaml-edit").value;
    S.busy = true; renderResult();
    api("validate", { method: "POST", body: { yaml: text } })
      .then((d) => { setResult({ ...d, warnings: S.warnings }); })
      .catch((err) => { showBanner(err.message); })
      .finally(() => { S.busy = false; renderResult(); });
    return;
  }
  if (t.id === "add-auto") return addAutomation();
  if (t.dataset.menu) { const [k, i] = t.dataset.menu.split(":"); e.stopPropagation(); return showMenu(t, k, Number(i)); }
  if (t.dataset.add) {
    const [k, i] = t.dataset.add.split(":");
    const where = { triggers: "un déclencheur", conditions: "une condition", actions: "une action" }[k];
    openDialog("Ajouter une étape", `Décris ${where} à ajouter (position ${Number(i) + 1}).`, (txt) =>
      generate(`Ajoute ${where} à la position ${Number(i) + 1} : ${txt}`, S.auto, `Ajouter ${where} : ${txt}`));
  }
});

function submitPrompt() {
  const v = $("#prompt").value.trim();
  if (!v || S.busy) return;
  $("#prompt").value = "";
  // Une automatisation est déjà affichée : le message sert à la modifier. « Nouvelle automatisation » repart de zéro.
  generate(v, S.auto || null);
}

$("#prompt").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitPrompt(); }
});

/* Couleurs : on recopie le thème de Home Assistant depuis la page parente (même origine via ingress). */
const THEME_VARS = [
  "--primary-background-color", "--card-background-color", "--secondary-background-color", "--primary-text-color",
  "--secondary-text-color", "--divider-color", "--primary-color", "--text-primary-color", "--error-color",
  "--success-color", "--warning-color", "--ha-card-border-radius", "--ha-font-family-body",
];
function syncTheme() {
  try {
    const cs = getComputedStyle(window.parent.document.documentElement);
    THEME_VARS.forEach((v) => {
      const val = cs.getPropertyValue(v).trim();
      if (val) document.documentElement.style.setProperty(v, val);
      else document.documentElement.style.removeProperty(v);
    });
  } catch (_) { /* page parente inaccessible : couleurs par défaut du thème sombre de HA */ }
}
syncTheme();
try {
  new MutationObserver(syncTheme).observe(window.parent.document.documentElement, { attributes: true, attributeFilter: ["style", "class"] });
} catch (_) { /* idem */ }

(async function init() {
  renderThread(); renderResult();
  try {
    const st = await api("status");
    $("#status-line").textContent = `${st.model} · ${st.entities} entités · Home Assistant ${st.ha_version}`;
    if (!st.configured) showBanner("Clé API Groq manquante : ajoute-la dans Paramètres → Modules complémentaires → Automations IA → Configuration.", true);
  } catch (err) {
    $("#status-line").textContent = "Connexion impossible";
    showBanner(err.message);
  }
})();
