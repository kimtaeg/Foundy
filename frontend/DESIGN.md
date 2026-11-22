# FOUNDY design contract

## Source of truth

- Status: **Active — home baseline, shared navigation and checklist** (2026-11-21).
- Scope: use the current home page as the design baseline for future page-by-page updates. This iteration extends the home design to the checklist; other page content follows in separate iterations.
- Evidence: current `DashboardViewData`, checklist/report selectors, existing Seoul population JSON files and `buildPopulationInsights`. This proposal does not assume a connected business API or a new dataset.
- Opening banner reference: the user's weekly calendar screenshot, simplified to date labels, vertical day separators, and a highlighted opening date with faded edges.

## Brand

FOUNDY helps a shop owner turn an uncertain opening process into clear next steps. Be calm, practical, and encouraging. Primary is `rgb(16, 126, 125)`; use neutral colors and white space for everything else.

## Product goals

Within a glance, answer: how many checklist items are complete, what needs a decision, and what to do next. Provide a useful glimpse of existing population analysis without loading the map. Success means readable priorities and working links/checks on desktop and mobile.

Non-goals: a sales dashboard, a readiness/success score, invented trends, live visitor counts, or changes to the database.

## Personas and jobs

The primary user is an owner preparing to open a small store. They return to continue a task, check a deadline, or resolve a report decision. Owners without a selected location need a clear route to area comparison, not alarming empty report results.

## Information architecture

Primary navigation is 홈, 개업 준비, 상권 분석, 지원사업. 개업 준비 groups 점검 리포트, 체크리스트 and 서류함 in a disclosure. The account/store action on the right opens 내 정보; do not duplicate it in primary navigation. Keep route ids and API callbacks stable. Custom destination arrays can supply optional preparation-group metadata and descriptions.

Keep the existing greeting. Below it, an open 12-column layout with shared section baselines:

1. Opening countdown and a compact opening-week calendar (full 12 columns).
2. Checklist completion + stage bars (7 columns), priority decision + report distribution (5).
3. Next tasks (7), hourly population preview (5). Both content rows share the same 7/5 column boundary.

Do not repeat the former three equal metric tiles. On mobile, preserve the same reading order in one column. Notifications belong in the navigation, without a duplicate dashboard card.

## Design principles and tradeoffs

- Make one number dominant: checklist completion, explicitly labeled as such.
- Use clear section hierarchy and shared alignment; graphs explain existing data without enclosing every section in a card.
- Keep actions next to the information that prompts them.
- Preserve provenance. Local/demo report results are not verified government findings. The population preview describes a fixed reference location, not the user's address.
- A compact derived population snapshot avoids downloading 13 large source files on dashboard entry. Regenerate it when those source files change.

## Visual language

