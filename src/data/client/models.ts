import { AttachmentDTO, KeyACLDTO, KeyDTO, TermDTO, AgentDTO, SessionDTO, ResultDTO, CalendarEventDTO, ProductDTO, OrderDTO } from "@/data/dto";

import PasswordValidator from 'password-validator';
import { createPrice, getCurrentTS, safeJsonParse } from "@/lib/utils";
import { Message } from "ai";
import moment from "moment";
import { AgentDefinition, FlowInputVariable, EditorStep } from "@/flows/models";


export enum DataLoadingStatus {
    Idle = 'idle',
    Loading = 'loading',
    Success = 'success',
    Error = 'error',
}

export enum DatabaseAuthStatus {
    Empty = 'Empty',
    NotAuthorized = 'NotAuthorized',
    AuthorizationError = 'AuthorizationError',
    Authorized = 'Success',
    InProgress = 'InProgress'
}

export type AttachmentExtra = {
    status: string;
    error: string;
}

export type AttachmentAssigment = {
    id: string;
    type: string;
}

export type DisplayableDataObject = {
    contentType?: string;
    url: string;
    name: string;
}

export class Attachment {
    id?: number;
    assignedTo?: AttachmentAssigment[];
    displayName: string;
    safeNameIdentifier?: string;
    description?: string;
    mimeType?: string;
    type?: string;
    json?: string;
    extra?: AttachmentExtra;
    size: number;
    storageKey: string;
    filePath?: string;
    createdAt: string;
    updatedAt: string;

    content: string;

    constructor(attachmentDTO: AttachmentDTO | Attachment) {
        this.id = attachmentDTO.id;
        this.safeNameIdentifier = attachmentDTO.safeNameIdentifier ?? '';
        this.assignedTo = attachmentDTO.assignedTo ? (typeof attachmentDTO.assignedTo == 'string' ? JSON.parse(attachmentDTO.assignedTo) : attachmentDTO.assignedTo) : [];
        this.extra = attachmentDTO.extra ? (typeof attachmentDTO.extra == 'string' ? JSON.parse(attachmentDTO.extra) : attachmentDTO.extra) : [];
        this.description = attachmentDTO.description ? attachmentDTO.description : '';
        this.mimeType = attachmentDTO.mimeType ? attachmentDTO.mimeType : '';
        this.type = attachmentDTO.type ? attachmentDTO.type : '';
        this.json = attachmentDTO.json ? attachmentDTO.json : '';
        this.size = attachmentDTO.size ?? 0;
        this.storageKey = attachmentDTO.storageKey;
        this.displayName = attachmentDTO.displayName ?? this.storageKey;
        this.filePath = attachmentDTO.filePath ? attachmentDTO.filePath : '';
        this.createdAt = attachmentDTO.createdAt;
        this.updatedAt = attachmentDTO.updatedAt;
        this.content = attachmentDTO.content ? attachmentDTO.content : '';
    }

    static fromDTO(fileDTO: AttachmentDTO | Attachment): Attachment {
        return new Attachment(fileDTO);
    }

    toDTO(): AttachmentDTO {
        return {
            id: this.id,
            assignedTo: JSON.stringify(this.assignedTo),
            safeNameIdentifier: this.safeNameIdentifier,
            displayName: this.displayName,
            description: this.description,
            mimeType: this.mimeType,
            type: this.type,
            json: this.json,
            extra: JSON.stringify(this.extra),
            size: this.size,
            storageKey: this.storageKey,
            filePath: this.filePath,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            content: this.content,
        };
    }
}

export class KeyACL {
    role: string;
    features: string[];
    constructor(keyACLDTO: KeyACLDTO) {
        this.role = keyACLDTO.role;
        this.features = keyACLDTO.features;
    }

    static fromDTO(keyACLDTO: KeyACLDTO): KeyACL {
        return new KeyACL(keyACLDTO);
    }

    toDTO(): KeyACLDTO {
        return {
            role: this.role,
            features: this.features,
        };
    }

}

export enum KeyType {
    User = 'user',
    API = 'api'
}

export type KeyExtra = {
    type: KeyType;
}

export class Key {
    displayName: string;
    keyLocatorHash: string;
    keyHash: string;
    keyHashParams: string;
    databaseIdHash: string;
    encryptedMasterKey: string;
    acl: KeyACL | null;
    extra: KeyExtra | null;
    expiryDate: string | null;
    updatedAt: string;

