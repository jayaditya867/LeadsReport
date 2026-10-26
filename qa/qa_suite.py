"""CRM Manav — Pipeline Review: requirement-traced QA suite (Playwright).
Usage: python3 qa_suite.py <base_url> <label>
"""
import asyncio, json, re, sys
from datetime import date, timedelta
from playwright.async_api import async_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:5173/'
LABEL = sys.argv[2] if len(sys.argv) > 2 else 'dev'
RESULTS = []
TODAY = date.today()
CUR_PREFIX = {'AED': 'AED', 'INR': '₹', 'USD': 'USD'}


def rec(tid, req, desc, ok, detail=''):
    RESULTS.append({'id': tid, 'req': req, 'desc': desc, 'pass': bool(ok), 'detail': str(detail)[:300]})


def money_val(t):
    return int(re.sub(r'[^\d]', '', t) or 0)


def cur_of(t):
    t = t.strip()
    return 'INR' if t.startswith('₹') else t.split(' ')[0]


async def fresh(browser, w=1366, h=768, reduced=True, storage=None, url=None):
    ctx = await browser.new_context(viewport={'width': w, 'height': h}, reduced_motion='reduce' if reduced else 'no-preference')
    if storage is not None:
        await ctx.add_init_script(storage)
    pg = await ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type in ('error', 'warning') and 'fonts.g' not in m.text and 'ERR_TUNNEL' not in m.text and 'Failed to load resource' not in m.text else None)
    await pg.goto(url or BASE)
    await pg.wait_for_selector('#leadsCard, #teamCard', timeout=8000)
    await pg.wait_for_timeout(500)
    return ctx, pg, errs


async def rows(pg):
    """Scrape the visible lead table."""
    return await pg.evaluate("""() => [...document.querySelectorAll('#mainSecs tbody tr')].map(tr => {
      const t = s => (tr.querySelector(s)?.textContent || '').trim();
      const tds = tr.querySelectorAll('td');
      return { id: tr.dataset.open, company: t('td.lead b'), eidState: t('td.lead small'), owner: (tds[1].querySelector('.own')?.lastChild?.textContent || tds[1].textContent).trim(),
        value: tds[2].textContent.trim(), status: tds[3].textContent.trim(), due: tds[4].textContent.trim(), stage: tds[5].textContent.trim(),
        revised: tds[6].childNodes[0]?.textContent.trim(), cnt: t('.cnt'), follow: tds[7].textContent.trim(), lu: tds[8].textContent.trim(), act: tds[9].textContent.trim() };
    })""")


async def msel(pg, sel_id, values, clear=True):
    await pg.click(f'#{sel_id} > button')
    if clear:
        await pg.click(f'#{sel_id} [data-clear]')
        if not await pg.locator(f'#{sel_id} .menu').count():
            await pg.click(f'#{sel_id} > button')
    for v in values:
        await pg.check(f'#{sel_id} input[value="{v}"]')
    await pg.keyboard.press('Escape')
    await pg.wait_for_timeout(120)


async def all_statuses(pg):
    await msel(pg, 'fStatus', [])  # cleared = All


async def set_view(pg, v):
    await pg.click(f'[data-view={v}]')
    await pg.wait_for_timeout(150)


async def set_cur(pg, c):
    await pg.click(f'.cur button[data-c={c}]')
    await pg.wait_for_timeout(250)


async def open_more(pg):
    if not await pg.locator('#moreRow').count():
        await pg.click('#moreBtn')
        await pg.wait_for_timeout(150)


