// server-product-repository.ts

import { BaseRepository, IQuery } from "./base-repository";
import { PaginatedResult, ProductDTO } from "../dto";
import { getCurrentTS } from "@/lib/utils";
import { and, asc, count, desc, eq, like, or } from "drizzle-orm";
import { create } from "./generic-repository";
import { products } from "./db-schema-commerce";

export default class ServerProductRepository extends BaseRepository<ProductDTO> {
  /**
   * Mapuje ProductDTO -> obiekt pasujący do "products" (drizzle)
   */
  private toDbRecord(dto: ProductDTO): any {
    return {
      id: dto.id,
      agentId: dto.agentId,
      sku: dto.sku,
      name: dto.name,
      description: dto.description,

      price: JSON.stringify(dto.price) ?? { value: 0, currency: "USD" },
      priceInclTax: JSON.stringify(dto.priceInclTax) ?? { value: 0, currency: "USD" },

      taxRate: dto.taxRate ?? 0,
      taxValue: dto.taxValue ?? 0,

      width: dto.width ?? 0,
      height: dto.height ?? 0,
      length: dto.length ?? 0,
      weight: dto.weight ?? 0,

      widthUnit: dto.widthUnit ?? "cm",
      heightUnit: dto.heightUnit ?? "cm",
      lengthUnit: dto.lengthUnit ?? "cm",
      weightUnit: dto.weightUnit ?? "kg",

      brand: dto.brand,
      status: dto.status,

      imageUrl: dto.imageUrl,

      // JSON
      attributes: dto.attributes ? JSON.stringify(dto.attributes) : null,
      variants: dto.variants ? JSON.stringify(dto.variants) : null,
      images: dto.images ? JSON.stringify(dto.images) : null,
      tags: dto.tags ? JSON.stringify(dto.tags) : null,

      createdAt: dto.createdAt,
      updatedAt: dto.updatedAt,
    };
  }

  /**
   * Mapuje dane z bazy (z kolumn) -> ProductDTO
   */
  private fromDbRecord(record: any): ProductDTO {
    const result: ProductDTO =  {
      id: record.id,
      agentId: record.agentId,
      sku: record.sku,
      name: record.name,
      description: record.description ?? undefined,

      taxRate: record.taxRate ?? 0,
      taxValue: record.taxValue ?? 0,

      width: record.width ?? 0,
      height: record.height ?? 0,
      length: record.length ?? 0,
      weight: record.weight ?? 0,

      widthUnit: record.widthUnit ?? "cm",
      heightUnit: record.heightUnit ?? "cm",
      lengthUnit: record.lengthUnit ?? "cm",
      weightUnit: record.weightUnit ?? "kg",

      brand: record.brand,
      status: record.status,

      imageUrl: record.imageUrl ?? null,

      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };

    try {
      result.price = JSON.parse(record.price);
    } catch {
      result.price = { value: 0, currency: "USD" };
    }
    try {
      result.priceInclTax = JSON.parse(record.priceInclTax)
    } catch {
      result.priceInclTax = { value: 0, currency: "USD" };
    }

    try {
      result.attributes = record.attributes ? JSON.parse(record.attributes) : []
    } catch {
      result.attributes = [];
    }

    try {
      result.variants = record.variants ? JSON.parse(record.variants) : []
    } catch {
      result.variants = [];
    }
    try {
      result.images = record.images ? JSON.parse(record.images) : []
    } catch {
      result.images = [];
    }
    
    try {
      result.tags = record.tags ? JSON.parse(record.tags) : []
    } catch {
      result.tags = [];
    }

    return result;
  }

  async create(item: ProductDTO): Promise<ProductDTO> {
    const db = await this.db();
    const dbRecord = this.toDbRecord(item);
    const inserted = await create(dbRecord, products, db);
    return this.fromDbRecord(inserted);
  }

  async upsert(query: Record<string, any>, item: ProductDTO): Promise<ProductDTO> {
    const db = await this.db();
    let existingRecord: any | null = null;

    if (query.id) {
      existingRecord = db.select().from(products).where(eq(products.id, query.id)).get();
    }

    if (!existingRecord) {
      // Tworzymy
      return this.create(item);
    } else {
      // Update
      const updated = { ...this.toDbRecord(item) };
      updated.updatedAt = getCurrentTS();

      db.update(products).set(updated).where(eq(products.id, query.id)).run();
      return this.fromDbRecord(updated);
    }
  }

  async delete(query: Record<string, any>): Promise<boolean> {
    const db = await this.db();
    if (query.id) {
      return db.delete(products).where(eq(products.id, query.id)).run().changes > 0;
    }
    return false;
  }

  async findAll(query?: IQuery): Promise<ProductDTO[]> {
    const db = await this.db();
    let dbQuery = db.select().from(products);

    // np. proste filtry
    if (query?.filter) {
      if (query.filter["id"]) {
        dbQuery.where(eq(products.id, query.filter["id"]));
      }
      if (query.filter["agentId"]) {
        dbQuery.where(eq(products.agentId, query.filter["agentId"]));
      }
      if (query.filter["sku"]) {
        dbQuery.where(eq(products.sku, query.filter["sku"]));
      }
      // ... inne filtry
    }

    const rows = dbQuery.all();
    return rows.map((row) => this.fromDbRecord(row));
  }


  async queryAll({ id, limit, offset, orderBy, query }: 
    { limit: number; offset: number; orderBy: string; query: string; id?: string;  }
  ): Promise<PaginatedResult<ProductDTO[]>> {
    const db = await this.db();

    // domyślne sortowanie – np. po dacie malejąco
    let orderColumn = desc(products.createdAt);

    switch (orderBy) {
      case "name":
        orderColumn = asc(products.name);
        break;
      case "price":
        orderColumn = asc(products.price);
        break;
      // inne pola, np. updatedAt, brand, itp.
      case "createdAt":
      default:
        orderColumn = desc(products.createdAt);
        break;
    }

    let whereCondition = null;
    if (query) {
      whereCondition = or(
        like(products.sku, `%${query}%`),
        like(products.name, `%${query}%`)
      );
    }

    if (id) {
        whereCondition = eq(products.id, id); // select single product by id
    }

    const countQuery = db
      .select({ count: count() })
      .from(products)
      .where(whereCondition ?? undefined)
      .execute();

    // Pobieżmy rekordy
    let dbRecords = db
      .select()
      .from(products)
      .where(whereCondition ?? undefined)
      .orderBy(orderColumn)
      .limit(limit)
      .offset(offset)
      .all();

    const total = (await countQuery)[0].count;

    // Zamieńmy je na ProductDTO
    const rows = dbRecords.map((r) => this.fromDbRecord(r));

    return {
      rows,
      total,
      limit,
      offset,
      orderBy,
      query,
    };
  }  
}