    constructor(keyDTO: KeyDTO | Key) {
        this.displayName = keyDTO.displayName;
        this.keyLocatorHash = keyDTO.keyLocatorHash;
        this.keyHash = keyDTO.keyHash;
        this.keyHashParams = keyDTO.keyHashParams;
        this.databaseIdHash = keyDTO.databaseIdHash;
        this.encryptedMasterKey = keyDTO.encryptedMasterKey;
        this.acl = keyDTO instanceof Key ? keyDTO.acl : (keyDTO.acl ? JSON.parse(keyDTO.acl) : null);
        this.extra = keyDTO instanceof Key ? keyDTO.extra : (keyDTO.extra ? JSON.parse(keyDTO.extra) : null);
        this.expiryDate = keyDTO.expiryDate ?? null;
        this.updatedAt = keyDTO.updatedAt ?? getCurrentTS();
    }

    static fromDTO(keyDTO: KeyDTO): Key {
        return new Key(keyDTO);
    }

    toDTO(): KeyDTO {
        return {
            displayName: this.displayName,
            keyLocatorHash: this.keyLocatorHash,
            keyHash: this.keyHash,
            keyHashParams: this.keyHashParams,
            databaseIdHash: this.databaseIdHash,
            encryptedMasterKey: this.encryptedMasterKey,
            acl: JSON.stringify(this.acl),
            extra: JSON.stringify(this.extra),
            expiryDate: this.expiryDate,
            updatedAt: this.updatedAt,
        };
    }
}

export class Term {
    id?: number;
    content: string;
    key: string;
    signature: string;
    ip?: string;
    ua?: string;
    name?: string;
    email?: string;
    signedAt: string;
    code: string;

    constructor(termDTO: TermDTO | Term) {
        this.id = termDTO.id;
        this.key = termDTO.key;
        this.content = termDTO.content;
        this.signature = termDTO.signature;
        this.ip = termDTO.ip ?? '';
        this.ua = termDTO.ua ?? '';
        this.name = termDTO.name ?? '';
        this.code = termDTO.code;
        this.email = termDTO.email ?? '';
        this.signedAt = termDTO.signedAt;
    }

    static fromDTO(termDTO: TermDTO): Term {
        return new Term(termDTO);
    }

    toDTO(): TermDTO {
        return {
            id: this.id,
            key: this.key,
            code: this.code,
            content: this.content,
            signature: this.signature,
            ip: this.ip,
            ua: this.ua,
            name: this.name,
            email: this.email,
            signedAt: this.signedAt,
        };
    }

}

export type AgentOptions = {
    ogDescription: string,
    ogTitle: string,
    welcomeMessage: string;
    termsAndConditions: string;
    mustConfirmTerms: boolean;
    resultEmail: string;
    collectUserEmail: boolean;
    collectUserName: boolean;
}

export enum AgentStatus {
    Active = 'active',
    Deleted = 'deleted',
}

export type AgentFlow = {
    name: string;
    description: string;
    code: string;
    flow: EditorStep;
    inputs: FlowInputVariable[] | null;
}

export class Agent {
    id?: string;
    displayName: string;
    options?: AgentOptions | null;
    prompt?: string;
    expectedResult?: string;
    safetyRules?: string;
    published?: boolean;
    events?: Record<string, EventConfiguration>;
    tools?: Record<string, ToolConfiguration>;
    locale: string;
    agentType?: string | null;
    llmProvider?: string | null;
    llmModel?: string | null;
    status: AgentStatus;
    createdAt: string;
    updatedAt: string;
    icon?: string | null;
    extra?: any | null;
    flows?: AgentFlow[] | null;
    defaultFlow?: string | null;
    agents?: AgentDefinition[] | null;


    constructor(agentDTO: AgentDTO | Agent) {
        this.id = agentDTO.id;
        this.displayName = agentDTO.displayName;
        this.published = typeof agentDTO.published === 'string' ? safeJsonParse(agentDTO.published, false) : agentDTO.published;
        this.options = typeof agentDTO.options === 'string' ? JSON.parse(agentDTO.options as string) : agentDTO.options;

        this.prompt = agentDTO.prompt;
        this.expectedResult = agentDTO.expectedResult ?? undefined;
        this.safetyRules = agentDTO.safetyRules ?? undefined;
        this.events = typeof agentDTO.events === 'string' ? JSON.parse(agentDTO.events as string) : agentDTO.events;
        this.tools = typeof agentDTO.tools === 'string' ? JSON.parse(agentDTO.tools as string) : agentDTO.tools;


        this.createdAt = agentDTO.createdAt;
        this.updatedAt = agentDTO.updatedAt;

        this.locale = agentDTO.locale || 'en';
        this.agentType = agentDTO.agentType;
        this.llmProvider = agentDTO.llmProvider;
        this.llmModel = agentDTO.llmModel;
        this.status = agentDTO.status === 'deleted' ? AgentStatus.Deleted : AgentStatus.Active;

        this.icon = agentDTO.icon;
        this.extra = typeof agentDTO.extra === 'string' ? JSON.parse(agentDTO.extra as string) : agentDTO.extra;

        this.agents = typeof agentDTO.agents === 'string' ? JSON.parse(agentDTO.agents as string) : agentDTO.agents;
        this.flows = typeof agentDTO.flows === 'string' ? JSON.parse(agentDTO.flows as string) : agentDTO.flows;
        this.defaultFlow = agentDTO.defaultFlow;
    }

