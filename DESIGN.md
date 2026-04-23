# Design System

## Overview

Freshwax is a private music release tracker. The interface should feel like a focused personal instrument for keeping up with artists and releases, not a generic admin surface and not a marketing-first product shell.

The visual system should be intentionally recognizable:

- cool blue-gray atmosphere with a bright lime signal color
- soft glassmorphism and layered translucent surfaces
- sharp display typography used as a controlled contrast against compact UI text
- dense, scan-friendly cards built for release browsing rather than data entry
- calm, technical mood with just enough editorial character to feel curated

The product should read as private, polished, and music-aware. It should feel closer to a collector's dashboard than a SaaS back office.

## Design Philosophy

### 1. Quiet Instrument, Not Loud Platform

Freshwax should feel useful before it feels expressive. The interface can be beautiful, but that beauty comes from hierarchy, restraint, and rhythm rather than spectacle.

- The UI should feel composed, not promotional.
- Visual intensity should concentrate around entry moments, key actions, and release signals.
- Most screens should feel calm enough to browse for a long time.

### 2. Atmosphere Over Decoration

Glassmorphism is part of the product identity, but it should create atmosphere and layering, not novelty.

- Use blur and translucency to separate planes of information.
- Prefer soft depth, glow, and contrast shifts over ornamental effects.
- Surfaces should feel like stacked panes in a listening room, not frosted widgets floating for their own sake.

### 3. Release-First Hierarchy

The design system exists to support fast recognition of artists, release titles, release dates, and user state.

- Release title, artist, date, and state should win over decoration.
- Artwork supports recognition, but metadata drives decisions.
- The interface should reward quick scanning down a list.

### 4. Editorial Contrast

Display typography and hero moments should provide identity by contrast. They matter because most of the app is restrained.

- Use display type sparingly and deliberately.
- Let compact, disciplined UI text carry the majority of the product.
- When a headline appears, it should feel intentional and structural.

### 5. Product-Led Cohesion

Every page should feel like part of the same tool.

- Navigation, cards, filters, settings, and auth should share the same surface language.
- Do not let settings or utility screens collapse into plain form layouts.
- Do not let content-heavy screens become visually noisy just because they contain a lot of information.

## Core Experience Principles

- Browsing should feel fast, even when the page is visually rich.
- Dense data should feel curated, not compressed.
- Important state changes should be obvious without turning the screen into a status dashboard.
- A user should always know what is new, what is upcoming, what is ignored, and what action is available next.
- The app should feel personal and private, not social or collaborative.

## Colors

### Light Mode

- **Background** `#edf1f5`: main app background
- **Background Strong** `#dfe6ee`: stronger neutral backdrop
- **Panel** `rgba(248, 251, 254, 0.92)`: primary elevated surface
- **Panel Strong** `#ffffff`: strongest surface
- **Panel Border** `rgba(18, 36, 56, 0.12)`: default panel border
- **Text Primary** `#0f1c2b`: primary text
- **Text Muted** `#58708a`: secondary copy
- **Accent** `#2d6df6`: links, active nav, eyebrow labels, focus direction
- **Accent Strong** `#0c52e0`: stronger hover/focus/link state
- **Accent Soft** `#dce8ff`: soft accent surface
- **Signal** `#d7ff64`: primary CTA and highlighted signal color
- **Signal Strong** `#122100`: text/icon color on signal backgrounds
- **Surface** `rgba(255, 255, 255, 0.72)`: secondary soft surface
- **Surface Muted** `rgba(255, 255, 255, 0.55)`: nested card surface
- **Field Background** `rgba(255, 255, 255, 0.92)`: inputs/selects
- **Ghost Background** `rgba(255, 255, 255, 0.82)`: ghost buttons
- **Status Background** `rgba(255, 255, 255, 0.76)`: chips and light metadata pills

### Dark Mode

