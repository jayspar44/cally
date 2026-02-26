# Home & Insights Redesign + Weekly Review

**Date:** 2026-02-25
**Status:** Approved

## Problem

The Home page is a passive scoreboard — numbers without context or guidance. The Insights page has useful data but presents everything with equal weight, no narrative, and buries the motivating elements. Typography and styling are inconsistent across the app.

## Design Philosophy

**"Nutritionist, not spreadsheet."** A good nutritionist notices patterns, gives you one thing to focus on, and adjusts based on progress. Kalli should do the same.

**Page responsibilities:**

| Page | Role |
|---|---|
| **Home** | Daily check-in — "Am I on track? What should I do now?" |
| **Insights** | Analytics reference — explore trends and patterns on your own terms |
| **Chat** | Coaching moments — weekly review as a conversational event |

## 1. Home Page — "Daily Check-in"

### 1.1 AI Greeting + Smart Nudge

- AI-generated 1-2 sentence message from Kalli on page load
- Given: daily summary data, recent patterns, time of day, weekly focus (if active)
- Examples: "Good afternoon! You're cruising at 1,100 cal with dinner to go. Your protein's been trending low — try to get 30g+ tonight."
- New lightweight backend endpoint (or extend daily summary response)
- Cached per session — don't re-fetch on every page visit

### 1.2 Calorie Progress

- Keep current progress bar + number
- Add pacing context: "typical by this time: ~1,200 cal" based on time-of-day ratio against target
- Simple frontend calculation: `(hoursElapsed / 16) * targetCalories` (assuming ~16 waking hours)

### 1.3 Adaptive Macro Cards

- Off-track macros get visual emphasis + contextual nudge
- On-track macros compress to a minimal "on track" state
- Logic: if progress < 60% of expected by time-of-day, emphasize. Otherwise, compact.
- Nudges are part of the AI greeting context, not separate AI calls

### 1.4 Weekly Focus Tracker

- Compact card showing current focus from last weekly review
- Focus stored as plain text in Firestore (e.g., "Hit 100g protein at least 5 days this week")
- AI evaluates focus text against this week's food logs, returns short progress summary
- Generated alongside the AI greeting (single API call), cached daily
- Only appears after user's first weekly review
- Tapping the card navigates to the weekly review conversation in Chat

### 1.5 Meals Feed

- Keep, but visually secondary — tighter spacing, less prominent
- The check-in status sections above are the hero, not the food diary

### 1.6 Context-Aware CTA

- Replace generic "Log Something" with context-aware label
- Logic: check time of day + which meals are logged → "Log lunch", "How was dinner?", "Add a snack"
- Frontend logic only, no AI needed

### Backend Changes (Home)

| Change | Type |
|---|---|
| New endpoint: AI greeting + focus progress | New route/controller/service |
| Store active weekly focus | New Firestore field on user doc or subcollection |
| Cache AI greeting per session | Frontend cache (state/context) |

## 2. Insights Page — "Analytics Reference"

No coaching pressure. Pure trends and patterns for the data-curious user.

### 2.1 Streak/Momentum Hero (top of page)

- Move from bottom to top — this is the emotional hook
- Current streak prominently displayed with visual flair
- Next badge to earn shown inline: "3 more days to Consistency King"
- Compact but impactful — not a full card, more of a banner

### 2.2 Time Range Selector

- Moves below streak hero (streak is always "now," range controls everything below)
- Keep current 1W / 1M / 3M pills

### 2.3 Trends Chart (enhanced)

- Keep metric switcher (calories/protein/carbs/fat) and period navigation
- Add inline annotations on the chart:
  - Personal bests marked with a subtle indicator
  - Goal-hit days visually distinguished
  - Streak start/end markers
- One-line computed insight below chart: "Your average is 180 cal under target — down from 320 last week"
- Visual polish: better colors, smoother transitions, refined tooltip
- All annotations computed client-side from existing API data

### 2.4 Macro Breakdown (rethought)

- Replace "3 equal horizontal bars" with trend-oriented view
- Each macro shows: current average, trend direction (improving/declining/stable), delta vs previous period
- Compact visual — arrows or sparklines rather than full bars
- Makes it complementary to Home (Home = today, Insights = trend over time)

### 2.5 AI Patterns (refined)

