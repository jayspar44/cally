# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [0.5.1](https://github.com/jayspar44/cally/compare/v0.5.0...v0.5.1) (2026-03-08)


### Bug Fixes

* tool call cap, weekly review time gate, and disable option 303e676

## [0.5.0](https://github.com/jayspar44/cally/compare/v0.4.7...v0.5.0) (2026-03-08)


### Features

* add Google Search nutrition fallback, USDA token scoring, and lookup fixes afd2cbd
* add token scoring, nutrition matching, searchFoodLogs improvements, and nutrient validation 6547a43
* add USDA retry with simplified query on 500/504 errors 1a80f0b
* redesign tool-calling loop with research cap, budget awareness, and fallback responses 4620a1a
* update gemini thinking levels, token limits, and chat history 6baceb7
* update system prompt with tool efficiency, search/lookup clarity, and conflict resolution 7f6a626


### Bug Fixes

* add minimum token score threshold (0.2) to searchFoodLogs 4a73b17
* add thinkingConfig to Google Search, harden JSON parsing and validateNutrients dc842a0
* add USDA 503 to retry conditions (observed in testing) e521eaa
* address code review issues from PR [#11](undefined/undefined/undefined/issues/11) 8a498f4
* block research tools at execution layer instead of toolConfig 3a366e0
* invalidate context cache when user updates profile 18afc37
* resolve express-rate-limit IPv6 validation warnings dc03a46
* restore Firestore lookupNutrition limits to 50 715c49d

### [0.4.7](https://github.com/jayspar44/cally/compare/v0.4.6...v0.4.7) (2026-03-03)


### Bug Fixes

* address code review issues from PR [#10](undefined/undefined/undefined/issues/10) a1346e7
* invalidate greeting cache when food logged from Chat efb1d66

### [0.4.6](https://github.com/jayspar44/cally/compare/v0.4.5...v0.4.6) (2026-03-02)


### Features

* bypass duplicate review guard for manual trigger d9935bc
* weekly review as agent tool, scannable format, and Home loading states 5399326


### Bug Fixes

* address code review blocking and high priority issues 74e4a70
* address remaining code review issues 800a178

### [0.4.5](https://github.com/jayspar44/cally/compare/v0.4.4...v0.4.5) (2026-03-01)


### Features

* add adaptive macros, weekly focus, and smart CTA to Home page 6dc9ea9
* add AI greeting and calorie pacing to Home page 21e9412
* add chart annotations, macro trends, and refine AI prompts 931bff6
* add home greeting API service 4cd9c83
* add home greeting route, controller, and AI generation 970b672
* add type scale and card utility classes to design system e7e1457
* add weekly review day setting to Settings page 3aad6a5
* implement weekly review generation service and endpoints 0470a69
* redesign insights page with progress bars, streak clarity, and AI prompt improvements 9b34e2a
* reorder Insights sections and enhance streak banner b25327f
* trigger weekly review from Chat page and verify focus flow 9f24190


### Bug Fixes

* add nutritionSource to manual food log creation 9266e00
* add rate limiting to greeting endpoint and fix weeklyFocus access 59d9551
* improve error handling for tool iteration limit and timezone sync cbf4047
* use logger instead of console.error for greeting fetch 4bb65b2

### [0.4.4](https://github.com/jayspar44/cally/compare/v0.4.3...v0.4.4) (2026-02-25)


### Bug Fixes

* add max iteration guard to tool-calling loops da4a386
* add time awareness and catch-up logging to AI prompt 4aa38f4

### [0.4.3](https://github.com/jayspar44/cally/compare/v0.4.2...v0.4.3) (2026-02-25)


### Features

* add correction memory and fix nutritionSource tracking e51cb53


### Bug Fixes

* improve food card UX, timezone sync, and nutrition source tracking 3d16af6

### [0.4.2](https://github.com/jayspar44/cally/compare/v0.4.1...v0.4.2) (2026-02-22)


### Bug Fixes

* add autocomplete attributes to login inputs for password managers 7e1cf26
* improve login form for password manager compatibility 6abee0c
* replace check icon with Save button in settings forms 9985941
* use inputMode numeric to prevent Android keyboard dismissal 2dcde1a
* use logger instead of console.error in SearchLogs e8f9048

### [0.4.1](https://github.com/jayspar44/cally/compare/v0.4.0...v0.4.1) (2026-02-21)


### Bug Fixes

* address code review blocking and high priority issues 6055805

## [0.4.0](https://github.com/jayspar44/cally/compare/v0.3.4...v0.4.0) (2026-02-21)


### Features

* merge develop into main (v0.2.1) 0269734


### Bug Fixes

* chat food logging reliability, global search, and UX improvements 4c7b043

### [0.3.4](https://github.com/jayspar44/cally/compare/v0.3.3...v0.3.4) (2026-02-21)


### Bug Fixes

* address code review HIGH priority issues 9156b34
* lower global API rate limit from 1000 to 100 req/15min 88e31ac

### [0.3.3](https://github.com/jayspar44/cally/compare/v0.3.2...v0.3.3) (2026-02-20)


### Bug Fixes

* compress gallery images and add chat processing status phases 0420a03
* improve earned badge visual distinction with checkmark overlay 0d86f0d

### [0.3.2](https://github.com/jayspar44/cally/compare/v0.3.1...v0.3.2) (2026-02-20)


### Bug Fixes

* insights accuracy, macros UX, and ghost keyboard handling eea6b9b

### [0.3.1](https://github.com/jayspar44/cally/compare/v0.3.0...v0.3.1) (2026-02-20)


### Bug Fixes

* enable SystemBars insets handling to fix ghost keyboard ([#5](undefined/undefined/undefined/issues/5)) 7cdbd0d

## [0.3.0](https://github.com/jayspar44/cally/compare/v0.2.4...v0.3.0) (2026-02-20)


### Features

* add trends chart navigation, redesign database page, and add badge streaks 750c7eb
* per-metric chart colors, AI cache invalidation, persist insight context, and database search UX dac6f60
* redesign insights page, add multi-photo chat, and dedicated macro colors f20d5c7, closes #3A7CA5


### Bug Fixes

* change prod app ID to com.getkalli.app f549e4c

### [0.2.4](https://github.com/jayspar44/cally/compare/v0.2.3...v0.2.4) (2026-02-19)


### Bug Fixes

* use user timezone for weekly/monthly insights date range 58f8cda

### [0.2.3](https://github.com/jayspar44/cally/compare/v0.2.2...v0.2.3) (2026-02-19)


### Features

* revamp color scheme, add over-100% indicators, and improve insights chart 85eacbc

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