- **Background** `#08111b`: main app background
- **Background Strong** `#0f1b29`: stronger neutral backdrop
- **Panel** `rgba(13, 24, 38, 0.88)`: primary elevated surface
- **Panel Strong** `#122236`: strongest surface
- **Panel Border** `rgba(157, 185, 214, 0.12)`: default panel border
- **Text Primary** `#eef4fb`: primary text
- **Text Muted** `#98abc0`: secondary copy
- **Accent** `#7ab0ff`: links, active nav, eyebrow labels, focus direction
- **Accent Strong** `#9ac6ff`: stronger hover/focus/link state
- **Accent Soft** `#132843`: soft accent surface
- **Signal** `#c8ff54`: primary CTA and highlighted signal color
- **Signal Strong** `#0f1600`: text/icon color on signal backgrounds
- **Surface** `rgba(11, 20, 31, 0.78)`: secondary soft surface
- **Surface Muted** `rgba(16, 29, 45, 0.78)`: nested card surface
- **Field Background** `rgba(9, 18, 29, 0.92)`: inputs/selects
- **Ghost Background** `rgba(12, 22, 34, 0.82)`: ghost buttons
- **Status Background** `rgba(12, 22, 34, 0.82)`: chips and light metadata pills

### Color Roles

- Use **Accent** for orientation, active structure, focused selection, and navigational emphasis.
- Use **Signal** for one clear primary action in a region and for high-value release signals.
- Keep the rest of the product in cool neutrals so releases and actions stand out.
- Do not add unrelated accent colors for feature-specific styling.

### Color Behavior Rules

- Blue organizes the interface. Lime punctuates it.
- Lime should feel rare enough to stay meaningful.
- Large zones of pure accent or signal color should be uncommon.
- Status surfaces should remain restrained; avoid loud traffic-light semantics unless the state is truly exceptional.
- Light and dark mode should preserve hierarchy and emphasis, not merely swap colors.

## Typography

### Font Families

- **Display**: `Space Grotesk`, used via `--font-display`
- **Body / UI**: `IBM Plex Sans`, used via `--font-sans`

### Typographic Intent

The type system should create a clear split between identity and operation.

- `Space Grotesk` provides product character, especially in page entry moments and standout metrics.
- `IBM Plex Sans` carries the actual work of the app: navigation, metadata, filters, form labels, and list content.
- This contrast should remain visible. Do not let display type drift into routine UI.

### Typography Rules

- **Brand / Major Hero Headline**: display font, semibold, tight tracking, large scale (`text-5xl` to `text-6xl`)
- **Page Entry Heading**: display font or display-adjacent styling, used only when introducing a page or major state
- **Section Heading**: body font, semibold, medium-large scale (`text-2xl` to `text-3xl`)
- **Stats Value**: display font, large scale, used selectively
- **Release Title**: body font, semibold, slightly larger than metadata, optimized for repeated scanning
- **Body Copy**: body font, regular weight, comfortable leading (`leading-7` to `leading-8`)
- **Eyebrow Labels**: uppercase, body font, `font-semibold` to `font-bold`, high letter spacing (`0.18em` to `0.22em`)
- **Control Labels**: body font, medium/semibold, compact scale
- **Metadata**: body font, smaller scale, muted color

### Typography Style Notes

- Large display text should appear in isolated moments with enough surrounding quiet.
- Repeated list views should rely on rhythm, spacing, and weight rather than oversized type.
- Release titles should feel crisp and readable before they feel expressive.
- Copy tone should be direct, useful, and lightly editorial, never playful or hype-heavy.

## Spacing and Layout

### Radius

- **Primary Surface Radius** `1.25rem`: main panels, shell surfaces
- **Secondary Surface Radius** `0.9rem`: nested cards, muted panels, auth support blocks
- **Pill Radius** `999px`: buttons, chips, nav items, status pills

### Spacing Pattern

- Use comfortable vertical spacing between stacked sections: typically `gap-4`, `gap-6`, or `gap-8`
- Use compact internal spacing inside controls and metadata rows
- Panels usually use generous internal padding around `1.5rem`
- Hero sections use larger padding around `2rem`
- Dense release lists should prioritize consistent rhythm over large empty gaps

### Layout Pattern

- Authenticated app: desktop sidebar plus primary content column
- Mobile app: compact top bar with expandable menu
- Pages are typically composed from stacked sections rather than deeply nested grids
- Use cards and panels to group content instead of separators or dense borders
- Prefer dashboard composition over table-heavy layouts

### Layout Hierarchy Rules

- Keep one dominant reading column on most screens, even when supporting panels exist.
- Use multi-column layouts to support context, not to fragment attention.
- Filters should feel attached to the content they shape.
- Critical information should appear in the first scan band without requiring interpretation of decorative elements.

