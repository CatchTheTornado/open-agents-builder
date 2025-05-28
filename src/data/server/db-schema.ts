import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";


export const config = sqliteTable('config', {
    key: text('key', { mode: 'text' }).primaryKey(),
    value: text('value'),
    updatedAt: text('updatedAt').notNull().default(sql`CURRENT_TIMESTAMP`)
});


export const agents = sqliteTable('agents', {
    id: text('id').primaryKey(),
    displayName: text('displayName'),
    options: text('options', { mode: 'json' }),
    events: text('events', { mode: 'json' }),
    tools: text('tools', { mode: 'json' }),
    prompt: text('prompt').notNull(),
    flows: text('flows'),
    published: text('published'),
    defaultFlow: text('defaultFlow'),
    inputs: text('inputs'),
    agents: text('agents'),
    expectedResult: text('expectedResult'),
    safetyRules: text('safetyRules'),
    status: text('status'),
    locale: text('locale'),
    agentType: text('agentType'),
    createdAt: text('createdAt').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updatedAt').notNull().default(sql`CURRENT_TIMESTAMP`),
    icon: text('icon'),
    extra: text('extra', { mode: 'json' }),
    evals: text('evals', { mode: 'json' })
}); 

export const sessions = sqliteTable('sessions', {
    id: text('id').primaryKey(),   
    agentId: text('agentId').references(() => agents.id),
    userName: text('userName').default(''),
    userEmail: text('userEmail').default(''),
    acceptTerms: text('acceptTerms'),
    completionTokens: integer('completionTokens'),
    promptTokens: integer('promptTokens'),
    messages: text('messages', { mode: 'json' }),
    createdAt: text('createdAt').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updatedAt').notNull().default(sql`CURRENT_TIMESTAMP`),
    finalizedAt: text('finalizedAt')
}); 

export const results = sqliteTable('results', {
    agentId: text('agentId').references(() => agents.id),
    sessionId: text('sessionId').references(() => sessions.id).primaryKey(),
    userName: text('userName'),
    userEmail: text('userEmail'),    
    content: text('content'),
    format: text('format'),
    createdAt: text('createdAt').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updatedAt').notNull().default(sql`CURRENT_TIMESTAMP`),
    finalizedAt: text('finalizedAt')
}); 

export const keys = sqliteTable('keys', {
    keyLocatorHash: text('keyLocatorHash').primaryKey(),
    displayName: text('displayName'),
    databaseIdHash: text('databaseIdHash', { mode: 'text' }).notNull(),
    keyHash: text('keyHash').notNull(),
    keyHashParams: text('keyHashParams').notNull(),
    encryptedMasterKey: text('encryptedMasterKey').notNull(),
    acl: text('acl'),
    extra: text('extra'),
    expiryDate: text('expiryDate').default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updatedAt').notNull().default(sql`CURRENT_TIMESTAMP`)
}); 


export const attachments = sqliteTable('attachments', {
    id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
    
    displayName: text('displayName'),
    safeNameIdentifier: text('safeNameIdentifier'),
    type: text('type'),
    url: text('url'),
    mimeType: text('mimeType'),

    assignedTo: text('assignedTo'),

    json: text('json'),
    extra: text('extra'),
    size: integer('size', { mode: 'number' }),    

    content: text('content'),


    storageKey: text('storageKey').notNull(),
    description: text('description'),
    
    createdAt: text('updatedAt').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updatedAt').notNull().default(sql`CURRENT_TIMESTAMP`)
});

export const terms = sqliteTable('terms', {
    id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
    content: text('content'),
    code: text('code'),
    key: text('key'),
    signature: text('signature'),
    ip: text('ip'),
    ua: text('ua'),
    name: text('name'),
    email: text('email'),
    signedAt: text('signedAt').notNull().default(sql`CURRENT_TIMESTAMP`)
});

export const calendarEvents = sqliteTable('calendarEvents', {
    id: text('id').primaryKey(),
    title: text('title'),
    start: text('start').notNull(),
    end: text('end').notNull(),
    exclusive: text('exclusive'),
    description: text('description'),
    location: text('location'),
    agentId: text('agentId').references(() => agents.id),
    participants: text('participants', { mode: 'json' }),
    createdAt: text('createdAt').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updatedAt').notNull().default(sql`CURRENT_TIMESTAMP`),
    sessionId: text('sessionId')
});