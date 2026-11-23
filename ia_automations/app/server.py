"""Automations IA : génère des automatisations Home Assistant avec Groq Cloud."""
import json
import logging
import os
import re
import time
import unicodedata
from datetime import datetime
from pathlib import Path

import yaml
from aiohttp import ClientSession, ClientTimeout, web

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("ia_automations")

BASE = Path(__file__).parent
OPTIONS_FILE = Path("/data/options.json")
OPTIONS = json.loads(OPTIONS_FILE.read_text()) if OPTIONS_FILE.exists() else {}
GROQ_KEY = (OPTIONS.get("groq_api_key") or os.environ.get("GROQ_API_KEY") or "").strip()
DEFAULT_MODEL = "openai/gpt-oss-120b"
# Modèles arrêtés par Groq (offres gratuite et développeur) : remplacés automatiquement.
RETIRED_MODELS = {"llama-3.3-70b-versatile", "llama-3.1-8b-instant", "qwen/qwen3.6-27b"}
GROQ_MODEL = (OPTIONS.get("groq_model") or DEFAULT_MODEL).strip()
if GROQ_MODEL in RETIRED_MODELS:
    logging.getLogger("ia_automations").warning(
        "Le modèle %s n'est plus disponible chez Groq : utilisation de %s", GROQ_MODEL, DEFAULT_MODEL
    )
    GROQ_MODEL = DEFAULT_MODEL
LANG = OPTIONS.get("language") or "fr"
TOKEN = os.environ.get("SUPERVISOR_TOKEN", "")
CORE = os.environ.get("HA_CORE_URL", "http://supervisor/core/api")
WS_URL = CORE.replace("http", "ws", 1).replace("/api", "/websocket")
GROQ_URL = os.environ.get("GROQ_URL", "https://api.groq.com/openai/v1/chat/completions")
ALLOWED_PEERS = {"172.30.32.2", "127.0.0.1", "::1"}

CONTROL_DOMAINS = {
    "light", "switch", "cover", "climate", "fan", "lock", "media_player", "vacuum",
    "scene", "script", "input_boolean", "humidifier", "water_heater", "siren", "button",
    "alarm_control_panel", "valve", "lawn_mower", "remote", "automation", "input_number",
    "input_select", "number", "select", "input_button", "camera",
}
SENSE_DOMAINS = {
    "binary_sensor", "person", "device_tracker", "weather", "sun", "zone", "calendar",
    "input_datetime", "timer", "counter",
}
USEFUL_SENSOR_CLASSES = {
    "temperature", "humidity", "illuminance", "power", "energy", "battery", "co2",
    "pressure", "wind_speed", "aqi", "pm25", "moisture", "gas", "voltage", "current",
}
SYNONYMS = {
    "cover": ["volet", "store", "rideau", "garage", "portail", "ouvrant", "blind", "shutter", "curtain"],
    "light": ["lumiere", "lampe", "lampadaire", "led", "ampoule", "eclairage", "spot", "light", "lamp"],
    "switch": ["prise", "interrupteur", "plug", "switch"],
    "climate": ["radiateur", "thermostat", "chauffage", "clim", "climatisation", "heating", "heater"],
    "media_player": ["musique", "tele", "television", "enceinte", "echo", "volume", "radio", "son", "tv", "speaker"],
    "fan": ["ventilateur", "fan", "ventilation"],
    "lock": ["serrure", "verrou", "lock"],
    "vacuum": ["aspirateur", "robot", "vacuum"],
    "alarm_control_panel": ["alarme", "alarm"],
    "person": ["arrive", "quitte", "maison", "absent", "rentre", "parti", "home", "away"],
    "sensor": ["temperature", "humidite", "chaud", "froid", "luminosite", "puissance", "humidity"],
    "binary_sensor": ["porte", "fenetre", "mouvement", "presence", "ouverture", "fumee", "door", "window", "motion"],
    "scene": ["scene", "ambiance"],
    "script": ["script"],
}

_cache = {"t": 0.0, "data": None}


