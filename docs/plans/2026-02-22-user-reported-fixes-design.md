# User-Reported Fixes Design

**Date:** 2026-02-22
**Scope:** Login page, Settings page

## Issues & Solutions

### 1. Password Manager Compatibility (Login Page)

**Problem:** No `autocomplete` or `name` attributes on login inputs. Android password managers can't detect the fields.

**Files:** `frontend/src/pages/Login.jsx`

**Changes:**
- Email input: add `autoComplete="email"` + `name="email"`
- Password input: add `autoComplete="current-password"` (sign in) / `autoComplete="new-password"` (sign up) + `name="password"`
- Dynamic `autoComplete` value based on `isSignup` state

### 2. Keyboard Auto-Closing on Android (Settings Number Inputs)

**Problem:** `type="number"` inputs on some Android devices cause the virtual keyboard to dismiss during React state updates. Known Capacitor/Android WebView issue.

**Files:** `frontend/src/pages/Settings.jsx`

**Changes:**
- Replace `type="number"` with `type="text"` + `inputMode="numeric"` + `pattern="[0-9]*"` on all number inputs in:
  - Biometrics form (weight, height feet, height inches, height cm, age)
  - Nutrition targets form (calories, protein, carbs, fat)

### 3. Save Button UX (Settings Page)

**Problem:** Small check icon buttons for saving are confusing to users.

**Files:** `frontend/src/pages/Settings.jsx`

**Changes:**
- Replace check icon buttons with full-width "Save" text buttons at the bottom of each editing form
- Applies to three sections: Display Name, Body Stats, Nutrition Targets
- Move save button from the section header row to below the form fields
- Style consistently with existing "Apply These Targets" button pattern

### 4. URL Confusion (cally-658 vs Kalli)

**No action required.** Firebase project ID in password reset URLs is a Firebase limitation. One-time user confusion resolved manually.
