# oab-vector-store

A lightweight, flexible vector store implementation with support for both in-memory and disk-based storage. This package provides a simple interface for storing and retrieving vector embeddings with metadata.

## Features

- 🚀 Simple and intuitive API
- 💾 Support for both in-memory and disk-based storage
- 🔒 Built-in concurrency handling with file locking
- 🔍 Vector similarity search with cosine similarity
- 📦 Zero external dependencies (except for TypeScript)
- 🔄 Configurable embedding generation
- 📝 TypeScript support out of the box

## Installation

```bash
npm install oab-vector-store
```

## Quick Start

```typescript
import { 
  createDiskVectorStore, 
  createInMemoryVectorStore,
  createOpenAIEmbeddings 
} from 'oab-vector-store';

// Create an OpenAI embeddings provider
const generateEmbeddings = createOpenAIEmbeddings({
  apiKey: process.env.OPENAI_API_KEY
});

// Create a disk-based vector store
const diskStore = createDiskVectorStore({
  storeName: 'my-store',
  partitionKey: 'user123',
  maxFileSizeMB: 10
}, generateEmbeddings);

// Create an in-memory vector store
const memoryStore = createInMemoryVectorStore({
  generateEmbeddings
});

// Store a vector with metadata
await diskStore.upsert({
  id: 'doc1',
  content: 'Hello, world!',
  metadata: { source: 'test' }
});

// Search for similar vectors
const results = await diskStore.search('Hello', 5);
```

## API Reference

### VectorStore Interface

```typescript
interface VectorStore {
  set(id: string, entry: VectorStoreEntry): Promise<void>;
  get(id: string): Promise<VectorStoreEntry | null>;
  delete(id: string): Promise<void>;
  upsert(entry: VectorStoreEntry): Promise<void>;
  entries(): Promise<VectorStoreEntry[]>;
  search(query: string, topK?: number): Promise<VectorStoreEntry[]>;
  getConfig(): VectorStoreConfig;
  clear(): Promise<void>;
}
```

### Configuration

```typescript
interface VectorStoreConfig {
  storeName: string;
  partitionKey: string;
  maxFileSizeMB?: number;
  generateEmbeddings: GenerateEmbeddings;
}
```

### VectorStoreEntry

```typescript
interface VectorStoreEntry {
  id: string;
  content: string;
  embedding: number[];
  metadata: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}
```

## Storage Backends

### DiskVectorStore

The disk-based implementation stores vectors in JSON files with built-in concurrency handling:

```typescript
const store = createDiskVectorStore({
  storeName: 'my-store',
  partitionKey: 'user123',
  maxFileSizeMB: 10
}, generateEmbeddings);
```

### InMemoryVectorStore

The in-memory implementation for temporary storage:

```typescript
const store = createInMemoryVectorStore({
  generateEmbeddings
});
```

## Embedding Providers

### OpenAI Embeddings

```typescript
const generateEmbeddings = createOpenAIEmbeddings({
  model: 'text-embedding-ada-002',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: process.env.OPENAI_API_KEY
});
```

You can also create your own embedding provider by implementing the `GenerateEmbeddings` interface:

```typescript
type GenerateEmbeddings = (content: string) => Promise<number[]>;
```

## License

MIT 