# --------------------------------------------------------------------------- utils
def norm_tokens(text):
    text = unicodedata.normalize("NFKD", text or "").encode("ascii", "ignore").decode().lower()
    toks = re.findall(r"[a-z0-9]+", text)
    out = []
    for t in toks:
        if len(t) < 3:
            continue
        out.append(t[:-1] if t.endswith("s") and len(t) > 3 else t)
    return out


def headers():
    return {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}


async def ha_get(session, path):
    async with session.get(f"{CORE}{path}", headers=headers()) as r:
        r.raise_for_status()
        return await r.json()


async def ws_commands(session, cmds):
    results = []
    async with session.ws_connect(WS_URL, max_msg_size=0) as ws:
        await ws.receive_json()
        await ws.send_json({"type": "auth", "access_token": TOKEN})
        auth = await ws.receive_json()
        if auth.get("type") != "auth_ok":
            raise RuntimeError("Authentification Home Assistant refusée")
        for i, cmd in enumerate(cmds, 1):
            await ws.send_json({**cmd, "id": i})
            while True:
                msg = await ws.receive_json()
                if msg.get("id") == i:
                    results.append(msg.get("result") if msg.get("success") else None)
                    break
    return results


async def load_catalog(session):
    """Entités, pièces, services de notification et configuration (mis en cache 60 s)."""
    if _cache["data"] and time.time() - _cache["t"] < 60:
        return _cache["data"]
    states = await ha_get(session, "/states")
    cfg = await ha_get(session, "/config")
    services = await ha_get(session, "/services")
    areas, ent_reg, dev_reg = await ws_commands(
        session,
        [
            {"type": "config/area_registry/list"},
            {"type": "config/entity_registry/list"},
            {"type": "config/device_registry/list"},
        ],
    )
    area_names = {a["area_id"]: a["name"] for a in (areas or [])}
    dev_area = {d["id"]: d.get("area_id") for d in (dev_reg or [])}
    reg = {e["entity_id"]: e for e in (ent_reg or [])}

    entities = {}
    for s in states:
        eid = s["entity_id"]
        domain = eid.split(".")[0]
        attrs = s.get("attributes", {})
        r = reg.get(eid, {})
        if r.get("hidden_by") or r.get("disabled_by"):
            continue
        if domain == "sensor":
            if attrs.get("device_class") not in USEFUL_SENSOR_CLASSES:
                continue
        elif domain not in CONTROL_DOMAINS and domain not in SENSE_DOMAINS:
            continue
        area_id = r.get("area_id") or dev_area.get(r.get("device_id"))
        entities[eid] = {
            "id": eid,
            "domain": domain,
            "name": attrs.get("friendly_name") or eid,
            "area": area_names.get(area_id, ""),
            "state": s.get("state"),
            "unit": attrs.get("unit_of_measurement", ""),
            "device_class": attrs.get("device_class", ""),
        }
    notify = sorted(
        f"notify.{name}"
        for block in services
        if block.get("domain") == "notify"
        for name in block.get("services", {})
        if name not in ("send_message", "persistent_notification")
    )
    data = {
        "entities": entities,
        "areas": area_names,
        "notify": notify,
        "tz": cfg.get("time_zone", "UTC"),
        "ha_version": cfg.get("version", ""),
        "location": cfg.get("location_name", ""),
    }
    _cache.update(t=time.time(), data=data)
    return data


def select_context(catalog, prompt, extra_text=""):
    """Réduit la liste d'entités à celles qui sont utiles pour la phrase."""
    tokens = set(norm_tokens(prompt + " " + extra_text))
    implied = {d for d, words in SYNONYMS.items() if any(norm_tokens(w)[0:1] and norm_tokens(w)[0] in tokens for w in words)}
    scored = []
    for e in catalog["entities"].values():
        words = set(norm_tokens(e["name"] + " " + e["area"] + " " + e["id"].split(".")[1].replace("_", " ")))
        score = len(tokens & words)
        if e["domain"] in implied:
            score += 0.5
        if e["domain"] in ("person", "sun"):
            score += 0.3
        scored.append((score, e))
    scored.sort(key=lambda x: (-x[0], x[1]["id"]))
    chosen = [e for sc, e in scored if sc > 0][:120]
    if len(chosen) < 40:
        ids = {e["id"] for e in chosen}
        for sc, e in scored:
            if len(chosen) >= 60:
                break
            if e["id"] not in ids and e["domain"] in CONTROL_DOMAINS:
                chosen.append(e)
    return chosen


