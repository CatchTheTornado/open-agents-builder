import { z } from 'zod';
import { getCurrentTS } from "@/lib/utils";
import { use } from 'react';

export type DTOEncryptionSettings = {
  encryptedFields: string[]
}

export const configDTOSchema = z.object({
  key: z.string().min(1),
  value: z.string().nullable(),
  updatedAt: z.string().default(() => getCurrentTS()),
});

export const ConfigDTOEncSettings: DTOEncryptionSettings =  { encryptedFields: ['value'] }
export type ConfigDTO = z.infer<typeof configDTOSchema>;

export const keyDTOSchema = z.object({
  displayName: z.string().min(1),
  keyLocatorHash: z.string().min(64).max(64),
  keyHash: z.string().min(32),
  keyHashParams: z.string().min(1),
  databaseIdHash: z.string().min(64).max(64),
  encryptedMasterKey: z.string().min(1),
  acl: z.string().nullable().optional(),
  extra: z.string().nullable().optional(),
  expiryDate: z.string().nullable(),
  updatedAt: z.string().default(() => getCurrentTS()),
});

export const KeyDTOEncSettings: DTOEncryptionSettings =  { encryptedFields: [] }
export type KeyDTO = z.infer<typeof keyDTOSchema>;


export type AttachmentAssigmentDTO = {
  id: number;
  type: string;
}

export const attachmentDTOSchema = z.object({
  id: z.number().positive().optional(),
  displayName: z.string().optional().nullable(),
  safeNameIdentifier: z.string().optional().nullable(),
  description: z.string().optional().nullable(),

  mimeType: z.string().optional().nullable(),
  type: z.string().optional().nullable(),
  json: z.string().optional().nullable(),
  extra: z.string().optional().nullable(),

  size: z.number().positive().int().nullable(),
  storageKey: z.string().min(1),
  filePath: z.string().optional(),

  content: z.string().optional().nullable(),

  createdAt: z.string().default(() => getCurrentTS()),
  updatedAt: z.string().default(() => getCurrentTS()),

  // bc. we're using end 2 end encryption on the database level even JSON fields must be represented as string
  assignedTo: z.string().optional().nullable()
});
export const AttachmentDTOEncSettings = { encryptedFields: ['displayName', 'description', 'mimeType', 'type', 'json', 'extra'] };
export type AttachmentDTO = z.infer<typeof attachmentDTOSchema>;

export const databaseCreateRequestSchema = z.object({
  email: z.string().email(),
  language: z.string().optional().nullable(),
  keyLocatorHash: z.string().min(64).max(64),
  keyHash: z.string().min(32),
  keyHashParams: z.string().min(1),
  databaseIdHash: z.string().min(1).min(64).max(64),
  encryptedMasterKey: z.string().min(1),
});
export type DatabaseCreateRequestDTO = z.infer<typeof databaseCreateRequestSchema>;

export const saasUserSchema = z.object({
  userId: z.string().min(1),
  email: z.string().email(),
  appUrl: z.string().min(1),
  activeApiKey: z.string().min(1)
});
export type SaaSUserDTO = z.infer<typeof saasUserSchema>;

export const databaseAuthorizeChallengeRequestSchema = z.object({
  keyLocatorHash: z.string().min(64).max(64),
  databaseIdHash: z.string().min(1).min(64).max(64),
});
export type DatabaseAuthorizeChallengeRequestDTO = z.infer<typeof databaseAuthorizeChallengeRequestSchema>;

export const databaseAuthorizeRequestSchema = z.object({
  keyLocatorHash: z.string().min(64).max(64),
  keyHash: z.string().min(32),
  databaseIdHash: z.string().min(1).min(64).max(64),
});
export type DatabaseAuthorizeRequestDTO = z.infer<typeof databaseAuthorizeRequestSchema>;

export const databaseRefreshRequestSchema = z.object({
  refreshToken: z.string().min(1),
});

export type DatabaseRefreshRequestDTO = z.infer<typeof databaseRefreshRequestSchema>;

export const keyHashParamsDTOSchema = z.object({
  salt: z.string(),
  time: z.number().positive().int(),
  mem: z.number().positive().int(),
  hashLen: z.number().positive().int(),
  parallelism: z.number().positive().int(),
});
export type KeyHashParamsDTO = z.infer<typeof keyHashParamsDTOSchema>;

