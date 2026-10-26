import type { Currency, EditableField, Status } from '../types';

/** Statuses used in the CRM Leads list. */
export const STATUSES: Status[] = ['Open', 'Qualified', 'Develop', 'Propose', 'Hold', 'OrderAcceptance', 'Won', 'Lost'];
export const CLOSED: Status[] = ['Won', 'Lost'];
export const STATUS_LABEL: Record<Status, string> = {
  Open: 'Open', Qualified: 'Qualified', Develop: 'Develop', Propose: 'Propose',
  Hold: 'Hold', OrderAcceptance: 'Order Acceptance', Won: 'Won', Lost: 'Lost',
};
export const STATUS_CLS: Record<Status, string> = {
  Open: 'b-closed', Qualified: 'b-closed', Develop: 'b-dev', Propose: 'b-prop',
  Hold: 'b-hold', OrderAcceptance: 'b-oa', Won: 'b-won', Lost: 'b-lost',
};
/** Saved default for the Status filter (client, 22 Oct). */
export const DEFAULT_STATUS: Status[] = ['OrderAcceptance', 'Propose'];

/** Proposal status = CRM opportunity stage. */
export const PROPOSAL = [
  'Received RFQ', 'Budgetary Quote Submission', 'RFQ Approved', 'Quote Prepared',
  'Quote approved and Submitted', 'Quote submitted', 'Negotiation', 'Negotiation completed',
  'Work Order Receipt', 'Work Order Acceptance',
];
/** Named by the client on 22 Oct as a status to add. */
export const NEW_STAGES = ['Negotiation'];
export const QUOTE_STAGES = [
  'Quote approved and Submitted', 'Quote submitted', 'Negotiation', 'Negotiation completed',
  'Work Order Receipt', 'Work Order Acceptance',
];
/** Sample options — the client has not defined the Site Status list yet. */
export const SITE = [
  'Not started', 'Site mobilisation', 'Civil work in progress', 'Structure in progress',
  'Finishing stage', 'Ready for supply', 'Completed', 'On hold',
];
export const REGIONS: Record<string, string[]> = {
  Dubai: ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah', 'Al Ain'],
  Bangalore: ['Karnataka'],
  Delhi: ['Delhi NCR', 'Haryana', 'Uttar Pradesh'],
  Mumbai: ['Maharashtra', 'Gujarat'],
};
export const OWNERS = ['Aisha Rahman', 'Karan Mehta', 'Omar Farouk', 'Priya Nair', 'Rohit Sharma', 'Layla Hassan'];
export const MGMT = ['Head of Sales', 'Director'];
export const CURRENCIES: Currency[] = ['AED', 'INR', 'USD'];
export const MAX_REVISIONS = 3;

export const FIELD_LABEL: Record<EditableField, string> = {
  stage: 'Proposal Status', revised: 'Revised Date', follow: 'Next Follow-up', project: 'Project Status',
  site: 'Site Status', floor: 'Floor Level', remark: 'Remarks', visit: 'Date of Visit',
};

export const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#0a9a52,#38b46a)', 'linear-gradient(135deg,#3d7cf0,#6a9cf5)',
  'linear-gradient(135deg,#6b5bd6,#8f82ea)', 'linear-gradient(135deg,#e07a2f,#f0a35e)',
  'linear-gradient(135deg,#d6455b,#ea7586)', 'linear-gradient(135deg,#1595a3,#40bac6)',
];