- Navigation retains the previous rounded-button design: 14px semibold labels, 10px corners, 10px vertical padding and 12px horizontal padding (8px on narrow mobile screens), with 44px touch targets. Use neutral-100 backgrounds and primary text for the current destination, without an underline, and subtle neutral hover backgrounds. The preparation group stays highlighted on any child page. Dropdowns use white, a neutral border, a small radius and light elevation; use a 4px panel inset, 8px item padding, 15px semibold labels and optional 13px neutral-600 descriptions. Prepend 36px decorative dimensional SVG icons: a chart document for reports, a clipboard for the checklist, and a folder for documents. Use teal/mint surfaces, paper highlights and subtle depth, with an 8px gap to the label. Keep icons local, sharp at any display density, and hidden from assistive technology because labels convey the destination. On opening, fade the dropdown in while moving down 4px over 180ms with ease-out; honor reduced-motion by opening immediately.
- Notification previews share the preparation dropdown surface: white background, 12px corners, a neutral-200 border, light elevation, and the same 180ms fade/4px entry motion with reduced-motion support. Use a 400px panel width, capped to the viewport with 16px side gutters. Align the 16px semibold header with the content at a 20px inset. Separate the four list items with subtle neutral rules; use 13px category badges and neutral summaries with 15px semibold titles. Category badges use pastel amber for decision-required notices, pastel red for approaching deadlines, and primary at 10% for grants and other notices, with dark matching text and no border. Use category badges without an adjacent dot; retain accessible read-state text, muted read titles, and a faint primary hover background. Show only supplied notification content, without fabricated timestamps or a redundant view-all action. Preserve hover, touch, keyboard and read-count behavior.
- Keep the page white. Dashboard sections have no card background, enclosing border, corner radius, or outer padding. Keep solid neutral-200 horizontal section dividers, including the greeting, opening band and report summary, and subtle task-row rules. Separate side-by-side sections with whitespace, without vertical column dividers. Keep the approved 7/5 layout; chart axes remain part of the data visualization.
- Primary for key numbers, completion marks, selected chart bars and actions. Neutral-900 headings, neutral-600 body/metadata. Report verdict accents retain semantic labels.
- Blend adjacent ring colors through short gradients centered on their shared boundaries. Each half-transition spans at most 4% of the ring and 35% of either neighboring contribution, preserving each stage's solid color and exact count. Skip empty stages and blend the last-to-first boundary only at 100%. The legend and bars retain solid stage colors. Set the central percentage's line height to 1 and leave 4px before the completed-count caption.
- Preparation stages share four distinct opaque primary-family tones in the ring, bars and legend: dark teal `rgb(11,85,84)`, primary `rgb(16,126,125)`, medium teal `rgb(82,169,166)` and light teal `rgb(161,207,202)`. Every contribution uses the entire checklist as its denominator: completed counts 1, 2, 2 out of 11 stack into a 5/11 ring, with the remaining 6/11 neutral. Never reserve separate stage-capacity arcs. Side bars use the same global denominator and show only each completed count; expose the denominator through accessible progress labels and the ring's completed/total count. Omit the redundant denominator caption, remaining-task encouragement, dashboard status footer and chart interaction instructions. Keep the population source and reference date. The ring uses a continuous 24-unit stroke within its 200-unit viewBox. Internal stage boundaries meet flush; a single mask rounds only the overall progress endpoints using the exact completion ratio. At 100% the segments form an unmasked complete ring. Tiny contributions retain flat ends and their true length rather than becoming oversized dots. The central percentage is neutral-900, semibold, 44px on mobile and 52px from sm, with a 20px percent sign.
- The opening band sits directly on the white page with a prominent countdown and date on the left, aligned to the greeting and section titles. On the right, a compact Sunday-to-Saturday week contains the actual opening date. Use only vertical day dividers that fade to transparent at both top and bottom, and primary text; the opening-day date and marker are 16px semibold. Omit horizontal calendar grid lines, event boxes, and the schedule link. Use neutral-300/90 for the divider centers, and fade each side according to the calendar container width: 12% below 200px, 22% from 200px, and 30% from 560px. The smaller fade keeps the opening marker readable on narrow screens. Keep the opening content compact without bottom padding; place its separator in the middle of the next row gap, with no monthly graph or extra KPI.
- Main content 14px or larger, metadata at least 12px. Metric figures 36–64px with tabular numerals. The four content sections use DashboardSectionHeader with 18px mobile / 20px desktop semibold titles, a shared 28px title row, 16px descriptions, and aligned 16px action links. Keep 20px before the content. The opening band does not use this section header.
- Keep row and column gaps equal: 48px below sm for more mobile breathing room, 32px from sm, and 48px at lg and above, including the loading skeleton. On mobile, center section rules 24px from each adjacent section; use 32px below the greeting rule and 36px above it, with 32px above and 24px below the report-summary rule. Position section dividers absolutely halfway through the responsive row gap; they must not create grid rows or add vertical padding. At xl, anchor the full-width separator to grid row 3 without occupying a row. Keep 20px between headers and content, 12px task-row padding, and at least 44px interaction targets. Place actions close to their content without automatic bottom alignment. The follow-up report action is a quote immediately below the upcoming-tasks header, before the task list: 3px primary left border, primary at 5% opacity background, 14px label and 16px semibold neutral-900 content. Let the action text wrap without truncation.
- Existing header typing remains. Checklist changes animate the ring's length, stage boundaries and central percentage together over 420ms with cubic ease-out. Rapid changes continue from the currently painted frame; the actual completed count and accessible label update immediately. Initial rendering and reduced-motion mode show the final geometry directly.
- Task previews keep the first three rows in due-date order, including completed items. Use 15px task text, 13px metadata, and a neutral-600 strikethrough for completed task titles. Checking or unchecking updates progress without removing or reordering the row; completed tasks do not show overdue warnings.
- At lg below xl, use one full-width divider above the side-by-side priority and upcoming-task sections, spanning their column gap. Keep the xl layout unchanged and mirror this in the skeleton. Place the checklist link in the upcoming-task section header instead of the due-order caption or a footer link.

## Checklist page

- Use open white sections instead of stacked cards: title and export action, completion/opening-date strip, view/status controls, then task groups. Keep date editing beside the date.
- Match home typography: 28px mobile / 34px desktop bold title, 18–20px section headings, 15–16px task titles and 13–14px neutral-600 metadata. Use primary checks/actions and neutral horizontal rules.
- Offer 시기별, 카테고리별, 달력 and list-only 전체/남은 일/완료 pressed-state buttons. Filters never change global/group denominators; preserve ordering and explicit empty states.
- Place narrow group headings left of tasks on desktop; stack on mobile. Keep titles and dates prominent, completed titles struck through, document links visible, and the 준비 정보 disclosure inline with the category badge and document link. Expand it for documents, agency and contact details. Only checkbox/title labels toggle completion.
- Calendar uses a 7/5 month/agenda split from xl and stacks below it. Distinguish today, selected day and opening with text/shape as well as color; readable seven-column grid at 320px with 44px day targets.
- Preserve supplied deadline strings, editing, routing, persistence and ICS export. Keep independent typed props and matching open-layout loading skeletons. Zero tasks is zero completion, not 100%.