def fmt_entities(entities):
    lines = []
    for e in entities:
        state = e["state"]
        if e["unit"]:
            state = f"{state}{e['unit']}"
        lines.append(f"{e['id']} | {e['name']} | {e['area'] or '-'} | {state}")
    return "\n".join(lines)


SYSTEM_PROMPT = """Tu es un expert Home Assistant. Tu transformes une demande en langage naturel en automatisation Home Assistant valide.

Réponds UNIQUEMENT avec un objet JSON (sans texte autour) ayant ces clés :
- "alias" : titre court en {lang_name}
- "description" : une phrase en {lang_name} (peut être vide)
- "mode" : "single", "restart", "queued" ou "parallel"
- "triggers" : liste de déclencheurs, syntaxe moderne ("trigger": "state" | "sun" | "time" | "time_pattern" | "numeric_state" | "zone" | "event" | "homeassistant" | "template" ...)
- "conditions" : liste de conditions (peut être vide), syntaxe moderne ("condition": "state" | "time" | "sun" | "numeric_state" | "zone" | "template" ...)
- "actions" : liste d'actions, syntaxe moderne ("action": "light.turn_on" avec "target": {{"entity_id": ...}} et "data": {{...}} ; "delay", "wait_for_trigger", "if/then/else", "choose", "repeat" sont autorisés)
- "warnings" : liste de textes courts en {lang_name} pour signaler toute hypothèse ou entité manquante (peut être vide)

Règles :
- Utilise UNIQUEMENT des entity_id présents dans la liste fournie. N'en invente jamais. Si aucune entité ne convient, choisis la plus proche et explique-le dans "warnings".
- Pour les services de notification, utilise uniquement ceux de la liste « Services de notification ».
- Coucher du soleil = {{"trigger": "sun", "event": "sunset", "offset": 0}} ; lever = "sunrise". Un décalage s'écrit "offset": "-00:30:00".
- Heure fixe : {{"trigger": "time", "at": "07:30:00"}}. Jours : condition "time" avec "weekday": ["mon","tue",...].
- Fermer des volets/stores : cover.close_cover ; les ouvrir : cover.open_cover.
- Allumer/éteindre : <domaine>.turn_on / <domaine>.turn_off. Luminosité en pourcentage : "brightness_pct".
- N'ajoute pas de conditions ou de déclencheurs que la demande ne justifie pas.
- Date et heure actuelles : {now} (fuseau {tz}).

Exemple de réponse pour « Chaque jour au coucher du soleil, ferme les stores et allume le lampadaire » :
{{"alias": "Stores et lampe au coucher du soleil", "description": "", "mode": "single",
 "triggers": [{{"trigger": "sun", "event": "sunset", "offset": 0}}], "conditions": [],
 "actions": [{{"action": "cover.close_cover", "target": {{"entity_id": "cover.stores"}}, "data": {{}}}},
             {{"action": "light.turn_on", "target": {{"entity_id": "light.lampadaire"}}, "data": {{}}}}],
 "warnings": []}}
"""


def build_messages(catalog, prompt, current=None):
    ctx = select_context(catalog, prompt, json.dumps(current, ensure_ascii=False) if current else "")
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    system = SYSTEM_PROMPT.format(
        lang_name="français" if LANG == "fr" else "English", now=now, tz=catalog["tz"]
    )
    context = "Entités disponibles (entity_id | nom | pièce | état) :\n" + fmt_entities(ctx)
    if catalog["notify"]:
        context += "\n\nServices de notification : " + ", ".join(catalog["notify"][:15])
    if current:
        user = (
            f"{context}\n\nAutomatisation actuelle (JSON) :\n{json.dumps(current, ensure_ascii=False)}\n\n"
            f"Modifie-la selon cette demande et renvoie l'automatisation complète : {prompt}"
        )
    else:
        user = f"{context}\n\nDemande : {prompt}"
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


