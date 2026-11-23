"""Faux Home Assistant + faux Groq pour tester l'application en local (voir docs/TESTING.md).

Lancement : python dev/mock_ha.py   (écoute sur le port 18123)
"""
import json
from aiohttp import web, WSMsgType

STATES = [
    {"entity_id": "cover.stores", "state": "open", "attributes": {"friendly_name": "Stores"}},
    {"entity_id": "light.lampadaire", "state": "off", "attributes": {"friendly_name": "Lampadaire"}},
    {"entity_id": "light.office_led", "state": "on", "attributes": {"friendly_name": "Office Led"}},
    {"entity_id": "person.david", "state": "home", "attributes": {"friendly_name": "David"}},
    {"entity_id": "sun.sun", "state": "above_horizon", "attributes": {"friendly_name": "Soleil"}},
    {"entity_id": "binary_sensor.porte", "state": "off", "attributes": {"friendly_name": "Porte d'entrée", "device_class": "door"}},
]
CREATED = {}


async def states(r): return web.json_response(STATES)
async def config(r): return web.json_response({"time_zone": "Europe/Brussels", "version": "2026.11.2", "location_name": "Maison"})
async def services(r): return web.json_response([{"domain": "notify", "services": {"mobile_app_xiaomi": {}, "send_message": {}}}])


async def ws(r):
    sock = web.WebSocketResponse()
    await sock.prepare(r)
    await sock.send_json({"type": "auth_required"})
    async for m in sock:
        if m.type != WSMsgType.TEXT:
            continue
        d = json.loads(m.data)
        if d["type"] == "auth":
            await sock.send_json({"type": "auth_ok"})
        else:
            res = {"config/area_registry/list": [{"area_id": "salon", "name": "Salon"}],
                   "config/entity_registry/list": [{"entity_id": "light.lampadaire", "area_id": "salon"}],
                   "config/device_registry/list": []}.get(d["type"], [])
            await sock.send_json({"id": d["id"], "type": "result", "success": True, "result": res})
    return sock


async def groq(r):
    body = await r.json()
    text = body["messages"][-1]["content"]
    auto = {"alias": "Stores et lampe au coucher du soleil", "description": "", "mode": "single",
            "triggers": [{"trigger": "sun", "event": "sunset", "offset": 0}], "conditions": [],
            "actions": [{"action": "cover.close_cover", "target": {"entity_id": "cover.stores"}, "data": {}},
                        {"action": "light.turn_on", "target": {"entity_id": "light.lampadaire"}, "data": {"brightness_pct": 60}}],
            "warnings": []}
    if "notification" in text.lower():
        auto["actions"].append({"action": "notify.mobile_app_xiaomi", "data": {"message": "Stores fermés"}})
    if "inconnu" in text.lower():
        auto["actions"][0]["target"]["entity_id"] = "cover.volets_fantomes"
    return web.json_response({"choices": [{"message": {"content": json.dumps(auto)}}]})


async def create(r):
    CREATED[r.match_info["i"]] = await r.json()
    return web.json_response({"result": "ok"})


async def delete(r):
    CREATED.pop(r.match_info["i"], None)
    return web.json_response({"result": "ok"})


app = web.Application()
app.router.add_get("/api/states", states)
app.router.add_get("/api/config", config)
app.router.add_get("/api/services", services)
app.router.add_get("/websocket", ws)
app.router.add_post("/groq", groq)
app.router.add_post("/api/config/automation/config/{i}", create)
app.router.add_delete("/api/config/automation/config/{i}", delete)
web.run_app(app, port=18123, print=None)
