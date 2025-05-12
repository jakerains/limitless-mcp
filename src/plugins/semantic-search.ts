import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { LimitlessPlugin } from "./types";
import NodeCache from "node-cache";

/**
 * A plugin that provides semantic search functionality using text embeddings
 */
export class SemanticSearchPlugin implements LimitlessPlugin {
  name = "semantic-search";
  description = "Enables semantic search using text embeddings to find semantically similar content";
  version = "1.0.0";
  
  private server?: McpServer;
  private config: Record<string, any> = {};
  private embedCache: NodeCache;
  
  // Simple in-memory store for embeddings
  private embeddings: Map<string, {
    id: string;
    title: string;
    vectors: number[][];
    chunks: string[];
    timestamp: number;
  }> = new Map();
  
  constructor() {
    // Initialize cache for embedding API calls
    this.embedCache = new NodeCache({
      stdTTL: 60 * 60, // 1 hour
      checkperiod: 120,
      maxKeys: 1000
    });
  }
  
  async initialize(server: McpServer, config: Record<string, any>): Promise<void> {
    this.server = server;
    this.config = config;
    
    // Override defaults with config
    if (config.embeddingsTtl) {
      this.embedCache.options.stdTTL = config.embeddingsTtl;
    }
    
    if (config.embeddingsMaxKeys) {
      this.embedCache.options.maxKeys = config.embeddingsMaxKeys;
    }
    
    // Register tool for creating embeddings
    server.tool(
      "create_embeddings",
      {
        id: z.string().describe("The ID of the lifelog to create embeddings for"),
        chunkSize: z.number().default(512).describe("Size of text chunks for embeddings (in characters)"),
        chunkOverlap: z.number().default(50).describe("Overlap between chunks (in characters)"),
        forceRefresh: z.boolean().default(false).describe("Whether to force refresh embeddings even if they exist")
      },
      async ({ id, chunkSize, chunkOverlap, forceRefresh }) => {
        try {
          // Check if embeddings already exist and are recent (less than 24 hours old)
          const existingEmbeddings = this.embeddings.get(id);
          const now = Date.now();
          const isRecent = existingEmbeddings && 
                          (now - existingEmbeddings.timestamp < 24 * 60 * 60 * 1000);
          
          if (existingEmbeddings && isRecent && !forceRefresh) {
            return {
              content: [{
                type: "text",
                text: `Embeddings already exist for lifelog ${id} (${existingEmbeddings.chunks.length} chunks). Created ${this.formatTimeDifference(now - existingEmbeddings.timestamp)} ago.`
              }]
            };
          }
          
          // Get lifelog content
          const lifelog = await this.getLifelog(id);
          
          if (!lifelog || !lifelog.markdown) {
            return {
              content: [{
                type: "text",
                text: `No content found for lifelog with ID: ${id}`
              }]
            };
          }
          
          // Chunk the text
          const chunks = this.chunkText(lifelog.markdown, chunkSize, chunkOverlap);
          
          if (chunks.length === 0) {
            return {
              content: [{
                type: "text",
                text: `No content chunks could be generated for lifelog ${id}.`
              }]
            };
          }
          
          // Generate embeddings for each chunk (mock implementation)
          const vectors = await Promise.all(chunks.map(chunk => this.generateEmbedding(chunk)));
          
          // Store in memory
          this.embeddings.set(id, {
            id,
            title: lifelog.title,
            vectors,
            chunks,
            timestamp: now
          });
          
          return {
            content: [{
              type: "text",
              text: `Successfully created embeddings for lifelog "${lifelog.title}" (ID: ${id}).\n` +
                    `Created ${chunks.length} chunks of approximately ${chunkSize} characters each.`
            }]
          };
          
        } catch (error) {
          console.error(`Error creating embeddings for lifelog ${id}:`, error);
          return {
            content: [{
              type: "text",
              text: `Error creating embeddings: ${error}`
            }]
          };
        }
      }
    );
    
    // Register tool for semantic search
    server.tool(
      "semantic_search",
      {
        query: z.string().describe("The query to search for semantically similar content"),
        ids: z.array(z.string()).optional().describe("Optional array of specific lifelog IDs to search within"),
        topK: z.number().default(5).describe("Number of top results to return"),
        threshold: z.number().default(0.7).describe("Similarity threshold (0-1)")
      },
      async ({ query, ids, topK, threshold }) => {
        try {
          if (!query.trim()) {
            return {
              content: [{
                type: "text",
                text: "Please provide a search query."
              }]
            };
          }
          
          // Generate embedding for the query
          const queryVector = await this.generateEmbedding(query);
          
          // Filter lifelogs if IDs are provided
          const lifelogsToSearch = ids && ids.length > 0
            ? Array.from(this.embeddings.values()).filter(emb => ids.includes(emb.id))
            : Array.from(this.embeddings.values());
          
          if (lifelogsToSearch.length === 0) {
            let message = "No embeddings found to search. ";
            
            if (ids && ids.length > 0) {
              message += `Please create embeddings for the specified lifelog IDs first using the create_embeddings tool.`;
            } else {
              message += `Please create embeddings for at least one lifelog first using the create_embeddings tool.`;
            }
            
            return {
              content: [{
                type: "text",
                text: message
              }]
            };
          }
          
          // Search across all lifelogs
          const results: Array<{
            id: string;
            title: string;
            chunk: string;
            similarity: number;
          }> = [];
          
          for (const lifelog of lifelogsToSearch) {
            // Compare query embedding with each chunk
            lifelog.vectors.forEach((vector, index) => {
              const similarity = this.cosineSimilarity(queryVector, vector);
              
              if (similarity >= threshold) {
                results.push({
                  id: lifelog.id,
                  title: lifelog.title,
                  chunk: lifelog.chunks[index],
                  similarity
                });
              }
            });
          }
          
          // Sort by similarity (descending)
          results.sort((a, b) => b.similarity - a.similarity);
          
          // Take top K results
          const topResults = results.slice(0, topK);
          
          if (topResults.length === 0) {
            return {
              content: [{
                type: "text",
                text: `No semantic matches found for "${query}" that meet the similarity threshold (${threshold}).`
              }]
            };
          }
          
          // Format response
          let resultText = `# Semantic Search Results for "${query}"\n\n`;
          resultText += `Found ${results.length} matches above threshold (${threshold}), showing top ${topResults.length}.\n\n`;
          
          topResults.forEach((result, index) => {
            resultText += `## ${index + 1}. Match in "${result.title}" (ID: ${result.id})\n`;
            resultText += `Similarity: ${(result.similarity * 100).toFixed(2)}%\n\n`;
            resultText += `> ${result.chunk}\n\n`;
          });
          
          return {
            content: [{
              type: "text",
              text: resultText
            }]
          };
          
        } catch (error) {
          console.error(`Error performing semantic search:`, error);
          return {
            content: [{
              type: "text",
              text: `Error performing semantic search: ${error}`
            }]
          };
        }
      }
    );
    
    // Register tool for managing embeddings
    server.tool(
      "manage_embeddings",
      {
        action: z.enum(["list", "delete", "clear", "info"]).describe("Action to perform"),
        id: z.string().optional().describe("Lifelog ID for delete/info actions")
      },
      async ({ action, id }) => {
        try {
          switch (action) {
            case "list":
              // List all lifelog embeddings
              const embeddingsList = Array.from(this.embeddings.values());
              
              if (embeddingsList.length === 0) {
                return {
                  content: [{
                    type: "text",
                    text: "No embeddings have been created yet."
                  }]
                };
              }
              
              let listText = `# Available Embeddings\n\n`;
              listText += `| ID | Title | Chunks | Created |\n`;
              listText += `| --- | --- | --- | --- |\n`;
              
              const now = Date.now();
              embeddingsList.forEach(emb => {
                const age = this.formatTimeDifference(now - emb.timestamp);
                listText += `| ${emb.id} | ${emb.title} | ${emb.chunks.length} | ${age} ago |\n`;
              });
              
              return {
                content: [{
                  type: "text",
                  text: listText
                }]
              };
              
            case "delete":
              // Delete embeddings for a specific lifelog
              if (!id) {
                return {
                  content: [{
                    type: "text",
                    text: "Please provide a lifelog ID to delete embeddings."
                  }]
                };
              }
              
              if (!this.embeddings.has(id)) {
                return {
                  content: [{
                    type: "text",
                    text: `No embeddings found for lifelog ${id}.`
                  }]
                };
              }
              
              this.embeddings.delete(id);
              return {
                content: [{
                  type: "text",
                  text: `Embeddings for lifelog ${id} have been deleted.`
                }]
              };
              
            case "clear":
              // Clear all embeddings
              const count = this.embeddings.size;
              this.embeddings.clear();
              return {
                content: [{
                  type: "text",
                  text: `All embeddings cleared (${count} removed).`
                }]
              };
              
            case "info":
              // Get info about embeddings for a specific lifelog
              if (!id) {
                return {
                  content: [{
                    type: "text",
                    text: "Please provide a lifelog ID to get embeddings info."
                  }]
                };
              }
              
              const embedding = this.embeddings.get(id);
              if (!embedding) {
                return {
                  content: [{
                    type: "text",
                    text: `No embeddings found for lifelog ${id}.`
                  }]
                };
              }
              
              const embInfo = `# Embeddings for "${embedding.title}"\n\n` +
                              `- **ID**: ${embedding.id}\n` +
                              `- **Chunks**: ${embedding.chunks.length}\n` +
                              `- **Created**: ${new Date(embedding.timestamp).toLocaleString()}\n` +
                              `- **Age**: ${this.formatTimeDifference(Date.now() - embedding.timestamp)}\n\n` +
                              `## Sample Chunks\n\n` +
                              embedding.chunks.slice(0, 3).map((chunk, i) => 
                                `### Chunk ${i+1}\n${chunk.substring(0, 150)}...`
                              ).join('\n\n');
              
              return {
                content: [{
                  type: "text",
                  text: embInfo
                }]
              };
              
            default:
              return {
                content: [{
                  type: "text",
                  text: `Unknown action: ${action}`
                }]
              };
          }
        } catch (error) {
          console.error(`Error managing embeddings:`, error);
          return {
            content: [{
              type: "text",
              text: `Error managing embeddings: ${error}`
            }]
          };
        }
      }
    );
  }
  
