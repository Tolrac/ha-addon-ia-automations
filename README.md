# Automations IA (Groq) – application Home Assistant

[![Ajouter ce dépôt à Home Assistant](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2Ftolrac%2Fha-addon-ia-automations)

Décris une automatisation en une phrase : l'IA de [Groq Cloud](https://console.groq.com) rédige les
étapes, tu les vérifies, un clic l'ajoute à Home Assistant.

> « Chaque jour au coucher du soleil, ferme les stores et allume le lampadaire. »

## Fonctionnalités

- **Génération en langage naturel** : une phrase suffit, l'IA produit une automatisation complète
  (déclencheurs, conditions, actions) avec la syntaxe moderne de Home Assistant.
- **Vérification avant ajout** : un panneau « Quand / Alors faire » résume l'automatisation, avec les
  appareils ciblés. Les entités inexistantes sont détectées et corrigées automatiquement.
- **Quatre vues** : Résumé, Canevas, Étapes et YAML (modifiable et validable).
- **Édition des étapes** : monter, descendre, dupliquer, supprimer, ou demander à l'IA de modifier ou
  d'ajouter une étape.
- **Chat de raffinement** : les messages suivants modifient l'automatisation en cours.
- **Ajout en un clic** dans Home Assistant, avec possibilité d'annuler ou d'ouvrir l'automatisation
  dans l'éditeur.
- **Intégré à l'interface** : lien dans la barre latérale (ingress), interface sur deux colonnes
  (chat à gauche, résultat à droite) qui suit le thème de Home Assistant.

## Prérequis

- Home Assistant OS ou Supervised (le Superviseur est nécessaire pour les applications).
- Architecture `aarch64` ou `amd64`.
- Une clé API Groq gratuite : <https://console.groq.com/keys>.

## Installation

1. Clique sur le bouton en haut de cette page, ou ajoute le dépôt à la main :
   **Paramètres → Applications → Installer une application → ⋮ → Dépôts**, puis colle :

   ```text
   https://github.com/tolrac/ha-addon-ia-automations
   ```

2. Installe **Automations IA (Groq)** dans la liste. La première installation construit l'image sur
   ta machine et peut prendre quelques minutes.
3. Dans l'onglet **Configuration**, renseigne `groq_api_key`, puis démarre l'application.
4. Ouvre **Automations IA** dans la barre latérale.

## Configuration

| Option | Description | Défaut |
|---|---|---|
| `groq_api_key` | Clé API Groq (obligatoire). | – |
| `groq_model` | Modèle Groq utilisé. Les modèles arrêtés par Groq sont remplacés automatiquement. | `openai/gpt-oss-120b` |
| `language` | Langue de l'interface et des textes générés (`fr` ou `en`). | `fr` |

## Confidentialité

- Seuls ta phrase et une **liste réduite de tes entités** (identifiant, nom, pièce, état) sont
  envoyées à Groq. Aucun jeton Home Assistant ni autre donnée n'est transmis.
- La clé API reste dans la configuration de l'application.
- Le serveur n'accepte que les requêtes venant de l'ingress du Superviseur : il n'est accessible que
  via la barre latérale de Home Assistant.

## Limites

- Une automatisation générée par une IA peut être incorrecte : relis-la toujours avant de l'ajouter.
- Une connexion internet et un compte Groq sont nécessaires.
- Les quotas de l'offre gratuite de Groq s'appliquent.

## Structure du dépôt

```text
repository.yaml          Métadonnées du dépôt pour le Superviseur
ia_automations/          L'application
├── config.yaml          Manifeste (options, ingress, version)
├── Dockerfile           Image Python + aiohttp
├── DOCS.md              Documentation affichée dans Home Assistant
└── app/                 Serveur (server.py) et interface (static/)
```

## Licence

[MIT](LICENSE)
