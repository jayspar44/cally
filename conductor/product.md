# Initial Concept
i want to build and onboarding flow for Kalli. it should capture their goals (e.g. lose weight, just track, get nutrition advice), it should ask for information e.g. height weight age gender, then use that to calculate their basal metabolic rate, and suggest a target for calories and macros. allow the user to adjust it as they see fit. this should all happen via Kalli chat but be stored on firebase and then be presented back on the settings page

# Target Audience
- New users who have just installed the app
- Existing users who need to update their goals or haven't completed their profile

# Core Goals
- To establish a personalized daily calorie and macro target
- To capture essential biometric data (height, weight, age, gender) for accurate BMR calculation
- To clearly define their primary fitness objective (lose weight, maintain, gain muscle, etc.)
- Tailor the app experience to the user's specific needs

# Key Features
- **Conversational Onboarding:** A chat-based interface that asks for user information (height, age, weight, gender) one piece at a time.
- **Real-time Calculation:** Instant calculation and display of BMR and recommended targets within the chat.
- **Interactive Review:** Ability to edit or confirm suggested targets directly in the chat or via a summary card.
- **Data Persistence:** Automatic saving of the finalized profile and targets to the user's Firebase document.
- **Settings Integration:** Reflection of onboarding data in the Settings page, specifically allowing manual overrides of calorie and macro targets.

# Non-Functional Requirements
- **Persona:** Chat responses should be natural, encouraging, and consistent with Kalli's persona.
- **Accuracy:** BMR calculations must follow a standard, validated formula (e.g., Mifflin-St Jeor).
- **Performance:** Data synchronization to Firebase must be immediate upon user confirmation.
