# Home & Insights Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform Home into a smart daily check-in, Insights into a polished analytics reference, and add a weekly review coaching event via Chat.

**Architecture:** Backend additions (AI greeting endpoint, weekly review trigger, Firestore schema). Frontend UI overhaul of Home, Insights, and Database pages. AI prompt refinement for insights. Typography consistency pass.

**Tech Stack:** React 19, Tailwind CSS 4, Express 5, Gemini Flash, Firebase Firestore, Recharts

**Design doc:** `docs/plans/2026-02-25-home-insights-redesign.md`

---

## Phase 1: Typography & Consistency Pass

Foundation work — standardize type scale, card styling, and colors across Home, Insights, and Database before redesigning content.

### Task 1.1: Define Type Scale Utility Classes

**Files:**
- Modify: `frontend/src/index.css`

**Step 1: Add type scale utility classes to index.css**

Add after the existing `@theme` block (after the CSS variables), before the global styles. These encode the design system's type scale using the existing font variables:

```css
/* Type Scale */
.type-page-title {
  font-family: var(--font-serif);
  font-weight: 900;
  font-size: 1.5rem;       /* 24px */
  line-height: 1.2;
  letter-spacing: -0.02em;
  color: var(--color-primary);
}

.type-section-header {
  font-family: var(--font-serif);
  font-weight: 700;
  font-size: 1.125rem;     /* 18px */
  line-height: 1.3;
  letter-spacing: -0.01em;
  color: var(--color-primary);
}

.type-body {
  font-family: var(--font-sans);
  font-weight: 400;
  font-size: 1rem;         /* 16px */
  line-height: 1.5;
  color: var(--color-primary);
}

.type-secondary {
  font-family: var(--font-sans);
  font-weight: 500;
  font-size: 0.875rem;     /* 14px */
  line-height: 1.4;
  color: color-mix(in srgb, var(--color-primary) 60%, transparent);
}

.type-caption {
  font-family: var(--font-sans);
  font-weight: 500;
  font-size: 0.75rem;      /* 12px */
  line-height: 1.4;
  letter-spacing: 0.02em;
  color: color-mix(in srgb, var(--color-primary) 50%, transparent);
}

.type-value {
  font-family: var(--font-mono);
  font-weight: 700;
  color: var(--color-primary);
}

.type-label {
  font-family: var(--font-sans);
  font-weight: 600;
  font-size: 0.75rem;      /* 12px */
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: color-mix(in srgb, var(--color-primary) 55%, transparent);
}
```

**Step 2: Verify dark mode compatibility**

Check that `color-mix` with `var(--color-primary)` works in dark mode since `--color-primary` changes value. Verify in browser at `http://localhost:3500` with dark mode toggled.

**Step 3: Commit**

```
git add frontend/src/index.css
git commit -m "feat: add type scale utility classes to design system"
```

---

### Task 1.2: Standardize Card Styling

**Files:**
- Modify: `frontend/src/index.css`

**Step 1: Add standardized card utility to index.css**

Add after the type scale classes:

```css
/* Card System */
.card-base {
  background-color: var(--color-surface);
  border-radius: var(--radius-2xl);
  padding: 1.25rem;
  box-shadow: var(--shadow-card);
}

.card-accent {
  background-color: color-mix(in srgb, var(--color-accent) 5%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-accent) 15%, transparent);
  border-radius: var(--radius-2xl);
  padding: 1.25rem;
}
```

**Step 2: Commit**

```
git add frontend/src/index.css
git commit -m "feat: add standardized card utility classes"
```

---

### Task 1.3: Audit and Fix Home Page Typography

**Files:**
- Modify: `frontend/src/pages/Home.jsx`
- Modify: `frontend/src/components/ui/MacroCard.jsx`
- Modify: `frontend/src/components/ui/MealItem.jsx`

**Step 1: Read current files**

Read `Home.jsx`, `MacroCard.jsx`, `MealItem.jsx` to identify all font/text classes being used.

**Step 2: Replace ad-hoc typography with type scale classes**

Systematically replace inconsistent text classes with the new type scale utilities. Key replacements:
- Page headings → `type-page-title`
- Section headers → `type-section-header`
- Calorie/macro numbers → `type-value` + appropriate size
- Labels like "Calories", "Protein" → `type-label`
- Secondary text → `type-secondary`
- Small captions → `type-caption`

Do NOT change layout, spacing, or functional behavior. Only swap typography classes.

**Step 3: Verify visually**

Run `npm run dev:frontend` and check Home page at `http://localhost:3500`. Compare dark/light mode.

**Step 4: Commit**

```
git add frontend/src/pages/Home.jsx frontend/src/components/ui/MacroCard.jsx frontend/src/components/ui/MealItem.jsx
git commit -m "refactor: standardize Home page typography with type scale"
```

