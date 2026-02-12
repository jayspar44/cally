# Implementation Plan - Kalli Conversational Onboarding Flow

## Phase 1: Foundation & Data Structure

- [ ] **Task: Define Firestore User Schema**
    - [ ] Task: Create a TypeScript interface or JSDoc definition for the extended User profile (biometrics, goals, BMR, targets).
    - [ ] Task: Update the `UserContext` or `AuthContext` to support fetching/updating these new fields.
- [ ] **Task: Utility Functions for Calculations**
    - [ ] Task: Write tests for BMR calculation (Mifflin-St Jeor) and TDEE.
    - [ ] Task: Implement BMR and TDEE calculation logic.
    - [ ] Task: Write tests for macro distribution logic based on goals.
    - [ ] Task: Implement macro distribution logic.
- [ ] **Task: Conductor - User Manual Verification 'Foundation & Data Structure' (Protocol in workflow.md)**

## Phase 2: Conversational UI Components

- [ ] **Task: Create Interactive Chat Cards**
    - [ ] Task: Write tests for a generic `InteractiveCard` component (supports buttons/inputs within chat).
    - [ ] Task: Implement `InteractiveCard` component using Tailwind CSS.
    - [ ] Task: Create specific cards for: `GoalSelection`, `BiometricsInput` (Height/Weight/Age/Gender), `TargetSummary`.
- [ ] **Task: Conductor - User Manual Verification 'Conversational UI Components' (Protocol in workflow.md)**

## Phase 3: Onboarding Logic & State Management

- [ ] **Task: Implement Onboarding State Machine**
    - [ ] Task: Write tests for the onboarding flow logic (state transitions: Start -> Goal -> Height -> Weight -> ... -> Summary).
    - [ ] Task: Create a custom hook `useOnboardingFlow` to manage the conversation state and temporary data.
- [ ] **Task: Integrate with Chat Interface**
    - [ ] Task: Write tests for integrating `useOnboardingFlow` with the main `Chat` component.
    - [ ] Task: Update `Chat.jsx` to trigger the onboarding flow for new users or upon request.
    - [ ] Task: Ensure user inputs are captured and validated correctly.
- [ ] **Task: Conductor - User Manual Verification 'Onboarding Logic & State Management' (Protocol in workflow.md)**

## Phase 4: Persistence & Settings Integration

- [ ] **Task: Save to Firebase**
    - [ ] Task: Write tests for the "Save Profile" service function.
    - [ ] Task: Implement the save logic to update the Firestore document upon user confirmation.
- [ ] **Task: Update Settings Page**
    - [ ] Task: Write tests for the Settings page components displaying new data.
    - [ ] Task: Update `Settings.jsx` to show read-only biometrics and editable targets.
    - [ ] Task: Implement "Override Targets" functionality in Settings.
- [ ] **Task: Conductor - User Manual Verification 'Persistence & Settings Integration' (Protocol in workflow.md)**
