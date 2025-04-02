import { VectorStoreEntry } from './types';
import { nanoid } from 'nanoid';

/**
 * Generates a unique ID for a vector store entry
 */
export function generateEntryId(): string {
  return nanoid();
}

/**
 * Returns the current timestamp in ISO format
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Calculates cosine similarity between two vectors
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a ** 2, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b ** 2, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Sorts vector store entries by similarity to a query embedding
 */
export function sortBySimilarity(
  entries: VectorStoreEntry[],
  queryEmbedding: number[],
  topK?: number
): VectorStoreEntry[] {
  return entries
    .map(entry => ({
      ...entry,
      similarity: cosineSimilarity(queryEmbedding, entry.embedding)
    }))
    .sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
    .slice(0, topK);
} 