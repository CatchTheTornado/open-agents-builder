import { BaseRepository } from "./base-repository"
import { ConfigDTO } from "../dto";
import { getCurrentTS } from "@/lib/utils";
import { config } from "./db-schema";
import { eq } from "drizzle-orm";
import { create } from "./generic-repository";
import { EncryptionUtils } from "@/lib/crypto";

export default class ServerConfigRepository extends BaseRepository<ConfigDTO> {
    storageKey: string | null | undefined;
    encUtils: EncryptionUtils | null = null;

    constructor(databaseIdHash: string, storageKey: string | null | undefined, databaseSchema: string = '', databasePartition: string = '') {
        super(databaseIdHash, databaseSchema, databasePartition);
        this.storageKey = storageKey;
        if (storageKey) {
            this.encUtils = new EncryptionUtils(storageKey);
        }
    }

    async encryptItem(item: ConfigDTO): Promise<ConfigDTO> {
        if (this.encUtils) {
            if (item.value) item.value = await this.encUtils.encrypt(item.value);
        }
        return item;
    }

    async decryptItem(item: ConfigDTO): Promise<ConfigDTO> {
        if (this.encUtils) {
            if (item.value) item.value = await this.encUtils.decrypt(item.value);
        }
        return item;
    }

    async decryptItems(items: ConfigDTO[]): Promise<ConfigDTO[]> {
        if (this.encUtils) {
            for (let item of items) {
                item = await this.decryptItem(item);
            }
        }
        return items;
    }

    // create a new config
    async create(item: ConfigDTO): Promise<ConfigDTO> {
        const db = await this.db();
        item = await this.encryptItem(item);
        return await this.decryptItem(await create(item, config, db));
    }

    // update config
    async upsert(query: { key: string }, item: ConfigDTO): Promise<ConfigDTO> {      
        const db = await this.db();  
        let existingRecord: ConfigDTO | null = query.key ? db.select().from(config).where(eq(config.key, query.key)).get() as ConfigDTO : null;
        if (!existingRecord) {
            existingRecord = await this.create(item)
        } else {
            item = await this.encryptItem(item);
            existingRecord = item;
            existingRecord.updatedAt = getCurrentTS();
            db.update(config).set(existingRecord).where(eq(config.key, query.key)).run();
            existingRecord = await this.decryptItem(existingRecord);
        }
        return Promise.resolve(existingRecord as ConfigDTO)   
    }

    async delete(query: Record<string, string>): Promise<boolean> {
        const db = (await this.db());
        return db.delete(config).where(eq(config.key, query.key)).run().changes > 0
    }

    async findAll(): Promise<ConfigDTO[]> {
        const db = await this.db();
        const dbQuery = db.select().from(config);
        return Promise.resolve(await this.decryptItems(dbQuery.all() as ConfigDTO[]));
    }

}