    static fromDTO(agentDTO: AgentDTO): Agent {
        return new Agent(agentDTO);
    }

    toDTO(): AgentDTO {
        return {
            id: this.id,
            displayName: this.displayName,
            options: JSON.stringify(this.options),
            prompt: this.prompt,
            expectedResult: this.expectedResult,
            safetyRules: this.safetyRules,
            published: JSON.stringify(this.published),
            events: JSON.stringify(this.events),
            tools: JSON.stringify(this.tools),
            locale: this.locale,
            agentType: this.agentType,
            llmProvider: this.llmProvider,
            llmModel: this.llmModel,
            status: this.status,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            icon: this.icon,
            extra: JSON.stringify(this.extra),
            flows: JSON.stringify(this.flows),
            agents: JSON.stringify(this.agents)
        };
    }


    toForm(setValue: ((field: string, value: any) => void) | null = null): Record<string, any> {
        const map: Record<string, any> = {
            id: this?.id || '',
            displayName: this?.displayName || '',
            prompt: this?.prompt || '',
            expectedResult: this?.expectedResult || '',
            safetyRules: this?.safetyRules || '',
            published: this?.published || false,
            ogTitle: this?.options?.ogTitle || '',
            ogDescription: this?.options?.ogDescription || '',
            welcomeInfo: this?.options?.welcomeMessage || '',
            termsConditions: this?.options?.termsAndConditions || '',
            confirmTerms: this?.options?.mustConfirmTerms || false,
            resultEmail: this?.options?.resultEmail || '',
            collectUserInfo: this?.options?.collectUserEmail,
            agentType: this?.agentType,
            llmProvider: this?.llmProvider,
            llmModel: this?.llmModel,
            status: this?.status || AgentStatus.Active,
            locale: this?.locale || 'en',
            events: this?.events || {},
            tools: this?.tools || {},
            agents: this?.agents || [],
            flows: this?.flows || [],
            defaultFlow: this?.defaultFlow || '',
            icon: this?.icon || '',
        };
        if (setValue !== null) {
            Object.keys(map).forEach((key) => {
                setValue(key, map[key]);
            });
        }

        return map;
    }

    static fromForm(data: Record<string, any>, agent?: Agent | null): Agent {
        return new Agent({
            ...agent,
            id: data.id ?? agent?.id,
            displayName: data.displayName ?? agent?.displayName,
            expectedResult: data.expectedResult ?? agent?.expectedResult,
            safetyRules: data.safetyRules ?? agent?.safetyRules,
            published: data.published ?? agent?.published,
            prompt: data.prompt ?? agent?.prompt,
            createdAt: agent?.createdAt || getCurrentTS(),
            updatedAt: getCurrentTS(),
            locale: data.locale ?? agent?.locale,
            agentType: data.agentType ?? agent?.agentType,
            llmProvider: data.llmProvider ?? agent?.llmProvider,
            llmModel: data.llmModel ?? agent?.llmModel,
            status: data.status ?? agent?.status,
            events: data.events ?? agent?.events,
            agents: data.agents ?? agent?.agents,
            flows: data.flows ?? agent?.flows,
            defaultFlow: data.defaultFlow ?? agent?.defaultFlow,
            tools: data.tools ?? agent?.tools,
            icon: data.icon ?? agent?.icon,
            options: {
                ...agent?.options,
                ogDescription: data.ogDescription ?? agent?.options?.ogDescription,
                ogTitle: data.ogTitle ?? agent?.options?.ogTitle,
                welcomeMessage: data.welcomeInfo ?? agent?.options?.welcomeMessage,
                termsAndConditions: data.termsConditions ?? agent?.options?.termsAndConditions,
                mustConfirmTerms: data.confirmTerms ?? agent?.options?.mustConfirmTerms,
                resultEmail: data.resultEmail ?? agent?.options?.resultEmail,
                collectUserEmail: data.collectUserInfo ?? agent?.options?.collectUserEmail,
                collectUserName: data.collectUserInfo ?? agent?.options?.collectUserName
            },
        } as Agent);
    }
}

export type SessionUserInfo = {
    name: string;
    email: string;
}

export class Session {
    id: string;
    agentId: string;
    userName?: string | null;
    userEmail?: string | null;
    acceptTerms?: boolean | null;
    messages?: [Message] | null;
    completionTokens?: number | null;
    promptTokens?: number | null;
    createdAt: string;
    updatedAt: string;
    finalizedAt?: string | null;

