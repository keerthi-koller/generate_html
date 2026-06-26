/**
 * server.js
 * ─────────
 * Express API that accepts a trace-enquiry JSON body
 * and returns a fully populated HTML report.
 *
 * Install:  npm install express
 * Run:      node server.js
 *
 * POST /api/report
 *   Body:    { json: { ...traceEnquiryResponse }, meta: { requester, enquiryDate, ... } }
 *   Returns: text/html — the filled report page
 */

const express = require('express');
const app = express();
app.use(express.json({ limit: '5mb' }));

/* ─────────────────────────────────────────────────────────────────────────────
   STATIC CONFIG
───────────────────────────────────────────────────────────────────────────── */
const COMPANY_INFO = {
    name: 'South African Corporate Registrations',
    phone: '0104494848',
    email: 'support@ubmv.co.za',
    support: 'support@ubmv.co.za',
    website: 'http://www.ubmv.co.za',
    whatsapp: '0662205503'
};

const META_DEFAULTS = {
    reportName: 'Member Trace Enquiry',
    enquiryDate: '',
    requester: '',
    dompasNumber: 'Not Authorized',
    citizenship: '',
    dhaDeceased: '',
    dhaDeceasedDate: '',
    birthCertificate: 'No',
    marriageCertificate: 'No',
    deathCertificate: 'No',
    dhaLinkUrl: '#'
};

