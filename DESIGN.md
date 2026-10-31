---
name: Dilemma
description: Dark purple vehicle comparison with clear actions and readable evidence.
colors:
  background: "#100820"
  surface: "#22113f"
  surface-raised: "#301169"
  surface-hover: "#321e52"
  border: "#493467"
  text: "#f8f5ff"
  text-secondary: "#bdb2d2"
  action: "#339cfc"
  accent: "#5cb4fc"
  ink: "#100820"
  warning: "#f4c66c"
  warning-surface: "#332613"
  error: "#ff9ca9"
  error-surface: "#381626"
  success: "#86d9b7"
  success-surface: "#12322c"
  photo-mat: "#e8e5ed"
typography:
  display:
    fontFamily: "Clash Grotesk, sans-serif"
    fontSize: "clamp(40px, 5.2vw, 72px)"
    fontWeight: 540
    lineHeight: 1.02
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Clash Grotesk, sans-serif"
    fontSize: "clamp(32px, 3vw, 40px)"
    fontWeight: 540
    lineHeight: 1.18
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Clash Grotesk, sans-serif"
    fontSize: "clamp(24px, 2.5vw, 32px)"
    fontWeight: 540
    lineHeight: 1.18
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Satoshi, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.55
  button:
    fontFamily: "Satoshi, sans-serif"
    fontSize: "16px"
    fontWeight: 640
    lineHeight: 1.38
  evidence:
    fontFamily: "Satoshi, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.7
rounded:
  control: "8px"
  card: "12px"
  panel: "16px"
  badge: "6px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "6": "24px"
  "8": "32px"
  "12": "48px"
  "16": "64px"
  "24": "96px"
  "32": "128px"
components:
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
  button-primary-hover:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.ink}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
  input:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "12px"
  surface-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.card}"
    padding: "20px"
  evidence-badge:
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.badge}"
    padding: "4px 8px"
  priority-selected:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "20px"
  disclosure:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text}"
    rounded: "{rounded.card}"
    padding: "20px"
---

# Design System: Dilemma

## Overview

**Creative North Star: "The Purple Component Playground"**

Dilemma adapts the user-supplied Uizard reference into a dark purple system for Canadian car comparison. Clear blue actions and geometric display type establish the identity; solid surfaces and legible evidence support sustained reading. The reference is inspiration, not a copied product identity.

The system uses tonal layering and thin boundaries rather than shadows. Car photographs remain uncropped against neutral mats, while labels distinguish facts, sources, warnings and uncertainty. The photo-credit page carries the same palette and self-hosted typefaces in a narrower reading layout.

**Key Characteristics:**
- Purple tonal surfaces with one blue action hierarchy.
- Clash Grotesk headings with Satoshi interface text.
- Readable source labels, status text and tabular vehicle values.
- Contained car photography and manual preview interactions.

