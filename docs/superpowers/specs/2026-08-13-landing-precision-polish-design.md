# Katedra Landing — Precision Polish

**Date:** 2026-08-13  
**Scope:** production landing page at `/`

## Goal

Improve the existing Katedra landing page so it feels more intentional,
balanced, and professionally finished without replacing its visual identity,
content structure, or product behavior.

## Approved direction

- Keep the existing paper-and-ink palette, serif typography, blue accent, and
  overall Katedra character.
- Keep the current landing sections and Croatian copy as the baseline.
- Do not introduce a new visual system, new marketing claims, testimonials,
  logos, unsupported usage numbers, or a card-heavy SaaS layout.
- Remove or consolidate experimental landing-only rules that were added during
  earlier demos so the final landing styling has one clear source of truth.

## Existing page structure to preserve

1. Header with Katedra identity and sign-in link.
2. Hero with “Završi rad bez nagađanja.” and two actions.
3. Trust statement about project rules guiding AI.
4. “Kako radi — 3 koraka” explanation.
5. Three Pass price options.
6. Closing “Počni pisati” action.
7. Legal and support footer.

## Visual polish

### Composition and spacing

- Establish a consistent vertical rhythm between header, hero, trust statement,
  process, pricing, closing action, and footer.
- Keep the page breathable without creating large empty dead zones.
- Align section content to the same readable column and keep long text within a
  comfortable measure.
- Preserve the current centered editorial composition and paper background.

### Typography

- Keep the existing serif family and blue accent.
- Strengthen the hierarchy between the hero headline, section labels, body copy,
  Pass names, prices, and supporting descriptions.
- Use weight, line-height, and spacing instead of additional boxes to create
  hierarchy.
- Keep Croatian diacritics and existing factual wording intact.

### Actions and Pass options

- Keep “Počni pisati” as the primary action and “Provjeri bez prijave” as the
  secondary action.
- Improve their alignment, focus state, hover response, and arrow movement
  without changing hrefs.
- Keep all three Passes, prices, descriptions, and `/pisi?tip=s`,
  `/pisi?tip=z`, and `/pisi?tip=d` targets.
- Improve Pass card consistency only through spacing, contrast, and interaction;
  do not add badges or a new pricing model.

## Motion

Motion is limited to feedback and hierarchy:

- short hero entrance using opacity/translate only;
- subtle section reveal when content enters the viewport, with content visible
  when JavaScript is unavailable;
- CTA arrow/underline movement on hover and keyboard focus;
- restrained Pass hover lift or tint, without constant looping animation;
- no animation dependency;
- all motion disabled or reduced with `prefers-reduced-motion: reduce`.

If the current architecture does not have a safe client boundary for scroll
reveal, use CSS-only entrance motion and preserve the no-JavaScript fallback
instead of converting the page into a larger client component.

## Accessibility and responsive behavior

- Keep visible `:focus-visible` states for every landing link.
- Preserve semantic headings and link destinations.
- Stack hero actions and Pass cards cleanly on narrow screens.
- Prevent horizontal overflow and awkward price wrapping.
- Respect reduced motion and keep all important content visible without motion.

## Implementation boundaries

- Modify only `app/page.jsx` and the landing-specific portion of
  `app/katedra-scoped.css` unless a small, justified helper is required.
- Do not change `/pisi`, auth, checkout, webhook, account routes, environment
  files, dependencies, or external integrations.
- Do not add another demo route or duplicate the landing content model.

## Verification

Run:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:ci
npm.cmd run build
```

Also verify locally that `/`, `/pisi`, `/pisi?screen=scan`, and all three Pass
targets return HTTP `200`, and that no demo route or demo reference remains.
