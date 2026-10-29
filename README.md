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
  App.tsx                      page state: filters, tabs, due chip, drafts, save rules
  types.ts                     Lead, Filters, Draft, … types
  data/
    constants.ts               statuses, proposal stages, site options, regions, owners, labels
    demoLeads.ts               illustrative leads (dates relative to today)
  lib/
    dates.ts                   date helpers (today, calendar week for the "This week" preset)
    format.ts                  amount formatting (AED / ₹ L·Cr / USD), initials
    leads.ts                   due buckets, filtering, sorting, totals
    storage.ts                 safe localStorage (prefix "manav.")
    persistence.ts             load/validate/save filters and status default
    motion.ts                  prefers-reduced-motion check
  hooks/
    usePressRipple.ts          button press ripple
    useSlidingIndicator.ts     sliding highlight for the header tabs
  components/
    hero/Hero.tsx              top bar, role switch, To be Updated / Updated / All tabs; dark header ends halfway down the tiles
    hero/WaterRipple.tsx       cursor water-ripple + glow in the header
    kpi/KpiTiles.tsx           Developed / Proposed / Overdue / Upcoming tiles
    filters/FilterPanel.tsx    main filters, More filters, due-date chips, save/reset
    filters/MultiSelect.tsx    checkbox dropdown
    leads/LeadsCard.tsx        lead table for the selected tab
    drawer/LeadDrawer.tsx      Update panel (all editing) + validation display
    drawer/HistoryTimeline.tsx update/comment history
    ui/                        Icon sprite, Avatar, badges/pills, AnimatedNumber, Reveal, Skeleton, Toast
  styles/app.css               design system and all component styles
```

## Business rules kept from the mockup

- Editing only for management (`ManagementGroup`); sales users see a read-only panel.
- Revised date (expected PO): remark required on change, no past dates, **no limit** on the number of changes — the count is shown (×n) and every update is logged (who, when, each field from → to, remark) in the lead's history.
- Lead table footer shows the lead count and **Total** Est. Revenue (₹) of the current tab.
- Tabs: **To be Updated** · **Updated** · **All**. A lead moves to *Updated* once management saves an update through this report (no weekly reset — client, 29 Oct).
- Status filter default *Order Acceptance + Propose* is saved; Lead Owner and Search are never saved.
- Single page (no Team Summary / report-type tabs). Due status and due-date chips are based on the Revised Date (PO).
- **INR only**: the report includes only leads whose currency is INR (Rupees); leads in AED / USD are left out (never converted). Set by `REPORT_CURRENCY` in `data/constants.ts`.

## Testing

- `npm run build` (type-check) and `npm run lint` must pass.
- End-to-end QA suite (Python + Playwright, 106 checks traced to the client meetings): start `npm run dev`, then
  `python qa/qa_suite.py http://localhost:5173/ dev`. Latest report: `../CRM_MANAV_QA_REPORT.md`.

## Next step (SPFx)

Replace `buildDemoLeads()` with a SharePoint `Leads` list query and call the list item update in `App.tsx → save()` (fields: `RevisedEstorderclosureDate`, `RevEstDateCounter`, `RemarksRevEstOrdCloseDate`, `OppotunityStage`, plus the new Site Status / Floor Level / Date of Visit / LastReviewedOn fields).
