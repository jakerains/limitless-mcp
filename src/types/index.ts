/**
 * Type definitions for the Limitless MCP server
 */

// Limitless API response types
export interface Lifelog {
  id: string;
  title: string;
  markdown?: string;
  startTime?: string;
  endTime?: string;
  contents?: Array<LifelogContent>;
}

export interface LifelogContent {
  type: string;
  content: string;
  startTime?: string;
  endTime?: string;
  startOffsetMs?: number;
  endOffsetMs?: number;
  children?: any[];
  speakerName?: string;
  speakerIdentifier?: string | null;
}

export interface LifelogResponse {
  data: {
    lifelogs?: Lifelog[];
    lifelog?: Lifelog;
  };
  meta?: {
    lifelogs?: {
      nextCursor?: string;
      count: number;
    };
  };
}

// Environment configuration interface
export interface LimitlessConfig {
  // API configuration
  API_KEY: string;
  API_BASE_URL: string;
  API_TIMEOUT_MS: number;
  API_MAX_RETRIES: number;
  
  // Pagination and result limits
  MAX_LIFELOG_LIMIT: number;
  DEFAULT_PAGE_SIZE: number;
  MAX_SEARCH_MULTIPLIER: number;
  
  // Cache configuration
  CACHE_TTL: number;
  CACHE_CHECK_PERIOD: number; 
  CACHE_MAX_KEYS: number;
  CACHE_TTL_MULTIPLIERS: {
    METADATA: number;
    LISTINGS: number;
    SEARCH: number;
    SUMMARIES: number;
  };
}

// Topic extraction result type
export interface Topic {
  name: string;
  count: number;
  score: number;
}