    constructor(sessionDTO: SessionDTO | Session) {
        this.id = sessionDTO.id;
        this.agentId = sessionDTO.agentId;
        this.userName = sessionDTO.userName ?? null;
        this.userEmail = sessionDTO.userEmail ?? null;
        try {
            this.messages = sessionDTO instanceof Session ? sessionDTO.messages : (sessionDTO.messages ? JSON.parse(sessionDTO.messages) : null);
        } catch (e) {
            this.messages = null
        }
        this.completionTokens = sessionDTO.completionTokens;
        this.promptTokens = sessionDTO.promptTokens;
        this.acceptTerms = !!(sessionDTO.acceptTerms ?? null);
        this.createdAt = sessionDTO.createdAt;
        this.updatedAt = sessionDTO.updatedAt;
        this.finalizedAt = sessionDTO.finalizedAt ?? null;
    }

    static fromDTO(sessionDTO: SessionDTO): Session {
        return new Session(sessionDTO);
    }

    toDTO(): SessionDTO {
        return {
            id: this.id,
            agentId: this.agentId,
            userEmail: this.userEmail,
            userName: this.userName,
            messages: JSON.stringify(this.messages),
            promptTokens: this.promptTokens,
            completionTokens: this.completionTokens,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            finalizedAt: this.finalizedAt,
        };
    }
}


export class Result {
    agentId: string;
    sessionId: string;
    userName?: string | null;
    userEmail?: string | null;
    content?: string | null;
    format?: string | null;
    createdAt: string;
    updatedAt: string;
    finalizedAt?: string | null;

    constructor(resultDTO: ResultDTO) {
        this.agentId = resultDTO.agentId;
        this.sessionId = resultDTO.sessionId;
        this.userName = resultDTO.userName ?? null;
        this.userEmail = resultDTO.userEmail ?? null;
        this.content = resultDTO.content;
        this.format = resultDTO.format;
        this.createdAt = resultDTO.createdAt;
        this.updatedAt = resultDTO.updatedAt;
        this.finalizedAt = resultDTO.finalizedAt ?? null;
    }

    static fromDTO(resultDTO: ResultDTO): Result {
        return new Result(resultDTO);
    }

    toDTO(): ResultDTO {
        return {
            sessionId: this.sessionId,
            agentId: this.agentId,
            userName: this.userName,
            userEmail: this.userEmail,
            content: this.content,
            format: this.format,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            finalizedAt: this.finalizedAt,
        };
    }
}


export class DatabaseCreateRequest {
    email: string;
    key: string;
    language: string;

    constructor(email: string, key: string, language: string) {
        this.email = email;
        this.key = key;
        this.language = language;
    }
}


export class DatabaseKeepLoggedInRequest {
    encryptedDatabaseId: string;
    encryptedKey: string;
    keepLoggedIn: boolean;

    constructor(encryptedDatabaseId: string, encryptedKey: string, keepLoggedIn: boolean) {
        this.encryptedDatabaseId = encryptedDatabaseId;
        this.encryptedKey = encryptedKey;;
        this.keepLoggedIn = keepLoggedIn;
    }
}

export class DatabaseAuthorizeRequest {
    email: string;
    key: string;
    keepLoggedIn: boolean;

    constructor(email: string, key: string, keepLoggedIn: boolean) {
        this.email = email;
        this.key = key;
        this.keepLoggedIn = keepLoggedIn;
    }
}


export type ToolConfiguration = {
    tool: string;                // e.g. "sendEmail" or "currentDate"
    description: string;         // e.g. "contact support" or "get the current date"
    options: Record<string, any> // tool-specific options
};

export type EventConfiguration = {
    condition: string;
    action: string;
};


export interface Participant {
    name: string
    email: string
}

export class CalendarEvent {
    id: string
    agentId: string
    title: string
    start?: Date | null
    end?: Date | null
    exclusive?: boolean | null
    description?: string | null
    location?: string | null
    participants?: Participant[] | null
    sessionId?: string | null // Added sessionId as optional
    updatedAt: string
    createdAt: string

    constructor(eventDTO: CalendarEventDTO | CalendarEvent) {
        this.id = eventDTO.id;
        this.agentId = eventDTO.agentId;
        this.title = eventDTO.title;
        this.start = eventDTO.start ? moment(eventDTO.start).toDate() : null;
        this.end = eventDTO.end ? moment(eventDTO.end).toDate() : null;
        this.exclusive = typeof eventDTO.exclusive === 'string' ? JSON.parse(eventDTO.exclusive) : eventDTO.exclusive;
        this.description = eventDTO.description;
        this.location = eventDTO.location;
        this.participants = typeof eventDTO.participants === 'string' ? JSON.parse(eventDTO.participants) : eventDTO.participants;
        this.sessionId = eventDTO.sessionId ?? null; // Initialize optional sessionId
        this.createdAt = eventDTO.createdAt;
        this.updatedAt = eventDTO.updatedAt;
    }