## Elevation and Surfaces

### Surface Types

- **Primary Panel**: translucent background, low-contrast border, blur, soft shadow
- **Muted Panel**: quieter nested surface, still rounded, less elevated
- **Hero Surface**: deep blue gradient, stronger shadow, decorative radial motif
- **Status Surface**: subtle translucent pill with light border

### Shadow System

- **Standard Shadow** `0 18px 45px rgba(17, 38, 61, 0.1)` in light mode
- **Standard Shadow Dark** `0 22px 54px rgba(0, 0, 0, 0.32)` in dark mode
- **Hero Shadow** approximately `0 24px 56px rgba(14, 33, 52, 0.16-0.18)`

### Surface Rules

- Panels should feel soft and layered, not flat.
- Blur is acceptable for shell surfaces, panels, and auth surfaces.
- Glass effects should support depth and atmosphere, not obscure legibility.
- Avoid harsh borders, opaque blocks, and sharp-cornered cards.
- Decorative gradients should mostly be reserved for hero contexts and active navigation.
- Nested surfaces should step down in contrast clearly enough to preserve hierarchy.

## Information Hierarchy

### Release Views

Release-oriented screens are the core of the product. Their hierarchy should consistently read:

1. release title
2. artist name
3. date or timing
4. user state and relevance
5. provider or utility metadata
6. secondary actions

Rules:

- The date should be easy to scan in a vertical list.
- User state such as ignored, followed, new, or upcoming should be legible at a glance.
- Secondary metadata should never overpower the title/date relationship.
- Artwork should help recognition, but text hierarchy should still work if artwork is absent.

### Discovery and Feed Screens

- Newness should be visible without resorting to loud badges everywhere.
- Filters and relevance controls should feel like tuning tools, not admin filters.
- The screen should help users decide quickly what deserves attention.

### Settings and Management Screens

- Settings should inherit the same panel language and atmospheric backdrop as the rest of the app.
- Utility screens can be simpler, but they should not feel disconnected from the main product.
- Form flows should be calm and structured, not sterile.

## Components

### Buttons

- **Primary Button**: pill shape, signal background, dark text, medium/strong shadow, semibold or bold label
- **Ghost Button**: pill shape, translucent neutral background, low-contrast border, text-colored label
- **Hover**: subtle upward lift (`translateY(-1px)`)
- **Disabled**: reduced opacity, no lift

Usage:

- Use one primary button per local action cluster where possible.
- Use ghost buttons for secondary navigation, imports, management actions, and optional actions.
- Avoid multiple competing primary buttons side by side unless one is clearly the dominant action.
- Primary actions should feel energetic because of color and contrast, not because they are oversized.

### Navigation

- **Desktop Nav Item**: pill-like row, left-aligned icon + label, muted text by default
- **Nav Hover**: soft translucent background with subtle border
- **Nav Active**: blue-to-lime tinted gradient fill with stronger contrast
- **Mobile Nav Item**: compact tile version of the same language, still rounded and soft

Rules:

- Navigation should feel embedded in the product shell, not bolted on.
- Active state should feel illuminated, not merely highlighted.
- Iconography should stay simple and structural.

### Panels and Cards

- **Panel**: default container for stats, forms, data cards, settings sections
- **Muted Panel**: nested provider cards, support blocks, secondary grouping
- **Stats Card**: panel plus oversized numeric value and faint decorative icon
- **Release Card**: panel with artwork block, eyebrow, title, metadata, pills, and actions
- **Empty State**: panel with centered content, eyebrow, display-style heading, supportive explanation

Rules:

- Cards should prioritize scannability over ornament.
- Within a release card, title/date/state rhythm matters more than visual flourish.
- Decorative accents should be faint enough that repeated cards remain comfortable to browse.

### Inputs and Fields

- Rounded rectangle inputs and selects
- Subtle border and translucent field background
- Focus uses blue border emphasis with soft outer ring
- Labels sit above fields and use muted UI text styling
- Search inputs can include padded icon space on the left

Rules:

- Inputs should feel integrated into the panel system, not like browser-default islands.
- Filter controls should read as light tuning instruments.
- Dense field groups should rely on alignment and spacing rather than separators.

### Status Pills