---

### Task 1.4: Audit and Fix Insights Page Typography

**Files:**
- Modify: `frontend/src/pages/Insights.jsx`
- Modify: `frontend/src/components/insights/KalliInsightCard.jsx`
- Modify: `frontend/src/components/insights/TrendsChart.jsx`
- Modify: `frontend/src/components/insights/MacroDonutChart.jsx`
- Modify: `frontend/src/components/insights/StreakBanner.jsx`
- Modify: `frontend/src/components/insights/BadgesSection.jsx`

**Step 1: Read all insight component files**

**Step 2: Replace ad-hoc typography with type scale classes**

Same approach as Task 1.3. Key areas:
- "Trends", "Macros", "Achievements" section headers → `type-section-header`
- Metric values in charts/cards → `type-value`
- Descriptive text → `type-secondary`
- Labels and captions → `type-label` / `type-caption`

**Step 3: Verify visually on Insights page**

**Step 4: Commit**

```
git add frontend/src/pages/Insights.jsx frontend/src/components/insights/
git commit -m "refactor: standardize Insights page typography with type scale"
```

---

### Task 1.5: Audit and Fix Database Page Typography

**Files:**
- Modify: `frontend/src/pages/Database.jsx`
- Potentially modify: components used by Database (DateNavigator, DailySummaryBar, MealSection, FoodEditModal)

**Step 1: Read Database.jsx and its component imports**

Find and read all components used by the Database page.

**Step 2: Apply type scale classes consistently**

Same pattern — replace ad-hoc text classes with type scale utilities.

**Step 3: Verify visually on Database page**

**Step 4: Commit**

```
git add frontend/src/pages/Database.jsx frontend/src/components/
git commit -m "refactor: standardize Database page typography with type scale"
```

---

### Task 1.6: Standardize Card Padding and Border Radius

**Files:**
- Modify: `frontend/src/pages/Home.jsx`
- Modify: `frontend/src/pages/Insights.jsx`
- Modify: `frontend/src/pages/Database.jsx`
- Modify: relevant components

**Step 1: Audit all card-like containers across Home, Insights, Database**

Search for `rounded-` classes and `p-` padding classes. Document inconsistencies.

**Step 2: Standardize**

- All primary cards: use `card-base` or equivalent `rounded-[2rem] p-5 bg-surface shadow-card`
- All accent/highlight cards: use `card-accent`
- Ensure consistent padding: `p-5` (1.25rem/20px) for standard cards
- Ensure consistent radius: `rounded-[2rem]` (32px) for all cards

**Step 3: Verify all three pages visually**

**Step 4: Commit**

```
git add frontend/src/pages/ frontend/src/components/
git commit -m "refactor: standardize card padding and border radius across pages"
```

---

## Phase 2: Home Page Backend — AI Greeting Endpoint

### Task 2.1: Add Home Greeting Route

**Files:**
- Modify: `backend/src/routes/api.js`
- Create: `backend/src/controllers/homeController.js`

**Step 1: Create the controller file**

Create `backend/src/controllers/homeController.js`:

```javascript
const geminiService = require('../services/geminiService');
const { db } = require('../services/firebase');
const { getTodayStr } = require('../utils/dateUtils');

async function getGreeting(req, res) {
  try {
    const userId = req.user.uid;
    const timezone = req.query.timezone || 'America/New_York';
    const today = getTodayStr(timezone);

    const result = await geminiService.generateHomeGreeting(userId, today, timezone);

    res.json(result);
  } catch (error) {
    req.log.error({ action: 'home.getGreeting', error: error.message }, 'Failed to generate greeting');
    res.status(500).json({ error: 'Failed to generate greeting' });
  }
}

module.exports = { getGreeting };
```

**Step 2: Add route to api.js**

In `backend/src/routes/api.js`, add after the user routes (around line 34):

```javascript
const homeController = require('../controllers/homeController');

// Home
router.get('/home/greeting', homeController.getGreeting);
```

**Step 3: Commit**

```
git add backend/src/controllers/homeController.js backend/src/routes/api.js
git commit -m "feat: add home greeting route and controller"
```

---

### Task 2.2: Implement AI Greeting Generation in Gemini Service

**Files:**
- Modify: `backend/src/services/geminiService.js`

**Step 1: Read geminiService.js to understand the pattern**

Focus on `buildEnhancedContext` (lines 641-716) and how models are initialized.

**Step 2: Add generateHomeGreeting function**

Add to `geminiService.js` before the `module.exports`:

```javascript
async function generateHomeGreeting(userId, today, timezone) {
  const logger = getLogger();

  // Gather context
  const userDoc = await db.collection('users').doc(userId).get();
  const userData = userDoc.exists ? userDoc.data() : {};
  const settings = userData.settings || {};
  const weeklyFocus = userData.weeklyFocus || null;

  // Get today's logs
  const todayLogs = await getDayLogs(userId, today);
  const todayFormatted = formatLogsByMeal(todayLogs, 'Today');
  const todaySums = sumLogs(todayLogs);

  // Get recent averages for pattern context
  const recentData = await getRecentDayLogs(userId, timezone, 5);

  // Determine which meals are logged
  const loggedMeals = [...new Set(todayLogs.map(l => l.meal))];

  // Get current hour for time-of-day context
  const now = new Date().toLocaleString('en-US', { timeZone: timezone });
  const currentHour = new Date(now).getHours();
  const timeOfDay = currentHour < 12 ? 'morning' : currentHour < 17 ? 'afternoon' : 'evening';

  const goals = {
    targetCalories: settings.targetCalories || 2000,
    targetProtein: settings.targetProtein || 150,
    targetCarbs: settings.targetCarbs || 250,
    targetFat: settings.targetFat || 65,
  };

  const remaining = {
    calories: goals.targetCalories - todaySums.calories,
    protein: goals.targetProtein - todaySums.protein,
    carbs: goals.targetCarbs - todaySums.carbs,
    fat: goals.targetFat - todaySums.fat,
  };

  const prompt = `You are Kalli, a friendly AI nutritionist. Generate a brief, personalized greeting for the user's home screen.

CONTEXT:
- Time of day: ${timeOfDay} (${currentHour}:00)
- Today's intake so far: ${todaySums.calories} cal, ${todaySums.protein}g protein, ${todaySums.carbs}g carbs, ${todaySums.fat}g fat
- Daily goals: ${goals.targetCalories} cal, ${goals.targetProtein}g protein, ${goals.targetCarbs}g carbs, ${goals.targetFat}g fat
- Remaining: ${remaining.calories} cal, ${remaining.protein}g protein, ${remaining.carbs}g carbs, ${remaining.fat}g fat
- Meals logged today: ${loggedMeals.length > 0 ? loggedMeals.join(', ') : 'none yet'}
- Today's food: ${todayFormatted || 'Nothing logged yet'}
- Recent 5-day averages: ${recentData.averagesText || 'Not enough data'}
${weeklyFocus ? `- Current weekly focus: "${weeklyFocus.text}"` : '- No weekly focus set'}

RULES:
- Write exactly 1-2 sentences. No more.
- Be specific and actionable, not generic praise.
- Reference actual numbers from their data.
- If a macro is notably low compared to their goal or recent average, mention it with a concrete suggestion.
- If it's late and they haven't logged much, gently nudge them.
- If they're on track, acknowledge it briefly and suggest what to aim for at the next meal.
- Do NOT use emojis. Do NOT use exclamation marks excessively (max 1).
- Tone: warm, concise, like a knowledgeable friend — not clinical, not cheerful-robot.
- Do NOT start with "Hey!" or "Hi there!" — vary your openings.`;

  const model = genAI.getGenerativeModel({
    model: MODELS.flash,
    generationConfig: { temperature: 0.9, maxOutputTokens: 150 },
  });

  const result = await model.generateContent(prompt);
  const greeting = result.response.text().trim();

  // Generate focus progress if weekly focus exists
  let focusProgress = null;
  if (weeklyFocus && weeklyFocus.text) {
    const focusPrompt = `You are Kalli. The user's weekly focus is: "${weeklyFocus.text}"

Based on their food logs this week, give a very brief progress update (1 short sentence, max 12 words).
Examples of good responses:
- "3 out of 5 days hit — 2 more to go"
- "Averaging 85g so far, getting closer"
- "Haven't started yet — today's a great day to begin"

Recent data: ${recentData.averagesText || 'Limited data this week'}
Today: ${todaySums.calories} cal, ${todaySums.protein}g P, ${todaySums.carbs}g C, ${todaySums.fat}g F`;

    const focusResult = await model.generateContent(focusPrompt);
    focusProgress = focusResult.response.text().trim();
  }

  logger.info({ action: 'home.generateGreeting', userId }, 'Generated home greeting');

  return {
    greeting,
    focusProgress,
    activeFocus: weeklyFocus ? weeklyFocus.text : null,
  };
}
```

**Step 3: Export the function**

Add `generateHomeGreeting` to the `module.exports` at the bottom of the file.

**Step 4: Commit**

```
git add backend/src/services/geminiService.js
git commit -m "feat: implement AI greeting generation for home page"
```

---

### Task 2.3: Add Greeting API to Frontend Services

**Files:**
- Modify: `frontend/src/api/services.js`

**Step 1: Add getHomeGreeting function**

Add to `frontend/src/api/services.js`:

```javascript
getHomeGreeting: (timezone) => api.get(`/home/greeting?timezone=${encodeURIComponent(timezone)}`).then(res => res.data),
```

**Step 2: Commit**

```
git add frontend/src/api/services.js
git commit -m "feat: add home greeting API service"
```

---

## Phase 3: Home Page Frontend Redesign

### Task 3.1: Add AI Greeting to Home Page

**Files:**
- Modify: `frontend/src/pages/Home.jsx`

**Step 1: Read current Home.jsx**

**Step 2: Add greeting state and fetch logic**

Add state for the greeting and fetch it on mount (after dailySummary loads). Use the user's timezone from UserPreferencesContext or `Intl.DateTimeFormat().resolvedOptions().timeZone`.

Cache in component state — don't refetch on re-renders within the same session. Use a `useRef` to track if greeting was already fetched this session.

```javascript
const [greeting, setGreeting] = useState(null);
const [greetingLoading, setGreetingLoading] = useState(true);
const greetingFetched = useRef(false);

useEffect(() => {
  if (greetingFetched.current) return;
  greetingFetched.current = true;

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  api.getHomeGreeting(timezone)
    .then(data => setGreeting(data))
    .catch(err => console.error('Greeting fetch failed:', err))
    .finally(() => setGreetingLoading(false));
}, []);
```

**Step 3: Render greeting above the calorie progress section**