# ------------------------------------------------------------------ normalisation
def extract_json(text):
    text = text.strip()
    text = re.sub(r"^```(?:json)?|```$", "", text, flags=re.M).strip()
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end < start:
        raise ValueError("Réponse de l'IA illisible")
    return json.loads(text[start : end + 1])


def _fix_services(node):
    if isinstance(node, list):
        for item in node:
            _fix_services(item)
    elif isinstance(node, dict):
        if "service" in node and "action" not in node and isinstance(node["service"], str):
            items = list(node.items())
            node.clear()
            for k, v in items:
                node["action" if k == "service" else k] = v
        for v in node.values():
            _fix_services(v)


def normalize(auto):
    out = {}
    out["alias"] = str(auto.get("alias") or "Nouvelle automatisation")
    out["description"] = str(auto.get("description") or "")
    for plural, singular in (("triggers", "trigger"), ("conditions", "condition"), ("actions", "action")):
        val = auto.get(plural, auto.get(singular, []))
        if isinstance(val, dict):
            val = [val]
        out[plural] = val if isinstance(val, list) else []
    for t in out["triggers"]:
        if isinstance(t, dict) and "platform" in t and "trigger" not in t:
            items = list(t.items())
            t.clear()
            for k, v in items:
                t["trigger" if k == "platform" else k] = v
    _fix_services(out["actions"])
    mode = auto.get("mode")
    out["mode"] = mode if mode in ("single", "restart", "queued", "parallel") else "single"
    for extra in ("variables", "trigger_variables"):
        if extra in auto:
            out[extra] = auto[extra]
    # ordre stable des clés
    ordered = {}
    for k in ("alias", "description", "triggers", "conditions", "actions", "mode"):
        ordered[k] = out[k]
    for k in out:
        ordered.setdefault(k, out[k])
    return ordered


ENTITY_RE = re.compile(r"^[a-z_]+\.[a-z0-9_]+$")
TEMPLATE_ENTITY_RE = re.compile(r"(?:states\(|is_state\(|state_attr\(|is_state_attr\()\s*['\"]([a-z_]+\.[a-z0-9_]+)['\"]")


def collect_entities(node, found=None):
    found = found if found is not None else set()
    if isinstance(node, dict):
        for k, v in node.items():
            if k == "entity_id":
                vals = v if isinstance(v, list) else [v]
                for x in vals:
                    if isinstance(x, str):
                        for part in x.split(","):
                            part = part.strip()
                            if ENTITY_RE.match(part):
                                found.add(part)
            else:
                collect_entities(v, found)
    elif isinstance(node, list):
        for v in node:
            collect_entities(v, found)
    elif isinstance(node, str):
        found.update(TEMPLATE_ENTITY_RE.findall(node))
    return found


def collect_areas(node, found=None):
    found = found if found is not None else set()
    if isinstance(node, dict):
        for k, v in node.items():
            if k == "area_id":
                for x in v if isinstance(v, list) else [v]:
                    if isinstance(x, str):
                        found.add(x)
            else:
                collect_areas(v, found)
    elif isinstance(node, list):
        for v in node:
            collect_areas(v, found)
    return found


def describe(catalog, auto, warnings=None):
    auto = normalize(auto)
    ents = collect_entities(auto)
    known = catalog["entities"]
    names = {e: known[e]["name"] for e in ents if e in known}
    domains = {e: e.split(".")[0] for e in ents}
    all_states_unknown = [e for e in ents if e not in known]
    areas = {a: catalog["areas"].get(a, a) for a in collect_areas(auto)}
    return {
        "automation": auto,
        "yaml": yaml.safe_dump(auto, allow_unicode=True, sort_keys=False, default_flow_style=False),
        "names": names,
        "domains": domains,
        "areas": areas,
        "unknown": all_states_unknown,
        "warnings": warnings or [],
    }