## Components

Navigation layout, destination buttons, preparation disclosure, its trigger/items and navigation skeleton are independent components with local barrel exports. Keep grouping labels in navigation data and state in the disclosure, without application-store imports.

Page wiring remains in `DashboardPage`; `DashboardView` accepts serializable data and separate event handlers. Each section, section header, divider, calendar, day cell, progress visualization, stage list, report strip, task row and population chart has its own directory and barrel. Pure selectors own aggregation and calendar-date calculations; display components do not access the application store.

Reuse the existing event boundary and data/Suspense boundary. The layout has matching unboxed skeletons through the optional plain appearance; other pages retain the default card skeleton. Existing component names and typed props remain compatible. Legacy API payloads without stage/report/population details still render meaningful summaries without invented values.

## Accessibility

The preparation dropdown is a native-button disclosure with aria-expanded/aria-controls and a labelled group of destinations. Support Enter/Space, Tab, ArrowDown/ArrowUp, Home/End and Escape; Escape restores trigger focus. Close on outside interaction, focus leaving, navigation and browser route changes. Preserve aria-current on the exact destination and do not require hover to open a menu.

One page h1, section h2 headings, keyboard-operable native controls, visible focus, text labels for charts and verdicts, named task checkboxes. Chart values must be available to keyboard/screen-reader users. Do not communicate status by color alone. No horizontal overflow at 320px.

Population bar tooltips show the hour and published count on hover or keyboard focus. Keep them inside the chart width, allow moving the pointer onto the tooltip, dismiss on Escape or leaving the chart, and preserve missing/partial-data labels.

Decision content uses the approved compact vertical layout: a 14px stage label, a 20px semibold balanced heading and the report action directly below it. Omit the recommendation/description line. The independent PriorityDecisionContent accepts only the report id, stage and title; draft comparisons are retained as screenshots in work/priority-design-preview.

## Responsive behavior

The navbar retains its previous layout and 16px vertical padding: one row from xl (1280px) with logo, centered primary navigation and account actions. Below xl, retain account actions on the first row and left-aligned primary items on the second row. Avoid horizontal scrolling/clipped dropdowns at 320px, and match this structure in the navigation skeleton.

Use 12 columns at desktop. The opening banner always occupies the first full-width row. At tablet, the preparation hero and population section span the full width, preventing charts from squeezing labels. At mobile, use one column. Within the opening banner, keep the countdown on the left and the date strip on the right; each date column keeps a minimum width of 112px, and a narrow calendar centers the opening date and clips faded neighboring dates without horizontal page overflow. Keep the complete week in the accessible figure description. Text wraps rather than truncating critical actions. Keep at least 44px high primary interaction targets. Each population bar has one solid primary-to-white tint, with no gradient inside the bar. Scale primary strength from 15% to 100% using each value divided by the chart maximum, so low counts are clearly lighter and the highest count uses the full primary color. Selection adds an inset primary outline without changing this value encoding. Missing values remain unfilled dashed markers; exact values stay available in button labels and the selected-hour summary.

## Interaction states

- Loading: unboxed section-sized skeletons behind Suspense/data boundaries, aligned with the loaded content.
- Empty: zero checklist items is not 100% complete; missing reports/data invite setup or connection.
- Error: inline data error and retry when a loader provides it.
- Success: completing a task updates completion, stages, and the remaining list immediately.
- Disabled: use pending state only when an actual asynchronous action is pending.
- Missing date: explain that the opening date is unset; show opening day and elapsed days accurately.
- Opening week: derive seven calendar dates from the opening date with timezone-independent arithmetic, including month/year and leap-day boundaries. An invalid or unset date does not create a decorative week from today's date.
- Undecided location: replace report decisions with a location-selection invitation.
- Partial population: preserve null/unpublished values, label partial published totals and show the source/reference date. Omit the location/radius subtitle from the dashboard header. No day-over-day comparison.

## Content voice

Short Korean statements: “체크리스트 완료율”, “먼저 결정할 일”, “다음 할 일”. Be encouraging without implying guaranteed outcomes. Prefer a clear action label to a generic “더 보기”.

## Implementation constraints

Next.js, TypeScript and Tailwind; no new chart dependency. Preserve typed props, `index.ts` exports, independent UI and existing delegated navigation. No external data acquisition, credential access or DB mutations. Bundled snapshot generation reuses the existing population calculation.

## Open questions

- Future page redesigns inherit this home's typography, spacing, primary/neutral colors and component conventions; each page's content hierarchy remains a separate design decision.
- A future backend must provide explicit coordinates and report provenance before displaying population as “내 가게 주변” or reports as verified API results.
