# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [0.2.2](https://github.com/jayspar44/cally/compare/v0.2.1...v0.2.2) (2026-02-19)


### Features

* add Play Store build infrastructure and fix Android bugs ca91508
* update color system and improve text accessibility f275ea6


### Bug Fixes

* add custom app icons to CI build and show version code in settings a5c64b9
* resolve keystore signing failures in Play Store workflow 4aff00e

### [0.2.1](https://github.com/jayspar44/cally/compare/v0.2.0...v0.2.1) (2026-02-12)


### Features

* enhance UI across chat, database, home, and insights pages 18a2918

## [0.2.0](https://github.com/jayspar44/cally/compare/v0.1.5...v0.2.0) (2026-02-11)


### Features

* improve information density and safe area support across app a6e63bf

### [0.1.5](https://github.com/jayspar44/cally/compare/v0.1.4...v0.1.5) (2026-02-11)


### Features

* add chat-powered onboarding flow with updateUserProfile AI tool b9099ce

### [0.1.4](https://github.com/jayspar44/cally/compare/v0.1.3...v0.1.4) (2026-02-11)


### Features

* transform AI into proactive nutrition coach with biometrics support f671dd0


### Bug Fixes

* prevent AI hallucinated food logging and strip HTML tags from chat responses a946839

### [0.1.3](https://github.com/jayspar44/cally/compare/v0.1.2...v0.1.3) (2026-02-10)


### Features

* add chat UX improvements, message retry, and food log deletion tool 8d16620

### [0.1.2](https://github.com/jayspar44/cally/compare/v0.1.1...v0.1.2) (2026-02-10)


### Features

* add user-level structured logging with AsyncLocalStorage context bd661de


### Bug Fixes

* accumulate multiple logFood calls and support multi-meal summary cards b4b06ac
* make login page scrollable when mobile keyboard opens dcfd7e1
* remove unused getTodayStr import in goalsService 3d3e859

### [0.1.1](https://github.com/jayspar44/cally/compare/v0.1.0...v0.1.1) (2026-02-10)


### Features

* add custom nutrition targets with daily goal snapshots 7fc5960

## 0.1.0 (2026-02-10)


### Features

* implement dev mode chat deletion and refactor chat scroll logic c3c7fea
* implement neutral obsidian dark mode and fix template placeholders db4b27e
* port helper scripts and finish phase 4 implementation a3305ca
* **ui:** rebrand Cally to Kalli in UI text 6a394c2


### Bug Fixes

* **build:** sanitize FIREBASE_CLIENT_CONFIG secret to single-line JSON 8c31cbb
* **cors:** handle OPTIONS requests in auth middleware and express config 34c6a68
* **cors:** move cors middleware to top and allow dev env bypass 09a993e
* **server:** remove express 5 incompatible wildcard options route 276e5fe

## 0.1.0 (Initial Release)

### Features

* Initial boilerplate template
* React 19 + Vite 7 + Tailwind CSS 4 frontend
* Express 5 backend with Firebase integration
* Capacitor mobile support
* Claude Code slash commands
* Conventional commits with auto-versioning
* Cloud Build CI/CD configuration
* PR preview environments