export const keyACLSchema = z.object({
  role: z.string().min(1),
  features: z.array(z.string()).min(1),
});
export type KeyACLDTO = z.infer<typeof keyACLSchema>;
export const defaultKeyACL: KeyACLDTO = { role: 'guest', features: [] };

export const termsDTOSchema = z.object({
  id: z.number().positive().optional(),
  key: z.string().min(1).optional(),
  code: z.string().min(1),
  content: z.string().min(1),
  signature: z.string().optional(),
  ip: z.string().nullable().optional(),
  ua: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  signedAt: z.string().default(() => getCurrentTS()),
});
export type TermDTO = z.infer<typeof termsDTOSchema>;


export const saasDTOSchema = z.object({
  currentQuota: z.object({
    allowedAgents: z.number().int(),
    allowedResults: z.number().int(),
    allowedSessions: z.number().int(),
    allowedDatabases: z.number().int(),
    allowedUSDBudget: z.number().int(),
    allowedTokenBudget: z.number().int()
  }),
  currentUsage: z.object({
      usedAgents: z.number().int(),
      usedResults: z.number().int(),
      usedSessions: z.number().int(),
      usedDatabases: z.number().int(),
      usedUSDBudget: z.number().int(),
      usedTokenBudget: z.number().int()
  }),
  storageKey: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  emailVerified: z.string().nullable().optional(),
  userId: z.string().nullable().optional(),
  saasToken: z.string(),
});
export type SaaSDTO = z.infer<typeof saasDTOSchema>;

// Stats DTO's 
export const statsSchema = z.object({
  id: z.number().positive().int().optional(),
  eventName: z.string().min(1),
  promptTokens: z.number().positive().int(),
  completionTokens: z.number().positive().int(),
  finishReasons: z.string().nullable().optional(),
  createdAt: z.string().default(() => getCurrentTS()),
  createdMonth:  z.number().positive().int().nullable().optional(),
  createdDay:  z.number().positive().int().nullable().optional(),
  createdYear:  z.number().positive().int().nullable().optional(),
  createdHour:  z.number().positive().int().nullable().optional(),
  counter: z.number().positive().int().optional()
})
export type StatDTO = z.infer<typeof statsSchema>;

export const auditDTOSchema = z.object({
  id: z.number().positive().int().optional(),
  ip: z.string().optional(),
  ua: z.string().optional(),
  keyLocatorHash: z.string().optional(),
  databaseIdHash: z.string().optional(),
  recordLocator: z.string().optional(),
  diff: z.string().optional(),
  eventName: z.string().optional(),
  createdAt: z.string().default(() => getCurrentTS()).optional(),
});
export type AuditDTO = z.infer<typeof auditDTOSchema>;


export type AggregatedStatsDTO = {
  thisMonth: {
    overallTokens: number;
    promptTokens: number;
    completionTokens: number;
    overalUSD: number;
    requests: number;
  },
  lastMonth: {
    overallTokens: number;
    promptTokens: number;
    completionTokens: number;
    overalUSD: number;
    requests: number;
  },  
  today: {
    overallTokens: number;
    promptTokens: number;
    completionTokens: number;
    overalUSD: number;
    requests: number;
  },
}



export const agentDTOSchema = z.object({
  id: z.string().optional(),
  displayName: z.string().min(1),
  options: z.string().optional().nullable(),
  prompt: z.string().optional(),
  expectedResult: z.string().optional().nullable(),
  safetyRules: z.string().optional().nullable(),
  published: z.string().optional().nullable(),
  events: z.string().optional().nullable(),
  tools: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  locale: z.string().optional().nullable(),
  agentType: z.string().optional().nullable(),
  llmProvider: z.string().optional().nullable(),
  llmModel: z.string().optional().nullable(),
  createdAt: z.string().default(() => getCurrentTS()),
  updatedAt: z.string().default(() => getCurrentTS()),
  inputs: z.string().optional().nullable(),
  defaultFlow: z.string().optional().nullable(),
  flows: z.string().optional().nullable(),
  agents: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  extra: z.string().optional().nullable()
});
export type AgentDTO = z.infer<typeof agentDTOSchema>;
export const AgentDTOEncSettings: DTOEncryptionSettings = { encryptedFields: [] };

