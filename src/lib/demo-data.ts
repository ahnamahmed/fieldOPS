/**
 * FieldOps BD — Centralized Development Demo Data Layer
 * 
 * NOTE: This is strictly for local UI development and demo walkthroughs.
 * In production accounts, real Supabase queries replace these fixtures.
 */

export const IS_DEVELOPMENT_DEMO_DATA = true;

export interface DemoOrganization {
  id: string;
  name: string;
  slug: string;
  contactEmail: string;
  contactPhone: string;
  city: string;
  address: string;
  taxId: string;
  currency: string;
  timezone: string;
}

export interface DemoTeamMember {
  id: string;
  fullName: string;
  role: "owner" | "admin" | "dispatcher" | "technician" | "finance";
  email: string;
  phone: string;
  activeJobsCount: number;
  status: "active" | "invited";
  avatarInitials: string;
}

export interface DemoCustomer {
  id: string;
  name: string;
  customerType: "commercial" | "residential" | "corporate";
  contactPerson: string;
  phone: string;
  email: string;
  sitesCount: number;
  assetsCount: number;
  outstandingBalance: number;
  isVip?: boolean;
}

export interface DemoSite {
  id: string;
  customerId: string;
  customerName: string;
  siteName: string;
  address: string;
  area: string;
  city: string;
  landmark: string;
  contactPerson: string;
  contactPhone: string;
}

export interface DemoAsset {
  id: string;
  siteId: string;
  customerId: string;
  customerName: string;
  siteName: string;
  assetTag: string;
  equipmentType: "split_ac" | "cassette_ac" | "standing_ac" | "vrf_system" | "chiller";
  equipmentTypeLabel: string;
  brand: string;
  model: string;
  serialNumber: string;
  capacity: string;
  refrigerant: string;
  location: string;
  conditionStatus: "operational" | "needs_service" | "under_repair";
  lastServicedDate: string;
}

export interface DemoJob {
  id: string;
  jobNumber: string;
  title: string;
  description: string;
  jobType: "repair" | "master_service" | "gas_charging" | "installation" | "amc_routine";
  jobTypeLabel: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "scheduled" | "in_progress" | "completed" | "on_hold";
  customerName: string;
  customerId: string;
  siteName: string;
  siteAddress: string;
  siteLandmark: string;
  customerPhone: string;
  equipmentTitle: string;
  equipmentDetails?: string;
  refrigerant?: string;
  scheduledTime: string;
  scheduledDate: string;
  technicianName: string;
  technicianId: string;
  technicianPhone: string;
  estimatedDuration: string;
  checklistsCompleted?: number;
  checklistsTotal?: number;
  photosUploaded?: number;
}

export interface DemoQuote {
  id: string;
  quoteNumber: string;
  customerName: string;
  jobTitle?: string;
  date: string;
  validUntil: string;
  subtotal: number;
  discount: number;
  vat: number;
  total: number;
  status: "draft" | "sent" | "accepted" | "expired";
}

export interface DemoInvoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  date: string;
  dueDate: string;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  status: "paid" | "partially_paid" | "issued" | "overdue";
  paymentMethod?: string;
  transactionRef?: string;
}

export interface DemoContract {
  id: string;
  contractNumber: string;
  title: string;
  customerName: string;
  contractType: "Comprehensive" | "Non-Comprehensive" | "Labor Only";
  coveredUnitsCount: number;
  interval: "Monthly" | "Quarterly" | "Bi-Monthly";
  annualValue: number;
  startDate: string;
  endDate: string;
  nextScheduledVisit: string;
  status: "active" | "renewal_due" | "draft";
}

// ==========================================
// CENTRALIZED DATA FIXTURES
// ==========================================

export const DEMO_ORGANIZATION: DemoOrganization = {
  id: "org-1",
  name: "CoolTech BD Services Ltd.",
  slug: "cooltech-bd",
  contactEmail: "ops@cooltechbd.com",
  contactPhone: "+880 1711-234567",
  city: "Dhaka",
  address: "House 34, Road 11, Block F, Banani, Dhaka-1213",
  taxId: "BIN-984321045",
  currency: "BDT",
  timezone: "Asia/Dhaka",
};

