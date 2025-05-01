#!/usr/bin/env node

import { McpServer, ResourceTemplate, ResourceMetadata } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { request } from "undici";
import { z } from "zod";

// ──────────────────────────────────────────────────────────────────────────────
// Main function that runs the MCP server
// ──────────────────────────────────────────────────────────────────────────────
async function main() {
  const API_KEY = process.env.LIMITLESS_API_KEY;
  if (!API_KEY) {
    console.error("Error: LIMITLESS_API_KEY environment variable is not set");
    console.error("Please set it to your Limitless API key");
    process.exit(1);
  }

  // Define types for Limitless API responses
  interface Lifelog {
    id: string;
    title: string;
    markdown?: string;
    startTime?: string;
    endTime?: string;
    contents?: Array<{
      type: string;
      content: string;
      startTime?: string;
      endTime?: string;
      startOffsetMs?: number;
      endOffsetMs?: number;
      children?: any[];
      speakerName?: string;
      speakerIdentifier?: string | null;
    }>;
  }

  interface LifelogResponse {
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

  const BASE = "https://api.limitless.ai/v1";
  const call = async (path: string, qs: Record<string, unknown> = {}): Promise<LifelogResponse> => {
    // Convert all query parameter values to strings
    const params = new URLSearchParams();
    Object.entries(qs).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });
    
    try {
      const response = await request(`${BASE}${path}?${params}`, {
        headers: { "X-API-Key": API_KEY }
      });
      return response.body.json() as Promise<LifelogResponse>;
    } catch (error) {
      console.error("API call error:", error);
      throw error;
    }
  };

  // ──────────────────────────────────────────────────────────────────────────────
  // 1. Spin up the server object
  // ──────────────────────────────────────────────────────────────────────────────
  const server = new McpServer({
    name: "limitless",
    version: "0.3.0"
  });

  // ──────────────────────────────────────────────────────────────────────────────
  // 2. Resources  (virtual markdown files for Claude to read)
  // ──────────────────────────────────────────────────────────────────────────────
  server.resource(
    "lifelogs",
    new ResourceTemplate("lifelogs://{id}", { 
      list: async () => {
        const response = await call("/lifelogs", { limit: 25 });
        const logs = response.data.lifelogs || [];
        return {
          resources: logs.map((l) => ({
            name: l.title,
            uri: `lifelogs://${l.id}`,
            description: l.title
          }))
        };
      }
    }),
    {} as ResourceMetadata,
    async (uri: URL) => {
      const id = uri.host;                             // lifelogs://<id>
      const response = await call(`/lifelogs/${id}`);
      const lifelog = response.data.lifelog;
      return {
        contents: [{ uri: uri.href, text: lifelog?.markdown ?? "(empty)" }]
      };
    }
  );

  // ──────────────────────────────────────────────────────────────────────────────
  // 3. Tools  (callable functions)
  // ──────────────────────────────────────────────────────────────────────────────
  
  // List lifelogs with enhanced filtering options
  server.tool(
    "list_lifelogs",
    { 
      limit: z.number().optional(),
      date: z.string().optional().describe("Date in YYYY-MM-DD format"),
      timezone: z.string().optional().describe("IANA timezone specifier"),
      start: z.string().optional().describe("Start date/time in YYYY-MM-DD or YYYY-MM-DD HH:mm:SS format"),
      end: z.string().optional().describe("End date/time in YYYY-MM-DD or YYYY-MM-DD HH:mm:SS format"),
      direction: z.enum(["asc", "desc"]).optional().describe("Sort direction: asc or desc")
    },
    async ({ limit = 10, date, timezone, start, end, direction }) => {
      const response = await call("/lifelogs", { 
        limit, 
        date, 
        timezone, 
        start, 
        end, 
        direction,
        includeMarkdown: true
      });
      
      const lifelogs = response.data.lifelogs || [];
      const nextCursor = response.meta?.lifelogs?.nextCursor;
      
      let resultText = lifelogs.map((l) => {
        let timeInfo = "";
        if (l.startTime) {
          const startDate = new Date(l.startTime);
          timeInfo = ` (${startDate.toLocaleString()})`;
        }
        return `${l.id} — ${l.title}${timeInfo}`;
      }).join("\n");
      
      if (nextCursor) {
        resultText += `\n\n[More results available. Use cursor: ${nextCursor}]`;
      }
      
      return {
        content: [{
          type: "text",
          text: lifelogs.length ? resultText : "No lifelogs found for the specified criteria."
        }]
      };
    }
  );

  // Pagination support for lifelogs
  server.tool(
    "get_paged_lifelogs",
    { 
      cursor: z.string().describe("Pagination cursor from previous results"),
      limit: z.number().optional(),
      date: z.string().optional().describe("Date in YYYY-MM-DD format"),
      timezone: z.string().optional().describe("IANA timezone specifier"),
      direction: z.enum(["asc", "desc"]).optional().describe("Sort direction: asc or desc")
    },
    async ({ cursor, limit = 10, date, timezone, direction }) => {
      const response = await call("/lifelogs", { 
        cursor,
        limit, 
        date, 
        timezone, 
        direction,
        includeMarkdown: true
      });
      
      const lifelogs = response.data.lifelogs || [];
      const nextCursor = response.meta?.lifelogs?.nextCursor;
      
      let resultText = lifelogs.map((l) => {
        let timeInfo = "";
        if (l.startTime) {
          const startDate = new Date(l.startTime);
          timeInfo = ` (${startDate.toLocaleString()})`;
        }
        return `${l.id} — ${l.title}${timeInfo}`;
      }).join("\n");
      
      if (nextCursor) {
        resultText += `\n\n[More results available. Use cursor: ${nextCursor}]`;
      }
      
      return {
        content: [{
          type: "text",
          text: lifelogs.length ? resultText : "No lifelogs found for the specified criteria."
        }]
      };
    }
  );

  // Get a specific lifelog by ID
  server.tool(
    "get_lifelog",
    { 
      id: z.string().describe("The ID of the lifelog to retrieve")
    },
    async ({ id }) => {
      try {
        const response = await call(`/lifelogs/${id}`);
        const lifelog = response.data.lifelog;
        
        if (!lifelog) {
          return {
            content: [{
              type: "text",
              text: `No lifelog found with ID: ${id}`
            }]
          };
        }
        
        let formattedTime = "";
        if (lifelog.startTime) {
          const startDate = new Date(lifelog.startTime);
          formattedTime = ` (${startDate.toLocaleString()})`;
        }
        
        const header = `# ${lifelog.title}${formattedTime}\n\nID: ${lifelog.id}\n\n`;
        const content = lifelog.markdown || "(No content available)";
        
        return {
          content: [{
            type: "text",
            text: header + content
          }]
        };
      } catch (error) {
        console.error(`Error fetching lifelog ${id}:`, error);
        return {
          content: [{
            type: "text",
            text: `Error retrieving lifelog ${id}. Please check if the ID is correct.`
          }]
        };
      }
    }
  );

  // Get only metadata for a lifelog
  server.tool(
    "get_lifelog_metadata",
    { 
      id: z.string().describe("The ID of the lifelog to retrieve metadata for")
    },
    async ({ id }) => {
      try {
        const response = await call(`/lifelogs/${id}`, { includeMarkdown: false });
        const lifelog = response.data.lifelog;
        
        if (!lifelog) {
          return {
            content: [{
              type: "text",
              text: `No lifelog found with ID: ${id}`
            }]
          };
        }
        
        // Format metadata
        let metadata = `# Metadata for Lifelog: ${lifelog.title}\n\n`;
        metadata += `- **ID**: ${lifelog.id}\n`;
        
        if (lifelog.startTime) {
          const startDate = new Date(lifelog.startTime);
          metadata += `- **Start Time**: ${startDate.toLocaleString()}\n`;
        }
        
        if (lifelog.endTime) {
          const endDate = new Date(lifelog.endTime);
          metadata += `- **End Time**: ${endDate.toLocaleString()}\n`;
        }
        
        if (lifelog.startTime && lifelog.endTime) {
          const start = new Date(lifelog.startTime).getTime();
          const end = new Date(lifelog.endTime).getTime();
          const durationMs = end - start;
          const minutes = Math.floor(durationMs / 60000);
          const seconds = Math.floor((durationMs % 60000) / 1000);
          metadata += `- **Duration**: ${minutes}m ${seconds}s\n`;
        }
        
        // Add content structure information if available
        if (lifelog.contents && lifelog.contents.length > 0) {
          metadata += `- **Content Blocks**: ${lifelog.contents.length}\n`;
          
          // Count by type
          const typeCounts: Record<string, number> = {};
          lifelog.contents.forEach(content => {
            typeCounts[content.type] = (typeCounts[content.type] || 0) + 1;
          });
          
          metadata += `- **Content Types**:\n`;
          Object.entries(typeCounts).forEach(([type, count]) => {
            metadata += `  - ${type}: ${count}\n`;
          });
          
          // Speaker information
          const speakers = new Set<string>();
          lifelog.contents.forEach(content => {
            if (content.speakerName) {
              speakers.add(content.speakerName);
            }
          });
          
          if (speakers.size > 0) {
            metadata += `- **Speakers**: ${Array.from(speakers).join(', ')}\n`;
          }
        }
        
        return {
          content: [{
            type: "text",
            text: metadata
          }]
        };
      } catch (error) {
        console.error(`Error fetching lifelog metadata ${id}:`, error);
        return {
          content: [{
            type: "text",
            text: `Error retrieving lifelog metadata for ${id}. Please check if the ID is correct.`
          }]
        };
      }
    }
  );

  // Filter lifelog contents by various criteria
  server.tool(
    "filter_lifelog_contents",
    { 
      id: z.string().describe("The ID of the lifelog to filter content from"),
      speakerName: z.string().optional().describe("Filter by speaker name"),
      contentType: z.string().optional().describe("Filter by content type (e.g., heading1, blockquote)"),
      timeStart: z.string().optional().describe("Filter content after this time (ISO-8601)"),
      timeEnd: z.string().optional().describe("Filter content before this time (ISO-8601)")
    },
    async ({ id, speakerName, contentType, timeStart, timeEnd }) => {
      try {
        const response = await call(`/lifelogs/${id}`);
        const lifelog = response.data.lifelog;
        
        if (!lifelog || !lifelog.contents) {
          return {
            content: [{
              type: "text",
              text: `No content found for lifelog with ID: ${id}`
            }]
          };
        }
        
        let filteredContents = lifelog.contents;
        
        // Apply filters
        if (speakerName) {
          filteredContents = filteredContents.filter(c => 
            c.speakerName && c.speakerName.toLowerCase().includes(speakerName.toLowerCase())
          );
        }
        
        if (contentType) {
          filteredContents = filteredContents.filter(c => c.type === contentType);
        }
        
        if (timeStart) {
          const startTime = new Date(timeStart).getTime();
          filteredContents = filteredContents.filter(c => {
            if (!c.startTime) return true;
            return new Date(c.startTime).getTime() >= startTime;
          });
        }
        
        if (timeEnd) {
          const endTime = new Date(timeEnd).getTime();
          filteredContents = filteredContents.filter(c => {
            if (!c.endTime) return true;
            return new Date(c.endTime).getTime() <= endTime;
          });
        }
        
        if (filteredContents.length === 0) {
          return {
            content: [{
              type: "text",
              text: "No content matched the filter criteria."
            }]
          };
        }
        
        // Format the filtered content
        let result = `# Filtered Content from "${lifelog.title}"\n\n`;
        result += `Found ${filteredContents.length} matching content blocks out of ${lifelog.contents.length} total.\n\n`;
        
        filteredContents.forEach((content, index) => {
          let timeInfo = "";
          if (content.startTime) {
            const time = new Date(content.startTime).toLocaleTimeString();
            timeInfo = ` (${time})`;
          }
          
          let speaker = content.speakerName ? `**${content.speakerName}**: ` : "";
          
          result += `## Block ${index + 1}${timeInfo}\n${speaker}${content.content}\n\n`;
        });
        
        return {
          content: [{
            type: "text",
            text: result
          }]
        };
      } catch (error) {
        console.error(`Error filtering lifelog ${id}:`, error);
        return {
          content: [{
            type: "text",
            text: `Error filtering lifelog ${id}. Please check if the ID is correct.`
          }]
        };
      }
    }
  );

  // Generate a formatted transcript from a lifelog
  server.tool(
    "generate_transcript",
    { 
      id: z.string().describe("The ID of the lifelog to generate transcript from"),
      format: z.enum(["simple", "detailed", "dialogue"]).default("dialogue").describe("Transcript format style")
    },
    async ({ id, format }) => {
      try {
        const response = await call(`/lifelogs/${id}`);
        const lifelog = response.data.lifelog;
        
        if (!lifelog || !lifelog.contents) {
          return {
            content: [{
              type: "text",
              text: `No content found for lifelog with ID: ${id}`
            }]
          };
        }
        
        // Extract and sort content by time if available
        let contents = [...(lifelog.contents || [])];
        contents.sort((a, b) => {
          if (!a.startTime || !b.startTime) return 0;
          return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
        });
        
        let transcript = "";
        
        // Generate transcript based on requested format
        switch (format) {
          case "simple":
            transcript = `# ${lifelog.title} - Simple Transcript\n\n`;
            contents.forEach(content => {
              transcript += `${content.content}\n\n`;
            });
            break;
            
          case "detailed":
            transcript = `# ${lifelog.title} - Detailed Transcript\n\n`;
            contents.forEach((content, index) => {
              let timeInfo = "";
              if (content.startTime) {
                timeInfo = `[${new Date(content.startTime).toLocaleTimeString()}] `;
              }
              
              transcript += `### Block ${index + 1}\n${timeInfo}${content.type}: ${content.content}\n\n`;
            });
            break;
            
          case "dialogue":
          default:
            transcript = `# ${lifelog.title} - Dialogue Transcript\n\n`;
            
            let currentSpeaker = "";
            let dialogueBlock = "";
            
            contents.forEach(content => {
              // If it's a new speaker or a heading
              if (content.speakerName && content.speakerName !== currentSpeaker) {
                // Add the previous block if it exists
                if (dialogueBlock) {
                  transcript += dialogueBlock + "\n\n";
                }
                
                // Start a new dialogue block
                currentSpeaker = content.speakerName;
                dialogueBlock = `**${currentSpeaker}**: ${content.content}`;
              } else if (content.type.startsWith("heading")) {
                // Add the previous block if it exists
                if (dialogueBlock) {
                  transcript += dialogueBlock + "\n\n";
                }
                
                // Reset speaker and add heading
                currentSpeaker = "";
                dialogueBlock = `## ${content.content}`;
              } else if (currentSpeaker) {
                // Continue with the current speaker
                dialogueBlock += " " + content.content;
              } else {
                // No speaker but not a heading, treat as narrative
                if (dialogueBlock) {
                  transcript += dialogueBlock + "\n\n";
                }
                dialogueBlock = content.content;
              }
            });
            
            // Add the last block
            if (dialogueBlock) {
              transcript += dialogueBlock;
            }
            break;
        }
        
        return {
          content: [{
            type: "text",
            text: transcript
          }]
        };
      } catch (error) {
        console.error(`Error generating transcript for ${id}:`, error);
        return {
          content: [{
            type: "text",
            text: `Error generating transcript for lifelog ${id}. Please check if the ID is correct.`
          }]
        };
      }
    }
  );

  // Get time summary and statistics
  server.tool(
    "get_time_summary",
    { 
      date: z.string().optional().describe("Date in YYYY-MM-DD format"),
      timezone: z.string().optional().describe("IANA timezone specifier"),
      start: z.string().optional().describe("Start date in YYYY-MM-DD format"),
      end: z.string().optional().describe("End date in YYYY-MM-DD format"),
      groupBy: z.enum(["hour", "day", "week"]).default("day").describe("How to group the time statistics")
    },
    async ({ date, timezone = "America/Los_Angeles", start, end, groupBy = "day" }) => {
      try {
        // Determine date range
        let queryParams: Record<string, unknown> = { 
          limit: 100, 
          timezone,
          direction: "asc"
        };
        
        if (date) {
          queryParams.date = date;
        } else if (start && end) {
          queryParams.start = start;
          queryParams.end = end;
        } else if (start) {
          queryParams.start = start;
          // Default to 7 days if only start is provided
          const endDate = new Date(start);
          endDate.setDate(endDate.getDate() + 7);
          queryParams.end = endDate.toISOString().split('T')[0];
        } else if (end) {
          queryParams.end = end;
          // Default to 7 days before if only end is provided
          const startDate = new Date(end);
          startDate.setDate(startDate.getDate() - 7);
          queryParams.start = startDate.toISOString().split('T')[0];
        } else {
          // Default to last 7 days
          const endDate = new Date();
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - 7);
          queryParams.start = startDate.toISOString().split('T')[0];
          queryParams.end = endDate.toISOString().split('T')[0];
        }
        
        const response = await call("/lifelogs", queryParams);
        const lifelogs = response.data.lifelogs || [];
        
        if (lifelogs.length === 0) {
          return {
            content: [{
              type: "text",
              text: "No lifelogs found for the specified time period."
            }]
          };
        }
        
        // Calculate statistics
        interface TimeStats {
          count: number;
          totalDurationMs: number;
          averageDurationMs: number;
          key: string;
        }
        
        const stats: Record<string, TimeStats> = {};
        let totalDuration = 0;
        let countWithDuration = 0;
        
        lifelogs.forEach(log => {
          if (!log.startTime) return;
          
          let key = "";
          const date = new Date(log.startTime);
          
          switch (groupBy) {
            case "hour":
              key = `${date.toLocaleDateString()} ${date.getHours()}:00`;
              break;
            case "week":
              // Get the monday of the week
              const day = date.getDay();
              const diff = date.getDate() - day + (day === 0 ? -6 : 1);
              const monday = new Date(date);
              monday.setDate(diff);
              key = `Week of ${monday.toLocaleDateString()}`;
              break;
            case "day":
            default:
              key = date.toLocaleDateString();
              break;
          }
          
          if (!stats[key]) {
            stats[key] = {
              count: 0,
              totalDurationMs: 0,
              averageDurationMs: 0,
              key
            };
          }
          
          stats[key].count++;
          
          if (log.startTime && log.endTime) {
            const start = new Date(log.startTime).getTime();
            const end = new Date(log.endTime).getTime();
            const duration = end - start;
            
            stats[key].totalDurationMs += duration;
            totalDuration += duration;
            countWithDuration++;
          }
        });
        
        // Calculate averages
        Object.values(stats).forEach(stat => {
          if (stat.count > 0) {
            stat.averageDurationMs = stat.totalDurationMs / stat.count;
          }
        });
        
        // Sort by key for proper chronological display
        const sortedStats = Object.values(stats).sort((a, b) => a.key.localeCompare(b.key));
        
        // Generate report
        let summary = `# Time Summary Analysis`;
        
        if (date) {
          summary += ` for ${date}`;
        } else if (start && end) {
          summary += ` from ${start} to ${end}`;
        }
        summary += `\n\n`;
        
        summary += `Total lifelogs: ${lifelogs.length}\n`;
        
        if (countWithDuration > 0) {
          const totalHours = Math.floor(totalDuration / 3600000);
          const totalMinutes = Math.floor((totalDuration % 3600000) / 60000);
          summary += `Total recording time: ${totalHours}h ${totalMinutes}m\n`;
          summary += `Average per recording: ${Math.floor((totalDuration / countWithDuration) / 60000)}m\n\n`;
        }
        
        summary += `## Breakdown by ${groupBy}\n\n`;
        summary += `| ${groupBy === "hour" ? "Hour" : groupBy === "week" ? "Week" : "Date"} | Count | Total Time | Avg Time |\n`;
        summary += `| --- | --- | --- | --- |\n`;
        
        sortedStats.forEach(stat => {
          const totalHours = Math.floor(stat.totalDurationMs / 3600000);
          const totalMinutes = Math.floor((stat.totalDurationMs % 3600000) / 60000);
          const totalTime = stat.totalDurationMs > 0 ? `${totalHours}h ${totalMinutes}m` : "N/A";
          
          const avgMinutes = Math.floor(stat.averageDurationMs / 60000);
          const avgSeconds = Math.floor((stat.averageDurationMs % 60000) / 1000);
          const avgTime = stat.averageDurationMs > 0 ? `${avgMinutes}m ${avgSeconds}s` : "N/A";
          
          summary += `| ${stat.key} | ${stat.count} | ${totalTime} | ${avgTime} |\n`;
        });
        
        return {
          content: [{
            type: "text",
            text: summary
          }]
        };
      } catch (error) {
        console.error(`Error generating time summary:`, error);
        return {
          content: [{
            type: "text",
            text: `Error generating time summary. Please check your date parameters.`
          }]
        };
      }
    }
  );

  // Search lifelogs with enhanced filtering
  server.tool(
    "search_lifelogs",
    { 
      query: z.string().describe("Text to search for in lifelogs"), 
      limit: z.number().optional(),
      date: z.string().optional().describe("Date in YYYY-MM-DD format"),
      timezone: z.string().optional().describe("IANA timezone specifier"),
      start: z.string().optional().describe("Start date/time in YYYY-MM-DD or YYYY-MM-DD HH:mm:SS format"),
      end: z.string().optional().describe("End date/time in YYYY-MM-DD or YYYY-MM-DD HH:mm:SS format")
    },
    async ({ query, limit = 10, date, timezone, start, end }) => {
      // First get the lifelogs based on date criteria
      const response = await call("/lifelogs", { 
        limit: Math.min(limit * 3, 25), // Get more than we need to increase search chances
        date, 
        timezone, 
        start, 
        end,
        includeMarkdown: true
      });
      
      const logs = response.data.lifelogs || [];
      
      // Then filter them by search term
      const hits = logs.filter((l) =>
        (l.markdown ?? "").toLowerCase().includes(query.toLowerCase()) ||
        (l.title ?? "").toLowerCase().includes(query.toLowerCase())
      ).slice(0, limit);
      
      let resultText = hits.map((l) => {
        let timeInfo = "";
        if (l.startTime) {
          const startDate = new Date(l.startTime);
          timeInfo = ` (${startDate.toLocaleString()})`;
        }
        return `${l.id} — «${l.title}»${timeInfo}`;
      }).join("\n");
      
      return {
        content: [{
          type: "text",
          text: hits.length
            ? resultText
            : "No matches found for the specified criteria."
        }]
      };
    }
  );

  // Get a specific day's summary
  server.tool(
    "get_day_summary",
    { 
      date: z.string().describe("Date in YYYY-MM-DD format"),
      timezone: z.string().optional().describe("IANA timezone specifier")
    },
    async ({ date, timezone = "America/Los_Angeles" }) => {
      const response = await call("/lifelogs", { 
        date, 
        timezone,
        includeMarkdown: true,
        limit: 25
      });
      
      const lifelogs = response.data.lifelogs || [];
      
      if (lifelogs.length === 0) {
        return {
          content: [{
            type: "text",
            text: `No lifelogs found for ${date}`
          }]
        };
      }
      
      // Format the lifelogs into a summary
      const formattedDate = new Date(date).toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        timeZone: timezone
      });
      
      let summary = `# Summary for ${formattedDate}\n\n`;
      summary += `Found ${lifelogs.length} lifelogs for this day.\n\n`;
      
      lifelogs.forEach((log, index) => {
        const startTime = log.startTime ? new Date(log.startTime).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit', 
          timeZone: timezone
        }) : 'Unknown time';
        
        summary += `## ${index + 1}. ${log.title} (${startTime})\n`;
        summary += `ID: ${log.id}\n`;
        
        // Add a brief excerpt if available
        if (log.markdown) {
          const excerpt = log.markdown.substring(0, 150) + (log.markdown.length > 150 ? '...' : '');
          summary += `\n${excerpt}\n\n`;
        }
        
        summary += `---\n\n`;
      });
      
      return {
        content: [{
          type: "text",
          text: summary
        }]
      };
    }
  );

  // ──────────────────────────────────────────────────────────────────────────────
  // 4. Start the server over stdio (Claude / VS Code / etc. expect this)
  // ──────────────────────────────────────────────────────────────────────────────
  try {
    await server.connect(new StdioServerTransport());
    // Log to stderr instead of stdout to avoid interfering with JSON communication
    console.error("Server connected successfully");
  } catch (error) {
    console.error("Failed to connect server:", error);
    process.exit(1);
  }
}

// Execute the main function
main().catch(error => {
  console.error("Unhandled error:", error);
  process.exit(1);
});