export const sessionDTOSchema = z.object({
  id: z.string().min(1),
  agentId: z.string().min(1),
  userName: z.string().optional().nullable(),
  userEmail: z.string().optional().nullable(),
  acceptTerms: z.string().optional().nullable(),
  messages: z.string().optional().nullable(),
  promptTokens: z.number().optional().nullable(),
  completionTokens: z.number().optional().nullable(),
  createdAt: z.string().default(() => getCurrentTS()),
  updatedAt: z.string().default(() => getCurrentTS()),
  finalizedAt: z.string().optional().nullable(),
});
export type SessionDTO = z.infer<typeof sessionDTOSchema>;
export const SessionDTOEncSettings: DTOEncryptionSettings = { encryptedFields: [] };


export const resultDTOSchema = z.object({
  agentId: z.string().min(1),
  sessionId: z.string().min(1),
  userName: z.string().optional().nullable(),
  userEmail: z.string().optional().nullable(),
  content: z.string().optional().nullable(),
  format: z.string().optional().nullable(),
  createdAt: z.string().default(() => getCurrentTS()),
  updatedAt: z.string().default(() => getCurrentTS()),
  finalizedAt: z.string().optional().nullable(),
});
export type ResultDTO = z.infer<typeof resultDTOSchema>;
export const ResultDTOEncSettings: DTOEncryptionSettings = { encryptedFields: [] };

export const calendarEventDTOSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  agentId: z.string().min(1),
  description: z.string().optional().nullable(),
  exclusive: z.string().optional().nullable(),
  start: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  end: z.string().optional().nullable(),
  allDay: z.boolean().optional().nullable(),
  sessionId: z.string().optional().nullable(), // Added sessionId as an optional field
  createdAt: z.string().default(() => getCurrentTS()),
  participants: z.string().optional().nullable(),
  updatedAt: z.string().default(() => getCurrentTS()),
});
export type CalendarEventDTO = z.infer<typeof calendarEventDTOSchema>;
export const CalendarEventDTOEncSettings: DTOEncryptionSettings = { encryptedFields: [] };

const productAttributeSchema = z.object({
  name: z.string(),
  type: z.enum(["text", "select"]).default("text"),
  values: z.array(z.string()).optional(), //  ["Red","Blue"]
  defaultValue: z.string().optional(),
});


// Price object => { value: number, currency: string }
export const priceSchema = z.object({
  value: z.number().min(0),
  currency: z.string(),
});

const productVariantSchema = z.object({
  id: z.string().optional(),    
  sku: z.string().min(1),
  name: z.string().optional(),
  status: z.string().optional(), 
  
  price: priceSchema.optional(),
  priceInclTax: priceSchema.optional(),
  taxRate: z.number().min(0).max(1).optional(),  // np. 0.23
  taxValue: z.number().min(0).optional(),

  width: z.number().min(0).optional(),
  height: z.number().min(0).optional(),
  length: z.number().min(0).optional(),
  weight: z.number().min(0).optional(),

  widthUnit: z.string().optional(),
  heightUnit: z.string().optional(),
  lengthUnit: z.string().optional(),
  weightUnit: z.string().optional(),
  
  brand: z.string().optional(),
});

const productImageSchema = z.object({
  storageKey: z.string().optional(),
  url: z.string().url(),
  alt: z.string().optional(),
  id: z.string().optional(),
  fileName: z.string().optional(),
  mimeType: z.string().optional()
});

export enum StorageSchemas  {
  Commerce = "commerce",
  VectorStore = "vector-store",
  Default = ""
}