    static fromDTO(eventDTO: CalendarEventDTO): CalendarEvent {
        return new CalendarEvent(eventDTO);
    }

    toDTO(): CalendarEventDTO {
        return {
            id: this.id,
            agentId: this.agentId,
            title: this.title,
            start: this.start ? moment(this.start).toISOString(true) : null,
            end: this.end ? moment(this.end).toISOString(true) : null,
            exclusive: this.exclusive ? 'true' : 'false',
            description: this.description,
            location: this.location,
            participants: JSON.stringify(this.participants),
            sessionId: this.sessionId || undefined, // Ensure sessionId persists in DTO
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }
}


/// commerce module

// models.ts

export interface Price {
    value: number;
    currency: string;
}

export interface ProductAttribute {
    name: string;
    type: "text" | "select";
    values?: string[];
    defaultValue?: string;
}

export interface ProductVariant {
    id?: string;
    sku: string;
    name?: string;
    status?: string;

    price?: Price;
    priceInclTax?: Price;
    taxRate?: number;
    taxValue?: number;

    width?: number;
    height?: number;
    length?: number;
    weight?: number;

    widthUnit?: string;
    heightUnit?: string;
    lengthUnit?: string;
    weightUnit?: string;

    brand?: string;
}

export interface ProductImage {
    url: string;
    alt?: string;
    storageKey?: string;
    id?: string;
    mimeType?: string;
    fileName?: string;
}

export class Product {
    id?: string;
    agentId?: string | null;

    sku: string;
    name: string;
    description?: string;

    price?: Price;
    priceInclTax?: Price;

    taxRate?: number;
    taxValue?: number;

    width?: number;
    height?: number;
    length?: number;
    weight?: number;

    widthUnit?: string;
    heightUnit?: string;
    lengthUnit?: string;
    weightUnit?: string;

    brand?: string;
    status?: string;

    imageUrl?: string;

    attributes?: ProductAttribute[];
    variants?: ProductVariant[];
    images?: ProductImage[];
    tags?: string[];

    createdAt: string;
    updatedAt: string;

    constructor(dto: ProductDTO | Product) {
        this.id = dto.id;
        this.agentId = dto.agentId ?? null;

        this.sku = dto.sku;
        this.name = dto.name;
        this.description = dto.description ?? undefined;

        this.price = dto.price;
        this.priceInclTax = dto.priceInclTax;

        this.taxRate = dto.taxRate;
        this.taxValue = dto.taxValue;

        this.width = dto.width;
        this.height = dto.height;
        this.length = dto.length;
        this.weight = dto.weight;

        this.widthUnit = dto.widthUnit;
        this.heightUnit = dto.heightUnit;
        this.lengthUnit = dto.lengthUnit;
        this.weightUnit = dto.weightUnit;

        this.brand = dto.brand;
        this.status = dto.status;

        this.imageUrl = dto.imageUrl ?? undefined;

        this.attributes = dto.attributes ?? [];
        this.variants = dto.variants ?? [];
        this.images = dto.images ?? [];
        this.tags = dto.tags ?? [];

        this.createdAt = dto.createdAt;
        this.updatedAt = dto.updatedAt;
    }

    static fromDTO(dto: ProductDTO): Product {
        return new Product(dto);
    }

    toDTO(): ProductDTO {
        return {
            id: this.id,
            agentId: this.agentId,

            sku: this.sku,
            name: this.name,
            description: this.description,

            price: this.price,
            priceInclTax: this.priceInclTax,
            taxRate: this.taxRate,
            taxValue: this.taxValue,

            width: this.width,
            height: this.height,
            length: this.length,
            weight: this.weight,

            widthUnit: this.widthUnit,
            heightUnit: this.heightUnit,
            lengthUnit: this.lengthUnit,
            weightUnit: this.weightUnit,

            brand: this.brand,
            status: this.status,

            imageUrl: this.imageUrl,

            attributes: this.attributes,
            variants: this.variants,
            images: this.images,
            tags: this.tags,

            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        };
    }

