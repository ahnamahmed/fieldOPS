export type ChecklistResult = "pass" | "fail" | "na" | "pending";

export interface TechChecklistItem {
  id: string;
  itemKey: string;
  label: string;
  fieldType: "boolean" | "number" | "text";
  unit: string | null;
  category: "cooling" | "electrical" | "cleaning" | "general" | string;
  isMandatory: boolean;
  result: ChecklistResult;
  valueNumber: number | null;
  valueBoolean: boolean | null;
  valueText: string | null;
  notes: string | null;
  recordedAt: string | null;
}

export interface TechPartItem {
  id: string;
  partName: string;
  quantity: number;
  unitOfMeasure: string;
  notes: string | null;
  unitPrice?: number;
  createdAt: string;
}

export interface TechPhotoAttachment {
  id: string;
  fileName: string;
  filePath: string;
  fileSizeBytes: number;
  mimeType: string;
  attachmentType: "before" | "after" | "evidence" | string;
  caption: string | null;
  signedUrl?: string;
  createdAt: string;
}

export interface TechJobSummary {
  id: string;
  jobNumber: string;
  title: string;
  description: string | null;
  jobType: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "new" | "quoted" | "scheduled" | "in_progress" | "on_hold" | "completed" | "cancelled";
  scheduledStart: string | null;
  scheduledEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  customerId: string;
  customerName: string;
  customerPhone: string;
  siteId: string;
  siteName: string;
  siteAddress: string;
  siteArea: string | null;
  siteCity: string | null;
  siteLandmark: string | null;
  assetId: string | null;
  assetBrand: string | null;
  assetModel: string | null;
  assetCapacity: string | null;
  totalChecklists: number;
  completedChecklists: number;
  createdAt: string;
}

export interface TechJobDetail extends TechJobSummary {
  alternatePhone: string | null;
  accessNotes: string | null;
  assignedNotes: string | null;
  equipmentServiceNotes: string | null;
  equipmentLocation: string | null;
  workPerformed: string | null;
  completionNotes: string | null;
  followUpRecommendation: string | null;
  completedAt: string | null;
  checklists: TechChecklistItem[];
  parts: TechPartItem[];
  photos: TechPhotoAttachment[];
}

export interface TechJobsGrouped {
  today: TechJobSummary[];
  upcoming: TechJobSummary[];
  completed: TechJobSummary[];
}