export const productDTOSchema = z.object({
  id: z.string().optional(),
  agentId: z.string().optional().nullable(),

  sku: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional().nullable(),

  // Zamiast net/gross => price, priceInclTax
  price: priceSchema.optional(),
  priceInclTax: priceSchema.optional(),

  taxRate: z.number().min(0).max(1).optional(),
  taxValue: z.number().min(0).optional(),

  width: z.number().min(0).optional(),
  height: z.number().min(0).optional(),
  length: z.number().min(0).optional(),
  weight: z.number().min(0).optional(),

  widthUnit: z.string().optional(),
  heightUnit: z.string().optional(),
  lengthUnit: z.string().optional(),
  weightUnit: z.string().optional(),

  brand: z.string().optional(),
  status: z.string().optional(),

  imageUrl: z.string().url().optional().nullable(),

  // atrybuty – tablica obiektów
  attributes: z.array(productAttributeSchema).optional(),

  // warianty
  variants: z.array(productVariantSchema).optional(),

  // zdjęcia – tablica w stylu Attachment
  images: z.array(productImageSchema).optional(),

  // tagi
  tags: z.array(z.string()).optional(),

  createdAt: z.string().default(() => getCurrentTS()),
  updatedAt: z.string().default(() => getCurrentTS()),
});

export type ProductDTO = z.infer<typeof productDTOSchema>;
export const ProductDTOEncSettings = {
  encryptedFields: [
  ],
};


// Address
const addressSchema = z.object({
  address1: z.string().optional(),
  address2: z.string().optional(),
  city: z.string().optional(),
  company: z.string().optional(),
  country: z.any().optional(),
  countryCode: z.string().optional(),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  name: z.string().optional(),
  phone: z.string().optional(),
  province: z.string().optional(),
  provinceCode: z.string().optional(),
  street: z.string().optional(),
  summary: z.string().optional(),
  postalCode: z.string().optional(),
});

// Note
const noteSchema = z.object({
  date: z.string(),
  message: z.string(),
  author: z.string().optional(),
});

// Status change
const statusChangeSchema = z.object({
  date: z.string(),
  message: z.string(),
  oldStatus: z.string().optional(),
  newStatus: z.string(),
});

// Customer
const customerSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  email: z.string().optional(),
});

// A single item in the order
const orderItemSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  productSku: z.string().optional(),
  variantSku: z.string().optional(),
  productId: z.string().optional(),
  variantId: z.string().optional(),

  variantName: z.string().optional(),
  message: z.string().optional(),
  customOptions: z.array(z.object({ name: z.string(), value: z.string() })).optional(),

  originalPrice: priceSchema.optional(),
  price: priceSchema, 
  priceInclTax: priceSchema.optional(),
  taxValue: priceSchema.optional(),
  
  quantity: z.number().min(1),
  successfully_fulfilled_quantity: z.number().min(0).optional(),

  title: z.string().optional(),

  lineValue: priceSchema.optional(),
  lineValueInclTax: priceSchema.optional(),
  lineTaxValue: priceSchema.optional(),
  originalPriceInclTax: priceSchema.optional(),

  taxRate: z.number().min(0).max(1).optional(),

  variant: z.any().optional(),
});

export const orderDTOSchema = z.object({
  id: z.string().optional(),
  agentId: z.string().optional(),
  sessionId: z.string().optional(),

  billingAddress: addressSchema.optional(),
  shippingAddress: addressSchema.optional(),

  attributes: z.record(z.any()).optional(),
  notes: z.array(noteSchema).optional(),
  statusChanges: z.array(statusChangeSchema).optional(),
  status: z.enum([
    "shopping_cart",
    "quote",
    "new",
    "processing",
    "shipped",
    "completed",
    "cancelled",
  ]).default("shopping_cart"),
  email: z.string().email().optional(),
  customer: customerSchema.optional(),

  // Price fields => Price
  subtotal: priceSchema.optional(),
  subTotalInclTax: priceSchema.optional(),
  subtotalTaxValue: priceSchema.optional(),
  total: priceSchema.optional(),
  totalInclTax: priceSchema.optional(),
  shippingMethod: z.string().optional(),
  shippingPrice: priceSchema.optional(),
  shippingPriceInclTax: priceSchema.optional(),
  shippingPriceTaxRate: z.number().optional(),

  items: z.array(orderItemSchema).optional(),

  createdAt: z.string().default(() => getCurrentTS()),
  updatedAt: z.string().default(() => getCurrentTS()),
});

export type OrderDTO = z.infer<typeof orderDTOSchema>;
export const OrderDTOEncSettings = {
  encryptedFields: [
  ],
};





export type PaginatedResult<T> = {
  rows: T;
  total: number;
  limit: number;
  offset: number;
  orderBy: string;
  query: string;
}

export type PaginatedQuery = { limit: number, offset: number, orderBy: string, query: string}