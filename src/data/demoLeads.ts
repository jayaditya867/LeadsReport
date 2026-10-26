import type { Currency, Lead, LogEntry, Status } from '../types';
import { CYCLE_START, DAY, TODAY, addDays, iso } from '../lib/dates';
import { MGMT, OWNERS, PROPOSAL } from './constants';

/* Illustrative demo data — fictional companies and people. Dates are relative to today. */

type SpecRow = [string, string, Currency, Status, number, number, number | null, number | null, number, number, number | null, string, string, string];

const COMP = ['Al Noor Contracting','Gulf Crest Engineering','Sahara MEP Works','Palm Horizon Builders','Desert Rose Electromechanical','Falcon Peak Projects','Marina Bay Constructions','Zenith Power Systems','Oasis Infra Services','Crown Gate Contracting','Skyline Utilities LLC','Blue Dune Technical','Emirates Link Builders','Harbor Point Engineering','Meridian Facility Works','Silverline Electricals','Nova Grid Solutions','Orchid Towers Contracting','Summit Rail Systems','Pinnacle Steelworks','Coastal Power & Water','Granite Ridge Developers','Lotus Tech Parks','Deccan Infra Projects','Malabar Switchgear Pvt Ltd','Kaveri Industrial Works','Himalaya Power Corp','Western Ghats Builders','Ganga Metro Contractors','Aravali Engineering Co','Konkan Cement Projects','Sagar Port Services','Vindhya Substations Ltd','Tapti Renewables','Capital Rail Infra','Lakeview Data Centres','Jade Bay Hospitality','Ruby Crest Warehousing','Indus Valley Smelters','Coral Reef Marine Works'];
const SCOPE = ['Earthing & lightning protection — supply','LV panel supply — Tower B','Power quality audit','Lightning protection system SITC','Earthing study & design','Surge protection devices supply','Substation earthing — SITC','Cable testing & commissioning'];
const PROJ = ['Awaiting consultant approval','Drawings under review','Tender stage at main contractor','Client finalising budget','Main contractor appointed','Material submittal approved','',''];
const REMARKS = ['Client asked for another week','Awaiting PO / budget sign-off','Site schedule moved by main contractor'];

/** region, state, currency, status, stage index, value, revised offset, follow-up offset, revision counter, created offset, reviewed day in cycle, site, floor, remark */
const SPEC: SpecRow[] = [
['Dubai','Dubai','AED','Propose',5,420000,-6,-2,1,-95,null,'Structure in progress','G+7',''],
['Dubai','Dubai','AED','Propose',7,185000,-1,1,2,-60,null,'Civil work in progress','Basement',''],
['Dubai','Abu Dhabi','AED','Propose',4,960000,0,0,0,-40,null,'Not started','',''],
['Dubai','Sharjah','AED','Propose',5,72000,3,6,1,-30,null,'Site mobilisation','2 floors',''],
['Dubai','Dubai','AED','Propose',7,530000,5,-4,0,-3,null,'Finishing stage','12th floor',''],
['Dubai','Ras Al Khaimah','AED','Develop',2,310000,12,9,0,-2,null,'Not started','',''],
['Dubai','Dubai','AED','Hold',5,148000,-14,-9,3,-130,null,'On hold','5th floor','Client funding review pending'],
['Dubai','Ajman','AED','Propose',5,64000,null,null,0,-1,null,'Not started','',''],
['Dubai','Dubai','AED','OrderAcceptance',9,780000,9,12,1,-52,null,'Ready for supply','G+12',''],
['Dubai','Fujairah','AED','Propose',6,205000,-3,2,0,-66,null,'Structure in progress','3rd floor',''],
['Dubai','Dubai','AED','Develop',1,95000,20,15,0,-12,null,'Not started','',''],
['Dubai','Abu Dhabi','AED','Propose',6,1240000,7,3,2,-88,null,'Finishing stage','Podium',''],
['Dubai','Dubai','AED','Propose',5,355000,-9,-5,1,-71,null,'Civil work in progress','8th floor',''],
['Dubai','Al Ain','AED','Hold',4,81000,30,null,0,-45,null,'On hold','',''],
['Dubai','Sharjah','AED','Propose',7,498000,14,10,0,-33,null,'Site mobilisation','4 floors',''],
['Dubai','Dubai','AED','OrderAcceptance',9,640000,2,4,1,-120,null,'Completed','G+5',''],
['Dubai','Dubai','AED','Propose',5,276000,4,-1,0,-25,null,'Structure in progress','7th floor',''],
['Dubai','Umm Al Quwain','AED','Develop',3,59000,null,8,0,-9,null,'Not started','',''],
['Dubai','Dubai','AED','Propose',7,870000,-2,0,1,-58,0,'Finishing stage','15th floor','Revised after client budget approval'],
['Dubai','Abu Dhabi','AED','Propose',6,392000,10,7,0,-48,1,'Ready for supply','G+3','Awaiting PO from client'],
['Dubai','Dubai','AED','OrderAcceptance',8,1115000,6,9,2,-90,1,'Ready for supply','Tower B','PO expected after LC opening'],
['Dubai','Sharjah','AED','Propose',5,133000,18,13,0,-20,1,'Site mobilisation','1 floor','Follow-up scheduled with site engineer'],
['Dubai','Dubai','USD','Propose',5,88000,16,11,0,-36,null,'Not started','',''],
['Dubai','Dubai','INR','Propose',5,2400000,-5,-3,0,-70,null,'Civil work in progress','',''],
['Bangalore','Karnataka','INR','Propose',7,6850000,-4,-1,1,-84,null,'Structure in progress','4th floor',''],
['Bangalore','Karnataka','INR','Propose',5,2300000,2,5,0,-35,null,'Site mobilisation','',''],
['Bangalore','Karnataka','INR','Develop',2,1450000,11,null,0,-4,null,'Not started','',''],
['Bangalore','Karnataka','INR','OrderAcceptance',8,9200000,8,10,2,-102,null,'Ready for supply','',''],
['Bangalore','Karnataka','INR','Hold',4,3100000,null,-12,0,-150,null,'On hold','','Awaiting client approvals'],
['Delhi','Delhi NCR','INR','Propose',7,5400000,0,3,0,-61,null,'Finishing stage','6th floor',''],
['Delhi','Haryana','INR','Propose',5,1870000,15,12,0,-27,1,'Civil work in progress','2 floors','Visit planned next week'],
['Mumbai','Maharashtra','INR','Propose',6,7600000,-7,-6,3,-110,null,'Civil work in progress','','Revised thrice — escalate'],
['Mumbai','Gujarat','INR','Develop',3,980000,22,16,0,-10,null,'Not started','',''],
['Delhi','Uttar Pradesh','INR','Propose',5,2650000,6,2,1,-43,null,'Structure in progress','',''],
['Bangalore','Karnataka','INR','OrderAcceptance',9,4300000,3,6,1,-79,null,'Completed','',''],
['Mumbai','Maharashtra','INR','Propose',7,3950000,25,20,0,-16,null,'Site mobilisation','3 floors',''],
['Dubai','Dubai','AED','Won',9,560000,-20,null,1,-160,null,'Completed','G+9','Order received'],
['Dubai','Sharjah','AED','Lost',5,240000,-30,null,2,-140,null,'On hold','','Lost on price'],
['Dubai','Dubai','AED','Qualified',0,150000,null,5,0,-6,null,'Not started','',''],
['Bangalore','Karnataka','INR','Open',0,1200000,null,4,0,-2,null,'Not started','','']
];