export const DEMO_TEAM: DemoTeamMember[] = [
  {
    id: "tech-1",
    fullName: "Tanvir Ahmed",
    role: "technician",
    email: "tanvir@cooltechbd.com",
    phone: "01712-345678",
    activeJobsCount: 2,
    status: "active",
    avatarInitials: "TA",
  },
  {
    id: "tech-2",
    fullName: "Sakib Al Hasan",
    role: "technician",
    email: "sakib@cooltechbd.com",
    phone: "01812-345678",
    activeJobsCount: 1,
    status: "active",
    avatarInitials: "SH",
  },
  {
    id: "tech-3",
    fullName: "Rahim Uddin",
    role: "technician",
    email: "rahim@cooltechbd.com",
    phone: "01912-345678",
    activeJobsCount: 1,
    status: "active",
    avatarInitials: "RU",
  },
  {
    id: "staff-1",
    fullName: "Kazi Farhan",
    role: "dispatcher",
    email: "farhan@cooltechbd.com",
    phone: "01755-123456",
    activeJobsCount: 0,
    status: "active",
    avatarInitials: "KF",
  },
  {
    id: "staff-2",
    fullName: "Nasreen Sultana",
    role: "finance",
    email: "nasreen@cooltechbd.com",
    phone: "01711-987654",
    activeJobsCount: 0,
    status: "active",
    avatarInitials: "NS",
  },
  {
    id: "owner-1",
    fullName: "Rezaul Karim",
    role: "owner",
    email: "reza@cooltechbd.com",
    phone: "01710-000000",
    activeJobsCount: 0,
    status: "active",
    avatarInitials: "RK",
  },
];

export const DEMO_CUSTOMERS: DemoCustomer[] = [
  {
    id: "cust-1",
    name: "Prime Bank Ltd. (Banani Branch)",
    customerType: "commercial",
    contactPerson: "Mahmud Hasan (Branch Admin)",
    phone: "01713-112233",
    email: "banani.branch@primebank.com.bd",
    sitesCount: 1,
    assetsCount: 14,
    outstandingBalance: 15000,
    isVip: true,
  },
  {
    id: "cust-2",
    name: "Star Kabab & Restaurant",
    customerType: "commercial",
    contactPerson: "Al-Amin Chowdhury (Manager)",
    phone: "01819-223344",
    email: "accounts@starkabab.com",
    sitesCount: 2,
    assetsCount: 8,
    outstandingBalance: 0,
    isVip: true,
  },
  {
    id: "cust-3",
    name: "Shanta Western Tower Management",
    customerType: "corporate",
    contactPerson: "Engr. Jahangir Alam (Facility Head)",
    phone: "01911-334455",
    email: "facilities@shantawestern.com",
    sitesCount: 1,
    assetsCount: 32,
    outstandingBalance: 92000,
    isVip: true,
  },
  {
    id: "cust-4",
    name: "Lakeview Luxury Apartments (Society)",
    customerType: "residential",
    contactPerson: "Dr. K. M. Rahman (Secretary)",
    phone: "01715-445566",
    email: "lakeview.g2@gmail.com",
    sitesCount: 1,
    assetsCount: 6,
    outstandingBalance: 0,
  },
  {
    id: "cust-5",
    name: "Apex Footwear Outlet",
    customerType: "commercial",
    contactPerson: "Tariqul Islam (Store Supervisor)",
    phone: "01611-556677",
    email: "uttara.apex@apexfootwearltd.com",
    sitesCount: 1,
    assetsCount: 4,
    outstandingBalance: 0,
  },
];

export const DEMO_SITES: DemoSite[] = [
  {
    id: "site-1",
    customerId: "cust-1",
    customerName: "Prime Bank Ltd.",
    siteName: "Banani Branch (Ground & 1st Floor)",
    address: "House 12, Road 11, Block D",
    area: "Banani",
    city: "Dhaka",
    landmark: "Opposite to Star Kabab Banani",
    contactPerson: "Mahmud Hasan",
    contactPhone: "01713-112233",
  },
  {
    id: "site-2",
    customerId: "cust-2",
    customerName: "Star Kabab & Restaurant",
    siteName: "Dhanmondi Outlet",
    address: "House 45, Road 27 (Old)",
    area: "Dhanmondi",
    city: "Dhaka",
    landmark: "Beside Rangs Plaza & Medinova",
    contactPerson: "Al-Amin Chowdhury",
    contactPhone: "01819-223344",
  },
  {
    id: "site-3",
    customerId: "cust-3",
    customerName: "Shanta Western Tower Management",
    siteName: "Main Corporate Tower (Floor 5-7)",
    address: "186 Bir Uttam Mir Shawkat Sarak",
    area: "Tejgaon Commercial Area",
    city: "Dhaka",
    landmark: "Beside Channel i office",
    contactPerson: "Engr. Jahangir Alam",
    contactPhone: "01911-334455",
  },
];

