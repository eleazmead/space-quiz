# Copilot Instructions for Space Quiz

## Architecture Overview

This project is a zero-dependency, single-file interactive web application contained entirely within `index.html`.

- **Layout & Design System**: Aerospace mission-control HUD theme styled with CSS custom properties (`--bg-primary`, `--accent`, `--telemetry-glow`, etc.). Supports dual themes via system `prefers-color-scheme` and manual override classes (`body.theme-light` / `body.theme-dark`).
- **Canvas Rendering**: Two dedicated HTML5 canvas layers:
  - `#starsCanvas`: Background starfield with depth and twinkling.
  - `#celebrationCanvas`: Particle confetti burst triggered when completing the quiz with a score >= 8 (Flight Excellence Citation).
- **State & Quiz Lifecycle**: Pure client-side state machine tracking `currentIdx`, `score`, `userAnswers`, and timers. Transitions toggle visibility between `#quizView` and `#resultsView`.
- **Feedback & Scoring**: Immediate answer feedback featuring dynamic score increments (`+10 PTS`), green glow animation for correct answers, red shake animation for incorrect answers, and contextual aerospace explanations.

## Development & Testing Workflow

There is no compiler, bundler, or package manager.

- **Running the App**: Open `index.html` directly in any modern web browser or the integrated browser canvas (`file:///C:/X/space-quiz/index.html`).
- **Smoke Testing**: Validate interactions using browser-level JavaScript execution or browser automation:
  - Keyboard navigation: Roving `ArrowUp` / `ArrowDown` between option buttons, `Enter`/`Space` selection.
  - Scoring and feedback: Correct answer green badge (`[OK ✓]`) and score increment; incorrect answer shake and red badge (`[ERR ✗]`) with correct answer revealed.
  - Results view: Verification of celebration card, citation badge, and breakdown list for scores >= 8.
  - State reset: Verify `RELAUNCH MISSION` button restores state to Question 1 with 0 points.

## Key Conventions

- **Zero External Dependencies**: Keep everything in `index.html`. Do not introduce npm packages, CDNs, external web fonts, or server requirements.
- **No Em-Dashes**: Never use em-dashes (`—`) anywhere in UI labels, text content, code, or comments. Use standard hyphens (`-`), colons, or commas instead.
- **Minimal, Concise Comments**: Avoid lengthy comments or comment banners. Only add short comments when code logic is complex or non-obvious and genuinely needs additional clarification.
- **Accessibility & Focus Management**:
  - Maintain `:focus-visible` styling (`outline: 2px solid var(--accent)` with offset and glow).
  - Manage programmatic focus transitions: moving focus to `#nextBtn` after answering, focusing the first option when advancing, and focusing `#restartBtn` on the results view.
  - Ensure all interactive elements have descriptive `aria-label`, `role`, and `aria-live` attributes.
- **Motion Preferences**: Always respect `prefers-reduced-motion`. In JavaScript, check `window.matchMedia("(prefers-reduced-motion: reduce)").matches` to disable `requestAnimationFrame` canvas loops; in CSS, preserve motion-reduction overrides for transitions and keyframes.
- **Telemetry Aesthetic**: Maintain the mission-control HUD vernacular (`SYS: NOMINAL`, `[MCC-01]`, `[A]`-`[D]` indicators, monospace telemetry fonts).