export function buildDemoLeads(): Lead[] {
  let seq = 1000;
  return SPEC.map((s, i) => {
    const [region, state, cur, status, stageIdx, value, revOff, folOff, counter, createdOff, reviewedDay, site, floor, remark] = s;
    const revised = revOff == null ? '' : iso(addDays(TODAY, revOff));
    const log: LogEntry[] = [];
    // earlier revised-date changes (each with its mandatory remark)
    for (let k = 0; k < counter; k++) {
      const on = addDays(TODAY, -45 + k * 12);
      on.setHours(11, 15);
      log.push({
        on: on.toISOString(),
        by: MGMT[k % 2],
        changes: [{
          f: 'Revised Date',
          from: iso(addDays(TODAY, (revOff ?? 0) - 14 * (counter - k))),
          to: k === counter - 1 ? revised : iso(addDays(TODAY, (revOff ?? 0) - 14 * (counter - k - 1))),
        }],
        remark: REMARKS[k % 3],
      });
    }
    // an older status update without a date change (comment only)
    if (i % 4 === 1) {
      const on = addDays(TODAY, -16);
      on.setHours(10, 5);
      log.push({ on: on.toISOString(), by: 'Head of Sales', changes: [{ f: 'Site Status', from: 'Not started', to: site }], remark: 'Discussed with salesperson in weekly review' });
    }
    let reviewed: string | null = null;
    let reviewedBy = '';
    if (reviewedDay != null) {
      const on = new Date(CYCLE_START.getTime() + reviewedDay * DAY);
      on.setHours(10 + (i % 6), 20);
      reviewed = on.toISOString();
      reviewedBy = MGMT[i % 2];
      log.push({ on: reviewed, by: reviewedBy, changes: [{ f: 'Proposal Status', from: PROPOSAL[Math.max(0, stageIdx - 1)], to: PROPOSAL[stageIdx] }], remark: remark || 'Weekly review completed' });
    } else if (log.length) {
      const last = log[log.length - 1];
      reviewed = last.on;
      reviewedBy = last.by;
    }
    log.sort((a, b) => (a.on < b.on ? -1 : 1));
    return {
      id: ++seq, eid: 7000 + i * 7, company: COMP[i % COMP.length], scope: SCOPE[i % SCOPE.length], owner: OWNERS[i % OWNERS.length],
      region, state, cur, status, stage: PROPOSAL[stageIdx], value,
      revised, follow: folOff == null ? '' : iso(addDays(TODAY, folOff)), counter, created: iso(addDays(TODAY, createdOff)),
      reviewed, reviewedBy, site, floor, remark, project: PROJ[i % PROJ.length],
      visit: i % 5 === 0 ? iso(addDays(TODAY, -(i % 9) - 1)) : '', log,
    };
  });
}
