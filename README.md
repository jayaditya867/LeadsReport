# Manav CRM — Pipeline Review (React + TypeScript)

React port of the client-approved mockup `CRM_Manav_Pipeline_Review_Mockup.html`. Looks and behaves the same; all data is illustrative (no SharePoint connection yet).

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build to dist/
npm run lint
```

## Structure

```
src/
  main.tsx                     entry (imports styles/app.css)
  App.tsx                      page state: filters, currency, report type, tabs, drafts, save rules
  types.ts                     Lead, Filters, Draft, … types
  data/
    constants.ts               statuses, proposal stages, site options, regions, owners, labels
    demoLeads.ts               illustrative leads (dates relative to today)
  lib/
    dates.ts                   date helpers, weekly update cycle (resets Saturday)
    format.ts                  currency formatting (AED / ₹ L·Cr / USD), initials
    leads.ts                   due buckets, filtering, sorting, totals
    storage.ts                 safe localStorage (prefix "manav.")
    persistence.ts             load/validate/save filters, status default and currency
    motion.ts                  prefers-reduced-motion check
  hooks/
    usePressRipple.ts          button press ripple
    useSlidingIndicator.ts     sliding highlight for report tabs / currency switch
  components/
    hero/Hero.tsx              top bar, page nav, role switch, report tabs, currency switch
    hero/WaterRipple.tsx       cursor water-ripple + glow in the header
    kpi/KpiTiles.tsx           Developed / Proposed / Overdue / Upcoming tiles
    filters/FilterPanel.tsx    main filters, More filters, due-date chips, save/reset
    filters/MultiSelect.tsx    checkbox dropdown
    leads/LeadsCard.tsx        To update · Updated this cycle · All + lead table
    drawer/LeadDrawer.tsx      Update panel (all editing) + validation display
    drawer/HistoryTimeline.tsx update/comment history
    team/TeamSummary.tsx       lead-owner summary page
    ui/                        Icon sprite, Avatar, badges/pills, AnimatedNumber, Reveal, Skeleton, Toast
  styles/app.css               design system and all component styles
```

## Business rules kept from the mockup

- Editing only for management (`ManagementGroup`); sales users see a read-only panel.
- Revised date (expected PO): remark required on change, no past dates, max **3** changes.
- A saved lead moves to *Updated this cycle* (cycle starts Saturday).
- Status filter default *Order Acceptance + Propose* is saved; Lead Owner and Search are never saved.
- Currency switch filters the whole page; AED/INR/USD are never summed together.

## Testing

- `npm run build` (type-check) and `npm run lint` must pass.
- End-to-end QA suite (Python + Playwright, 128 checks traced to the client meetings): start `npm run dev`, then
  `python qa/qa_suite.py http://localhost:5173/ dev`. Latest report: `../CRM_MANAV_QA_REPORT.md`.

## Next step (SPFx)

Replace `buildDemoLeads()` with a SharePoint `Leads` list query and call the list item update in `App.tsx → save()` (fields: `RevisedEstorderclosureDate`, `RevEstDateCounter`, `RemarksRevEstOrdCloseDate`, `OppotunityStage`, plus the new Site Status / Floor Level / Date of Visit / LastReviewedOn fields).