Source authority: the approved user plan and supplied [Uizard reference](https://uizard.io), adapted in the current implementation. Product truth is in `PRODUCT.md`; route strategy is in `.impeccable/surfaces/dilemma.md`.

Verification: this record was extracted from source on 30 October 2026. The mechanical UI detector returned no findings. The finish-review disposition is **recapture**: browser connection, activation and input-geometry failures prevented screenshots. Desktop, tablet, mobile, expanded-state and 200% zoom appearance are **not visually verified**; source documentation is not visual approval.

## Colors

### Primary

- **Action Blue:** primary buttons and active workflow steps.
- **Clear Sky Accent:** links, focus, selected priorities and primary hover states.

### Neutral

- **Deep Purple Ground:** the page ground, dark button ink and quiet inset regions.
- **Purple Surface:** cards, forms and workspaces; **Raised Violet:** selected structural regions and table headers.
- **Purple Hover:** secondary hover feedback; **Plum Boundary:** thin boundaries and dividers.
- **Near-White Text:** primary content; **Lavender Secondary:** descriptive copy, metadata and unselected controls.
- **Neutral Photo Mat:** a pale, quiet backing for contained source photographs; it is imagery support, not a light theme.

### Status

Amber warning, rose error and mint success roles have matching dark state surfaces. Every status retains a visible label or explanation. No separate decorative accent palette is introduced.

**The Dark Ink Rule.** Bright blue action and selected-state fills use dark ink, never white button text.

**The Evidence Rule.** State is expressed in words as well as color; source provenance and unresolved values remain readable.

## Typography

**Display Font:** Clash Grotesk, with sans-serif fallback. **Body Font:** Satoshi, with sans-serif fallback. Both are self-hosted variable WOFF2 files from Fontshare with original Free Font License notices; `font-display: swap` is used, and the primary body font is preloaded.

The display role is reserved for large invitations; the headline and title roles serve workspace and section headings. Body text has comfortable leading. Evidence and metadata stay at the smaller evidence scale, rather than the tiny labels of the previous interface. Display weights use the variable font's intermediate weight; controls use a firmer weight.

Vehicle prices, mileage, specifications and scores use tabular numerals. Headings balance their wraps, permit long names to break, and use restrained negative tracking. The standalone credit page uses slightly looser prose leading (1.65) for reading.

**The Two Voices Rule.** Clash Grotesk carries headings; Satoshi carries controls, prose, labels and vehicle values.

## Layout

The app's usable content width is capped at 1440px inside a shell with 32px side gutters. Below 768px, gutters become 20px and the navigation becomes a disclosure. Between 768px and 1000px, navigation gaps compact. The sticky header has an 88px desktop minimum and a 72px mobile minimum.

The spacing scale begins at 4px. Workspaces use compact 20?32px groups, separated by larger section intervals. Homepage sections use the widest rhythm; their mobile intervals contract. Long explanatory introductions are limited to approximately 65?70 characters per line where the component permits.

Vehicle collections use one column per contender at wide widths, two columns at or below 1100px, and one below 768px. Decision priorities use six columns, then three, then two. Photo/text decision results stack on mobile. Research grids use automatic columns with minimum widths that collapse to the available width.

Comparison tables retain a sticky first column inside a labelled local scrolling region, with a scroll hint. Source strings and names wrap. Preview slides share a CSS-grid area and grow naturally for taller content; minimum heights provide a steady frame without fixing a clipping height. Horizontal preview overflow remains local to the slide.

The credit page uses a narrower 960px reading container. These are implemented responsive rules, not a claim that screenshots or zoom behavior have passed visual review.

## Elevation & Depth

The interface is flat at rest. Thin borders, solid purple surface steps and inset ground colors distinguish regions. There is no drop-shadow vocabulary. The homepage alone has a restrained radial purple illumination, bounded horizontally to its hero. The photo dialog uses an opaque dark-tinted backdrop to separate the focused task.

**The Tonal Depth Rule.** Resting surfaces use solid color and thin borders, without drop shadows.

## Shapes

Controls, cards and broad panels use the named radius scale. Evidence badges have a smaller radius; circular workflow numerals and preview progress dots are functional exceptions. Images are clipped only to their frame corners: photographs use `object-fit: contain` and centered positioning, so the vehicle is not cropped. One-pixel borders establish boundaries without accent side stripes.

## Components

### Buttons

Primary buttons pair Action Blue with dark ink, shift to Clear Sky Accent on hover and keep a minimum 44px target. Default padding and typography are in the tokens. Import submit buttons are taller. Secondary buttons use a transparent ground, a plum boundary, near-white text and a purple hover surface. Disabled controls dim and use a not-allowed cursor.

Keyboard focus uses a 3px accent outline with a 4px offset. Background and border transitions are brief (160ms). Reduced-motion preferences suppress nonessential transitions and animation.

### Inputs / Fields

Fields use the deep ground, primary text and a thin plum boundary. Placeholders retain the secondary text role. Fields have a minimum 48px height; error borders use the error role, accompanied by an alert message. The import field sits in a bordered purple group; its submit action moves to a full row on mobile. Focus strengthens the group boundary and preserves an explicit outline.

### Navigation

A solid, sticky header carries the brand and three routes. The active route uses near-white text and a blue underline; the comparison link includes a labelled shortlist count. Mobile Menu/Close controls expose an expandable navigation region, with Escape returning focus to the trigger. Workspace step indicators share one visual language and mark the current step with blue fill and dark ink.

### Cards / Containers

Vehicle cards have solid purple surfaces, one-pixel boundaries, contained photo mats and compact content padding. The recommendation panel uses the broader panel radius and separates its photographic, explanatory, fact and footer regions with thin dividers. Cards do not need an additional shadow. The preview frame uses the same surface grammar with a raised-violet header.

### Priorities and Evidence Badges

Unselected priorities use purple surfaces and secondary text; the selected priority is accent-filled with dark ink. Evidence badges are compact outlined labels. Factory, VIN and agreeing-source labels use the accent role, conflicts use warning text, and reported presence uses success. Words communicate the distinction alongside color.

### Disclosures and State Panels

Native details/summary controls carry research, provenance, seller descriptions and scoring details. Summaries have a minimum 48px target, an accent marker and a divider when open. Warning panels use an amber boundary, warning surface and explicit concern text. Source and progress notices use readable secondary text; error and success messages retain their named roles.

Comparison cards show detected condition and identity warnings directly; collapsing source details must not hide those warnings. The table's scroll hint is limited to mobile widths.

### Photography and Motion

Preview controls are manual and keyboard operable. The current preview slide enters and exits with brief position/opacity motion; outgoing content is hidden from interaction. The larger-photo dialog preserves contained imagery and has an explicit close action. No imagery is generated for this redesign: existing model photographs retain source credits and embedded origins.

## Do's and Don'ts

### Do:
- **Do** use the named color and type roles across all screens.
- **Do** keep car photographs contained and source labels close to their facts.
- **Do** preserve keyboard focus, reduced motion and explicit state wording.
- **Do** treat comparison-table scrolling as local, not permission for page overflow.

### Don't:
- **Don't** replace dark ink with white on blue action fills.
- **Don't** turn absent specifications into visual certainty or remove visible warnings.
- **Don't** crop vehicle photographs to fill a frame.
- **Don't** introduce autoplay, decorative eyebrow labels or invented proof.