- Reframe from "AI Summary" to "Patterns" or "What I noticed"
- Shorter: 2-3 bullet observations, not a paragraph
- Prompt refinement to force specific callouts:
  - "You eat 40% more carbs on weekends"
  - "Your protein is consistently low at breakfast"
  - NOT "Great job staying consistent!"
- "Chat about this" link stays
- Refresh button stays

### 2.6 Badges Gallery

- Keep at bottom as a detail section
- Earned badges + in-progress badges with progress bars
- Less buried than today (clear section header) but not the hero
- Badge detail modal stays

### Backend Changes (Insights)

| Change | Type |
|---|---|
| AI summary prompt refinement | Update existing prompt |
| No new endpoints needed | — |
| Chart annotations | Client-side computation |

## 3. Weekly Review — Chat Event

A proactive coaching moment delivered as a conversation.

### 3.1 Trigger

- User sets preferred review day in profile settings (default: Sunday)
- When user opens the app on that day, Kalli sends a review message
- Could also trigger via push notification: "Your weekly review is ready"
- Only triggers once per week (flag in Firestore)

### 3.2 Content

The weekly review message includes:
- **Wins:** What went well ("You hit your calorie target 5/7 days")
- **Patterns:** What Kalli noticed ("Lunch portions have been creeping up")
- **Comparison:** vs. previous week ("Protein intake up 12% from last week")
- **Proposed focus:** One thing to work on this week ("Let's aim for 30g protein at breakfast at least 4 days")

### 3.3 Conversational

- User can respond, ask questions, adjust the focus
- "That's too ambitious" → Kalli adjusts
- "Can we focus on something else?" → Kalli proposes alternatives
- The conversation is natural, not a rigid flow

### 3.4 Output

- Agreed focus stored as plain text in Firestore
- Surfaces on Home page as weekly focus tracker card
- Persists until next weekly review replaces it

### 3.5 Delivery Options (future)

- Push notification on review day
- Email summary (optional, user preference)

### Backend Changes (Weekly Review)

| Change | Type |
|---|---|
| Weekly review generation endpoint/trigger | New service logic |
| Review day setting in user profile | Schema addition |
| Weekly focus storage | New Firestore field |
| Weekly review sent flag (prevent duplicates) | New Firestore field |
| Chat history entry for review message | Uses existing chat system |

## 4. Typography & Consistency Pass

Applies to: **Home, Insights, Database** (and any shared components)

### 4.1 Type Scale

Define and enforce a consistent scale:

| Role | Size | Weight | Usage |
|---|---|---|---|
| Page title | xl/2xl | Semibold | Page headers |
| Section header | lg | Semibold | Card titles, section labels |
| Body | base | Normal | Primary content |
| Secondary | sm | Normal | Supporting text, labels |
| Caption | xs | Normal | Timestamps, metadata |

### 4.2 Consistency Fixes

- Standardize card padding, border radius, spacing across all pages
- Metric colors (protein/carbs/fat) consistent everywhere
- Font sizes and weights audited and unified
- Dark mode color consistency verified

## 5. Scope & Non-Scope

### In Scope

- Home page redesign (UI + new AI greeting endpoint)
- Insights page redesign (UI + prompt refinement)
- Weekly review system (new feature: trigger, generation, storage, chat delivery)
- Typography/consistency pass across Home, Insights, Database
- Weekly focus storage and tracking

### Out of Scope

- Chat page UI changes (weekly review uses existing chat infrastructure)
- Settings page changes (beyond adding review day preference)
- Login page changes
- Push notifications (future enhancement)
- Backend rewrites or new database architecture

## 6. Data Model Additions

### User Document (`users/{userId}`)

```js
{
  // ... existing fields ...
  settings: {
    // ... existing settings ...
    weeklyReviewDay: 'sunday',         // User's preferred review day
  },
  weeklyFocus: {
    text: string,                       // Plain text focus from last review
    setAt: timestamp,                   // When the focus was set
    reviewMessageId: string | null,     // Chat message ID of the review
  },
  lastWeeklyReview: string | null,     // YYYY-MM-DD of last review sent
}
```

## 7. New API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/home/greeting` | AI greeting + focus progress for Home page |
| POST | `/api/chat/weekly-review` | Trigger/generate weekly review (or auto-trigger) |

The `/api/home/greeting` endpoint receives the daily summary context server-side and returns:

```js
{
  greeting: string,          // 1-2 sentence AI message
  focusProgress: string | null,  // AI evaluation of weekly focus progress
  activeFocus: string | null,    // Current focus text
}
```
