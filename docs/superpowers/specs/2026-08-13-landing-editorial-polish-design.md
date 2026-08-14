# Katedra Landing — Kinetic Editorial

**Date:** 2026-08-13  
**Scope:** public landing page at `/` only

## Goal

Create a visibly distinct, human-directed landing page that keeps Katedra’s
paper-and-ink colors but replaces the generic card-first treatment with an
editorial composition and purposeful motion.

## Approved direction

- Keep the existing Katedra color tokens, paper background, serif identity, and
  Croatian copy.
- Use an asymmetrical editorial composition with deliberate whitespace and
  strong typographic hierarchy.
- Make **Počni pisati** the primary action, but present it as an editorial
  action link with an animated arrow/underline rather than a rounded SaaS pill.
- Keep **Provjeri bez prijave** as a quieter text action.
- Avoid a repeated grid of rounded rectangles, feature tiles, fake proof points,
  testimonials, logos, and unsupported marketing numbers.

## Page structure

1. **Masthead:** Katedra identity, short descriptor, and quiet sign-in link.
2. **Editorial hero:** oversized headline, supporting copy, primary/secondary
   text actions, and a thin blue rule that becomes the visual spine of the
   page.
3. **Trust statement:** a short editorial note separated by rules, not a card.
4. **Process timeline:** three numbered steps connected by the blue rule; each
   step reveals as it enters the viewport.
5. **Pass list:** three typographic price rows with separators, not cards. The
   hovered/focused row gets a restrained paper tint and an arrow movement.
6. **Closing CTA:** one quiet final line and the repeated primary action.
7. **Footer:** legal and support links with the existing destinations.

## Motion system

Motion should explain hierarchy, not decorate every element:

- On first paint, the hero label/copy/actions enter with a short stagger.
- The blue rule draws from left to right once.
- Timeline steps reveal on intersection with a small upward movement and fade.
- Price rows respond with a subtle background tint, underline, and arrow shift.
- The closing CTA uses only a small underline/arrow response.
- All motion is disabled or reduced under `prefers-reduced-motion: reduce`.
- Content remains visible if JavaScript or the observer is unavailable.

## UI details

### Hero

- Remove the large hero container treatment and keep the paper surface open.
- Use a large serif headline with a controlled maximum line length.
- Add one small uppercase editorial label only if it describes the product
  truthfully; do not add a slogan or fabricated proof.
- Use an inline primary action with a blue underline/arrow treatment.

### Process

- Use a single vertical rule on mobile and a horizontal/diagonal visual spine
  on wider screens where it remains readable.
- Number markers are open circles or small ink marks, not filled UI buttons.
- Step copy stays short and keeps the existing factual content.

### Pricing

- Replace `.panel` price cards with semantic linked rows.
- Keep all three existing Pass names, prices, descriptions, and query targets:
  `/pisi?tip=s`, `/pisi?tip=z`, and `/pisi?tip=d`.
- Use separators and typography for hierarchy; no “most popular” badge.

### Responsive and accessibility behavior

- On narrow screens, the hero remains left-aligned and actions stack vertically.
- The process rule becomes vertical and price rows remain full-width without
  horizontal overflow.
- All links have visible `:focus-visible` outlines.
- Motion never communicates essential information by itself.

## Implementation boundaries

- Modify only landing UI files and a small landing motion helper if needed:
  `app/page.jsx`, `app/katedra-scoped.css`, and optionally
  `app/landing-motion.jsx`.
- Do not change `/pisi`, auth, checkout, webhook, account routes, environment
  files, dependencies, or external integrations.
- Preserve all existing CTA destinations and legal links.
- Use CSS keyframes and `IntersectionObserver`; add no animation dependency.

## Verification

After implementation:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:ci
npm.cmd run build
```

Also verify `/`, `/pisi`, `/pisi?screen=scan`, and all three Pass targets return
HTTP `200` locally. Verify the landing content remains visible with motion
reduced and that no existing application route changes.