    /**
     * Tworzenie obiektu Product z formularza (lub analogicznie):
     */
    static fromForm(data: Record<string, any>, existing?: Product | null): Product {
        return new Product({
            ...existing,
            id: data.id ?? existing?.id,
            agentId: data.agentId ?? existing?.agentId,

            sku: data.sku ?? existing?.sku,
            name: data.name ?? existing?.name,
            description: data.description ?? existing?.description,

            price: {
                value: data.price.value ?? existing?.price?.value ?? 0,
                currency: data.price?.currency ?? existing?.price?.currency ?? "USD",
            },
            priceInclTax: {
                value: data.priceInclTax?.value ?? existing?.priceInclTax?.value ?? 0,
                currency: data.price.currency ?? existing?.priceInclTax?.currency ?? "USD",
            },

            taxRate: data.taxRate ?? existing?.taxRate ?? 0,
            taxValue: data.taxValue ?? existing?.taxValue ?? 0,

            width: data.width ?? existing?.width ?? 0,
            height: data.height ?? existing?.height ?? 0,
            length: data.length ?? existing?.length ?? 0,
            weight: data.weight ?? existing?.weight ?? 0,

            widthUnit: data.widthUnit ?? existing?.widthUnit ?? "cm",
            heightUnit: data.heightUnit ?? existing?.heightUnit ?? "cm",
            lengthUnit: data.lengthUnit ?? existing?.lengthUnit ?? "cm",
            weightUnit: data.weightUnit ?? existing?.weightUnit ?? "kg",

            brand: data.brand ?? existing?.brand ?? "",
            status: data.status ?? existing?.status ?? "active",

            imageUrl: data.imageUrl ?? existing?.imageUrl,

            attributes: data.attributes ?? existing?.attributes ?? [],
            variants: data.variants ?? existing?.variants ?? [],
            images: data.images ?? existing?.images ?? [],
            tags: data.tags ?? existing?.tags ?? [],

            createdAt: existing?.createdAt || getCurrentTS(),
            updatedAt: getCurrentTS(),
        } as Product);
    }
}

// models.ts

export interface Price {
    value: number;
    currency: string;
  }
  
  export interface Address {
    address1?: string;
    address2?: string;
    city?: string;
    company?: string;
    country?: any;
    countryCode?: string;
    firstName?: string | null;
    lastName?: string | null;
    name?: string;
    phone?: string;
    province?: string;
    provinceCode?: string;
    street?: string;
    summary?: string;
    postalCode?: string;
  }
  export interface Note {
    date: string;
    message: string;
    author?: string;
  }
  export interface StatusChange {
    date: string;
    message: string;
    oldStatus?: string;
    newStatus: string;
  }
  export interface CustomerInfo {
    id?: string;
    name?: string;
    email?: string;
  }
  export interface OrderItem {
    id: string;
    name?: string;
    productSku?: string;
    variantSku?: string;
    variantName?: string;
    productId?: string;
    variantId?: string;

    message?: string;
    customOptions?: { name: string; value: string }[];
    originalPrice?: Price;
    price: Price;
    priceInclTax?: Price;
    taxValue?: Price;
  
    quantity: number;
    successfully_fulfilled_quantity?: number;
  
    title?: string;
  
    lineValue?: Price;
    lineValueInclTax?: Price;
    lineTaxValue?: Price;
    originalPriceInclTax?: Price;
    taxRate?: number;
  
    variant?: any;
  }


export const ORDER_STATUSES = [
    { label: ("Shopping Cart"), value: "shopping_cart" },
    { label: ("Quote"), value: "quote" },
    { label: ("New"), value: "new" },
    { label: ("Processing"), value: "processing" },
    { label: ("Shipped"), value: "shipped" },
    { label: ("Completed"), value: "completed" },
    { label: ("Cancelled"), value: "cancelled" },
];
  
  export class Order {
    id?: string;
    agentId?: string;
    sessionId?: string;
    billingAddress?: Address;
    shippingAddress?: Address;
    attributes?: Record<string, any>;
    notes?: Note[];
    statusChanges?: StatusChange[];
    status?: string;
    email?: string;
    customer?: CustomerInfo;
  
    subtotal?: Price;
    subTotalInclTax?: Price;
    subtotalTaxValue?: Price;
    total?: Price;
    totalInclTax?: Price;
    shippingPrice?: Price;
    shippingMethod?: string;
    shippingPriceTaxRate?: number;
    shippingPriceInclTax?: Price;
  
    items?: OrderItem[];
  
    createdAt: string;
    updatedAt: string;
   
