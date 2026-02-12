# Track Specification: Kalli Conversational Onboarding Flow

## Overview
Create a chat-based onboarding flow for Kalli that captures user goals and biometric data, calculates BMR and nutritional targets, allows users to review/edit these targets, and persists the profile to Firebase. This flow needs to be integrated into the existing chat interface and settings page.

## Core Features
1.  **Conversational Data Collection:**
    *   Interactive chat flow to collect:
        *   User Goals (Lose weight, maintain, gain muscle, etc.)
        *   Height (cm/ft)
        *   Weight (kg/lbs)
        *   Age
        *   Gender
    *   Natural, encouraging persona ("Warm Professional").
    *   Input validation for all fields.

2.  **Real-time BMR & Target Calculation:**
    *   Calculate BMR using the Mifflin-St Jeor equation.
    *   Calculate TDEE (Total Daily Energy Expenditure) based on activity level (default to sedentary/lightly active for MVP or ask?). *Decision: Ask for activity level to ensure accuracy.*
    *   Recommend Calorie and Macro targets based on the selected goal.

3.  **Interactive Review & Edit:**
    *   Present a summary card within the chat.
    *   Allow users to "Confirm" or "Edit" the suggested targets.

4.  **Data Persistence:**
    *   Save the complete user profile and targets to the `users` collection in Firestore.

5.  **Settings Integration:**
    *   Display current biometrics and targets in the Settings page.
    *   Allow manual override of Calorie and Macro targets.

## Non-Functional Requirements
-   **Performance:** Immediate feedback in chat; fast sync to Firebase.
-   **Tone:** Supportive, non-judgmental.
-   **Design:** Clean, modern, mobile-optimized cards within the chat stream.

## Technical Considerations
-   **Frontend:** React, Tailwind CSS. Reuse existing `ChatInput` and `ChatMessage` components if possible, or extend them for "System" messages with interactive cards.
-   **Backend:** Firebase Functions (optional) or client-side logic for BMR calculation (acceptable for MVP). *Decision: Client-side logic for immediate feedback, validate on save.*
-   **Database:** Firestore `users/{userId}` document structure update.
