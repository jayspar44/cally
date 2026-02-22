# User-Reported Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix three user-reported issues: password manager compatibility on login, Android keyboard dismissal in settings number inputs, and confusing save icon UX.

**Architecture:** Direct edits to two frontend page components. No backend changes. No new dependencies.

**Tech Stack:** React 19, Tailwind CSS 4, Capacitor 8 (Android WebView)

---

## Task 1: Add autocomplete attributes to Login page

**Files:**
- Modify: `frontend/src/pages/Login.jsx:95-113`

**Step 1: Add `name` and `autoComplete` to the email input**

In `frontend/src/pages/Login.jsx`, find the email input (line 95-102) and add two attributes:

```jsx
<input
    type="email"
    name="email"
    autoComplete="email"
    placeholder="hello@example.com"
    value={email}
    onChange={(e) => setEmail(e.target.value)}
    required
    className="w-full h-14 px-6 rounded-2xl bg-background/50 border border-primary/10 text-primary placeholder:text-primary/30 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/50 transition-all font-sans text-lg"
/>
```

**Step 2: Add `name` and dynamic `autoComplete` to the password input**

Find the password input (line 106-113). The `autoComplete` value depends on `isSignup` state — use `"new-password"` for signup, `"current-password"` for sign-in:

```jsx
<input
    type="password"
    name="password"
    autoComplete={isSignup ? 'new-password' : 'current-password'}
    placeholder="••••••••"
    value={password}
    onChange={(e) => setPassword(e.target.value)}
    required
    className="w-full h-14 px-6 rounded-2xl bg-background/50 border border-primary/10 text-primary placeholder:text-primary/30 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/50 transition-all font-sans text-lg"
/>
```

**Step 3: Verify in browser**

Run: `npm run dev:frontend` (if not already running)
Navigate to http://localhost:3500/login
- Inspect email input: should have `name="email"` and `autocomplete="email"`
- Inspect password input: should have `name="password"` and `autocomplete="current-password"`
- Toggle to signup mode: password input `autocomplete` should change to `"new-password"`

**Step 4: Commit**

```bash
git add frontend/src/pages/Login.jsx
git commit -m "fix: add autocomplete attributes to login inputs for password managers"
```

---

## Task 2: Fix Android keyboard dismissal on Settings number inputs

**Files:**
- Modify: `frontend/src/pages/Settings.jsx`

**Context:** On some Android devices, `type="number"` inputs in React cause the virtual keyboard to dismiss on every state update. The fix is to use `type="text"` with `inputMode="numeric"` and `pattern="[0-9]*"`, which shows the same numeric keyboard without the dismissal bug.

**Step 1: Replace all `type="number"` with text+inputMode in biometrics form**

There are 5 number inputs in the biometrics section. For each one, replace `type="number"` with `type="text" inputMode="numeric" pattern="[0-9]*"`.

**Weight input (line 328):**
```jsx
<input
    type="text"
    inputMode="numeric"
    pattern="[0-9]*"
    value={biometricsForm.weight}
    onChange={e => setBiometricsForm({...biometricsForm, weight: e.target.value})}
    placeholder="168"
    className="w-full px-3 py-2 text-sm bg-primary/5 rounded-lg outline-none font-mono text-primary focus:ring-1 focus:ring-primary/20"
/>
```

**Height feet input (line 351):**
```jsx
<input
    type="text"
    inputMode="numeric"
    pattern="[0-9]*"
    value={biometricsForm.heightFeet}
    onChange={e => setBiometricsForm({...biometricsForm, heightFeet: e.target.value})}
    placeholder="5"
    className="w-full px-3 py-2 text-sm bg-primary/5 rounded-lg outline-none font-mono text-primary focus:ring-1 focus:ring-primary/20"
/>
```

**Height inches input (line 361):**
```jsx
<input
    type="text"
    inputMode="numeric"
    pattern="[0-9]*"
    value={biometricsForm.heightInches}
    onChange={e => setBiometricsForm({...biometricsForm, heightInches: e.target.value})}
    placeholder="11"
    className="w-full px-3 py-2 text-sm bg-primary/5 rounded-lg outline-none font-mono text-primary focus:ring-1 focus:ring-primary/20"
/>
```