    calcTotals(): void {
        if (!this.items || this.items.length === 0) {
          // If no items, reset everything
          const fallbackCurrency = this.subtotal?.currency || "USD";
          this.subtotal = createPrice(0, fallbackCurrency);
          this.subTotalInclTax = createPrice(0, fallbackCurrency);
          this.subtotalTaxValue = createPrice(0, fallbackCurrency);
          this.total = createPrice(0, fallbackCurrency);
          this.totalInclTax = createPrice(0, fallbackCurrency);
          return;
        }
    
        // Bierzemy currency z 1. itema (fallback = 'USD')
        const currency = this.items[0].price?.currency || "USD";
    
        let subtotalValue = 0;
        let subtotalInclTaxValue = 0;
        let subtotalTaxValue = 0;
    
        // Przeliczenie każdej linii:
        for (const item of this.items) {
          if (item.price.value < 0) item.price.value = 0;
          if ((item.priceInclTax?.value ?? 0) < 0) item.priceInclTax = createPrice(0, currency);
          item.taxRate = Math.max(0, item.taxRate || 0);

          const itemCurrency = item.price?.currency ?? currency;
          const lineNet = (item.price?.value ?? 0) * (item.quantity || 1);
    
          // lineValue
          item.lineValue = createPrice(lineNet, itemCurrency);
    
          // lineValueInclTax
          let lineGross = 0;
          if (item.priceInclTax) {
            lineGross = item.priceInclTax.value * item.quantity;
          } else {
            if (item.taxRate !== undefined && item.taxRate !== null) {
              lineGross = lineNet * (1 + item.taxRate);
            } else {
              lineGross = lineNet;
            }
          }
          item.lineValueInclTax = createPrice(lineGross, itemCurrency);
    
          // lineTaxValue
          const lineTax = lineGross - lineNet;
          item.lineTaxValue = createPrice(lineTax, itemCurrency);
    
          // sum to sub-totals
          subtotalValue += lineNet;
          subtotalInclTaxValue += lineGross;
          subtotalTaxValue += lineTax;
        }
    
        // Setting subTotal, subTotalInclTax, etc.
        this.subtotal = createPrice(subtotalValue, currency);
        this.subTotalInclTax = createPrice(subtotalInclTaxValue, currency);
        this.subtotalTaxValue = createPrice(subtotalTaxValue, currency);

        let shippingValue = this.shippingPrice?.value || 0;
        shippingValue = Math.max(0, shippingValue);
        if ((this.shippingPriceTaxRate ?? 0) < 0) this.shippingPriceTaxRate = 0;

        // shipping
        let shippingInclValue = Math.max(this.shippingPriceInclTax?.value || 0, 0);

        if (!this.shippingPriceInclTax && this.shippingPrice && this.shippingPriceTaxRate) {
            shippingInclValue = this.shippingPrice.value * (1 + this.shippingPriceTaxRate);
        }

        if (this.shippingPriceInclTax && this.shippingPriceTaxRate) {
            const shippingTaxRate = this.shippingPriceTaxRate;
            shippingValue = this.shippingPriceInclTax.value / (1 + shippingTaxRate);
            this.shippingPrice = createPrice(shippingValue, currency);
        } 
    
        const totalNet = subtotalValue + shippingValue;
        const totalGross = subtotalInclTaxValue + shippingInclValue;
    
        this.total = createPrice(totalNet, currency);
        this.totalInclTax = createPrice(totalGross, currency);
      }
    
  
    constructor(dto: OrderDTO) {
      this.id = dto.id;
      this.agentId = dto.agentId;
      this.sessionId = dto.sessionId;
      this.billingAddress = dto.billingAddress;
      this.shippingAddress = dto.shippingAddress;
      this.attributes = dto.attributes;
      this.notes = dto.notes;
      this.statusChanges = dto.statusChanges;
      this.status = dto.status;
      this.email = dto.email;
      this.customer = dto.customer;
  
      this.subtotal = dto.subtotal;
      this.subTotalInclTax = dto.subTotalInclTax;
      this.subtotalTaxValue = dto.subtotalTaxValue;
      this.total = dto.total;
      this.totalInclTax = dto.totalInclTax;
      this.shippingPrice = dto.shippingPrice;
      this.shippingMethod = dto.shippingMethod;
      this.shippingPriceTaxRate = dto.shippingPriceTaxRate;
      this.shippingPriceInclTax = dto.shippingPriceInclTax;
  
      this.items = dto.items;
  
      this.createdAt = dto.createdAt || new Date().toISOString();
      this.updatedAt = dto.updatedAt || new Date().toISOString();
    }
  
    static fromDTO(dto: OrderDTO) {
      return new Order(dto);
    }
  
