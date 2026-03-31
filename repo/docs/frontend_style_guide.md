# MeridianCare Frontend Style Guide (Angular Desktop UI)

## Visual Thesis
Clinical operations console: calm, high-trust, dense information surfaces with low visual noise and one restrained accent color.

## Content Structure
1. **Orientation Layer**: role, clinic context, system state.
2. **Action Layer**: primary task actions for current role.
3. **Evidence Layer**: latest API responses, queue status, audit-relevant metadata.
4. **Workflow Layer**: concise step list and status progression.

## Design Tokens
- **Typeface**: `IBM Plex Sans` for UI, `Space Grotesk` for section identity only.
- **Primary ink**: `#10231b`
- **Accent**: `#0f6a4b`
- **Accent strong**: `#0a4f38`
- **Surface**: `#fbfcf8`
- **Line**: `#d4ded6`
- **Error**: `#aa2e2e`

## Layout Rules
- Desktop-first grid: left operational rail + right working canvas.
- Left rail includes navigation, workflow checklist, and operator identity.
- Right canvas includes top action bar, response panel, and active module content.
- Avoid dashboard card mosaics. Use sectional planes and data tables.

## Interaction Rules
- No manual IDs in forms; always searchable selection controls.
- Main action buttons are singular per section (`Run`, `Save`, `Approve`, etc.).
- Snackbar/toast for short success/errors; modal for multi-step confirmations.
- Disable buttons during in-flight requests.
- Keep one-click pharmacist approve/dispense actions prominent.

## Accessibility Rules
- Minimum 4.5:1 contrast for text.
- Keyboard focus state clearly visible.
- All interactive controls reachable by tab order.
- Role-specific pages preserve consistent heading hierarchy.

## Status Semantics
- Draft/Queued: neutral muted tone.
- Approved/Dispensed/Paid: green emphasis.
- Voided/Failed/Blocked: red emphasis.
- Never encode status only by color; include text labels.

## Table & Form Patterns
- Tables: sticky headers for desktop workflows, explicit empty states.
- Forms: grouped by domain intent (patient, encounter, medication, billing).
- Validation messages inline and deterministic.
- All money/quantity fields right-aligned and normalized server-side.

## Motion Guidance
- Keep motion functional and minimal:
  - subtle page fade on route change,
  - quick hover elevation on actionable rows,
  - response panel reveal animation.
- No decorative motion loops.

## Component Priorities by Phase
- **Phase 1**: Auth shell, user admin table, credentialing import + row errors.
- **Phase 2**: Encounter editor, ICD typeahead panel, sign action footer.
- **Phase 3**: Pharmacy queue board, inventory movement table, low-stock badges.
- **Phase 4**: Checkout composer, invoice preview + payment capture panel.
- **Phase 5**: Ops console for jobs, model versions, backups, and drill logs.

## Done Criteria for UI in each phase
- Role workflows are operable without dev tools.
- No placeholder text remains in production routes.
- API failure states are explicit and recoverable.
- Screenshots for each role are captured and linked in release notes.