- Rounded full-pill metadata treatment
- Translucent background with low-contrast border
- Small icon allowed
- Use for discovery state, counts, connection summaries, and lightweight metadata

Rules:

- Status pills should carry secondary information, not dominate the card.
- Prefer subtle contrast shifts over strong color coding.
- Reserve signal color for truly important actions or states.

### Artwork / Avatars

- Use rounded rectangles or soft rounded squares
- Keep borders subtle
- Fallback artwork may use a blue-toned gradient fill
- Artwork should support scanning, not dominate the card

Rules:

- Artwork should reinforce recognition and mood.
- In dense lists, artwork should stay subordinate to metadata.
- Missing artwork should not make the layout feel broken.

### Hero Blocks

- Large gradient surface in deep blue tones
- White or near-white text
- Signal-colored eyebrow
- Oversized display headline
- Optional radial orbital decoration in the corner

Use hero treatment only for page entry, welcome states, or identity moments, not routine settings panels.

Rules:

- Hero blocks should establish mood and orientation quickly.
- They should not become the default answer for making a screen feel important.
- The content beneath a hero should still carry the real product value.

## Responsive Behavior

- Desktop uses a persistent left sidebar and wide content area
- Below the main app breakpoint, collapse to a single column
- Sidebar navigation becomes a top bar plus expandable mobile navigation
- Hero sections collapse from side-by-side to vertical stacking on smaller screens
- Auth grid collapses from two columns to one column
- Mobile touch targets should remain generous and retain pill/rounded shapes

### Mobile Rules

- Preserve hierarchy before preserving decoration.
- Reduce peripheral surfaces before reducing core metadata.
- Filters should remain easy to reach without taking over the screen.
- Release cards should keep title, artist, date, and state visible without expansion.

## Interaction and Motion

- Use short, subtle transitions around `180ms ease`
- Hover motion should be minimal and functional
- Focus states should be clear but soft, using accent-colored rings
- Pulse animation is acceptable only for live sync/activity indicators
- Avoid large-scale motion, bouncing, or decorative animation

### Interaction Rules

- Motion should clarify affordance, depth, or state change.
- Hover effects should feel crisp, not playful.
- The interface should feel responsive and deliberate rather than animated.

## Content Tone

- Direct
- Useful
- Calm
- Slightly editorial
- Product-oriented

Prefer copy like:

- "Keep a private watchlist"
- "Tune what counts as relevant"
- "Nothing on the horizon yet"
- "Recent releases worth a closer look"

Avoid:

- growth-product hype
- playful jokes
- overly promotional marketing phrasing
- social-media energy
- vague system language with no user value

### Writing Rules

- Empty states should feel calm and competent, never apologetic.
- Status messaging should be clear first and stylish second.
- Settings copy should explain intent, not implementation.
- Release-related copy should sound curated, not algorithmic.

## Do's and Don'ts

### Do

- Use dashboard composition patterns with layered panels
- Reuse the existing primitives: panel, muted panel, ghost button, primary button, eyebrow, status pill
- Keep the blue/lime palette dominant
- Use display typography sparingly for emphasis
- Keep forms visually aligned with the dashboard rather than restyling them as plain forms
- Preserve the private, music-tracker tone of the product
- Keep both light and dark themes visually equivalent in structure
- Design around release scanning, not generic app management
- Let glass, glow, and typography serve hierarchy rather than compete with it

### Don't

- Do not turn pages into generic admin tables by default
- Do not use flat white cards with no translucency or depth
- Do not introduce multiple unrelated accent colors
- Do not overuse hero gradients outside major entry surfaces
- Do not use sharp corners as the dominant style
- Do not add heavy or playful animation
- Do not write copy that sounds like a social feed, streamer app, or growth funnel
- Do not let artwork or effects overpower title/date/state clarity
- Do not solve weak hierarchy by adding more badges, color, or decoration

## UI Pass Checklist

When revisiting the interface, check each screen against these questions:

- Is the page immediately recognizable as part of the same product?
- Is the primary action obvious without multiple competing highlights?
- Can a user scan title, artist, date, and state in seconds?
- Are glass effects adding depth without reducing readability?
- Is display type being used as contrast rather than habit?
- Does the screen feel calm, curated, and private?

## Implementation Anchors

These files define the current source-of-truth implementation:

- `src/app/globals.css`
- `src/app/layout.tsx`