async def ground_truth(pg):
    """All leads per currency with all statuses (from the All tab) + updated-set from Updated tab."""
    gt = {}
    await all_statuses(pg)
    for c in ['AED', 'INR', 'USD']:
        await set_cur(pg, c)
        await set_view(pg, 'all')
        allr = await rows(pg)
        await set_view(pg, 'upd')
        upd = {r['id'] for r in await rows(pg)}
        for r in allr:
            r['updated'] = r['id'] in upd
            r['cur'] = c
        gt[c] = allr
    await set_cur(pg, 'AED')
    await pg.click('#reset')
    await pg.wait_for_timeout(200)
    return gt


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()

        # ---------------- A. Load / layout ----------------
        ctx, pg, errs = await fresh(b)
        rec('A1', 'General', 'Page title & logo present', 'Manav CRM' in await pg.title() and await pg.locator('img.logo').count() == 1, await pg.title())
        nat = await pg.evaluate("document.querySelector('img.logo').naturalWidth")
        rec('A2', 'General', 'Logo image loads', nat > 0, nat)
        fav = await pg.evaluate("document.querySelector('link[rel=icon]').href")
        st = await pg.request.get(fav)
        rec('A3', 'General', 'Favicon served', st.status == 200, fav)
        for w in (1366, 1536, 1920, 820, 390):
            await pg.set_viewport_size({'width': w, 'height': 800}); await pg.wait_for_timeout(150)
            hs = await pg.evaluate('document.documentElement.scrollWidth > innerWidth')
            rec(f'A4-{w}', 'M1 modern UI', f'No horizontal page scroll at {w}px', not hs)
        await pg.set_viewport_size({'width': 1366, 'height': 768}); await pg.wait_for_timeout(150)
        tops = await pg.evaluate("[...document.querySelectorAll('#kpis .kpi')].map(k=>Math.round(k.getBoundingClientRect().top))")
        rec('A5', 'UX (Jay)', 'KPI tiles in one row at 1366px', len(tops) == 4 and len(set(tops)) == 1, tops)
        fits = await pg.evaluate("(()=>{const t=document.querySelector('#mainSecs .tw');return t.scrollWidth<=t.clientWidth+1})()")
        rec('A6', 'UX (Jay)', 'Lead table fits 1366px without sideways scroll', fits)
        tbl_top = await pg.evaluate("document.querySelector('#leadsCard').getBoundingClientRect().top")
        rec('A7', 'UX (Jay)', 'Lead list starts within first screen at 1366x768', tbl_top < 768, round(tbl_top))

        gt = await ground_truth(pg)
        total = sum(len(v) for v in gt.values())
        rec('A8', 'Data', 'Ground truth loaded (all currencies, all statuses)', total == 40, {k: len(v) for k, v in gt.items()})

        # ---------------- B. Report types (M2) ----------------
        await set_view(pg, 'all')
        rec('B1', 'M2 8:01–10:22', 'Default report type is "All leads"', await pg.get_attribute('#tAll', 'aria-selected') == 'true')
        rec('B2', 'M2 9:45', 'No due chips in All view', await pg.locator('#chips .chip').count() == 0)
        for tab, col in (('#tFol', 'follow'), ('#tRev', 'revised')):
            await pg.click(tab); await pg.wait_for_timeout(250)
            chips = await pg.evaluate("[...document.querySelectorAll('#chips .chip')].map(c=>[c.dataset.k, +c.querySelector('.pill').textContent])")
            rs = await rows(pg)
            rec(f'B3{tab}', 'M2 7:22 / M3 25:58', f'{tab} shows 5 due chips (Overdue/Today/Next 7/Scheduled/Not set)', len(chips) == 5, chips)
            # each row's Due badge must reflect the date column of that report type
            bad = []
            for r in rs:
                d = r[col]
                if r['status'] in ('Won', 'Lost'):
                    continue
                if d in ('—', 'Not set', ''):
                    exp = 'Not set'
                else:
                    dd = (date.fromisoformat(__import__('datetime').datetime.strptime(d, '%d %b %Y').date().isoformat()) - TODAY).days
                    exp = f'Overdue {-dd}d' if dd < 0 else 'Due today' if dd == 0 else f'In {dd}d' if dd <= 7 else 'Scheduled'
                if r['due'] != exp:
                    bad.append((r['company'], d, r['due'], exp))
            rec(f'B4{tab}', 'M2 6:16–7:02', f'{tab}: Due badge computed from the {col} date', not bad, bad[:3])
            total_chips = sum(n for _, n in chips)
            rec(f'B5{tab}', 'M2', f'{tab}: chip counts add up to rows in list', total_chips == len(rs), (total_chips, len(rs)))
            await pg.click('#chips .chip[data-k=over]'); await pg.wait_for_timeout(200)
            ov = await rows(pg)
            rec(f'B6{tab}', 'M1 9:14 overdue report', f'{tab}: Overdue chip shows only overdue rows', ov and all(r['due'].startswith('Overdue') for r in ov), len(ov))
            pill = int(await pg.inner_text('#cFol' if tab == '#tFol' else '#cRev'))
            rec(f'B7{tab}', 'M1 9:14', f'{tab}: red tab counter equals overdue count', pill == len(ov), (pill, len(ov)))
            await pg.click('#chips .chip[data-k=over]'); await pg.wait_for_timeout(150)
            sorted_dates = [r[col] for r in rs if r['status'] not in ('Won', 'Lost') and r[col] not in ('—', 'Not set')]
            parsed = [__import__('datetime').datetime.strptime(d, '%d %b %Y') for d in sorted_dates]
            rec(f'B8{tab}', 'M3 26:22', f'{tab}: list sorted by due date ascending', parsed == sorted(parsed))
        await pg.click('#tAll'); await pg.wait_for_timeout(150)

        # ---------------- C. Currency (M2 8:44) ----------------
        for c in ('AED', 'INR', 'USD'):
            await set_cur(pg, c); await set_view(pg, 'all')
            rs = await rows(pg)
            rec(f'C1-{c}', 'M2 8:44', f'{c}: every row in {c}', all(cur_of(r['value']) == c for r in rs), [r['value'] for r in rs][:3])
            tot = await pg.inner_text('#ltot')
            rec(f'C2-{c}', 'M2 8:44', f'{c}: list total uses only {c}', (not rs and tot == '') or (tot.startswith(CUR_PREFIX[c]) and '·' not in tot), tot)
            tags = await pg.evaluate("[...document.querySelectorAll('#kpis .l em')].map(e=>e.textContent)")
            rec(f'C3-{c}', 'M2 8:44', f'{c}: all KPI tiles tagged {c}', tags == [c] * 4, tags)
            al = await pg.evaluate("(()=>{const box=document.querySelector('.cur'),i=box.querySelector('.ind').getBoundingClientRect(),b=box.querySelector('[aria-pressed=true]').getBoundingClientRect();return Math.abs(i.left-b.left)+Math.abs(i.width-b.width)})()")
            rec(f'C4-{c}', 'UI bug report', f'{c}: currency highlight aligned with button', al < 1.5, al)
        await set_cur(pg, 'INR'); await pg.reload(); await pg.wait_for_selector('#leadsCard'); await pg.wait_for_timeout(500)
        rec('C5', 'UX', 'Currency choice remembered after reload', await pg.get_attribute('.cur [aria-pressed=true]', 'data-c') == 'INR')
        await set_cur(pg, 'AED')

        # ---------------- G. KPI tiles (M3 18:22) ----------------
        for c in ('AED', 'INR'):
            await set_cur(pg, c)
            data = gt[c]
            kv = await pg.evaluate("[...document.querySelectorAll('#kpis .kpi')].map(k=>({v:k.querySelector('.v').textContent,m:k.querySelector('.m').textContent,lg:k.querySelector('.legend')?.textContent||''}))")
            for idx, stt in ((0, 'Develop'), (1, 'Propose')):
                sub = [r for r in data if r['status'] == stt]
                ok = int(kv[idx]['v']) == len(sub)
                upd = [r for r in sub if r['updated']]
                ok2 = f'Updated {len(upd)}' in kv[idx]['lg'] and f'Pending {len(sub) - len(upd)}' in kv[idx]['lg']
                rec(f'G1-{c}-{stt}', 'M3 18:22', f'{c} {stt} tile: count matches data', ok, (kv[idx]['v'], len(sub)))
                rec(f'G2-{c}-{stt}', 'M3 18:22', f'{c} {stt} tile: Updated/Pending split matches', ok2, kv[idx]['lg'])
                if sub:
                    s = sum(money_val(r['value']) for r in sub)
                    rec(f'G3-{c}-{stt}', 'M3 18:22', f'{c} {stt} tile: total & average shown', 'avg' in kv[idx]['m'], (kv[idx]['m'], s, s / len(sub)))
            # overdue / upcoming from status-filtered (default) set
        await set_cur(pg, 'AED')
        await pg.click('[data-go=over]'); await pg.wait_for_timeout(500)
        rs = await rows(pg)
        rec('G4', 'M3 26:22–26:48', 'Overdue tile → Revised Date view, All tab, Overdue chip', await pg.get_attribute('#tRev', 'aria-selected') == 'true' and await pg.get_attribute('[data-view=all]', 'aria-selected') == 'true' and await pg.get_attribute('#chips .chip[data-k=over]', 'aria-pressed') == 'true')
        kpi_over = int(await pg.evaluate("document.querySelectorAll('#kpis .v')[2].textContent"))
        rec('G5', 'M3 26:22', 'Overdue tile number = rows in overdue list', kpi_over == len(rs) and all(r['due'].startswith('Overdue') for r in rs), (kpi_over, len(rs)))
        await pg.click('[data-go=next7]'); await pg.wait_for_timeout(500)
        rs = await rows(pg)
        rec('G6', 'M3 26:22', 'Upcoming tile → list of leads due in next 7 days', rs and all(r['due'].startswith('In ') or r['due'] == 'Due today' for r in rs), [r['due'] for r in rs])
        await pg.click('#tAll'); await set_view(pg, 'upc')

        # ---------------- D. Filters ----------------
        await pg.click('#reset'); await pg.wait_for_timeout(200)
        rs = await rows(pg)
        rec('D1', 'M3 17:43', 'Default Status filter = Order Acceptance + Propose', await pg.inner_text('#fStatus > button') == '2 selected' and all(r['status'] in ('Propose', 'Order Acceptance') for r in rs))
        await msel(pg, 'fStatus', ['Develop'])
        await pg.reload(); await pg.wait_for_selector('#leadsCard'); await pg.wait_for_timeout(400)
        rec('D2', 'M3 17:43', 'Status filter restored after reload', await pg.inner_text('#fStatus > button') == 'Develop')
        await msel(pg, 'fStatus', [])
        await pg.reload(); await pg.wait_for_selector('#leadsCard'); await pg.wait_for_timeout(400)
        rec('D2b', 'M3 17:43', 'Status "All" (cleared) is restored as All after reload', await pg.inner_text('#fStatus > button') == 'All', await pg.inner_text('#fStatus > button'))
        await pg.click('#reset'); await pg.wait_for_timeout(200)
        await msel(pg, 'fOwner', ['Aisha Rahman', 'Karan Mehta']); await set_view(pg, 'all')
        rs = await rows(pg)
        rec('D3', 'M3 18:02', 'Lead Owner multi-select filters rows', rs and all(r['owner'] in ('Aisha Rahman', 'Karan Mehta') for r in rs), len(rs))
        await pg.reload(); await pg.wait_for_selector('#leadsCard'); await pg.wait_for_timeout(400)
        rec('D4', 'M3 18:02', 'Lead Owner NOT saved after reload', await pg.inner_text('#fOwner > button') == 'All')
        await pg.select_option('#fRegion', 'Dubai')
        opts = await pg.evaluate("[...document.querySelectorAll('#fState option')].map(o=>o.textContent)")
        rec('D5', 'M2 3:05–4:28', 'Region → Emirate list cascades (Dubai → emirates only)', 'Karnataka' not in opts and 'Abu Dhabi' in opts, opts)
        await pg.select_option('#fState', 'Sharjah'); await set_view(pg, 'all')
        rs = await rows(pg)
        rec('D6', 'M3 18:02', 'Emirate filter shows only Sharjah leads', rs and all('Sharjah' in r['eidState'] for r in rs), len(rs))
        await pg.select_option('#fRegion', 'Delhi'); await pg.wait_for_timeout(100)
        rec('D7', 'M2', 'Changing region clears incompatible emirate', await pg.input_value('#fState') == '')
        await pg.click('#reset'); await pg.wait_for_timeout(150); await all_statuses(pg); await set_view(pg, 'all')
        for q, check in (('summit', lambda r: 'Summit' in r['company']), ('7126', lambda r: '7126' in r['eidState'])):
            await pg.fill('#fSearch', q); await pg.wait_for_timeout(150)
            rs = await rows(pg)
            rec(f'D8-{q}', 'M1 3:40 account search', f'Search "{q}" (case-insensitive) finds lead', rs and all(check(r) for r in rs), len(rs))
        await pg.fill('#fSearch', 'zzzz-no-match'); await pg.wait_for_timeout(150)
        rec('D9', 'UX', 'No-match search shows empty state', await pg.locator('#mainSecs .empty-state').count() == 1)
        await pg.fill('#fSearch', '')
        await open_more(pg)
        await msel(pg, 'fStage', ['Negotiation completed'])
        rs = await rows(pg)
        rec('D10', 'M1 9:14 / M2 1:35', 'Proposal Status filter', rs and all(r['stage'] == 'Negotiation completed' for r in rs), len(rs))
        await msel(pg, 'fStage', [])
        await msel(pg, 'fSite', ['On hold'])
        rs = await rows(pg)
        ids = [r['id'] for r in rs]
        rec('D11', 'M1 9:14', 'Site Status filter returns leads', len(rs) > 0, len(rs))
        await msel(pg, 'fSite', [])
        await pg.click('#dbCre'); await pg.click('[data-p=week]'); await pg.wait_for_timeout(200)
        rs = await rows(pg)
        rec('D12', 'M2 1:22 "this week how many opportunities added"', 'Opportunity Created + This week preset', await pg.input_value('#fFrom') != '' and len(rs) >= 1, (await pg.input_value('#fFrom'), await pg.input_value('#fTo'), len(rs)))
        await pg.click('#dbRev'); await pg.click('[data-p=next30]'); await pg.wait_for_timeout(200)
        rs = await rows(pg)
        okd = all(r['revised'] not in ('Not set',) for r in rs)
        rec('D13', 'M1 1:28 revised date filter', 'Revised Date + Next 30 days preset filters by revised date', okd, len(rs))
        await pg.select_option('#fMonth', '%02d' % TODAY.month); await pg.select_option('#fYear', str(TODAY.year)); await pg.wait_for_timeout(150)
        rs = await rows(pg)
        rec('D14', 'M1 2:31 month/year', 'Month/Year filter applied', all(TODAY.strftime('%b') in r['revised'] for r in rs), len(rs))
        await pg.reload(); await pg.wait_for_selector('#leadsCard'); await pg.wait_for_timeout(400)
        rec('D15', 'Jay Q13', 'More filters auto-open and values restored after reload', await pg.locator('#moreRow').count() == 1 and await pg.input_value('#fMonth') == '%02d' % TODAY.month)
        await pg.click('#reset'); await pg.wait_for_timeout(200)
        rec('D16', 'UX', 'Reset clears everything back to defaults', await pg.input_value('#fFrom') == '' and await pg.input_value('#fMonth') == '' and await pg.inner_text('#fStatus > button') == '2 selected')
        # dropdown above table
        await pg.click('#fOwner > button'); await pg.wait_for_timeout(150)
        box = await pg.locator('#fOwner .menu').bounding_box()
        topel = await pg.evaluate(f"(()=>{{const e=document.elementFromPoint({box['x'] + 30},{box['y'] + box['height'] - 40});return !!e.closest('.menu')}})()")
        rec('D17', 'Bug regression', 'Dropdown menu renders above the lead table', topel)
        await pg.keyboard.press('Escape')
        rec('D18', 'A11y', 'Esc closes dropdown', await pg.locator('#fOwner .menu').count() == 0)

        # ---------------- E. Lead list (M3) ----------------
        await all_statuses(pg)
        for c in ('AED', 'INR'):
            await set_cur(pg, c)
            a = int(await pg.inner_text('#nAll')); u = int(await pg.inner_text('#nUpd')); n = int(await pg.inner_text('#nUpc'))
            rec(f'E1-{c}', 'M3 10:08–14:26', f'{c}: To update + Updated = All', a == u + n, (n, u, a))
        await set_cur(pg, 'AED')
        await set_view(pg, 'upd')
        rs = await rows(pg)
        cs = TODAY - timedelta(days=(TODAY.weekday() - 5) % 7)
        okd = all(__import__('datetime').datetime.strptime(r['lu'][:11], '%d %b %Y').date() >= cs for r in rs)
        rec('E2', 'M3 10:08 weekly Saturday cycle', 'Updated tab only has leads reviewed since Saturday', okd, [r['lu'][:11] for r in rs])
        await set_view(pg, 'all')
        for key, col, conv in (('company', 'company', str.lower), ('value', 'value', money_val), ('owner', 'owner', str.lower)):
            for _ in range(2):
                await pg.click(f'th[data-sort={key}]'); await pg.wait_for_timeout(120)
                rs = await rows(pg)
                vals = [conv(r[col]) for r in rs]
                d = await pg.get_attribute(f'th[data-sort={key}]', 'aria-sort')
                exp = sorted(vals) if d == 'ascending' else sorted(vals, reverse=True)
                rec(f'E3-{key}-{d}', 'UX', f'Sort by {key} {d}', vals == exp)
        await pg.click('th[data-sort=due]'); await pg.wait_for_timeout(100)
        closed = [r for r in await rows(pg) if r['status'] in ('Won', 'Lost')]
        rec('E4', 'M3 17:43 all statuses', 'Closed leads appear with "View" (not Update)', closed and all(r['act'].startswith('View') for r in closed), len(closed))
        rec('E5', 'M2 12:16', 'Revised-date change counter shown n/3', all(re.match(r'^[0-3]/3$', r['cnt']) for r in await rows(pg)))

        # ---------------- F. Update panel rules (M3) ----------------
        await pg.click('#reset'); await set_view(pg, 'upc')
        rs = await rows(pg)
        tgt = next(r for r in rs if r['cnt'] != '3/3')
        before_upc = int(await pg.inner_text('#nUpc')); before_upd = int(await pg.inner_text('#nUpd'))
        await pg.click(f'tr[data-open="{tgt["id"]}"]'); await pg.wait_for_timeout(500)
        fields = await pg.evaluate("[...document.querySelectorAll('#dBody .ed')].map(e=>e.dataset.f)")
        rec('F1', 'M3 5:08–15:08', 'Editable: revised, remark, proposal status, follow-up, project, site, floor, visit', set(fields) == {'revised', 'remark', 'stage', 'follow', 'project', 'site', 'floor', 'visit'}, fields)
        rec('F2', 'M3 14:26', 'Site Status is a selection; Floor Level is text; Proposal Status is a selection',
            await pg.evaluate("document.querySelector('#dBody [data-f=site]').tagName==='SELECT' && document.querySelector('#dBody [data-f=floor]').type==='text' && document.querySelector('#dBody [data-f=stage]').tagName==='SELECT'"))
        rec('F3', 'UX', 'Save disabled until something changes', await pg.is_disabled('#dSave'))
        rec('F4', 'Bug regression', 'Page scroll locked while panel open', await pg.evaluate("document.documentElement.classList.contains('lock')"))
        newdate = (TODAY + timedelta(days=15)).isoformat()
        await pg.fill('#dBody [data-f=revised]', newdate); await pg.click('#dSave'); await pg.wait_for_timeout(200)
        rec('F5', 'Legacy CRM rule', 'Changing revised date without remark is blocked', 'remark' in (await pg.inner_text('#dBody')).lower() and await pg.locator('#dBody .errmsg').count() == 1)
        await pg.fill('#dBody [data-f=revised]', (TODAY - timedelta(days=2)).isoformat()); await pg.fill('#dBody [data-f=remark]', 'test remark'); await pg.click('#dSave'); await pg.wait_for_timeout(200)
        rec('F6', 'Legacy CRM rule', 'Revised date in the past is blocked', 'past' in (await pg.inner_text('#dBody .errmsg') if await pg.locator('#dBody .errmsg').count() else '').lower())
        await pg.fill('#dBody [data-f=revised]', newdate)
        await pg.fill('#dBody [data-f=follow]', (TODAY - timedelta(days=3)).isoformat())
        await pg.click('#dSave'); await pg.wait_for_timeout(250)
        follow_blocked = await pg.locator('#drawer .drawer').count() == 1 and await pg.locator('#dBody .errmsg').count() == 1
        if follow_blocked:
            near = await pg.evaluate("(()=>{const e=document.querySelector('#dBody .errmsg');const f=document.querySelector('#dBody [data-f=follow]');return !!e && f.getAttribute('aria-invalid')==='true' && e.previousElementSibling.contains(f)})()")
            rec('F7b', 'UX', 'Follow-up error shown next to the Status & follow-up fields and field marked invalid', near)
        rec('F7', 'Data quality', 'Next follow-up in the past is blocked', follow_blocked, await pg.inner_text('#dBody .errmsg') if await pg.locator('#dBody .errmsg').count() else 'saved without error')
        if not follow_blocked:
            rec('F8', 'Data quality', 'Date of visit in the future is blocked', False, 'not reached — follow-up check already saved')
        else:
            await pg.fill('#dBody [data-f=follow]', (TODAY + timedelta(days=5)).isoformat())
            await pg.fill('#dBody [data-f=visit]', (TODAY + timedelta(days=5)).isoformat())
            await pg.click('#dSave'); await pg.wait_for_timeout(250)
            visit_blocked = await pg.locator('#drawer .drawer').count() == 1 and await pg.locator('#dBody .errmsg').count() == 1
            rec('F8', 'Data quality', 'Date of visit in the future is blocked', visit_blocked, 'saved' if not visit_blocked else await pg.inner_text('#dBody .errmsg'))
            if visit_blocked:
                await pg.fill('#dBody [data-f=visit]', (TODAY - timedelta(days=1)).isoformat())
                await pg.select_option('#dBody [data-f=site]', 'Finishing stage')
                await pg.fill('#dBody [data-f=floor]', '9th floor')
                await pg.click('#dSave'); await pg.wait_for_timeout(600)
        saved = await pg.locator('#drawer').count() == 0
        rec('F9', 'M3 6:03–9:42', 'Valid update saves and closes the panel', saved)
        toast = await pg.inner_text('.toast')
        rec('F10', 'M3 6:03', 'Confirmation toast mentions write-back', 'updated' in toast.lower(), toast[:80])
        a_upc = int(await pg.inner_text('#nUpc')); a_upd = int(await pg.inner_text('#nUpd'))
        rec('F11', 'M3 13:48–14:26', 'Saved lead moves from To update to Updated this cycle', (a_upc, a_upd) == (before_upc - 1, before_upd + 1), ((before_upc, before_upd), (a_upc, a_upd)))
        await set_view(pg, 'upd')
        row = next((r for r in await rows(pg) if r['id'] == tgt['id']), None)
        rec('F12', 'M1 10:17 date of update', 'Last Updated = today by Head of Sales, revised counter +1', row and TODAY.strftime('%d %b %Y').lstrip('0') in row['lu'].lstrip('0') and 'Head of Sales' in row['lu'] and row['cnt'] == f"{int(tgt['cnt'][0]) + 1}/3", row)
        await pg.click(f'tr[data-open="{tgt["id"]}"]'); await pg.wait_for_timeout(500)
        hist = await pg.inner_text('#dBody .dhist .hist')
        rec('F13', 'M2 12:16–12:35 view comments', 'History shows the new entry with remark and changed fields', 'test remark' in hist and 'Revised Date' in hist and 'Site Status' in hist, hist[:160])
        # cancel discards
        await pg.fill('#dBody [data-f=floor]', 'DRAFT-VALUE'); await pg.click('#dCancel'); await pg.wait_for_timeout(450)
        await pg.click(f'tr[data-open="{tgt["id"]}"]'); await pg.wait_for_timeout(500)
        rec('F14', 'UX', 'Cancel discards unsaved changes', await pg.input_value('#dBody [data-f=floor]') != 'DRAFT-VALUE')
        # revert value disables save
        orig = await pg.input_value('#dBody [data-f=floor]')
        await pg.fill('#dBody [data-f=floor]', orig + 'x'); en = not await pg.is_disabled('#dSave')
        await pg.fill('#dBody [data-f=floor]', orig); dis = await pg.is_disabled('#dSave')
        rec('F15', 'UX', 'Typing then reverting a value turns Save off again', en and dis)
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(450)
        rec('F16', 'A11y', 'Esc closes the panel and unlocks scroll', await pg.locator('#drawer').count() == 0 and not await pg.evaluate("document.documentElement.classList.contains('lock')"))
        # maxed lead
        await set_view(pg, 'all'); await all_statuses(pg)
        mx = next((r for r in await rows(pg) if r['cnt'] == '3/3'), None)
        if mx:
            await pg.click(f'tr[data-open="{mx["id"]}"]'); await pg.wait_for_timeout(500)
            rec('F17', 'Legacy CRM rule (max 3)', 'Revised date locked after 3 changes', await pg.is_disabled('#dBody [data-f=revised]') and 'limit reached' in await pg.inner_text('#dBody'))
            await pg.click('#drawer', position={'x': 30, 'y': 300}); await pg.wait_for_timeout(450)
            rec('F18', 'UX', 'Click on backdrop closes the panel', await pg.locator('#drawer').count() == 0)
        # closed lead read-only for management
        cl = next((r for r in await rows(pg) if r['status'] in ('Won', 'Lost')), None)
        await pg.click(f'tr[data-open="{cl["id"]}"]'); await pg.wait_for_timeout(500)
        rec('F19', 'Business rule', 'Closed (Won/Lost) lead opens read-only', await pg.locator('#dBody .ed').count() == 0 and await pg.locator('#dSave').count() == 0)
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400)
        # keyboard open
        await pg.focus('#mainSecs tbody tr >> nth=0'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(500)
        rec('F20', 'A11y', 'Enter on a focused row opens the panel', await pg.locator('#drawer .drawer').count() == 1)
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400)

        # ---------------- R. Roles (M3 4:36, 16:07) ----------------
        await pg.click('#roleSales'); await pg.wait_for_timeout(300)
        rec('R1', 'M3 4:36', 'Sales view shows read-only banner', await pg.locator('#roBanner').count() == 1)
        acts = [r['act'] for r in await rows(pg)]
        rec('R2', 'M3 16:07', 'Sales view rows say "View" (no Update)', acts and all(a.startswith('View') for a in acts))
        await pg.click('#mainSecs tbody tr >> nth=0'); await pg.wait_for_timeout(500)
        rec('R3', 'M3 16:07 "not even edit"', 'Sales panel has zero inputs and no Save', await pg.locator('#dBody .ed').count() == 0 and await pg.locator('#dSave').count() == 0 and 'View only' in await pg.inner_text('#dBody'))
        await pg.click('#roleMg') if False else None
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400)
        await pg.click('#roleMg'); await pg.wait_for_timeout(200)
        # role switch while drawer open
        await pg.click('#mainSecs tbody tr >> nth=0'); await pg.wait_for_timeout(500)
        await pg.evaluate("document.getElementById('roleSales').click()"); await pg.wait_for_timeout(500)
        rec('R4', 'Security', 'Switching role closes an open edit panel', await pg.locator('#drawer').count() == 0)
        await pg.click('#roleMg')

        # ---------------- H. Team Summary (M1 5:16, M2 0:17, 12:16) ----------------
        await all_statuses(pg); await set_cur(pg, 'AED')
        await pg.click('[data-page=team]'); await pg.wait_for_timeout(500)
        rec('H1', 'Nav', 'Team page shows owner table & hides lead list & report tabs', await pg.locator('#teamCard').count() == 1 and await pg.locator('#leadsCard').count() == 0 and await pg.evaluate("getComputedStyle(document.querySelector('.switch')).visibility") == 'hidden')
        team = await pg.evaluate("[...document.querySelectorAll('#obody tr')].map(tr=>[...tr.querySelectorAll('td')].map((td,i)=>i===0?(td.querySelector('b')?.textContent||'').trim():td.textContent.trim()))")
        # recompute from ground truth (AED, all statuses) — note F-tests modified one lead; compare counts only
        data = gt['AED']
        owners = sorted({r['owner'] for r in data})
        ok = [t[0] for t in team] == owners and all(int(t[1]) == sum(1 for r in data if r['owner'] == t[0]) for t in team)
        rec('H2', 'M1 5:16 pivot per person', 'Leads per owner match data', ok, team[:2])
        okv = all(money_val(t[3]) == sum(money_val(r['value']) for r in data if r['owner'] == t[0]) for t in team)
        rec('H3', 'M2 8:44 value per person', 'Total value per owner matches data', okv)
        await pg.reload(); await pg.wait_for_selector('#teamCard'); await pg.wait_for_timeout(300)
        rec('H4', 'Nav', 'Team page survives reload (#team)', await pg.locator('#teamCard').count() == 1 and (await pg.evaluate('location.hash')) == '#team')
        await pg.click('[data-go=over]'); await pg.wait_for_timeout(500)
        rec('H5', 'Nav', 'Overdue tile from Team page goes back to the lead list', await pg.locator('#leadsCard').count() == 1)
        rec('A9', 'Quality', 'No console errors/warnings during session', not errs, errs[:3])
        await ctx.close()

        # ---------------- P. Robustness ----------------
        for pid, desc, script in (
            ('P1', 'Corrupt saved settings do not break the page', "try{localStorage.setItem('manav.filters','{broken');localStorage.setItem('manav.status','\"oops\"');localStorage.setItem('manav.cur','\"EUR\"')}catch(e){}"),
            ('P1b', 'Wrong-shaped saved filters do not break the page', "try{localStorage.setItem('manav.filters','{\"stage\":\"x\",\"site\":5,\"basis\":\"zzz\"}');localStorage.setItem('manav.status','[1,null]')}catch(e){}"),
            ('P2', 'Page works when browser storage is blocked', "Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked')}})")):
            try:
                ctx, pg, errs = await fresh(b, storage=script)
                rec(pid, 'Robustness', desc, await pg.locator('#mainSecs tbody tr').count() > 0 and not [e for e in errs if 'pageerror' in e], errs[:2])
            except Exception as ex:
                rec(pid, 'Robustness', desc, False, 'page did not render: ' + str(ex)[:80])
            await ctx.close()

        # ---------------- M. Mobile ----------------
        ctx, pg, errs = await fresh(b, 390, 844)
        rec('M1', 'Responsive', 'Mobile: filters collapsed behind one button', await pg.is_visible('#ftoggle') and not await pg.is_visible('#fSearch'))
        await pg.click('#ftoggle'); await pg.wait_for_timeout(150)
        rec('M2', 'Responsive', 'Mobile: filters open on tap', await pg.is_visible('#fSearch'))
        await pg.click('#mainSecs tbody tr >> nth=0'); await pg.wait_for_timeout(500)
        w = await pg.evaluate("[document.querySelector('.drawer').getBoundingClientRect().width, document.documentElement.clientWidth]")
        rec('M3', 'Responsive', 'Mobile: panel is full width', w[0] >= w[1] - 1, w)
        await ctx.close()

        # ---------------- S. Classic (Windows-style) scrollbars ----------------
        b2 = await p.chromium.launch(ignore_default_args=['--hide-scrollbars'])
        ctx = await b2.new_context(viewport={'width': 1366, 'height': 768}); pg = await ctx.new_page(); await pg.goto(BASE); await pg.wait_for_selector('#leadsCard'); await pg.wait_for_timeout(1300)
        js = "[document.querySelector('#leadsCard').getBoundingClientRect().left, document.querySelector('.cur').getBoundingClientRect().left]"
        a = await pg.evaluate(js); await pg.click('#mainSecs tbody tr >> nth=0'); await pg.wait_for_timeout(700)
        o = await pg.evaluate(js); cover = await pg.evaluate("document.querySelector('.drawerbg').getBoundingClientRect().right >= innerWidth - 0.5")
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(500); c = await pg.evaluate(js)
        rec('S1', 'Bug report (shift)', 'With visible scrollbars: no sideways shift when panel opens/closes', a == o == c, (a, o, c))
        rec('S2', 'Bug regression', 'With visible scrollbars: overlay covers full width (no strip at right edge)', cover)
        await ctx.close(); await b2.close()

        # ---------------- Motion (non-reduced) ----------------
        ctx, pg, errs = await fresh(b, reduced=False)
        await pg.wait_for_timeout(1500)
        v = await pg.evaluate("[...document.querySelectorAll('#kpis .v')].map(e=>e.textContent)")
        await pg.wait_for_timeout(100)
        rec('X1', 'Motion', 'KPI numbers settle on final values after animation', all(x.isdigit() for x in v), v)
        for x in range(300, 900, 40):
            await pg.mouse.move(x, 100); await pg.wait_for_timeout(15)
        drawn = await pg.evaluate("(()=>{const c=document.getElementById('fx');const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;for(let i=3;i<d.length;i+=4)if(d[i])return true;return false})()")
        rec('X2', 'Motion', 'Header water ripple renders on mouse move', drawn)
        await pg.click('#mainSecs tbody tr >> nth=0'); await pg.wait_for_timeout(600)
        await pg.click('#dClose'); await pg.wait_for_timeout(600)
        rec('X3', 'Motion', 'Panel slide-out completes and unmounts', await pg.locator('#drawer').count() == 0)
        rec('X4', 'Quality', 'No console errors with animations on', not errs, errs[:3])
        await ctx.close()
        await b.close()

    ok = sum(r['pass'] for r in RESULTS)
    print(f'[{LABEL}] {ok}/{len(RESULTS)} passed')
    for r in RESULTS:
        if not r['pass']:
            print('  FAIL', r['id'], '|', r['req'], '|', r['desc'], '|', r['detail'])
    json.dump(RESULTS, open(f'/tmp/qa_{LABEL}.json', 'w'), indent=1)


asyncio.run(main())