Note: remove the `min="0"` and `max="11"` props from this input — they are HTML attributes for `type="number"` only and have no effect on `type="text"`.

**Height cm input (line 374):**
```jsx
<input
    type="text"
    inputMode="numeric"
    pattern="[0-9]*"
    value={biometricsForm.heightCm}
    onChange={e => setBiometricsForm({...biometricsForm, heightCm: e.target.value})}
    placeholder="180"
    className="w-full px-3 py-2 text-sm bg-primary/5 rounded-lg outline-none font-mono text-primary focus:ring-1 focus:ring-primary/20"
/>
```

**Age input (line 396):**
```jsx
<input
    type="text"
    inputMode="numeric"
    pattern="[0-9]*"
    value={biometricsForm.age}
    onChange={e => setBiometricsForm({...biometricsForm, age: e.target.value})}
    placeholder="30"
    className="w-full px-3 py-2 text-sm bg-primary/5 rounded-lg outline-none font-mono text-primary focus:ring-1 focus:ring-primary/20"
/>
```

**Step 2: Replace all `type="number"` in nutrition targets form**

There are 4 number inputs in the nutrition targets section. Same replacement pattern.

**Calories input (line 536):**
```jsx
<input
    type="text"
    inputMode="numeric"
    pattern="[0-9]*"
    value={nutritionForm.targetCalories}
    onChange={e => setNutritionForm({...nutritionForm, targetCalories: e.target.value})}
    className="w-full px-3 py-2 text-sm bg-primary/5 rounded-lg outline-none font-mono text-primary focus:ring-1 focus:ring-primary/20"
/>
```

**Protein input (line 545):**
```jsx
<input
    type="text"
    inputMode="numeric"
    pattern="[0-9]*"
    value={nutritionForm.targetProtein}
    onChange={e => setNutritionForm({...nutritionForm, targetProtein: e.target.value})}
    className="w-full px-3 py-2 text-sm bg-primary/5 rounded-lg outline-none font-mono text-primary focus:ring-1 focus:ring-primary/20"
/>
```

**Carbs input (line 554):**
```jsx
<input
    type="text"
    inputMode="numeric"
    pattern="[0-9]*"
    value={nutritionForm.targetCarbs}
    onChange={e => setNutritionForm({...nutritionForm, targetCarbs: e.target.value})}
    className="w-full px-3 py-2 text-sm bg-primary/5 rounded-lg outline-none font-mono text-primary focus:ring-1 focus:ring-primary/20"
/>
```

**Fat input (line 563):**
```jsx
<input
    type="text"
    inputMode="numeric"
    pattern="[0-9]*"
    value={nutritionForm.targetFat}
    onChange={e => setNutritionForm({...nutritionForm, targetFat: e.target.value})}
    className="w-full px-3 py-2 text-sm bg-primary/5 rounded-lg outline-none font-mono text-primary focus:ring-1 focus:ring-primary/20"
/>
```

**Step 3: Verify in browser**

Navigate to http://localhost:3500/settings
- Click Edit on Body Stats — tap into weight field, should show numeric keyboard (on mobile), should accept typing without keyboard dismissal
- Click Edit on Nutrition Targets — tap into protein field, same behavior
- Verify all number inputs still parse correctly on save (the `parseInt`/`parseFloat` calls in handlers already handle string values)

**Step 4: Commit**

```bash
git add frontend/src/pages/Settings.jsx
git commit -m "fix: use inputMode numeric to prevent Android keyboard dismissal"
```

---

## Task 3: Replace check icon save buttons with full-width Save buttons

**Files:**
- Modify: `frontend/src/pages/Settings.jsx`
- Modify: `frontend/src/pages/Settings.jsx` (icon import, line 7)

**Step 1: Remove `Check` from the lucide-react import**

On line 7, remove `Check` from the import since it will no longer be used:

