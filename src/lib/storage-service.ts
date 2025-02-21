import path from 'path'
import fs from 'fs'

export class StorageService {
    private rootPath: string;
    private uploadPath: string;
    private schema: string;

    constructor(databaseIdHash: string, schema: string) {
        this.rootPath = path.resolve(process.cwd());
        this.uploadPath =path.join(this.rootPath, 'data', databaseIdHash, schema)
        this.schema = schema;
    }

    public async saveAttachment(file: File, storageKey: string): Promise<void> {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = new Uint8Array(arrayBuffer);
        if (!fs.existsSync(this.uploadPath)) {
            fs.mkdirSync(this.uploadPath, { recursive: true });
        }
        fs.writeFileSync(path.resolve(this.uploadPath, storageKey), buffer);
    }

    public readAttachment(storageKey: string): ArrayBuffer {
        const filePath = path.resolve(this.uploadPath, storageKey);
        const buffer = fs.readFileSync(filePath);
        return new Uint8Array(buffer).buffer;
    }


    public deleteAttachment(storageKey: string) {
        return fs.rmSync(path.resolve(this.uploadPath, storageKey));
    }
}