    toDTO(): OrderDTO {
      return {
        id: this.id,
        agentId: this.agentId,
        sessionId: this.sessionId,
        billingAddress: this.billingAddress,
        shippingAddress: this.shippingAddress,
        attributes: this.attributes,
        notes: this.notes,
        statusChanges: this.statusChanges,
        status: this.status,
        email: this.email,
        customer: this.customer,
  
        subtotal: this.subtotal,
        subTotalInclTax: this.subTotalInclTax,
        subtotalTaxValue: this.subtotalTaxValue,
        total: this.total,
        totalInclTax: this.totalInclTax,
        shippingPrice: this.shippingPrice,
        shippingMethod: this.shippingMethod,
        shippingPriceTaxRate: this.shippingPriceTaxRate,
        shippingPriceInclTax: this.shippingPriceInclTax,
  
        items: this.items,
  
        createdAt: this.createdAt,
        updatedAt: this.updatedAt,
      };
    }
  }
  


export class DatabaseRefreshRequest {
    refreshToken: string;
    keepLoggedIn?: boolean;

    constructor(refreshToken: string, keepLoggedIn?: boolean) {
        this.refreshToken = refreshToken;
        this.keepLoggedIn = keepLoggedIn;
    }
}

export const passwordValidator = (value: string) => {
    const passSchema = new PasswordValidator();
    passSchema.is().min(6).has().not().spaces();
    return passSchema.validate(value);
}

export const sharingKeyValidator = (value: string) => {
    const passSchema = new PasswordValidator();
    passSchema.is().min(6).has().not().spaces().has().digits(6);
    return passSchema.validate(value);
}

export type UploadedFile = {
    id: number | string;
    file: File;
    uploaded: boolean;
    status: FileUploadStatus;
    index: number;
    dto: AttachmentDTO | null;
}


export enum FileUploadStatus {
  QUEUED = 'queued',
  UPLOADING = 'uploading',
  SUCCESS = 'ok',
  ERROR = 'error',
  ENCRYPTING = 'encrypting'
}


export const defaultVariantSku = (prod:ProductDTO | null= null) => {

    if(prod !== null)
      return 'VAR-' + prod.sku.replace('PROD-','') + '-' + (prod.variants?.length ?? 0 +1);
  else 
    return 'VAR-' + defaultProductSku().replace('PROD-','');
  
  }
  
  export const defaultOrderId = () => {
    const today = new Date();
    const year = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
  
    return `ORD-${year}-${mm}-${dd}-${rand}`;
  }
  
  export const defaultProductSku = () => {
    const today = new Date();
    const year = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
  
    return `PROD-${year}-${mm}-${dd}-${rand}`;    
  }


  // TODO: migrate this tool to use the `renderTemplate` from `prompt-template.ts` instead and make the templates switchable
  export function renderProductToMarkdown(product: Product, imagesDir: string): string {
      let md = `# ${product.name}\n\n`;
      md += `**SKU**: ${product.sku}\n\n`;
      if (product.description) {
          md += `**Description**: ${product.description}\n\n`;
      }
      if (product.price) {
          md += `**Price**: ${product.price.value} ${product.price.currency}\n\n`;
      }
      if (product.priceInclTax) {
          md += `**Price (incl. tax)**: ${product.priceInclTax.value} ${product.priceInclTax.currency}\n\n`;
      }
      if (product.taxRate) {
          md += `**Tax Rate**: ${product.taxRate}%\n\n`;
      }
      if (product.taxValue) {
          md += `**Tax Value**: ${product.taxValue}\n\n`;
      }
      if (product.brand) {
          md += `**Brand**: ${product.brand}\n\n`;
      }
      if (product.status) {
          md += `**Status**: ${product.status}\n\n`;
      }
      if (product.images && product.images.length > 0) {
          md += `## Images\n\n`;
          for (const image of product.images) {
              md += `![${image.alt || 'Image'}](${image.url})\n\n`;
          }
      }
      if (product.attributes && product.attributes.length > 0) {
          md += `## Attributes\n\n`;
          for (const attribute of product.attributes) {
              md += `**${attribute.name}**: ${attribute.values?.join(', ') || attribute.defaultValue || ''}\n\n`;
          }
      }
      if (product.variants && product.variants.length > 0) {
          md += `## Variants\n\n`;
          for (const variant of product.variants) {
              md += `### ${variant.name || variant.sku}\n\n`;
              md += `**SKU**: ${variant.sku}\n\n`;
              if (variant.price) {
                  md += `**Price**: ${variant.price.value} ${variant.price.currency}\n\n`;
              }
              if (variant.priceInclTax) {
                  md += `**Price (incl. tax)**: ${variant.priceInclTax.value} ${variant.priceInclTax.currency}\n\n`;
              }
              if (variant.taxRate) {
                  md += `**Tax Rate**: ${variant.taxRate}%\n\n`;
              }
              if (variant.taxValue) {
                  md += `**Tax Value**: ${variant.taxValue}\n\n`;
              }
              if (variant.brand) {
                  md += `**Brand**: ${variant.brand}\n\n`;
              }
              if (variant.status) {
                  md += `**Status**: ${variant.status}\n\n`;
              }
          }
      }
      return md;
  }
  
  