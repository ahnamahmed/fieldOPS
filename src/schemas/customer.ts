import { z } from "zod";
import { isValidBDPhone } from "@/lib/formatters";

export const customerSchema = z.object({
  name: z.string().trim().min(2, "Customer or company name is required").optional(),
  companyName: z.string().trim().optional(),
  contactName: z.string().trim().optional(),
  customerType: z.enum(["residential", "commercial", "corporate"]).default("commercial"),
  phone: z
    .string()
    .trim()
    .refine((val) => isValidBDPhone(val), {
      message: "Please enter a valid Bangladesh mobile number (e.g. 01712345678 or +8801712345678)",
    }),
  alternatePhone: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || isValidBDPhone(val), {
      message: "Alternate phone must be a valid Bangladesh mobile number",
    })
    .or(z.literal("")),
  email: z.string().trim().email("Invalid email address").optional().or(z.literal("")),
  billingAddress: z.string().trim().optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
}).transform((data) => {
  const resolvedName = (data.name || data.companyName || data.contactName || "Customer").trim();
  return {
    ...data,
    name: resolvedName,
    companyName: data.companyName?.trim() || resolvedName,
    contactName: data.contactName?.trim() || resolvedName,
  };
});

export const serviceSiteSchema = z.object({
  customerId: z.string().uuid("Invalid customer ID"),
  siteName: z.string().trim().min(2, "Site name is required"),
  address: z.string().trim().min(3, "Address is required").optional(),
  addressLine1: z.string().trim().optional(),
  addressLine2: z.string().trim().optional(),
  area: z.string().trim().optional(), // Gulshan, Banani, Agrabad, Motijheel, etc.
  city: z.string().trim().default("Dhaka"),
  district: z.string().trim().default("Dhaka"),
  postcode: z.string().trim().optional(),
  postalCode: z.string().trim().optional(),
  landmark: z.string().trim().optional(),
  siteContactName: z.string().trim().optional(),
  siteContactPhone: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || isValidBDPhone(val), {
      message: "Site contact phone must be a valid Bangladesh number",
    })
    .or(z.literal("")),
  accessNotes: z.string().trim().optional(),
  accessInstructions: z.string().trim().optional(),
}).transform((data) => {
  const resolvedAddress = (data.address || data.addressLine1 || "").trim();
  const resolvedPostcode = (data.postcode || data.postalCode || "").trim();
  const resolvedAccessNotes = (data.accessNotes || data.accessInstructions || "").trim();
  return {
    ...data,
    address: resolvedAddress,
    addressLine1: resolvedAddress,
    postcode: resolvedPostcode || null,
    postalCode: resolvedPostcode || null,
    accessNotes: resolvedAccessNotes || null,
    accessInstructions: resolvedAccessNotes || null,
  };
});

export const equipmentAssetSchema = z.object({
  customerId: z.string().uuid("Invalid customer ID"),
  siteId: z.string().uuid("Invalid site ID").optional(),
  serviceSiteId: z.string().uuid("Invalid site ID").optional(),
  assetTag: z.string().trim().optional(),
  equipmentType: z.enum([
    "split_ac",
    "cassette_ac",
    "standing_ac",
    "vrf_system",
    "chiller",
    "cold_room",
    "refrigerator",
    "deep_freezer",
    "other",
  ]).default("split_ac"),
  brand: z.string().trim().min(1, "Brand name is required"),
  model: z.string().trim().optional(),
  modelNumber: z.string().trim().optional(),
  serialNumber: z.string().trim().optional(),
  capacity: z.string().trim().optional(), // e.g. "1.5 Ton", "2.0 Ton", "5.0 Ton"
  refrigerantType: z
    .enum(["R22", "R32", "R410A", "R134a", "R404A", "R290", "other"])
    .optional()
    .nullable(),
  locationDescription: z.string().trim().optional(),
  locationInFacility: z.string().trim().optional(),
  installationDate: z.string().optional().nullable(),
  warrantyExpiry: z.string().optional().nullable(),
  conditionStatus: z
    .enum(["operational", "needs_service", "under_repair", "decommissioned"])
    .default("operational"),
  serviceNotes: z.string().trim().optional(),
  notes: z.string().trim().optional(),
})
.refine((data) => Boolean(data.serviceSiteId || data.siteId), {
  message: "Service site ID is required",
  path: ["siteId"],
})
.transform((data) => {
  const resolvedSiteId = (data.serviceSiteId || data.siteId)!;
  const resolvedModel = (data.model || data.modelNumber || "").trim();
  const resolvedLocation = (data.locationDescription || data.locationInFacility || "").trim();
  const resolvedNotes = (data.serviceNotes || data.notes || "").trim();

  return {
    ...data,
    siteId: resolvedSiteId,
    serviceSiteId: resolvedSiteId,
    model: resolvedModel || null,
    modelNumber: resolvedModel || null,
    locationDescription: resolvedLocation || null,
    locationInFacility: resolvedLocation || null,
    serviceNotes: resolvedNotes || null,
    notes: resolvedNotes || null,
  };
});

export type CustomerInput = z.input<typeof customerSchema>;
export type CustomerOutput = z.output<typeof customerSchema>;

export type ServiceSiteInput = z.input<typeof serviceSiteSchema>;
export type ServiceSiteOutput = z.output<typeof serviceSiteSchema>;

export type EquipmentAssetInput = z.input<typeof equipmentAssetSchema>;
export type EquipmentAssetOutput = z.output<typeof equipmentAssetSchema>;