# --------------------------------------------------------------------------- Groq
class GroqError(Exception):
    pass


async def call_groq(session, messages):
    if not GROQ_KEY:
        raise GroqError("Clé API Groq manquante : renseigne-la dans la configuration du module.")
    body = {
        "model": GROQ_MODEL,
        "messages": messages,
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
    }
    if GROQ_MODEL.startswith("openai/gpt-oss"):
        body["reasoning_effort"] = "low"  # réponses rapides : la tâche est structurée
    try:
        for attempt in range(2):
            async with session.post(
                GROQ_URL,
                json=body,
                headers={"Authorization": f"Bearer {GROQ_KEY}"},
                timeout=ClientTimeout(total=90),
            ) as r:
                payload = await r.json(content_type=None)
                if r.status == 401:
                    raise GroqError("Clé API Groq refusée (401). Vérifie-la dans la configuration du module.")
                if r.status == 429:
                    raise GroqError("Limite de requêtes Groq atteinte (429). Réessaie dans un instant.")
                if r.status >= 400:
                    msg = (payload.get("error") or {}).get("message") if isinstance(payload, dict) else ""
                    # Paramètre non géré par le modèle : on réessaie une fois sans les options facultatives.
                    if r.status == 400 and attempt == 0 and re.search(r"reasoning_effort|response_format", msg or ""):
                        body.pop("reasoning_effort", None)
                        if "response_format" in (msg or ""):
                            body.pop("response_format", None)
                        continue
                    raise GroqError(f"Erreur Groq {r.status} : {msg or 'requête refusée'}")
                return payload["choices"][0]["message"]["content"]
    except GroqError:
        raise
    except Exception as err:  # réseau, délai dépassé…
        raise GroqError(f"Groq injoignable : {err}") from err
    raise GroqError("Groq n'a pas répondu correctement.")


async def generate(session, prompt, current=None):
    catalog = await load_catalog(session)
    messages = build_messages(catalog, prompt, current)
    raw = await call_groq(session, messages)
    auto = normalize(extract_json(raw))
    warnings = [str(w) for w in extract_json(raw).get("warnings", []) if w] if raw else []
    unknown = [e for e in collect_entities(auto) if e not in catalog["entities"] and not e.startswith(("group.", "notify."))]
    if unknown:
        messages += [
            {"role": "assistant", "content": raw},
            {
                "role": "user",
                "content": "Ces entity_id n'existent pas : " + ", ".join(unknown)
                + ". Corrige en utilisant UNIQUEMENT des entity_id de la liste fournie et renvoie le JSON complet.",
            },
        ]
        try:
            raw2 = await call_groq(session, messages)
            auto = normalize(extract_json(raw2))
            warnings = [str(w) for w in extract_json(raw2).get("warnings", []) if w]
        except Exception as err:
            log.warning("Correction automatique impossible : %s", err)
    return describe(catalog, auto, warnings)


# --------------------------------------------------------------------------- routes
@web.middleware
async def only_ingress(request, handler):
    peer = request.transport.get_extra_info("peername")
    if peer and peer[0] not in ALLOWED_PEERS:
        return web.Response(status=403, text="Accès refusé")
    return await handler(request)


@web.middleware
async def errors(request, handler):
    try:
        return await handler(request)
    except GroqError as err:
        return web.json_response({"error": str(err)}, status=502)
    except (ValueError, json.JSONDecodeError) as err:
        return web.json_response({"error": f"Réponse invalide : {err}"}, status=422)
    except web.HTTPException:
        raise
    except Exception as err:
        log.exception("Erreur non gérée")
        return web.json_response({"error": f"Erreur interne : {err}"}, status=500)


async def index(request):
    return web.FileResponse(BASE / "static" / "index.html")


async def static_file(request):
    root = (BASE / "static").resolve()
    path = (root / request.match_info["name"]).resolve()
    if root not in path.parents or not path.is_file():
        raise web.HTTPNotFound()
    return web.FileResponse(path)


