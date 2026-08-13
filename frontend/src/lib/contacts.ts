export interface OfficerContact {
  id: string;
  name: string;
  designation: string;
  mobile: string;   // with country code, no spaces — e.g. "919876543210"
  email?: string;
}

// ⚠️ DEMO DATA — replace with real officer details before going live
export const OFFICER_CONTACTS: OfficerContact[] = [
  {
    id: "commercial-control-ngp",
    name: "Commercial Control — NGP Division",
    designation: "Commercial Control",
    mobile: "919876500011",
    email: "commercial.control.ngp@demo-railway.gov.in",
  },
  {
    id: "commercial-control-bsp",
    name: "Commercial Control — BSP Division",
    designation: "Commercial Control",
    mobile: "919876500012",
    email: "commercial.control.bsp@demo-railway.gov.in",
  },
  {
    id: "commercial-control-nagpur-east",
    name: "Commercial Control — Nagpur East Division",
    designation: "Commercial Control",
    mobile: "919876500013",
    email: "commercial.control.east@demo-railway.gov.in",
  },
  {
    id: "sr-dcm",
    name: "R. K. Sharma",
    designation: "Sr. DCM",
    mobile: "919876500002",
    email: "sr.dcm@demo-railway.gov.in",
  },
  {
    id: "dcm",
    name: "A. P. Verma",
    designation: "DCM",
    mobile: "919876500003",
    email: "dcm@demo-railway.gov.in",
  },
  {
    id: "duty-officer",
    name: "Duty Officer",
    designation: "Divisional Duty Officer",
    mobile: "919876500004",
    email: "duty.officer@demo-railway.gov.in",
  },
  {
    id: "vigilance",
    name: "S. N. Patil",
    designation: "Vigilance Inspector",
    mobile: "919876500005",
    email: "vigilance@demo-railway.gov.in",
  },
];