# Automations IA (Groq)

Décris une automatisation en une phrase. L'IA (Groq Cloud) rédige les étapes, tu les
vérifies (résumé, canevas, étapes ou YAML), puis un clic les ajoute à Home Assistant.

## Configuration

| Option | Description |
|---|---|
| `groq_api_key` | Ta clé API Groq (https://console.groq.com/keys). Obligatoire. |
| `groq_model` | Modèle Groq utilisé (défaut `openai/gpt-oss-120b`). Les modèles arrêtés par Groq (`llama-3.3-70b-versatile`, `llama-3.1-8b-instant`) sont remplacés automatiquement. |
| `language` | Langue de l'interface et des textes générés (`fr` ou `en`). |

## Fonctionnement

1. Saisis une phrase, par exemple « Chaque jour au coucher du soleil, ferme les stores et allume le lampadaire ».
2. Le module envoie à Groq ta phrase et une liste réduite de tes entités (identifiant, nom, pièce, état).
   Aucune autre donnée de Home Assistant n'est envoyée, et aucun jeton n'est transmis.
3. L'automatisation proposée est vérifiée (entités existantes) puis affichée.
4. « Ajouter » crée l'automatisation dans Home Assistant. « Annuler » la supprime.

## Confidentialité

La clé API reste dans la configuration du module. Le module n'écoute que sur le réseau interne
de Home Assistant (accès via la barre latérale uniquement).