Replace the static "Today's Fuel" heading area with the AI greeting. Show a subtle loading skeleton while fetching. Fallback to no greeting if the API fails (don't block the page).

```jsx
{/* AI Greeting */}
{!greetingLoading && greeting && (
  <p className="type-body text-primary/80 leading-relaxed">
    {greeting.greeting}
  </p>
)}
```

**Step 4: Verify visually**

Start both servers with `npm run dev:local`. Check Home page loads, greeting appears after brief delay. Test with and without logged food.

**Step 5: Commit**

```
git add frontend/src/pages/Home.jsx
git commit -m "feat: add AI greeting to Home page"
```

---

### Task 3.2: Add Calorie Pacing Context

**Files:**
- Modify: `frontend/src/pages/Home.jsx`

**Step 1: Add pacing calculation**

Below the calorie progress bar, add a pacing indicator. Calculate expected intake based on time of day:

```javascript
const getPacingText = (currentCalories, targetCalories) => {
  const now = new Date();
  const hour = now.getHours();
  // Assume 7am-11pm waking window (16 hours)
  const wakingHoursElapsed = Math.max(0, Math.min(16, hour - 7));
  const expectedByNow = Math.round((wakingHoursElapsed / 16) * targetCalories);

  if (currentCalories === 0) return null;
  const diff = currentCalories - expectedByNow;
  if (Math.abs(diff) < 100) return `Right on pace for this time of day`;
  if (diff > 0) return `~${Math.abs(diff)} cal ahead of typical pace`;
  return `~${Math.abs(diff)} cal behind typical pace`;
};
```

**Step 2: Render pacing text below progress bar**

```jsx
{pacingText && (
  <p className="type-caption mt-1">{pacingText}</p>
)}
```

**Step 3: Verify visually at different times of day**

**Step 4: Commit**

```
git add frontend/src/pages/Home.jsx
git commit -m "feat: add calorie pacing context to Home page"
```

---

### Task 3.3: Make Macro Cards Adaptive

**Files:**
- Modify: `frontend/src/pages/Home.jsx`
- Modify: `frontend/src/components/ui/MacroCard.jsx`

**Step 1: Add adaptive logic to Home.jsx**

Determine which macros are on/off track based on time-of-day expected progress:

```javascript
const getExpectedProgress = () => {
  const hour = new Date().getHours();
  const wakingHoursElapsed = Math.max(0, Math.min(16, hour - 7));
  return (wakingHoursElapsed / 16) * 100; // expected % of daily goal
};

const expectedProgress = getExpectedProgress();
// A macro is "off track" if actual progress is less than 60% of expected
const isOffTrack = (progress) => progress < expectedProgress * 0.6;
```

Pass an `emphasized` prop to MacroCard when off-track.

**Step 2: Update MacroCard to support emphasized/compact modes**

Add an `emphasized` boolean prop. When `emphasized=true`, show the card at full size (current behavior). When `emphasized=false` and all macros are on track, show a more compact version (smaller ring, no percentage text inside the ring — just the label and value below).

Keep the change minimal — just scale down the SVG and hide the center text when compact.

**Step 3: Verify visually**

Test with: all macros on track (compact), one off track (that one emphasized), all off track (all emphasized).

**Step 4: Commit**

```
git add frontend/src/pages/Home.jsx frontend/src/components/ui/MacroCard.jsx
git commit -m "feat: make macro cards adaptive based on progress"
```

---

### Task 3.4: Add Weekly Focus Tracker Card

**Files:**
- Modify: `frontend/src/pages/Home.jsx`

**Step 1: Add focus tracker rendering**

Below the macro cards, add the weekly focus card. Only render if `greeting?.activeFocus` exists:

```jsx
{greeting?.activeFocus && (
  <Link to="/chat" className="block card-base">
    <div className="flex items-center justify-between">
      <div>
        <p className="type-label mb-1">This Week's Focus</p>
        <p className="type-body font-medium">{greeting.activeFocus}</p>
        {greeting.focusProgress && (
          <p className="type-secondary mt-1">{greeting.focusProgress}</p>
        )}
      </div>
      <ChevronRight className="w-5 h-5 text-primary/30" />
    </div>
  </Link>
)}
```

**Step 2: Verify**

This card won't show until the weekly review system is built (Phase 5). For now, verify it renders nothing when `activeFocus` is null.

**Step 3: Commit**

```
git add frontend/src/pages/Home.jsx
git commit -m "feat: add weekly focus tracker card to Home page"
```

---

### Task 3.5: Make CTA Context-Aware

**Files:**
- Modify: `frontend/src/pages/Home.jsx`

**Step 1: Add context-aware CTA logic**

```javascript
const getCtaLabel = (meals) => {
  const hour = new Date().getHours();
  const loggedMeals = new Set((meals || []).map(m => m.meal));

  if (hour >= 6 && hour < 11 && !loggedMeals.has('breakfast')) return 'Log breakfast';
  if (hour >= 11 && hour < 15 && !loggedMeals.has('lunch')) return 'Log lunch';
  if (hour >= 15 && hour < 17 && !loggedMeals.has('snack') && loggedMeals.has('lunch')) return 'Add a snack';
  if (hour >= 17 && hour < 22 && !loggedMeals.has('dinner')) return 'Log dinner';
  return 'Log something';
};
```

**Step 2: Replace the static CTA text with the dynamic label**

**Step 3: Verify at current time of day, confirm label makes sense**

**Step 4: Commit**

```
git add frontend/src/pages/Home.jsx
git commit -m "feat: make home CTA context-aware based on time and meals"
```

---

### Task 3.6: Tighten Meals Feed Visually

**Files:**
- Modify: `frontend/src/pages/Home.jsx`
- Modify: `frontend/src/components/ui/MealItem.jsx`

**Step 1: Read MealItem.jsx current styling**

**Step 2: Reduce visual weight of meals section**

- Make the "Today's Meals" section header smaller (`type-label` instead of section header)
- Reduce padding within MealItem components
- Use `type-secondary` for item details
- Consider collapsing the whole section by default with a "Show meals" toggle if there are logged meals

**Step 3: Verify the meals section feels secondary to the greeting + calorie + macro hero sections**

**Step 4: Commit**

```
git add frontend/src/pages/Home.jsx frontend/src/components/ui/MealItem.jsx
git commit -m "refactor: tighten meals feed visual weight on Home page"
```

---

## Phase 4: Insights Page Frontend Redesign

### Task 4.1: Reorder Insights Sections — Streak to Top

**Files:**
- Modify: `frontend/src/pages/Insights.jsx`

**Step 1: Read current Insights.jsx layout order**

**Step 2: Move StreakBanner rendering to the top of the page**

Current order: TimeRange → KalliInsight → TrendsChart → MacroDonut → StreakBanner → Badges

New order: StreakBanner → TimeRange → TrendsChart → KalliInsight (reframed) → MacroBreakdown (rethought) → Badges

Move the `<StreakBanner>` JSX block from near the bottom to the top of the page content, before the time range selector.

**Step 3: Move time range selector below streak**

The time range pills should render after the streak banner.

**Step 4: Verify page order visually**

**Step 5: Commit**

```
git add frontend/src/pages/Insights.jsx
git commit -m "refactor: reorder Insights sections — streak hero to top"
```

---

### Task 4.2: Enhance Streak Banner with Next Badge

**Files:**
- Modify: `frontend/src/components/insights/StreakBanner.jsx`
- Modify: `frontend/src/pages/Insights.jsx` (pass badge data to StreakBanner)

**Step 1: Pass next badge to StreakBanner**

In `Insights.jsx`, compute the next badge from `badgeData.progress` (the one with highest percentage that isn't earned yet) and pass it as a `nextBadge` prop.

**Step 2: Render next badge inline in StreakBanner**

When `nextBadge` is provided, show a compact line below the streak:
```
"3 more days to Consistency King" (computed from nextBadge.target - nextBadge.current)
```

Use `type-caption` styling.

**Step 3: Verify with badge data**

**Step 4: Commit**

```
git add frontend/src/components/insights/StreakBanner.jsx frontend/src/pages/Insights.jsx
git commit -m "feat: show next badge to earn in streak banner"
```

---

### Task 4.3: Add Chart Annotations to TrendsChart

**Files:**
- Modify: `frontend/src/components/insights/TrendsChart.jsx`

**Step 1: Compute annotations from existing data**

In TrendsChart, compute from the `weeklyData`/`monthlyData`/`quarterlyData`:
- Personal best day for the selected metric in the current period
- Days where the metric was within 5% of goal (goal-hit days)

```javascript
const annotations = useMemo(() => {
  if (!chartData?.length) return {};
  const metricKey = selectedMetric; // 'calories', 'protein', etc.
  const goalKey = metricColors[metricKey].goalKey;
  const goalVal = goals?.[goalKey] || 0;

  let bestIdx = 0;
  let bestVal = 0;
  const goalHits = new Set();

  chartData.forEach((d, i) => {
    const val = d[metricKey] || 0;
    if (val > bestVal && val > 0) { bestVal = val; bestIdx = i; }
    if (goalVal > 0 && val > 0 && Math.abs(val - goalVal) / goalVal <= 0.05) {
      goalHits.add(i);
    }
  });

  return { bestIdx, bestVal, goalHits };
}, [chartData, selectedMetric, goals]);
```

**Step 2: Render annotations on chart**

For Recharts BarChart, use a Recharts `ReferenceDot` or custom `Cell` styling:
- Personal best bar gets a subtle star/dot above it
- Goal-hit bars get a small checkmark dot or accent color border

Keep it subtle — these are visual hints, not loud callouts.

**Step 3: Improve the chart insight text below the chart**

Replace the current `ChartInsight` text with a more specific computed insight:

```javascript
const insightText = useMemo(() => {
  if (!averages || !goals) return null;
  const avg = averages[selectedMetric] || 0;
  const goalKey = metricColors[selectedMetric].goalKey;
  const goal = goals[goalKey] || 0;
  if (!goal || !avg) return null;

  const diff = avg - goal;
  const absDiff = Math.abs(Math.round(diff));
  const unit = selectedMetric === 'calories' ? 'cal' : 'g';
  const direction = diff > 0 ? 'over' : 'under';

  return `Averaging ${Math.round(avg)}${unit} — ${absDiff}${unit} ${direction} your ${Math.round(goal)}${unit} target`;
}, [averages, goals, selectedMetric]);
```

**Step 4: Verify visually with real data**

**Step 5: Commit**

```
git add frontend/src/components/insights/TrendsChart.jsx
git commit -m "feat: add chart annotations and improved insight text"
```

---

### Task 4.4: Rethink Macro Breakdown — Trend View

**Files:**
- Modify: `frontend/src/components/insights/MacroDonutChart.jsx`

**Step 1: Read current MacroDonutChart.jsx**

**Step 2: Redesign to show trend direction**

Replace the horizontal bars with a compact trend view per macro. Each macro row shows:
- Macro name + color indicator
- Current period average (number)
- Trend arrow (up/down/stable) computed from comparing current vs previous period averages
- Delta text: "+12g" or "-8g" vs previous period

Props needed: `averages` (current), `prevAverages` (previous period), `goals`

If `prevAverages` is not available (only exists for 1W currently), show "vs target" instead of "vs last period".

```jsx
<div className="flex items-center justify-between">
  <div className="flex items-center gap-2">
    <div className={`w-2.5 h-2.5 rounded-full bg-${macro.color}`} />
    <span className="type-secondary">{macro.label}</span>
  </div>
  <div className="flex items-center gap-3">
    <span className="type-value text-sm">{Math.round(avg)}g</span>
    {trend !== 0 && (
      <span className={`type-caption ${trend > 0 ? 'text-green-600' : 'text-red-500'}`}>
        {trend > 0 ? '↑' : '↓'} {Math.abs(Math.round(delta))}g
      </span>
    )}
  </div>
</div>
```

**Step 3: Update Insights.jsx to pass `prevAverages` to MacroDonutChart**

The `prevAverages` computed value already exists in Insights.jsx. Pass it as a prop.

**Step 4: Rename component file**

Consider renaming `MacroDonutChart.jsx` to `MacroTrends.jsx` since it's no longer a donut chart. Update the import in `Insights.jsx`.

**Step 5: Verify visually**

**Step 6: Commit**

```
git add frontend/src/components/insights/ frontend/src/pages/Insights.jsx
git commit -m "feat: replace macro breakdown with trend-oriented view"
```

---

### Task 4.5: Refine AI Summary Prompt — "Patterns"

**Files:**
- Modify: `backend/src/controllers/insightsController.js`
- Modify: `frontend/src/components/insights/KalliInsightCard.jsx`

**Step 1: Read current AI summary prompts in insightsController.js**

Focus on the prompt templates in `getAISummary` (around lines 600-659).

**Step 2: Rewrite prompts to force specific pattern callouts**

Update the prompts for each range (1W, 1M, 3M). Key changes:
- Instruct the model to output exactly 2-3 bullet points
- Each bullet must reference a specific pattern with data
- Prohibit generic praise ("Great job!", "Keep it up!")
- Require at least one observation about a specific macro or meal pattern
- Use markdown bullet format (`- `)

Example prompt addition:
```
FORMAT: Exactly 2-3 bullet points, each starting with "- ".
Each bullet MUST reference specific data (numbers, days, meals, trends).
NEVER write generic encouragement like "Great job" or "Keep it up."
BAD: "- You're doing well with your nutrition goals"
GOOD: "- Your protein averages 82g on weekdays but drops to 55g on weekends — a 33% gap"
GOOD: "- You've hit your calorie target 5 of the last 7 days, with the two misses on Wednesday and Saturday"
```

**Step 3: Update KalliInsightCard header text**

Change the card title from "Kalli's Insight" (or whatever it currently says) to "What I noticed" or "Patterns".

**Step 4: Verify with a real AI summary refresh**

**Step 5: Commit**

```
git add backend/src/controllers/insightsController.js frontend/src/components/insights/KalliInsightCard.jsx
git commit -m "feat: refine AI summary prompts for specific pattern callouts"
```

---

### Task 4.6: Visual Polish Pass on TrendsChart

**Files:**
- Modify: `frontend/src/components/insights/TrendsChart.jsx`

**Step 1: Review current chart styling**

**Step 2: Apply visual improvements**

- Smoother bar radius (Recharts `radius` prop on `<Bar>`)
- Refined tooltip styling (consistent with type scale, use `card-base` aesthetic)
- Better grid line styling (lighter, dashed)
- Gradient fill for area charts (improve opacity/colors)
- Transition animations on metric switch

Keep changes purely visual — no functional changes.

**Step 3: Verify in both light and dark mode**

**Step 4: Commit**

```
git add frontend/src/components/insights/TrendsChart.jsx
git commit -m "refactor: visual polish pass on trends chart"
```

---

## Phase 5: Weekly Review System

### Task 5.1: Add Weekly Review Day Setting

**Files:**
- Modify: `frontend/src/pages/Settings.jsx` (or wherever settings are rendered)
- Modify: `frontend/src/api/services.js` (if settings update needs changes)

**Step 1: Find and read the Settings page**

Search for settings page or profile settings UI.

**Step 2: Add a "Weekly Review Day" picker**

Add a dropdown/selector for choosing the review day (Sunday through Saturday, default Sunday). Save to user profile under `settings.weeklyReviewDay`.

**Step 3: Verify setting saves and persists**

**Step 4: Commit**

```
git add frontend/src/pages/Settings.jsx frontend/src/api/services.js
git commit -m "feat: add weekly review day setting"
```

---

### Task 5.2: Backend — Weekly Review Generation

**Files:**
- Create: `backend/src/services/weeklyReviewService.js`
- Modify: `backend/src/controllers/chatController.js`
- Modify: `backend/src/routes/api.js`

**Step 1: Create weeklyReviewService.js**

This service:
1. Fetches the past week's food logs
2. Computes stats (days tracked, averages, streaks, top foods, meal patterns)
3. Compares to previous week
4. Generates a weekly review message via Gemini
5. Extracts a proposed focus from the AI response
6. Stores the review message in chat history
7. Stores the weekly focus in the user document
8. Updates `lastWeeklyReview` timestamp

```javascript
const { db } = require('./firebase');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getTodayStr, parseLocalDate } = require('../utils/dateUtils');
const logger = require('../logger');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function generateWeeklyReview(userId, timezone) {
  const today = getTodayStr(timezone);

  // Check if already sent this week
  const userDoc = await db.collection('users').doc(userId).get();
  const userData = userDoc.data();
  if (userData.lastWeeklyReview === today) {
    return { alreadySent: true };
  }

  // Fetch last 7 days of logs
  const endDate = today;
  const startDate = // compute 7 days ago using parseLocalDate
  // ... fetch logs, compute stats, compare to previous week

  // Generate review via Gemini
  const prompt = `You are Kalli, the user's AI nutritionist. Write their weekly review.
  // ... detailed prompt with stats context

  End with a "WEEKLY FOCUS:" line proposing one specific, measurable thing to work on.
  Example: "WEEKLY FOCUS: Hit 100g protein at least 4 out of 7 days"`;

  // Parse response, extract focus
  // Save to chat history
  // Save focus to user doc
  // Update lastWeeklyReview

  return { message: reviewText, focus: extractedFocus };
}

async function shouldTriggerReview(userId, timezone) {
  const userDoc = await db.collection('users').doc(userId).get();
  const userData = userDoc.data();
  const settings = userData.settings || {};
  const reviewDay = settings.weeklyReviewDay || 'sunday';

  const now = new Date().toLocaleString('en-US', { timeZone: timezone });
  const currentDay = new Date(now).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

  if (currentDay !== reviewDay) return false;

  const today = getTodayStr(timezone);
  if (userData.lastWeeklyReview === today) return false;

  return true;
}

module.exports = { generateWeeklyReview, shouldTriggerReview };
```

**Step 2: Add route and controller method**

Add `POST /api/chat/weekly-review` route. The controller calls `shouldTriggerReview`, then `generateWeeklyReview` if appropriate.

**Step 3: Commit**

```
git add backend/src/services/weeklyReviewService.js backend/src/controllers/chatController.js backend/src/routes/api.js
git commit -m "feat: implement weekly review generation service"
```

---

### Task 5.3: Frontend — Trigger Weekly Review on Chat Open

**Files:**
- Modify: `frontend/src/pages/Chat.jsx` (or wherever chat initialization happens)
- Modify: `frontend/src/api/services.js`

**Step 1: Add API service for weekly review**

```javascript
triggerWeeklyReview: (timezone) => api.post('/chat/weekly-review', { timezone }).then(res => res.data),
checkWeeklyReview: (timezone) => api.get(`/chat/weekly-review/check?timezone=${encodeURIComponent(timezone)}`).then(res => res.data),
```

**Step 2: Add check on Chat page mount**

When the Chat page mounts, call `checkWeeklyReview`. If it returns `{ shouldTrigger: true }`, call `triggerWeeklyReview` and prepend the review message to the chat.

This should happen once — use a ref to prevent re-triggering.

**Step 3: Verify**

Set your review day to today's day of the week in settings. Open chat. Verify the review message appears.

**Step 4: Commit**

```
git add frontend/src/pages/Chat.jsx frontend/src/api/services.js
git commit -m "feat: trigger weekly review on chat open"
```

---

### Task 5.4: Store and Retrieve Weekly Focus

**Files:**
- Modify: `backend/src/services/weeklyReviewService.js`
- Modify: `backend/src/services/geminiService.js` (greeting uses focus)

**Step 1: Implement focus extraction from review response**

Parse the AI review response to extract the "WEEKLY FOCUS:" line. Store it:

```javascript
await db.collection('users').doc(userId).set({
  weeklyFocus: {
    text: focusText,
    setAt: FieldValue.serverTimestamp(),
    reviewMessageId: chatMessageId,
  },
  lastWeeklyReview: today,
}, { merge: true });
```

**Step 2: Verify the greeting endpoint reads weeklyFocus**

The `generateHomeGreeting` function in Task 2.2 already reads `userData.weeklyFocus`. Verify it works end-to-end: set a focus manually in Firestore, then check the Home greeting references it.

**Step 3: Commit**

```
git add backend/src/services/weeklyReviewService.js
git commit -m "feat: store weekly focus from review and surface in greeting"
```

---

## Phase 6: Integration Testing & Polish

### Task 6.1: End-to-End Flow Verification

**No code changes — manual testing.**

**Step 1: Test Home page flow**

1. Open Home page → greeting loads with AI message
2. Calorie pacing shows correct context
3. Macro cards adapt (log some food to test both states)
4. CTA shows appropriate meal based on time
5. Weekly focus card shows only if focus exists

**Step 2: Test Insights page flow**

1. Streak banner at top with next badge
2. Time range selector below streak
3. Charts have annotations on personal bests
4. Macro breakdown shows trends with arrows
5. AI patterns show specific bullet points (not generic)
6. Badges section at bottom

**Step 3: Test Weekly Review flow**

1. Set review day to today in Settings
2. Open Chat → review message appears
3. Respond to the review conversationally
4. Go to Home → weekly focus card appears with the focus from the review
5. Next day: Home greeting references the focus

**Step 4: Test dark mode on all three pages**

**Step 5: Test Database page typography consistency**

---

### Task 6.2: Final Commit and Cleanup

**Step 1: Review all changes**

```bash
git diff develop --stat
```

**Step 2: Ensure no console.log statements left in backend code**

```bash
grep -r "console.log" backend/src/ --include="*.js"
```

**Step 3: Ensure all new files follow naming conventions**

- Controllers: camelCase
- Services: camelCase
- Components: PascalCase

**Step 4: Final commit if any cleanup needed**

```
git commit -m "chore: cleanup after home/insights redesign"
```