export const DEMO_ASSETS: DemoAsset[] = [
  {
    id: "eq-1",
    siteId: "site-1",
    customerId: "cust-1",
    customerName: "Prime Bank Ltd.",
    siteName: "Banani Branch",
    assetTag: "PB-AC-01",
    equipmentType: "cassette_ac",
    equipmentTypeLabel: "4.0 Ton Cassette AC",
    brand: "General (Fujitsu)",
    model: "AUGG36FRTA",
    serialNumber: "GEN-2022-89211",
    capacity: "4.0 Ton",
    refrigerant: "R410A",
    location: "Server Room / ATM UPS Backroom",
    conditionStatus: "needs_service",
    lastServicedDate: "2026-07-14",
  },
  {
    id: "eq-2",
    siteId: "site-1",
    customerId: "cust-1",
    customerName: "Prime Bank Ltd.",
    siteName: "Banani Branch",
    assetTag: "PB-AC-02",
    equipmentType: "standing_ac",
    equipmentTypeLabel: "4.0 Ton Floor Standing AC",
    brand: "Gree",
    model: "GV-36C3",
    serialNumber: "GREE-2023-11029",
    capacity: "4.0 Ton",
    refrigerant: "R32",
    location: "Main Banking Customer Hall",
    conditionStatus: "operational",
    lastServicedDate: "2026-09-02",
  },
  {
    id: "eq-3",
    siteId: "site-2",
    customerId: "cust-2",
    customerName: "Star Kabab & Restaurant",
    siteName: "Dhanmondi Outlet",
    assetTag: "SK-CH-01",
    equipmentType: "chiller",
    equipmentTypeLabel: "Cold Room Chiller",
    brand: "Carrier",
    model: "CAR-CR-150",
    serialNumber: "CAR-99384-CH",
    capacity: "3.5 HP",
    refrigerant: "R404A",
    location: "Meat & Marination Cold Storage",
    conditionStatus: "operational",
    lastServicedDate: "2026-09-20",
  },
  {
    id: "eq-4",
    siteId: "site-3",
    customerId: "cust-3",
    customerName: "Shanta Western Tower",
    siteName: "Main Corporate Tower",
    assetTag: "SWT-VRF-01",
    equipmentType: "vrf_system",
    equipmentTypeLabel: "14 HP VRF Outdoor Master",
    brand: "Daikin",
    model: "VRV-IV-RXYQ",
    serialNumber: "DKN-VRV-2021-004",
    capacity: "14.0 HP",
    refrigerant: "R410A",
    location: "Rooftop North Plant Deck",
    conditionStatus: "under_repair",
    lastServicedDate: "2026-08-11",
  },
  {
    id: "eq-5",
    siteId: "site-1",
    customerId: "cust-1",
    customerName: "Prime Bank Ltd.",
    siteName: "Banani Branch",
    assetTag: "PB-AC-03",
    equipmentType: "split_ac",
    equipmentTypeLabel: "2.0 Ton Split Inverter",
    brand: "Gree",
    model: "GWH18ACD",
    serialNumber: "GREE-2024-5519",
    capacity: "2.0 Ton",
    refrigerant: "R32",
    location: "Branch Manager Cabin (Room 102)",
    conditionStatus: "operational",
    lastServicedDate: "2026-09-18",
  },
];

