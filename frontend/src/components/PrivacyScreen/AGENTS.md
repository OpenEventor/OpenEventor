# PrivacyScreen

## Purpose
Full-screen overlay that hides the application content. Used when the organizer steps away from the computer or when onlookers are nearby. Activated by clicking the logo in the AppBar, dismissed by clicking anywhere on the overlay.

## File
- `PrivacyScreen.tsx`

## Props
```typescript
interface PrivacyScreenProps {
  open: boolean;
  onClose: () => void;
}
```

## Behavior
- Black background covering the entire viewport (`position: fixed`, `inset: 0`, max z-index)
- Displays: OpenEventor logo + "OpenEventor" title + "Nothing interesting here. Thank you."
- Click anywhere to dismiss

## Used by
- `AppBar` — logo click toggles this screen