  // Helper to fetch a lifelog by ID
  private async getLifelog(id: string): Promise<any> {
    // In a real implementation, this would call the Limitless API
    // For now, we'll throw an error to indicate this needs to be implemented
    console.error(`Would fetch lifelog with ID: ${id}`);
    throw new Error("Lifelog fetching needs to be implemented for this plugin");
  }
  
  // Split text into chunks with overlap
  private chunkText(text: string, chunkSize: number, overlap: number): string[] {
    const chunks: string[] = [];
    
    // Simple chunking strategy - split by character count with overlap
    let currentIndex = 0;
    
    while (currentIndex < text.length) {
      // Get chunk from current position
      const chunk = text.substring(currentIndex, currentIndex + chunkSize);
      
      if (chunk.length < 10) break; // Stop if chunks are too small
      
      chunks.push(chunk);
      
      // Move to next position, accounting for overlap
      currentIndex += chunkSize - overlap;
    }
    
    return chunks;
  }
  
  // Generate embedding vector for text
  // This is a mock implementation - in a real system you would use an embedding API
  private async generateEmbedding(text: string): Promise<number[]> {
    // Check if we have this embedding cached
    const cachedVector = this.embedCache.get<number[]>(text);
    if (cachedVector) {
      return cachedVector;
    }
    
    // In a real implementation, you would call an embedding API like:
    // - OpenAI's text-embedding-ada-002
    // - HuggingFace's sentence-transformers
    // - A local embedding model
    
    // For this example, we'll generate a pseudo-random vector based on the text content
    // This is NOT suitable for real semantic search but demonstrates the concept
    const vector: number[] = [];
    const dimension = 128; // 128-dimension vector
    
    // Simple deterministic embedding generation for demo
    // In reality, you'd call an embedding model API here
    const hash = text
      .split('')
      .reduce((hash, char) => ((hash << 5) - hash) + char.charCodeAt(0), 0);
    
    const random = new PseudoRandom(Math.abs(hash));
    
    for (let i = 0; i < dimension; i++) {
      // Generate values between -1 and 1 with some patterns based on text
      vector.push(random.nextFloat() * 2 - 1);
    }
    
    // Normalize the vector (unit length)
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    const normalized = vector.map(val => val / magnitude);
    
    // Cache the result
    this.embedCache.set(text, normalized);
    
    return normalized;
  }
  
  // Calculate cosine similarity between two vectors
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error("Vectors must have the same length");
    }
    
    // Calculate dot product
    let dotProduct = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
    }
    
    // The vectors are already normalized, so the dot product is the cosine similarity
    return dotProduct;
  }
  
  // Format time difference in a human-readable way
  private formatTimeDifference(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    
    if (seconds < 60) {
      return `${seconds} seconds`;
    }
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `${minutes} minutes`;
    }
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `${hours} hours`;
    }
    
    const days = Math.floor(hours / 24);
    return `${days} days`;
  }
}

// Simple deterministic random number generator for demo purposes
class PseudoRandom {
  private seed: number;
  
  constructor(seed: number) {
    this.seed = seed;
  }
  
  // Linear congruential generator
  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
  
  // Random float between 0 and 1
  nextFloat(): number {
    return this.next();
  }
}