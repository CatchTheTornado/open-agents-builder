import { BaseRepository, IFilter } from "./base-repository"
import { AttachmentDTO, PaginatedResult } from "../dto";
import { pool } from '@/data/server/db-provider'
import { getCurrentTS } from "@/lib/utils";
import { attachments } from "./db-schema";
import { asc, count, desc, eq, like, or } from "drizzle-orm";
import { create } from "./generic-repository";
import { EncryptionUtils } from "@/lib/crypto";

export default class ServerAttachmentRepository extends BaseRepository<AttachmentDTO> {
    
    storageKey: string | null | undefined;
    encUtils:EncryptionUtils | null = null;

    async encryptItem(item: AttachmentDTO): Promise<AttachmentDTO> {
        if(this.encUtils){
            if(item.content) item.content = await this.encUtils.encrypt(item.content);
        }
        return item;
    }

    async decryptItem(item: AttachmentDTO): Promise<AttachmentDTO> {
        if (this.encUtils){
            if (item.content) item.content = await this.encUtils.decrypt(item.content);            
        }
        return item
    }

    async decryptItems(items: AttachmentDTO[]): Promise<AttachmentDTO[]> {
        if(this.encUtils){
            for(let item of items){
                item = await this.decryptItem(item);
            }
        }
        return items;
    }

    constructor(databaseIdHash: string, storageKey: string | null | undefined, databaseSchema: string = '', databasePartition: string ='') {
        super(databaseIdHash, databaseSchema, databasePartition);
        this.storageKey = storageKey
        if (storageKey){
            this.encUtils = new EncryptionUtils(storageKey);
        }
    }

    
    async create(item: AttachmentDTO): Promise<AttachmentDTO> {
        const db = (await this.db());
        item = await this.encryptItem(item);
        if (item.displayName) {
            item.safeNameIdentifier = item.displayName.replace(/[^a-zA-Z0-9_]/g, '');
        }
        return this.decryptItem(await create(item, attachments, db)); // generic implementation
    }

    async delete(query:Record<string, any>): Promise<boolean> {
        const db = (await this.db());
        return db.delete(attachments).where(eq(attachments.storageKey, query.storageKey)).run().changes > 0
    }

    // update folder
    async upsert(query:Record<string, any>, item: AttachmentDTO): Promise<AttachmentDTO> {        
        const db = (await this.db());
        let existingRecord:AttachmentDTO | null = query.id ? db.select().from(attachments).where(eq(attachments.id, query.id)).get() as AttachmentDTO : null
        if (!existingRecord) {
            existingRecord = await this.create(item);
       } else {
            if (item.displayName) {
                item.safeNameIdentifier = item.displayName.replace(/[^a-zA-Z0-9_]/g, '');
            }        
            item = await this.encryptItem(item);  
            existingRecord = item
            existingRecord.updatedAt = getCurrentTS() // TODO: load attachments
            db.update(attachments).set(existingRecord).where(eq(attachments.id, query.id)).run();
            existingRecord = await this.decryptItem(existingRecord);
       }
       return Promise.resolve(existingRecord as AttachmentDTO)   
    }    

    async findAll(): Promise<AttachmentDTO[]> {
        const db = (await this.db());
        return Promise.resolve(db.select().from(attachments).all() as AttachmentDTO[])
    }

    async findOne(query: IFilter): Promise<AttachmentDTO | null> {
        const db = (await this.db());
        return db.select().from(attachments).where(eq(attachments.storageKey, query.storageKey)).get() as AttachmentDTO;
    }


      async queryAll({ id, limit, offset, orderBy, query, mimeTypes }: 
        { limit: number; offset: number; orderBy: string; query: string; id?: string; mimeTypes?: string[] }
      ): Promise<PaginatedResult<AttachmentDTO[]>> {
        const db = await this.db();
    
        // domyślne sortowanie – np. po dacie malejąco
        let orderColumn = desc(attachments.createdAt);
    
        switch (orderBy) {
          case "displayName":
            orderColumn = asc(attachments.displayName);
            break;
          case "createdAt":
          default:
            orderColumn = desc(attachments.createdAt);
            break;
        }
    
        let whereCondition = null;
        if (query) {
          whereCondition = or(
            eq(attachments.id, parseInt(query) > 0 ? parseInt(query) : 0),
            like(attachments.displayName, `%${query}%`),
            like(attachments.storageKey, `%${query}%`),
            like(attachments.safeNameIdentifier, `%${query}%`),
            like(attachments.mimeType, `%${query}%`)
          );
        }

        if (mimeTypes) {
            whereCondition = or(
                ...mimeTypes.map((mimeType) => like(attachments.mimeType, `%${mimeType}%`))
            );

        }
    
        if (id) {
            whereCondition = eq(attachments.storageKey, id); // select single product by id
        }
    
        const countQuery = db
          .select({ count: count() })
          .from(attachments)
          .where(whereCondition ?? undefined)
          .execute();
    
        // Pobieżmy rekordy
        let dbRecords = db
          .select()
          .from(attachments)
          .where(whereCondition ?? undefined)
          .orderBy(orderColumn)
          .limit(limit)
          .offset(offset)
          .all();
    
        const total = (await countQuery)[0].count;
        
        return {
          rows: await this.decryptItems(dbRecords as AttachmentDTO[]),
          total,
          limit,
          offset,
          orderBy,
          query,
        };
      }  

}