import { StorageService } from "@/lib/storage-service";

export type EmbeddingResult = {
    content: string;
    embedding: number[];
    metadata: any;
  };
  
  export interface VectorStore {
    set: (id: string, value: EmbeddingResult) => Promise<void>;
    entries: () => Promise<[string, EmbeddingResult][]>;
  }
  
  export type GenerateEmbeddings = (content: string) => Promise<number[]>;
  

  /**
 * Use this function to create your own embeddings provider, with different model and API key.
 */
export const openAIEmbeddings = ({
    model = 'text-embedding-ada-002',
    baseUrl = 'https://api.openai.com/v1',
    apiKey = process.env.OPENAI_API_KEY,
  }: {
    model?: string
    baseUrl?: string
    apiKey?: string
  } = {}) => {
    return async (content: string): Promise<number[]> => {
      const response = await fetch(`${baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: content,
          model,
          encoding_format: 'float',
        }),
      })
  
      if (!response.ok) {
        const error = await response.json()
        throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`)
      }
  
      const data = await response.json()
      return data.data[0].embedding
    }
  }

  /**
 * In-memory implementation of the VectorStore interface using functions.
 */
export const createInMemoryVectorStore = () => {
    const store = new Map<string, EmbeddingResult>()
  
    const set = async (id: string, value: EmbeddingResult): Promise<void> => {
      store.set(id, value)
    }
  
    const entries = async (): Promise<[string, EmbeddingResult][]> => {
      return Array.from(store.entries())
    }
  
    return {
      set,
      entries,
    }
  }

  
  /**
   * Creates a disk-based vector store that uses StorageService for:
   *   - concurrency (lock/unlock)
   *   - reading/writing JSON
   *   - partitioning (via file name)
   * and enforces a size limit on the JSON file.
   */
  export const createDiskBackedVectorStore = (
    databaseIdHash: string,
    schema: string,
    agentId: string,
    shardName?: string,
    maxFileSizeMB: number = 10
  ) => {
    // 1. Construct a storage service
    const storageService = new StorageService(databaseIdHash, schema);
  
    // 2. Build the file name: agentId + optional shardName
    const fileName = shardName ? `${agentId}-${shardName}.json` : `${agentId}.json`;
  
    /**
     * set: Write or overwrite an embedding result for the given id.
     * Uses lock -> read -> update -> write -> unlock pattern.
     */
    const set = async (id: string, value: EmbeddingResult): Promise<void> => {
      // Acquire lock
      await storageService.acquireLock(fileName);
  
      try {
        // Read the existing JSON data
        const data = storageService.readPlainJSONAttachment<Record<string, EmbeddingResult>>(fileName);
  
        // Update or insert the value
        data[id] = value;
  
        // Write back to disk with size check
        storageService.writePlainJSONAttachment(fileName, data, maxFileSizeMB);
      } finally {
        // Release lock
        storageService.releaseLock(fileName);
      }
    };
  
    /**
     * entries: Returns all [key, EmbeddingResult] pairs from the JSON store.
     * Also lock-based for concurrency safety.
     */
    const entries = async (): Promise<[string, EmbeddingResult][]> => {
      // Acquire lock
      await storageService.acquireLock(fileName);
  
      try {
        if (!storageService.fileExists(fileName)) {
          // No data yet
          return [];
        }
        const data = storageService.readPlainJSONAttachment<Record<string, EmbeddingResult>>(fileName);
        return Object.entries(data);
      } finally {
        // Release lock
        storageService.releaseLock(fileName);
      }
    };
  
    return {
      set,
      entries,
    };
  };
  


  export const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a ** 2, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b ** 2, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  };