```jsx
import { LogOut, Sun, User, Info, ChevronRight, Trash2, Cpu, Database, Target, Scale, Calculator, MessageSquare, RotateCcw } from 'lucide-react';
```

**Step 2: Replace Display Name save — move button below input**

Currently (lines 242-258), when `editingName` is true, the check icon button sits next to the input in the header row. Replace with: keep just the input in the header area, and add a full-width Save button below.

Replace the `editingName` ternary branch (lines 242-258) with:

```jsx
{editingName ? (
    <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
            {/* ...existing icon+label left side stays... */}
            <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="w-32 px-3 py-1.5 text-sm bg-primary/5 border border-transparent rounded-lg focus:border-primary/20 outline-none font-sans text-primary"
                autoFocus
            />
        </div>
        <button
            onClick={handleSaveName}
            disabled={savingName}
            className="w-full py-2.5 text-sm font-sans font-medium bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
            {savingName ? 'Saving...' : 'Save'}
        </button>
    </div>
) : (
```

More precisely: in the existing header row `<div className="flex items-center justify-between py-2">`, when `editingName` is true, replace the check icon button with just the input field. Then add a Save button after the closing `</div>` of the header row but before the divider.

The exact edit: replace lines 242-258 (the editingName true branch) with:

```jsx
) : (
```
becomes keeping the input inline but replacing the Check button:

```jsx
{editingName ? (
    <div className="flex items-center gap-2">
        <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            className="w-32 px-3 py-1.5 text-sm bg-primary/5 border border-transparent rounded-lg focus:border-primary/20 outline-none font-sans text-primary"
            autoFocus
        />
    </div>
) : (
```

Then after the entire Display Name row's closing (after line 272), before the `<div className="h-px bg-border/50 my-2" />` divider, add:

```jsx
{editingName && (
    <button
        onClick={handleSaveName}
        disabled={savingName}
        className="w-full mt-3 py-2.5 text-sm font-sans font-medium bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
    >
        {savingName ? 'Saving...' : 'Save'}
    </button>
)}
```

**Step 3: Replace Body Stats save — move button below form**

Currently (lines 303-310), when `editingBiometrics` is true, a check icon button appears in the header. Replace it with an "Edit" label that's inactive (or hide the Edit button), and add a Save button at the bottom of the biometrics form.

Replace the `editingBiometrics` true branch in the header (lines 303-310):

```jsx
{editingBiometrics ? (
    <span className="px-3 py-1.5 font-serif font-bold text-primary/40 text-sm">Editing...</span>
) : (
```

Then after the biometrics editing form's closing `</div>` (after line 446, the close of the `editingBiometrics ? (` form div), before the `) : (` for the display view, add the Save button inside the editing branch:

```jsx
<button
    onClick={handleSaveBiometrics}
    disabled={savingBiometrics}
    className="w-full mt-4 py-2.5 text-sm font-sans font-medium bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
>
    {savingBiometrics ? 'Saving...' : 'Save'}
</button>
```

**Step 4: Replace Nutrition Targets save — move button below form**

Same pattern. Replace the check icon in the header (lines 513-520):

```jsx
{editingNutrition ? (
    <span className="px-3 py-1.5 font-serif font-bold text-primary/40 text-sm">Editing...</span>
) : (
```

Then after the nutrition editing form's closing `</div>` (after line 568), add:

```jsx
<button
    onClick={handleSaveNutrition}
    disabled={savingNutrition}
    className="w-full mt-4 py-2.5 text-sm font-sans font-medium bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
>
    {savingNutrition ? 'Saving...' : 'Save'}
</button>
```

**Step 5: Verify in browser**

Navigate to http://localhost:3500/settings
- Click Edit on Body Stats: should show "Editing..." where Edit was, and a full-width "Save" button below the form fields
- Click Edit on Nutrition Targets: same pattern
- Click on Display Name: input appears, "Save" button below it
- Test each Save button works (saves and exits editing mode)
- Verify "Saving..." loading state shows briefly

**Step 6: Commit**

```bash
git add frontend/src/pages/Settings.jsx
git commit -m "fix: replace check icon with Save button in settings forms"
```