/* ─────────────────────────────────────────────────────────────────────────────
   TEMPLATE HELPERS
───────────────────────────────────────────────────────────────────────────── */
function esc(v) {
    if (v === null || v === undefined) return '';
    return String(v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function badge(value, kind) {
    const v = esc(value);
    if (kind === 'gender') {
        const up = v.toUpperCase();
        if (up.startsWith('M')) return '<span class="badge badge-male">Male</span>';
        if (up.startsWith('F')) return '<span class="badge badge-female">Female</span>';
        return v || '-';
    }
    const low = v.toLowerCase();
    if (low === 'yes') return '<span class="badge badge-yes">Yes</span>';
    if (low === 'no') return '<span class="badge badge-no">No</span>';
    return v || '-';
}

function fullName(item) {
    return [item.FullNames, item.Surname].filter(Boolean).map(esc).join(' ') || '-';
}

function joinList(arr) {
    return (!arr || !arr.length) ? '-' : arr.map(esc).join('<br>');
}

function tableRows(items, colSpan, rowFn) {
    if (!items || !items.length)
        return `<tr class="empty-row"><td colspan="${colSpan}">No records found</td></tr>`;
    return items.map(rowFn).join('');
}

function linkType(item) {
    const hasAddr = Array.isArray(item.Addresses) && item.Addresses.length > 0;
    const hasTel = Array.isArray(item.Telephones) && item.Telephones.length > 0;
    if (hasAddr && hasTel) return 'Telephone, Address';
    if (hasTel) return 'Telephone';
    if (hasAddr) return 'Address';
    return '-';
}

function employerAddress(emp) {
    return emp.FullAddress ||
        [emp.Line1, emp.Line2, emp.Line3, emp.Line4, emp.Line5].filter(Boolean).join(', ') ||
        '-';
}

/* ─────────────────────────────────────────────────────────────────────────────
   HTML BUILDER
───────────────────────────────────────────────────────────────────────────── */
function buildReportHtml(json, metaOverrides) {
    const meta = Object.assign({}, META_DEFAULTS, metaOverrides || {});
    const result = json.Result || {};
    const person = result.Person || {};
    const indicators = result.Indicators || {};

    /* ── section builders ── */
    const namesHistory = tableRows(result.History, 2, h =>
        `<tr><td>${esc(h.FullNames)}</td><td>${esc(h.Surname)}</td></tr>`);

    const passports = tableRows(result.Passport, 2, p =>
        `<tr><td>${esc(p.PassportNumber)}</td><td>${esc(p.RecordDate)}</td></tr>`);

    const marriage = tableRows(result.Marriage, 8, m =>
        `<tr>
      <td><a class="id-link" href="#">${esc(m.IDNumber)}</a></td>
      <td>${fullName(m)}</td>
      <td>${badge(m.Gender, 'gender')}</td>
      <td>${esc(m.MaidenName)}</td>
      <td>${esc(m.Age)}</td>
      <td>${esc(m.MaritalDate)}</td>
      <td>${esc(m.DivorceDate)}</td>
      <td>${esc(m.DateOfDeath)}</td>
    </tr>`);

    const possibleMarriage = tableRows(result.PossibleMarriage, 4, pm =>
        `<tr>
      <td>${esc(pm.IDNumber)}</td>
      <td>${esc(pm.MaidenName)}</td>
      <td>${esc(pm.MaritalDate)}</td>
      <td>${esc(pm.RecordDate)}</td>
    </tr>`);

    const relatives = tableRows(result.Relatives, 7, rel =>
        `<tr>
      <td>${esc(rel.IDNumber)}</td>
      <td>${esc(rel.FullNames)}</td>
      <td>${esc(rel.Surname)}</td>
      <td>${esc(rel.DateOfBirth)}</td>
      <td>${esc(rel.DateOfDeath)}</td>
      <td>${esc(rel.Age)}</td>
      <td>${esc(rel.LinkDesc)}</td>
    </tr>`);

    const otherLinks = tableRows(result.OtherLinks, 6, ol => {
        const per = ol.Person || {};
        return `<tr>
      <td>${esc(per.IDNumber)}</td>
      <td>${esc(per.FullNames)}</td>
      <td>${esc(per.Surname)}</td>
      <td>${linkType(ol)}</td>
      <td>${joinList(ol.Telephones)}</td>
      <td>${joinList(ol.Addresses)}</td>
    </tr>`;
    });

    const telephones = tableRows(result.Telephones, 5, t =>
        `<tr>
      <td>${esc(t.TelNo)}</td>
      <td>${esc(t.TelType)}</td>
      <td>${esc(t.Linkages)}</td>
      <td>-</td>
      <td>${esc(t.RecordDate)}</td>
    </tr>`);

    const telephoneLinks = tableRows(result.TelephoneLinks, 5, tl =>
        `<tr>
      <td>${esc(tl.IDNumber)}</td>
      <td>${fullName(tl)}</td>
      <td>${esc(tl.TelType)}</td>
      <td>${esc(tl.TelNo)}</td>
      <td>${esc(tl.RecordDate)}</td>
    </tr>`);

    const rdpHousing = tableRows(result.RDPHousing, 9, h =>
        `<tr>
      <td>${esc(h.Prov)}</td><td>${esc(h.Status)}</td><td>${esc(h.AppType)}</td>
      <td>${esc(h.RegDate)}</td><td>${esc(h.Area)}</td><td>${esc(h.SiteNo)}</td>
      <td>${esc(h.Project)}</td><td>${esc(h.ConstrStatus)}</td><td>${esc(h.PosInArea)}</td>
    </tr>`);

    const addresses = tableRows(result.Addresses, 3, a =>
        `<tr>
      <td>${esc(a.FullAddress)}</td>
      <td>${esc(a.Linkages)}</td>
      <td>${esc(a.RecordDate)}</td>
    </tr>`);

    const emails = tableRows(result.Emails, 2, e =>
        `<tr><td>${esc(e.EmailAddress)}</td><td>${esc(e.RecordDate)}</td></tr>`);

    const employers = tableRows(result.Employers, 6, emp =>
        `<tr>
      <td>${esc(emp.RegNo)}</td>
      <td>${esc(emp.EmployerName)}</td>
      <td>${esc(employerAddress(emp))}</td>
      <td>${esc(emp.Designation)}</td>
      <td>${esc(emp.EmployeeNo)}</td>
      <td>${esc(emp.RecordDate)}</td>
    </tr>`);

    const properties = tableRows(result.Properties, 8, pr =>
        `<tr>
      <td>${esc(pr.RegistrarName)}</td>
      <td>${esc(pr.BuyerName)}</td>
      <td>-</td>
      <td>${esc(pr.PurchasePriceAmt)}</td>
      <td>${esc(pr.AuthorityName)}</td>
      <td>${esc(pr.PhysicalAddress)}</td>
      <td>${esc(pr.TitleDeedNo)}</td>
      <td>${esc(pr.PurchaseDate)}</td>
    </tr>`);

    /* counts */
    const count = arr => (arr || []).length;

    /* ── full HTML ── */
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Member Trace Enquiry — ${esc(person.FullNames || '')} ${esc(person.Surname || '')}</title>
<style>
  :root{
    --blue:#1f5fa8;--blue-dark:#16487f;--ink:#1b2733;--muted:#5b6a78;
    --line:#d8e1ea;--line-soft:#e7ecf1;--bg-soft:#fafcfe;--head-bg:#eef3f8;
  }
  *{box-sizing:border-box;}
  body{margin:0;background:#f3f6f9;font-family:Arial,Helvetica,sans-serif;color:var(--ink);}
  .sheet{max-width:1000px;margin:24px auto 60px;background:#fff;padding:32px 40px 40px;box-shadow:0 1px 4px rgba(20,30,40,.08);}
  .report-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid var(--blue);padding-bottom:16px;margin-bottom:26px;}
  .logo-block{display:flex;align-items:center;gap:12px;}
  .logo-icon svg{width:46px;height:46px;display:block;}
  .logo-text .brand{font-size:22px;font-weight:700;color:var(--blue);letter-spacing:.5px;line-height:1;}
  .logo-text .tagline{font-size:9.5px;color:var(--muted);max-width:170px;line-height:1.3;margin-top:3px;}
  .company-info{text-align:right;font-size:12px;color:#33414f;}
  .company-info .company-name{font-size:14px;font-weight:700;color:var(--blue);margin-bottom:5px;}
  .company-info div{margin:2px 0;}
  .section{margin-bottom:30px;}
  .section-title{font-size:14.5px;font-weight:700;color:var(--blue);margin-bottom:9px;padding-bottom:5px;border-bottom:1px solid var(--line);}
  .section-title .count{color:var(--muted);font-weight:600;}
  .info-grid{display:grid;grid-template-columns:repeat(2,1fr);border:1px solid var(--line);border-radius:4px;overflow:hidden;}
  .info-grid.cols-3{grid-template-columns:repeat(3,1fr);}
  .info-cell{padding:10px 14px;border-bottom:1px solid var(--line-soft);border-right:1px solid var(--line-soft);background:#fff;}
  .info-grid.cols-2 .info-cell:nth-child(2n){border-right:none;}
  .info-grid.cols-3 .info-cell:nth-child(3n){border-right:none;}
  .info-cell:nth-child(odd){background:var(--bg-soft);}
  .info-label{font-size:10.5px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin-bottom:3px;}
  .info-value{font-size:13px;color:var(--ink);word-break:break-word;}
  .ha-verified{font-size:11px;color:var(--muted);font-weight:600;}
  .dha-link{margin-top:8px;font-size:11.5px;}
  .dha-link a{color:var(--blue);text-decoration:none;}
  .table-wrap{border:1px solid var(--line-soft);border-radius:4px;overflow-x:auto;}
  table{width:100%;border-collapse:collapse;font-size:12px;min-width:560px;}
  thead th{background:var(--head-bg);color:#33414f;text-align:left;padding:8px 10px;border-bottom:2px solid var(--line);font-weight:700;white-space:nowrap;}
  tbody td{padding:7px 10px;border-bottom:1px solid var(--line-soft);vertical-align:top;}
  tbody tr:hover{background:#f8fbfd;}
  .empty-row td{text-align:center;color:#8a97a3;font-style:italic;padding:14px;}
  .badge{display:inline-block;padding:2px 10px;border-radius:10px;font-size:11px;font-weight:700;}
  .badge-male{background:#e8f0fb;color:var(--blue);}
  .badge-female{background:#fdeef3;color:#c0407a;}
  .badge-yes{background:#fdeeee;color:#c0392b;}
  .badge-no{background:#eafbf0;color:#1f8a4c;}
  .id-link{color:var(--blue);text-decoration:none;font-weight:600;}
  .id-link:hover{text-decoration:underline;}
  .disclaimer{margin-top:34px;padding-top:16px;border-top:1px solid var(--line);font-size:10px;color:var(--muted);line-height:1.55;}
  .disclaimer strong{display:block;margin-bottom:6px;color:#33414f;font-size:11px;}
  .footer-credit{margin-top:14px;font-size:10px;color:#8a97a3;}
  @media print{@page{margin:1cm;} .sheet{box-shadow:none;margin:0;max-width:100%;}}
</style>
</head>
<body>
<div class="sheet" id="report">

  <!-- HEADER -->
  <div class="report-header">
    <div class="logo-block">
      <div class="logo-icon">
        <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
          <path d="M32 2 L58 12 V30 C58 46 47 57 32 62 C17 57 6 46 6 30 V12 Z" fill="#1f5fa8"/>
          <path d="M32 8 L52 16 V30 C52 43 43 52 32 56 C21 52 12 43 12 30 V16 Z" fill="#ffffff"/>
          <circle cx="32" cy="27" r="8" fill="#1f5fa8"/>
          <rect x="29.5" y="33" width="5" height="14" rx="2" fill="#1f5fa8"/>
        </svg>
      </div>
      <div class="logo-text">
        <div class="brand">UBMV</div>
        <div class="tagline">Unclaimed Benefits Member Verification and Fraud Prevention</div>
      </div>
    </div>
    <div class="company-info">
      <div class="company-name">${esc(COMPANY_INFO.name)}</div>
      <div>Phone: ${esc(COMPANY_INFO.phone)}</div>
      <div>Email: ${esc(COMPANY_INFO.email)}</div>
      <div>Support: ${esc(COMPANY_INFO.support)}</div>
      <div>Website: ${esc(COMPANY_INFO.website)}</div>
      <div>WhatsApp: ${esc(COMPANY_INFO.whatsapp)}</div>
    </div>
  </div>

  <!-- ENQUIRY DETAILS -->
  <div class="section">
    <div class="section-title">Enquiry Details</div>
    <div class="info-grid cols-2">
      <div class="info-cell"><div class="info-label">Report Name</div><div class="info-value">${esc(meta.reportName) || '-'}</div></div>
      <div class="info-cell"><div class="info-label">Enquiry Date</div><div class="info-value">${esc(meta.enquiryDate) || '-'}</div></div>
      <div class="info-cell"><div class="info-label">Enquiry Reference</div><div class="info-value">${esc(json.EnquiryID) || '-'}</div></div>
      <div class="info-cell"><div class="info-label">Requester</div><div class="info-value">${esc(meta.requester) || '-'}</div></div>
    </div>
  </div>

  <!-- MEMBER NAMES -->
  <div class="section">
    <div class="section-title">Member Names</div>
    <div class="info-grid cols-2">
      <div class="info-cell"><div class="info-label">ID Number</div><div class="info-value">${esc(person.IDNumber || json.IDNumber) || '-'} <span class="ha-verified">(HA Verified: ${esc(indicators.HAVerified) || '-'})</span></div></div>
      <div class="info-cell"><div class="info-label">Date Of Birth</div><div class="info-value">${esc(person.DateOfBirth) || '-'}</div></div>
      <div class="info-cell"><div class="info-label">Gender</div><div class="info-value">${badge(person.Gender, 'gender')}</div></div>
      <div class="info-cell"><div class="info-label">Age</div><div class="info-value">${esc(person.Age) || '-'}</div></div>
      <div class="info-cell"><div class="info-label">Names</div><div class="info-value">${esc(person.FullNames) || '-'}</div></div>
      <div class="info-cell"><div class="info-label">Surname</div><div class="info-value">${esc(person.Surname) || '-'}</div></div>
      <div class="info-cell"><div class="info-label">Initials</div><div class="info-value">${esc(person.Initials) || '-'}</div></div>
      <div class="info-cell"><div class="info-label">Maiden Name</div><div class="info-value">${esc(person.MaidenName) || '-'}</div></div>
      <div class="info-cell"><div class="info-label">Dompas Number</div><div class="info-value">${esc(meta.dompasNumber) || '-'}</div></div>
      <div class="info-cell"><div class="info-label">Citizenship</div><div class="info-value">${esc(meta.citizenship) || '-'}</div></div>
    </div>
  </div>

  <!-- INDICATORS -->
  <div class="section">
    <div class="section-title">Indicators</div>
    <div class="info-grid cols-3">
      <div class="info-cell"><div class="info-label">Has Trust Info</div><div class="info-value">${badge(indicators.HasTrust, 'yesno')}</div></div>
      <div class="info-cell"><div class="info-label">Deceased</div><div class="info-value">${badge(indicators.HADeceasedStatus, 'yesno')}</div></div>
      <div class="info-cell"><div class="info-label">DHA Deceased</div><div class="info-value">${badge(meta.dhaDeceased, 'yesno')}</div></div>
      <div class="info-cell"><div class="info-label">Has Deceased Estates</div><div class="info-value">${badge(indicators.HasDeceasedEstate, 'yesno')}</div></div>
      <div class="info-cell"><div class="info-label">Deceased Date</div><div class="info-value">${esc(indicators.HADeceasedDate) || '-'}</div></div>
      <div class="info-cell"><div class="info-label">DHA Deceased Date</div><div class="info-value">${esc(meta.dhaDeceasedDate) || '-'}</div></div>
      <div class="info-cell"><div class="info-label">Birth Certificate</div><div class="info-value">${badge(meta.birthCertificate, 'yesno')}</div></div>
      <div class="info-cell"><div class="info-label">Marriage Certificate</div><div class="info-value">${badge(meta.marriageCertificate, 'yesno')}</div></div>
      <div class="info-cell"><div class="info-label">Death Certificate</div><div class="info-value">${badge(meta.deathCertificate, 'yesno')}</div></div>
      <div class="info-cell"><div class="info-label">Real-Time Deceased Checked</div><div class="info-value">${esc(json.RealTimeDeceasedChecked) || '-'}</div></div>
      <div class="info-cell"><div class="info-label">Government Employee</div><div class="info-value">${result.GovernmentEmployee ?? '-'}</div></div>
      <div class="info-cell"></div>
    </div>
    <div class="dha-link"><a href="${esc(meta.dhaLinkUrl)}">click here to do a live DHA enquiry to confirm the deceased status. (Additional costs will apply).</a></div>
  </div>

  <!-- NAMES HISTORY -->
  <div class="section">
    <div class="section-title">Names History (<span class="count">${count(result.History)}</span>)</div>
    <div class="table-wrap"><table>
      <thead><tr><th>Full Names</th><th>Surname</th></tr></thead>
      <tbody>${namesHistory}</tbody>
    </table></div>
  </div>

  <!-- PASSPORTS -->
  <div class="section">
    <div class="section-title">Passports (<span class="count">${count(result.Passport)}</span>)</div>
    <div class="table-wrap"><table>
      <thead><tr><th>Passport Number</th><th>Record Date</th></tr></thead>
      <tbody>${passports}</tbody>
    </table></div>
  </div>

  <!-- MARRIAGE -->
  <div class="section">
    <div class="section-title">Marriage (<span class="count">${count(result.Marriage)}</span>)</div>
    <div class="table-wrap"><table>
      <thead><tr><th>ID No</th><th>Full Names</th><th>Gender</th><th>Maiden Name</th><th>Age</th><th>Marital Date</th><th>Divorce Date</th><th>Date Of Death</th></tr></thead>
      <tbody>${marriage}</tbody>
    </table></div>
  </div>

  <!-- POSSIBLE MARRIAGE -->
  <div class="section">
    <div class="section-title">Possible Marriage (<span class="count">${count(result.PossibleMarriage)}</span>)</div>
    <div class="table-wrap"><table>
      <thead><tr><th>ID Number</th><th>Maiden Name</th><th>Marital Date</th><th>Record Date</th></tr></thead>
      <tbody>${possibleMarriage}</tbody>
    </table></div>
  </div>

  <!-- POSSIBLE RELATIVES -->
  <div class="section">
    <div class="section-title">Possible Relatives (<span class="count">${count(result.Relatives)}</span>)</div>
    <div class="table-wrap"><table>
      <thead><tr><th>ID Number</th><th>Full Names</th><th>Surname</th><th>Date Of Birth</th><th>Date Of Death</th><th>Age</th><th>Link</th></tr></thead>
      <tbody>${relatives}</tbody>
    </table></div>
  </div>

  <!-- OTHER POSSIBLE LINKS -->
  <div class="section">
    <div class="section-title">Other Possible Links (<span class="count">${count(result.OtherLinks)}</span>)</div>
    <div class="table-wrap"><table>
      <thead><tr><th>ID Number</th><th>Full Names</th><th>Surname</th><th>Link</th><th>Linked Tels</th><th>Linked Addresses</th></tr></thead>
      <tbody>${otherLinks}</tbody>
    </table></div>
  </div>

  <!-- TELEPHONES -->
  <div class="section">
    <div class="section-title">Telephones (<span class="count">${count(result.Telephones)}</span>)</div>
    <div class="table-wrap"><table>
      <thead><tr><th>Tel Number</th><th>Type(s)</th><th>Linkages</th><th>Possible Companies</th><th>Record Date</th></tr></thead>
      <tbody>${telephones}</tbody>
    </table></div>
  </div>

  <!-- TELEPHONE LINKAGES - EXTERNAL -->
  <div class="section">
    <div class="section-title">Telephones Linkages - External (<span class="count">${count(result.TelephoneLinks)}</span>)</div>
    <div class="table-wrap"><table>
      <thead><tr><th>ID Number</th><th>Full Name</th><th>Tel Type</th><th>Tel Number</th><th>Record Date</th></tr></thead>
      <tbody>${telephoneLinks}</tbody>
    </table></div>
  </div>

  <!-- RDP HOUSING -->
  <div class="section">
    <div class="section-title">RDP Housing</div>
    <div class="table-wrap"><table>
      <thead><tr><th>Prov</th><th>Status</th><th>App. Type</th><th>Reg. Date</th><th>Area</th><th>Site No</th><th>Project</th><th>Constr. Status</th><th>Pos. In Area</th></tr></thead>
      <tbody>${rdpHousing}</tbody>
    </table></div>
  </div>

  <!-- ADDRESSES -->
  <div class="section">
    <div class="section-title">Addresses (<span class="count">${count(result.Addresses)}</span>)</div>
    <div class="table-wrap"><table>
      <thead><tr><th>Address</th><th>Linkages</th><th>Record Date</th></tr></thead>
      <tbody>${addresses}</tbody>
    </table></div>
  </div>

  <!-- EMAILS -->
  <div class="section">
    <div class="section-title">Emails (<span class="count">${count(result.Emails)}</span>)</div>
    <div class="table-wrap"><table>
      <thead><tr><th>Email Address</th><th>Record Date</th></tr></thead>
      <tbody>${emails}</tbody>
    </table></div>
  </div>

  <!-- EMPLOYERS -->
  <div class="section">
    <div class="section-title">Employers (<span class="count">${count(result.Employers)}</span>)</div>
    <div class="table-wrap"><table>
      <thead><tr><th>Registration No</th><th>Employer</th><th>Address</th><th>Designation</th><th>Employee No</th><th>Record Date</th></tr></thead>
      <tbody>${employers}</tbody>
    </table></div>
  </div>

  <!-- PROPERTIES -->
  <div class="section">
    <div class="section-title">Properties (<span class="count">${count(result.Properties)}</span>)</div>
    <div class="table-wrap"><table>
      <thead><tr><th>Registrar</th><th>Buyer</th><th>Ownership</th><th>Purchase Price</th><th>Authority</th><th>Address</th><th>Title Deed</th><th>Purchase Date</th></tr></thead>
      <tbody>${properties}</tbody>
    </table></div>
  </div>

  <!-- DISCLAIMER -->
  <div class="disclaimer">
    <strong>Disclaimer</strong>
    The content of this document serves as an information only source and is confidential and intended for the recipient who enquired this
    information. The views and opinions included in this document belong to the entity utilising the information and do not necessarily mirror the
    views and opinions of UBMV. Our employees are obliged not to make any defamatory clauses, infringe, or authorize infringement of any legal
    right. The user warrants that the request for services in respect of the processing of the personal information of a member (data subject) is
    necessary for pursuing the user's legitimate interest and undertakes to use the services provided for lawful purposes only and in compliance
    with all applicable laws of the Republic of South Africa. UBMV does not accept any liability for any damages, including any lost profits, lost
    savings, or any other direct, indirect, special, incidental, or consequential damages arising from the use or the inability to use this information
    correctly. The information contained in this document was gathered and/or scraped from publicly available open data sources. All linkages are
    done based on unique algorithms to match members as closely as possible. We do not claim that our matching algorithms are 100% accurate and
    therefore require further verification to be conducted by the user using this platform, to confirm the accuracy of such linkages.
    <div class="footer-credit">© 2026 UBMV Search Portal is a product of Data Confirm (Pty) Ltd</div>
  </div>

</div>
</body>
</html>`;
}

/* ─────────────────────────────────────────────────────────────────────────────
   ROUTES
───────────────────────────────────────────────────────────────────────────── */

/**
 * POST /api/report
 *
 * Body (JSON):
 * {
 *   "json": { ...traceEnquiryResponse },   // required
 *   "meta": {                               // optional overrides
 *     "requester":   "Jane Doe",
 *     "enquiryDate": "6 March 2026 7:23 pm"
 *   }
 * }
 *
 * Returns: text/html
 */
app.post('/api/report', (req, res) => {
    const { json, meta } = req.body;

    if (!json) {
        return res.status(400).json({ error: '`json` field is required in the request body.' });
    }

    try {
        const html = buildReportHtml(json, meta);
        res.setHeader('Content-Type', 'text/html; charset=utf-8'); s
        res.send(html);
    } catch (err) {
        console.error('Report build error:', err);
        res.status(500).json({ error: 'Failed to build report.', detail: err.message });
    }
});

/* Health check */
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

/* ─────────────────────────────────────────────────────────────────────────────
   START
───────────────────────────────────────────────────────────────────────────── */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Report API running → http://localhost:${PORT}`));