export const DEMO_JOBS: DemoJob[] = [
  {
    id: "job-1",
    jobNumber: "FO-JOB-1001",
    title: "Server Room AC Not Cooling — Low Gas Diagnostic",
    description: "Server room ambient temperature reaching 28°C. Check suction pressure, flare joints for R410A leak, and charge gas.",
    jobType: "gas_charging",
    jobTypeLabel: "Refrigerant Charging",
    priority: "urgent",
    status: "in_progress",
    customerName: "Prime Bank Ltd. (Banani Branch)",
    customerId: "cust-1",
    siteName: "Banani Branch (Ground & 1st Floor)",
    siteAddress: "House 12, Road 11, Block D, Banani",
    siteLandmark: "Opposite to Star Kabab Banani",
    customerPhone: "01713-112233",
    equipmentTitle: "General 4.0 Ton Cassette (PB-AC-01)",
    equipmentDetails: "Model: AUGG36FRTA | Ref: R410A",
    refrigerant: "R410A",
    scheduledDate: "Today",
    scheduledTime: "10:30 AM – 01:00 PM",
    technicianName: "Tanvir Ahmed",
    technicianId: "tech-1",
    technicianPhone: "01712-345678",
    estimatedDuration: "2h 30m",
    checklistsCompleted: 3,
    checklistsTotal: 6,
    photosUploaded: 2,
  },
  {
    id: "job-2",
    jobNumber: "FO-JOB-1002",
    title: "Routine Quarterly Jet Wash & Chemical Clean",
    description: "Complete water-jet washing of outdoor condensers, indoor filters cleaning, and drain pan bleaching.",
    jobType: "master_service",
    jobTypeLabel: "Master Service",
    priority: "medium",
    status: "scheduled",
    customerName: "Star Kabab & Restaurant",
    customerId: "cust-2",
    siteName: "Dhanmondi Outlet",
    siteAddress: "House 45, Road 27 (Old), Dhanmondi",
    siteLandmark: "Beside Rangs Plaza & Medinova",
    customerPhone: "01819-223344",
    equipmentTitle: "Gree 3.0 Ton Split & Kitchen Units",
    refrigerant: "R32",
    scheduledDate: "Today",
    scheduledTime: "02:30 PM – 05:00 PM",
    technicianName: "Tanvir Ahmed",
    technicianId: "tech-1",
    technicianPhone: "01712-345678",
    estimatedDuration: "2h 30m",
    checklistsCompleted: 0,
    checklistsTotal: 5,
    photosUploaded: 0,
  },
  {
    id: "job-3",
    jobNumber: "FO-JOB-1003",
    title: "VRF Outdoor Compressor High Amp Draw Inspection",
    description: "Compressor tripping every 40 minutes under high load. Check motor winding resistance, expansion valve, and supply voltage.",
    jobType: "repair",
    jobTypeLabel: "Major Repair",
    priority: "high",
    status: "in_progress",
    customerName: "Shanta Western Tower Management",
    customerId: "cust-3",
    siteName: "Main Corporate Tower (Floor 5-7)",
    siteAddress: "186 Bir Uttam Mir Shawkat Sarak, Tejgaon",
    siteLandmark: "Beside Channel i office",
    customerPhone: "01911-334455",
    equipmentTitle: "Daikin 14 HP VRF Master Unit (SWT-VRF-01)",
    refrigerant: "R410A",
    scheduledDate: "Today",
    scheduledTime: "11:00 AM – 03:00 PM",
    technicianName: "Sakib Al Hasan",
    technicianId: "tech-2",
    technicianPhone: "01812-345678",
    estimatedDuration: "4h",
    checklistsCompleted: 2,
    checklistsTotal: 5,
    photosUploaded: 1,
  },
  {
    id: "job-4",
    jobNumber: "FO-JOB-1004",
    title: "Emergency Ceiling Drain Pipe Flush — Water Dripping",
    description: "Drain line blocked causing water to overflow into VIP cabin false ceiling. Cleared with nitrogen flush.",
    jobType: "repair",
    jobTypeLabel: "Emergency Repair",
    priority: "urgent",
    status: "completed",
    customerName: "Prime Bank Ltd. (Banani Branch)",
    customerId: "cust-1",
    siteName: "Banani Branch (Ground & 1st Floor)",
    siteAddress: "House 12, Road 11, Block D, Banani",
    siteLandmark: "Opposite to Star Kabab Banani",
    customerPhone: "01713-112233",
    equipmentTitle: "Gree 2.0 Ton Split (PB-AC-03)",
    refrigerant: "R32",
    scheduledDate: "Yesterday",
    scheduledTime: "04:00 PM – 05:30 PM",
    technicianName: "Rahim Uddin",
    technicianId: "tech-3",
    technicianPhone: "01912-345678",
    estimatedDuration: "1h 30m",
    checklistsCompleted: 4,
    checklistsTotal: 4,
    photosUploaded: 3,
  },
  {
    id: "job-5",
    jobNumber: "FO-JOB-1005",
    title: "Cold Room Chiller Defrost Cycle Malfunction",
    description: "Chiller evaporator coil icing up. Inspect defrost timer, bimetal thermostat, and drain heater.",
    jobType: "repair",
    jobTypeLabel: "Cold Storage Service",
    priority: "high",
    status: "scheduled",
    customerName: "Star Kabab & Restaurant",
    customerId: "cust-2",
    siteName: "Dhanmondi Outlet",
    siteAddress: "House 45, Road 27 (Old), Dhanmondi",
    siteLandmark: "Beside Rangs Plaza & Medinova",
    customerPhone: "01819-223344",
    equipmentTitle: "Carrier 3.5 HP Cold Room Chiller (SK-CH-01)",
    refrigerant: "R404A",
    scheduledDate: "Tomorrow",
    scheduledTime: "09:30 AM – 12:00 PM",
    technicianName: "Rahim Uddin",
    technicianId: "tech-3",
    technicianPhone: "01912-345678",
    estimatedDuration: "2h 30m",
    checklistsCompleted: 0,
    checklistsTotal: 5,
    photosUploaded: 0,
  },
];