async def status(request):
    catalog = await load_catalog(request.app["session"])
    return web.json_response(
        {
            "configured": bool(GROQ_KEY),
            "model": GROQ_MODEL,
            "language": LANG,
            "entities": len(catalog["entities"]),
            "ha_version": catalog["ha_version"],
        }
    )


async def api_generate(request):
    data = await request.json()
    prompt = (data.get("prompt") or "").strip()
    if not prompt:
        return web.json_response({"error": "Décris l'automatisation à créer."}, status=400)
    if len(prompt) > 1500:
        return web.json_response({"error": "Phrase trop longue (1500 caractères max)."}, status=400)
    current = data.get("current")
    return web.json_response(await generate(request.app["session"], prompt, current))


async def api_validate(request):
    data = await request.json()
    if "yaml" in data:
        try:
            auto = yaml.safe_load(data["yaml"])
        except yaml.YAMLError as err:
            return web.json_response({"error": f"YAML invalide : {err}"}, status=422)
    else:
        auto = data.get("automation")
    if not isinstance(auto, dict):
        return web.json_response({"error": "L'automatisation doit être un objet YAML."}, status=422)
    catalog = await load_catalog(request.app["session"])
    return web.json_response(describe(catalog, auto))


async def api_create(request):
    data = await request.json()
    auto = normalize(data.get("automation") or {})
    if not auto["triggers"] or not auto["actions"]:
        return web.json_response({"error": "Il faut au moins un déclencheur et une action."}, status=400)
    auto_id = str(int(time.time() * 1000))
    session = request.app["session"]
    async with session.post(
        f"{CORE}/config/automation/config/{auto_id}", headers=headers(), json=auto
    ) as r:
        body = await r.json(content_type=None)
        if r.status >= 400:
            msg = body.get("message") if isinstance(body, dict) else str(body)
            return web.json_response({"error": f"Home Assistant a refusé l'automatisation : {msg}"}, status=422)
    log.info("Automatisation créée : %s (%s)", auto["alias"], auto_id)
    return web.json_response({"id": auto_id, "path": f"/config/automation/edit/{auto_id}"})


async def api_delete(request):
    auto_id = request.match_info["auto_id"]
    if not re.fullmatch(r"\d{10,16}", auto_id):
        return web.json_response({"error": "Identifiant invalide."}, status=400)
    async with request.app["session"].delete(
        f"{CORE}/config/automation/config/{auto_id}", headers=headers()
    ) as r:
        if r.status >= 400:
            return web.json_response({"error": "Suppression impossible."}, status=422)
    log.info("Automatisation supprimée : %s", auto_id)
    return web.json_response({"ok": True})


async def no_cache(request, response):
    """Évite qu'une ancienne interface reste affichée après une mise à jour du module."""
    response.headers["Cache-Control"] = "no-store"


async def on_start(app):
    app["session"] = ClientSession()


async def on_stop(app):
    await app["session"].close()


def make_app():
    app = web.Application(middlewares=[only_ingress, errors], client_max_size=2 * 1024 * 1024)
    app.on_response_prepare.append(no_cache)
    app.on_startup.append(on_start)
    app.on_cleanup.append(on_stop)
    # Le proxy ingress peut ajouter des « / » en trop devant le chemin : on les accepte tous.
    pre = "/{_pre:/*}"
    app.router.add_get(pre, index)
    app.router.add_get(pre + "app", index)
    app.router.add_get(pre + "api/status", status)
    app.router.add_post(pre + "api/generate", api_generate)
    app.router.add_post(pre + "api/validate", api_validate)
    app.router.add_post(pre + "api/create", api_create)
    app.router.add_delete(pre + "api/automation/{auto_id}", api_delete)
    app.router.add_get(pre + "static/{name:.+}", static_file)
    return app


if __name__ == "__main__":
    log.info("Démarrage — modèle %s, clé %s", GROQ_MODEL, "présente" if GROQ_KEY else "absente")
    web.run_app(make_app(), host="0.0.0.0", port=8099, print=None)
