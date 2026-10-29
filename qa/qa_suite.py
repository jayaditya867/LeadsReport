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
        revised: tds[6].childNodes[0]?.textContent.trim(), cnt: t('.cnt'), follow: tds[7].textContent.trim(), visit: t('td.visit'), lu: t('td.lu'), act: t('td.go') };
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


async def open_more(pg):
    if not await pg.locator('#moreRow').count():
        await pg.click('#moreBtn')
        await pg.wait_for_timeout(150)


async def ground_truth(pg):
    """All leads (all statuses, all currencies) from the All tab + the updated-set from the Updated tab."""
    await all_statuses(pg)
    await set_view(pg, 'all')
    allr = await rows(pg)
    await set_view(pg, 'upd')
    upd = {r['id'] for r in await rows(pg)}
    for r in allr:
        r['updated'] = r['id'] in upd
        r['cur'] = cur_of(r['value'])
    await pg.click('#reset')
    await pg.wait_for_timeout(200)
    return allr


def due_label(d):
    if d in ('—', 'Not set', ''):
        return 'Not set'
    dd = (__import__('datetime').datetime.strptime(d, '%d %b %Y').date() - TODAY).days
    return f'Overdue {-dd}d' if dd < 0 else 'Due today' if dd == 0 else f'In {dd}d' if dd <= 7 else 'Scheduled'


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

        default_upc = await pg.get_attribute('[data-view=upc]', 'aria-selected') == 'true'
        gt = await ground_truth(pg)
        rec('A8', 'Data', 'Ground truth loaded (all statuses, INR leads)', len(gt) == 40, len(gt))

        # ---------------- B. Header layout (client change 29 Oct) ----------------
        tabs = await pg.evaluate("[...document.querySelectorAll('#hero .switch button')].map(b=>b.childNodes[1]?.textContent.trim() || b.textContent.trim())")
        rec('B1', 'Client change 29 Oct', 'Header tabs are To be Updated / Updated / All (in place of report types)', tabs == ['To be Updated', 'Updated', 'All'], tabs)
        rec('B2', 'Client change 29 Oct', 'Old report-type tabs removed (All leads / Next Follow-up / Revised Date)', await pg.locator('#tAll, #tFol, #tRev').count() == 0)
        rec('B3', 'Client change 29 Oct', 'Currency switch removed', await pg.locator('.cur, [data-c]').count() == 0)
        rec('B4', 'Client change 29 Oct', 'Pipeline Review / Team Summary navigation removed', await pg.locator('.pnav, [data-page], #teamCard').count() == 0)
        rec('B5', 'Client change 29 Oct', 'Default tab is To be Updated', default_upc)
        geo = await pg.evaluate("(()=>{const h=document.querySelector('#hero').getBoundingClientRect(),f=document.querySelector('#filters').getBoundingClientRect(),k=document.querySelector('#kpis').getBoundingClientRect();return [h.bottom,f.top,f.bottom,k.top]})()")
        kb = await pg.evaluate("document.querySelector('#kpis').getBoundingClientRect().bottom")
        rec('B6', 'Client change 29 Oct (2)', 'Dark header background ends halfway down the tiles; filters sit below on the page', abs(geo[0] - (geo[3] + kb) / 2) <= 2 and geo[1] > kb, (geo, kb))
        al = await pg.evaluate("(()=>{const box=document.querySelector('#hero .switch'),i=box.querySelector('.ind').getBoundingClientRect(),b=box.querySelector('[aria-selected=true]').getBoundingClientRect();return Math.abs(i.left-b.left)+Math.abs(i.width-b.width)})()")
        rec('B7', 'UI', 'Tab highlight aligned with selected tab', al < 1.5, al)
        col = await pg.evaluate("getComputedStyle(document.querySelector('#fStatus > button')).color")
        rec('B8', 'Bug regression', 'Filter values readable on dark header (dark text on white fields)', col == 'rgb(23, 34, 51)', col)
        for v, n in (('upd', 'nUpd'), ('all', 'nAll'), ('upc', 'nUpc')):
            await set_view(pg, v)
            cnt = int(await pg.inner_text('#' + n)); lr = len(await rows(pg))
            lc = await pg.inner_text('#leadsCard .lcount')
            rec(f'B9-{v}', 'M3 10:08–14:26', f'Tab {v}: count in header = rows in list = count in list title', cnt == lr and lc.startswith(str(lr)), (cnt, lr, lc))

        # ---------------- C. INR only (Jay, 29 Oct) ----------------
        await all_statuses(pg); await set_view(pg, 'all')
        rs = await rows(pg)
        curs = {cur_of(r['value']) for r in rs}
        rec('C1', 'Jay 29 Oct', 'Every lead amount is in INR (₹); no AED / USD anywhere on the page', curs == {'INR'} and not re.search(r'\b(AED|USD)\b', await pg.inner_text('body')), curs)
        exp = sum(money_val(r['value']) for r in rs)
        ttl = await pg.get_attribute('#ltot', 'title')
        got = money_val(ttl.split(':')[-1])
        rec('C2', 'Jay 29 Oct', 'List header Total (₹) = sum of Est. Revenue of the tab', got == exp and (await pg.inner_text('#ltotVal')).startswith('₹'), (got, exp, await pg.inner_text('#ltot')))
        rec('C2b', 'Jay 29 Oct', 'Total shown in the list header only — no total row in the table footer', await pg.locator('#mainSecs tfoot').count() == 0 and await pg.locator('.lhead #ltot').count() == 1 and str(len(rs)) in ttl, ttl)
        await set_view(pg, 'upc'); urs = await rows(pg)
        rec('C2c', 'Jay 29 Oct', 'Header total follows the selected tab (To be Updated)', money_val((await pg.get_attribute('#ltot', 'title')).split(':')[-1]) == sum(money_val(x['value']) for x in urs))
        await set_view(pg, 'all')
        kv = await pg.evaluate("[...document.querySelectorAll('#kpis .kpi .m')].map(e=>e.textContent)")
        rec('C3', 'M3 + Jay 29 Oct', 'Developed / Proposed tiles show a single ₹ total with average', all(m.startswith('₹') and 'avg ₹' in m for m in kv[:2] if m != 'No leads'), kv[:2])
        await pg.click('#reset'); await pg.wait_for_timeout(150)

        # ---------------- G. KPI tiles (M3 18:22, 26:22) ----------------
        kv = await pg.evaluate("[...document.querySelectorAll('#kpis .kpi')].map(k=>({v:k.querySelector('.v').textContent,lg:k.querySelector('.legend')?.textContent||''}))")
        for idx, stt in ((0, 'Develop'), (1, 'Propose')):
            sub = [r for r in gt if r['status'] == stt]
            upd = [r for r in sub if r['updated']]
            rec(f'G1-{stt}', 'M3 18:22', f'{stt} tile: count matches data (all currencies)', int(kv[idx]['v']) == len(sub), (kv[idx]['v'], len(sub)))
            rec(f'G2-{stt}', 'M3 18:22', f'{stt} tile: Updated/Pending split matches', f'Updated {len(upd)}' in kv[idx]['lg'] and f'Pending {len(sub) - len(upd)}' in kv[idx]['lg'], kv[idx]['lg'])
        await pg.click('[data-go=over]'); await pg.wait_for_timeout(500)
        rs = await rows(pg)
        rec('G4', 'M3 26:22–26:48', 'Overdue tile → All tab + Overdue chip', await pg.get_attribute('[data-view=all]', 'aria-selected') == 'true' and await pg.get_attribute('#chips .chip[data-k=over]', 'aria-pressed') == 'true')
        kpi_over = int(await pg.evaluate("document.querySelectorAll('#kpis .v')[2].textContent"))
        rec('G5', 'M3 26:22', 'Overdue tile number = rows in overdue list', kpi_over == len(rs) and all(r['due'].startswith('Overdue') for r in rs), (kpi_over, len(rs)))
        await pg.click('[data-go=next7]'); await pg.wait_for_timeout(500)
        rs = await rows(pg)
        rec('G6', 'M3 26:22', 'Upcoming tile → leads due today / next 7 days', rs and all(r['due'].startswith('In ') or r['due'] == 'Due today' for r in rs), [r['due'] for r in rs])
        await pg.click('#chips .chip[aria-pressed=true]'); await pg.wait_for_timeout(150)
        # due chips always available (Revised Date based)
        chips = await pg.evaluate("[...document.querySelectorAll('#chips .chip')].map(c=>[c.dataset.k, +c.querySelector('.pill').textContent])")
        rs = await rows(pg)
        rec('G7', 'M1 9:14 overdue report', 'Revised-date chips always shown (5) and add up to the list', len(chips) == 5 and sum(n for _, n in chips) == len(rs), (chips, len(rs)))
        bad = [(r['company'], r['due'], due_label(r['revised'])) for r in rs if r['status'] not in ('Won', 'Lost') and r['due'] != due_label(r['revised'])]
        rec('G8', 'M3 8:38–9:10', 'Due badge computed from Revised Date (PO)', not bad, bad[:3])
        await set_view(pg, 'upc')

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
        monday=(TODAY - timedelta(days=TODAY.weekday())).isoformat()
        rec('D12', 'M2 1:22 "this week how many opportunities added"', 'Opportunity Created + This week preset (Mon–Sun calendar week)', await pg.input_value('#fFrom') == monday and len(rs) >= 1, (await pg.input_value('#fFrom'), await pg.input_value('#fTo'), len(rs)))
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
        a = int(await pg.inner_text('#nAll')); u = int(await pg.inner_text('#nUpd')); n = int(await pg.inner_text('#nUpc'))
        rec('E1', 'M3 10:08–14:26', 'To be Updated + Updated = All', a == u + n and a == len(gt), (n, u, a))
        await set_view(pg, 'upd')
        upd_rows = await rows(pg)
        await set_view(pg, 'upc')
        upc_rows = await rows(pg)
        rec('E2', 'Client change 29 Oct — no weekly cycle', 'Updated tab = leads with a Last Updated date; To be Updated hides the (always empty) Last Updated column',
            upd_rows and all(r['lu'] and not r['lu'].startswith('Not yet') for r in upd_rows) and all(r['lu'] == '' for r in upc_rows) and await pg.locator('#mainSecs th:has-text("Last Updated")').count() == 0, (len(upd_rows), len(upc_rows)))
        tabs = await pg.evaluate("[...document.querySelectorAll('#hero .switch button')].map(b=>b.childNodes[1]?.textContent.trim() || b.textContent.trim())")
        rec('E2b', 'Client change 29 Oct', 'Lead tabs are "To be Updated", "Updated", "All"', tabs == ['To be Updated', 'Updated', 'All'], tabs)
        rec('E2c', 'Client change 29 Oct', 'No weekly "Update cycle" shown in the header', await pg.locator('.cycle, #cycleTxt').count() == 0 and 'cycle' not in (await pg.inner_text('body')).lower())
        await set_view(pg, 'all')
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
        rec('E5', 'Jay 29 Oct (no limit)', 'Revised-date change count shown as ×n (no "of 3" limit)', all(r['cnt'] == '' or re.match(r'^×[1-9]\d*$', r['cnt']) for r in await rows(pg)) and any(r['cnt'] for r in await rows(pg)))

        # ---------------- F. Update panel rules (M3) ----------------
        await pg.click('#reset'); await set_view(pg, 'upc')
        rs = await rows(pg)
        tgt = next(r for r in rs if r['cnt'] == '×3') if any(r['cnt'] == '×3' for r in rs) else rs[0]
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
        rec('F11', 'M3 13:48–14:26', 'Saved lead moves from To be Updated to Updated', (a_upc, a_upd) == (before_upc - 1, before_upd + 1), ((before_upc, before_upd), (a_upc, a_upd)))
        await set_view(pg, 'upd')
        row = next((r for r in await rows(pg) if r['id'] == tgt['id']), None)
        rec('F12', 'M1 10:17 date of update', 'Last Updated = today by Head of Sales, revised counter +1', row and TODAY.strftime('%d %b %Y').lstrip('0') in row['lu'].lstrip('0') and 'Head of Sales' in row['lu'] and row['cnt'] == f"×{int(tgt['cnt'][1:] or 0) + 1}", (row, tgt['cnt']))
        vexp = (TODAY - timedelta(days=1)).strftime('%d %b %Y')
        rec('F12b', 'Jay 29 Oct', 'Date of Visit column shows the visit date saved in the Update panel', row and row['visit'] == vexp, (row and row['visit'], vexp))
        hdrs = await pg.evaluate("[...document.querySelectorAll('#mainSecs thead th')].map(t=>t.textContent.trim())")
        rec('F12c', 'Jay 29 Oct', 'Lead table has a sortable Date of Visit column after Next Follow-up', 'Date of Visit' in hdrs and hdrs.index('Date of Visit') == hdrs.index('Next Follow-up') + 1 and await pg.locator('th[data-sort=visit]').count() == 1, hdrs)
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
        mx = next((r for r in await rows(pg) if r['cnt'] and int(r['cnt'][1:]) >= 3 and r['status'] not in ('Won', 'Lost')), None)
        if mx:
            await pg.click(f'tr[data-open="{mx["id"]}"]'); await pg.wait_for_timeout(500)
            rec('F17', 'Jay 29 Oct (no limit)', 'Revised date still editable after 3+ changes; panel says there is no limit', not await pg.is_disabled('#dBody [data-f=revised]') and 'limit reached' not in (await pg.inner_text('#dBody')).lower() and 'No limit' in await pg.inner_text('#revCount'), mx['cnt'])
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

        # ---------------- H. Navigation removed (client change 29 Oct) ----------------
        await pg.goto(BASE + '#team'); await pg.wait_for_selector('#leadsCard'); await pg.wait_for_timeout(300)
        rec('H1', 'Client change 29 Oct', 'Single page: #team hash still shows the lead list, no Team page', await pg.locator('#leadsCard').count() == 1 and await pg.locator('#teamCard').count() == 0)
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
        js = "[document.querySelector('#leadsCard').getBoundingClientRect().left, document.querySelector('.hero .switch').getBoundingClientRect().left]"
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