export const DEMO_QUOTES: DemoQuote[] = [
  {
    id: "qte-1",
    quoteNumber: "FO-QTE-1001",
    customerName: "Prime Bank Ltd. (Banani Branch)",
    jobTitle: "R410A Refrigerant Top-up & 45uF Capacitor Replacement",
    date: "10 Oct 2026",
    validUntil: "24 Oct 2026",
    subtotal: 18500,
    discount: 500,
    vat: 0,
    total: 18000,
    status: "accepted",
  },
  {
    id: "qte-2",
    quoteNumber: "FO-QTE-1002",
    customerName: "Shanta Western Tower Management",
    jobTitle: "Daikin VRF Inverter PCB Module Replacement",
    date: "11 Oct 2026",
    validUntil: "25 Oct 2026",
    subtotal: 85000,
    discount: 2500,
    vat: 0,
    total: 82500,
    status: "sent",
  },
  {
    id: "qte-3",
    quoteNumber: "FO-QTE-1003",
    customerName: "Apex Footwear Outlet",
    jobTitle: "4x 2.5 Ton Standing AC Master Overhaul & Coil Wash",
    date: "08 Oct 2026",
    validUntil: "22 Oct 2026",
    subtotal: 24000,
    discount: 1000,
    vat: 0,
    total: 23000,
    status: "draft",
  },
];

export const DEMO_INVOICES: DemoInvoice[] = [
  {
    id: "inv-1",
    invoiceNumber: "FO-INV-1001",
    customerName: "Prime Bank Ltd. (Banani Branch)",
    date: "08 Oct 2026",
    dueDate: "22 Oct 2026",
    totalAmount: 45000,
    paidAmount: 30000,
    balanceDue: 15000,
    status: "partially_paid",
    paymentMethod: "bKash Merchant",
    transactionRef: "9J72KLA98P",
  },
  {
    id: "inv-2",
    invoiceNumber: "FO-INV-1002",
    customerName: "Star Kabab & Restaurant",
    date: "05 Oct 2026",
    dueDate: "05 Oct 2026",
    totalAmount: 18500,
    paidAmount: 18500,
    balanceDue: 0,
    status: "paid",
    paymentMethod: "Cash on Site",
    transactionRef: "CSH-REC-482",
  },
  {
    id: "inv-3",
    invoiceNumber: "FO-INV-1003",
    customerName: "Shanta Western Tower Management",
    date: "01 Oct 2026",
    dueDate: "15 Oct 2026",
    totalAmount: 92000,
    paidAmount: 0,
    balanceDue: 92000,
    status: "issued",
  },
  {
    id: "inv-4",
    invoiceNumber: "FO-INV-0988",
    customerName: "Lakeview Luxury Apartments",
    date: "15 Sep 2026",
    dueDate: "30 Sep 2026",
    totalAmount: 12000,
    paidAmount: 0,
    balanceDue: 12000,
    status: "overdue",
  },
];

export const DEMO_CONTRACTS: DemoContract[] = [
  {
    id: "amc-1",
    contractNumber: "FO-AMC-1001",
    title: "Annual Comprehensive AC Maintenance — 14 Units",
    customerName: "Prime Bank Ltd. (Banani Branch)",
    contractType: "Comprehensive",
    coveredUnitsCount: 14,
    interval: "Quarterly",
    annualValue: 180000,
    startDate: "01 Jan 2026",
    endDate: "31 Dec 2026",
    nextScheduledVisit: "18 Oct 2026",
    status: "active",
  },
  {
    id: "amc-2",
    contractNumber: "FO-AMC-1002",
    title: "Kitchen Chillers & Dining AC Routine Servicing",
    customerName: "Star Kabab & Restaurant",
    contractType: "Non-Comprehensive",
    coveredUnitsCount: 8,
    interval: "Monthly",
    annualValue: 144000,
    startDate: "01 Jun 2026",
    endDate: "31 May 2027",
    nextScheduledVisit: "22 Oct 2026",
    status: "active",
  },
  {
    id: "amc-3",
    contractNumber: "FO-AMC-1003",
    title: "Corporate Tower HVAC & VRF Master Contract",
    customerName: "Shanta Western Tower Management",
    contractType: "Comprehensive",
    coveredUnitsCount: 32,
    interval: "Bi-Monthly",
    annualValue: 450000,
    startDate: "01 Nov 2025",
    endDate: "31 Oct 2026",
    nextScheduledVisit: "28 Oct 2026",
    status: "renewal_due",
  },
];
