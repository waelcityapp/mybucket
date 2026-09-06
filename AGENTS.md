# Project Rules & Conventions

## Mobile Preview Revision Counter
- The user reviews updates primarily from their mobile phone. Because mobile browsers can cache or delay refreshing, we maintain a visible revision counter number (e.g. `#1`, `#2`, `#3`...) directly next to the greeting text (`greetingText` / مساء الخير / صباح الخير) in `src/App.tsx`.
- **CRITICAL RULE**: On EVERY request where changes are implemented, increment this number by 1 (e.g., `#1` -> `#2`).
- When the user explicitly requests preparing the project for GitHub / production deployment, remove this counter.
