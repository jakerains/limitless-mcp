import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { LimitlessPlugin } from "./types";

/**
 * A plugin that provides natural language time reference parsing
 */
export class TimeParserPlugin implements LimitlessPlugin {
  name = "time-parser";
  description = "Parses natural language time references into specific date ranges";
  version = "1.0.0";
  
  private server?: McpServer;
  private config: Record<string, any> = {};
  
  async initialize(server: McpServer, config: Record<string, any>): Promise<void> {
    this.server = server;
    this.config = config;
    
    // Register tool for parsing natural language time references
    server.tool(
      "parse_time_reference",
      {
        timeReference: z.string().describe("Natural language time reference (e.g., 'yesterday', 'last week')"),
        timezone: z.string().optional().describe("IANA timezone specifier (e.g., 'America/New_York')"),
        referenceDate: z.string().optional().describe("Reference date in YYYY-MM-DD format (defaults to today)")
      },
      async ({ timeReference, timezone = "UTC", referenceDate }) => {
        try {
          // Parse the reference date or use current date
          let refDate: Date;
          
          if (referenceDate) {
            refDate = new Date(referenceDate);
          } else {
            refDate = new Date();
          }
          
          // Make sure the reference date is valid
          if (isNaN(refDate.getTime())) {
            return {
              content: [{
                type: "text",
                text: `Invalid reference date: ${referenceDate}`
              }]
            };
          }
          
          // Apply timezone if provided
          if (timezone) {
            try {
              // Format the date with the specified timezone
              const options: Intl.DateTimeFormatOptions = { 
                timeZone: timezone 
              };
              const formatter = new Intl.DateTimeFormat('en-US', options);
              const tzDate = new Date(formatter.format(refDate));
              
              // If this doesn't throw, timezone is valid
              refDate.toLocaleString('en-US', { timeZone: timezone });
            } catch (error) {
              return {
                content: [{
                  type: "text",
                  text: `Invalid timezone: ${timezone}`
                }]
              };
            }
          }
          
          // Parse the time reference
          const result = this.parseTimeReference(timeReference, refDate, timezone);
          
          if (!result.success || !result.start || !result.end) {
            return {
              content: [{
                type: "text",
                text: result.error || "Unable to parse time reference."
              }]
            };
          }
          
          // Format the date range nicely
          const { start, end } = result;
          
          const formatOptions: Intl.DateTimeFormatOptions = {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            timeZone: timezone
          };
          
          const startFormatted = start.toLocaleString('en-US', formatOptions);
          const endFormatted = end.toLocaleString('en-US', formatOptions);
          
          // Format for API consumption (ISO format)
          const startISO = start.toISOString();
          const endISO = end.toISOString();
          
          return {
            content: [{
              type: "text",
              text: `# Parsed Time Reference: "${timeReference}"\n\n` +
                   `Reference Date: ${refDate.toLocaleDateString('en-US', { timeZone: timezone })}\n` +
                   `Timezone: ${timezone}\n\n` +
                   `## Results\n\n` +
                   `- **Start**: ${startFormatted}\n` +
                   `- **End**: ${endFormatted}\n\n` +
                   `## ISO Formatted (for API use)\n\n` +
                   `- **Start**: \`${startISO}\`\n` +
                   `- **End**: \`${endISO}\`\n\n` +
                   `## Search Parameters\n\n` +
                   `\`\`\`json\n` +
                   `{\n` +
                   `  "start": "${startISO}",\n` +
                   `  "end": "${endISO}",\n` +
                   `  "timezone": "${timezone}"\n` +
                   `}\n` +
                   `\`\`\``
            }]
          };
          
        } catch (error) {
          console.error(`Error parsing time reference:`, error);
          return {
            content: [{
              type: "text",
              text: `Error parsing time reference: ${error}`
            }]
          };
        }
      }
    );
    
    // Register tool for search with natural language time
    server.tool(
      "search_with_time",
      {
        query: z.string().describe("Search query text"),
        timeReference: z.string().describe("Natural language time reference (e.g., 'yesterday', 'last week')"),
        timezone: z.string().optional().describe("IANA timezone specifier"),
        limit: z.number().optional(),
        includeContent: z.boolean().default(false).describe("Whether to include content in results")
      },
      async ({ query, timeReference, timezone = "UTC", limit = 10, includeContent }) => {
        try {
          // Parse the time reference
          const refDate = new Date();
          const timeResult = this.parseTimeReference(timeReference, refDate, timezone);
          
          if (!timeResult.success || !timeResult.start || !timeResult.end) {
            return {
              content: [{
                type: "text",
                text: timeResult.error || "Unable to parse time reference."
              }]
            };
          }
          
          // Format the date range for display
          const { start, end } = timeResult;
          
          // The actual search call would happen here
          // In a real implementation, this would call the Limitless API
          
          return {
            content: [{
              type: "text",
              text: `# Search Results for "${query}" during ${timeReference}\n\n` +
                   `Time period: ${start.toLocaleString()} to ${end.toLocaleString()}\n\n` +
                   `The search would be performed with these parameters:\n\n` +
                   `\`\`\`json\n` +
                   `{\n` +
                   `  "query": "${query}",\n` +
                   `  "start": "${start.toISOString()}",\n` +
                   `  "end": "${end.toISOString()}",\n` +
                   `  "timezone": "${timezone}",\n` +
                   `  "limit": ${limit},\n` +
                   `  "includeContent": ${includeContent}\n` +
                   `}\n` +
                   `\`\`\`\n\n` +
                   `Note: This is a placeholder response. The actual search functionality would call the Limitless API.`
            }]
          };
          
        } catch (error) {
          console.error(`Error searching with time reference:`, error);
          return {
            content: [{
              type: "text",
              text: `Error searching with time reference: ${error}`
            }]
          };
        }
      }
    );
    
    // Enhance existing list_lifelogs and search_lifelogs tools to accept natural language time
    this.enhanceExistingTools(server);
  }
  
  // Add natural language time capabilities to existing tools
  private enhanceExistingTools(server: McpServer): void {
    // This is a placeholder for the implementation
    // In a real implementation, we would monkey-patch the existing tools
    // or register new tools with the same names but enhanced functionality
    console.error("Natural language time enhancements would be applied to existing tools");
  }
  
  // Parse a natural language time reference into a date range
  private parseTimeReference(
    reference: string, 
    refDate: Date = new Date(),
    timezone: string = "UTC"
  ): { 
    success: boolean; 
    start?: Date; 
    end?: Date; 
    error?: string 
  } {
    // Normalize the reference
    const normalizedRef = reference.toLowerCase().trim();
    
    // For creating dates in the specified timezone
    const createDate = (year: number, month: number, day: number, hour: number = 0, minute: number = 0): Date => {
      const date = new Date(Date.UTC(year, month, day, hour, minute));
      // Apply timezone adjustment
      const offset = this.getTimezoneOffset(timezone, date);
      date.setTime(date.getTime() - offset);
      return date;
    };
    
    // Get reference date components
    const refYear = refDate.getFullYear();
    const refMonth = refDate.getMonth();
    const refDay = refDate.getDate();
    const refDayOfWeek = refDate.getDay(); // 0 = Sunday, 6 = Saturday
    
    // Handle different time references
    try {
      // Today
      if (normalizedRef === "today") {
        const start = createDate(refYear, refMonth, refDay, 0, 0);
        const end = createDate(refYear, refMonth, refDay, 23, 59);
        return { success: true, start, end };
      }
      
      // Yesterday
      if (normalizedRef === "yesterday") {
        const yesterday = new Date(refDate);
        yesterday.setDate(refDate.getDate() - 1);
        
        const yesterdayYear = yesterday.getFullYear();
        const yesterdayMonth = yesterday.getMonth();
        const yesterdayDay = yesterday.getDate();
        
        const start = createDate(yesterdayYear, yesterdayMonth, yesterdayDay, 0, 0);
        const end = createDate(yesterdayYear, yesterdayMonth, yesterdayDay, 23, 59);
        return { success: true, start, end };
      }
      
      // Tomorrow
      if (normalizedRef === "tomorrow") {
        const tomorrow = new Date(refDate);
        tomorrow.setDate(refDate.getDate() + 1);
        
        const tomorrowYear = tomorrow.getFullYear();
        const tomorrowMonth = tomorrow.getMonth();
        const tomorrowDay = tomorrow.getDate();
        
        const start = createDate(tomorrowYear, tomorrowMonth, tomorrowDay, 0, 0);
        const end = createDate(tomorrowYear, tomorrowMonth, tomorrowDay, 23, 59);
        return { success: true, start, end };
      }
      
      // This week
      if (normalizedRef === "this week") {
        // Get the start of the week (Sunday)
        const daysToSunday = refDayOfWeek;
        const startDay = new Date(refDate);
        startDay.setDate(refDay - daysToSunday);
        
        // Get the end of the week (Saturday)
        const daysToSaturday = 6 - refDayOfWeek;
        const endDay = new Date(refDate);
        endDay.setDate(refDay + daysToSaturday);
        
        const start = createDate(startDay.getFullYear(), startDay.getMonth(), startDay.getDate(), 0, 0);
        const end = createDate(endDay.getFullYear(), endDay.getMonth(), endDay.getDate(), 23, 59);
        return { success: true, start, end };
      }
      
      // Last week
      if (normalizedRef === "last week") {
        // Get the start of last week (Sunday)
        const daysToLastSunday = refDayOfWeek + 7;
        const startDay = new Date(refDate);
        startDay.setDate(refDay - daysToLastSunday);
        
        // Get the end of last week (Saturday)
        const daysToLastSaturday = 6 - refDayOfWeek + 7;
        const endDay = new Date(refDate);
        endDay.setDate(refDay - daysToLastSaturday);
        
        const start = createDate(startDay.getFullYear(), startDay.getMonth(), startDay.getDate(), 0, 0);
        const end = createDate(endDay.getFullYear(), endDay.getMonth(), endDay.getDate(), 23, 59);
        return { success: true, start, end };
      }
      
      // Next week
      if (normalizedRef === "next week") {
        // Get the start of next week (Sunday)
        const daysToNextSunday = 7 - refDayOfWeek;
        const startDay = new Date(refDate);
        startDay.setDate(refDay + daysToNextSunday);
        
        // Get the end of next week (Saturday)
        const daysToNextSaturday = 13 - refDayOfWeek;
        const endDay = new Date(refDate);
        endDay.setDate(refDay + daysToNextSaturday);
        
        const start = createDate(startDay.getFullYear(), startDay.getMonth(), startDay.getDate(), 0, 0);
        const end = createDate(endDay.getFullYear(), endDay.getMonth(), endDay.getDate(), 23, 59);
        return { success: true, start, end };
      }
      
      // This month
      if (normalizedRef === "this month") {
        const start = createDate(refYear, refMonth, 1, 0, 0);
        
        // Get the last day of the month
        const lastDay = new Date(refYear, refMonth + 1, 0).getDate();
        const end = createDate(refYear, refMonth, lastDay, 23, 59);
        
        return { success: true, start, end };
      }
      
      // Last month
      if (normalizedRef === "last month") {
        // Get the first day of last month
        const lastMonthDate = new Date(refDate);
        lastMonthDate.setMonth(refMonth - 1);
        
        const lastMonthYear = lastMonthDate.getFullYear();
        const lastMonth = lastMonthDate.getMonth();
        
        const start = createDate(lastMonthYear, lastMonth, 1, 0, 0);
        
        // Get the last day of last month
        const lastDay = new Date(lastMonthYear, lastMonth + 1, 0).getDate();
        const end = createDate(lastMonthYear, lastMonth, lastDay, 23, 59);
        
        return { success: true, start, end };
      }
      
      // Next month
      if (normalizedRef === "next month") {
        // Get the first day of next month
        const nextMonthDate = new Date(refDate);
        nextMonthDate.setMonth(refMonth + 1);
        
        const nextMonthYear = nextMonthDate.getFullYear();
        const nextMonth = nextMonthDate.getMonth();
        
        const start = createDate(nextMonthYear, nextMonth, 1, 0, 0);
        
        // Get the last day of next month
        const lastDay = new Date(nextMonthYear, nextMonth + 1, 0).getDate();
        const end = createDate(nextMonthYear, nextMonth, lastDay, 23, 59);
        
        return { success: true, start, end };
      }
      
      // Last X days
      const lastDaysMatch = normalizedRef.match(/^last\s+(\d+)\s+days?$/);
      if (lastDaysMatch) {
        const days = parseInt(lastDaysMatch[1], 10);
        
        if (isNaN(days) || days <= 0) {
          return { 
            success: false, 
            error: "Invalid number of days. Please specify a positive number." 
          };
        }
        
        // Get the start date (X days ago)
        const startDay = new Date(refDate);
        startDay.setDate(refDay - days);
        
        // End date is yesterday (since "last X days" typically excludes today)
        const endDay = new Date(refDate);
        endDay.setDate(refDay - 1);
        
        const start = createDate(startDay.getFullYear(), startDay.getMonth(), startDay.getDate(), 0, 0);
        const end = createDate(endDay.getFullYear(), endDay.getMonth(), endDay.getDate(), 23, 59);
        
        return { success: true, start, end };
      }
      
      // Next X days
      const nextDaysMatch = normalizedRef.match(/^next\s+(\d+)\s+days?$/);
      if (nextDaysMatch) {
        const days = parseInt(nextDaysMatch[1], 10);
        
        if (isNaN(days) || days <= 0) {
          return { 
            success: false, 
            error: "Invalid number of days. Please specify a positive number." 
          };
        }
        
        // Start date is tomorrow (since "next X days" typically excludes today)
        const startDay = new Date(refDate);
        startDay.setDate(refDay + 1);
        
        // Get the end date (X days from tomorrow)
        const endDay = new Date(refDate);
        endDay.setDate(refDay + days);
        
        const start = createDate(startDay.getFullYear(), startDay.getMonth(), startDay.getDate(), 0, 0);
        const end = createDate(endDay.getFullYear(), endDay.getMonth(), endDay.getDate(), 23, 59);
        
        return { success: true, start, end };
      }
      
      // Last X weeks
      const lastWeeksMatch = normalizedRef.match(/^last\s+(\d+)\s+weeks?$/);
      if (lastWeeksMatch) {
        const weeks = parseInt(lastWeeksMatch[1], 10);
        
        if (isNaN(weeks) || weeks <= 0) {
          return { 
            success: false, 
            error: "Invalid number of weeks. Please specify a positive number." 
          };
        }
        
        // Get the start date (X weeks ago from the start of this week)
        const daysToSunday = refDayOfWeek;
        const thisWeekSunday = new Date(refDate);
        thisWeekSunday.setDate(refDay - daysToSunday);
        
        const startDay = new Date(thisWeekSunday);
        startDay.setDate(thisWeekSunday.getDate() - (7 * weeks));
        
        // End date is the Saturday before this week
        const endDay = new Date(thisWeekSunday);
        endDay.setDate(thisWeekSunday.getDate() - 1);
        
        const start = createDate(startDay.getFullYear(), startDay.getMonth(), startDay.getDate(), 0, 0);
        const end = createDate(endDay.getFullYear(), endDay.getMonth(), endDay.getDate(), 23, 59);
        
        return { success: true, start, end };
      }
      
      // Specific day of week
      const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
      const dayOfWeekIndex = dayNames.indexOf(normalizedRef);
      
      if (dayOfWeekIndex !== -1) {
        // Find the most recent occurrence of this day
        const dayDiff = (refDayOfWeek - dayOfWeekIndex + 7) % 7;
        const dayDate = new Date(refDate);
        
        if (dayDiff === 0) {
          // It's today, so use today
          dayDate.setDate(refDay);
        } else {
          // Use the most recent past occurrence
          dayDate.setDate(refDay - dayDiff);
        }
        
        const start = createDate(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), 0, 0);
        const end = createDate(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), 23, 59);
        
        return { success: true, start, end };
      }
      
      // Last [day of week]
      for (const dayName of dayNames) {
        if (normalizedRef === `last ${dayName}`) {
          const targetDayIndex = dayNames.indexOf(dayName);
          
          // Calculate days difference to the previous occurrence
          let dayDiff = (refDayOfWeek - targetDayIndex + 7) % 7;
          
          // If today is the target day, we need to go back a full week
          if (dayDiff === 0) {
            dayDiff = 7;
          }
          
          const dayDate = new Date(refDate);
          dayDate.setDate(refDay - dayDiff);
          
          const start = createDate(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), 0, 0);
          const end = createDate(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), 23, 59);
          
          return { success: true, start, end };
        }
      }
      
      // Handle more complex cases like "3 days ago" and "2 weeks ago"
      
      // X days ago
      const daysAgoMatch = normalizedRef.match(/^(\d+)\s+days?\s+ago$/);
      if (daysAgoMatch) {
        const daysAgo = parseInt(daysAgoMatch[1], 10);
        
        if (isNaN(daysAgo) || daysAgo <= 0) {
          return { 
            success: false, 
            error: "Invalid number of days. Please specify a positive number." 
          };
        }
        
        const dayDate = new Date(refDate);
        dayDate.setDate(refDay - daysAgo);
        
        const start = createDate(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), 0, 0);
        const end = createDate(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), 23, 59);
        
        return { success: true, start, end };
      }
      
      // X weeks ago
      const weeksAgoMatch = normalizedRef.match(/^(\d+)\s+weeks?\s+ago$/);
      if (weeksAgoMatch) {
        const weeksAgo = parseInt(weeksAgoMatch[1], 10);
        
        if (isNaN(weeksAgo) || weeksAgo <= 0) {
          return { 
            success: false, 
            error: "Invalid number of weeks. Please specify a positive number." 
          };
        }
        
        // Get the date X weeks ago
        const weeksDate = new Date(refDate);
        weeksDate.setDate(refDay - (7 * weeksAgo));
        
        // Calculate the start and end of that week
        const weekDayOfWeek = weeksDate.getDay();
        
        // Start of the week (Sunday)
        const startDay = new Date(weeksDate);
        startDay.setDate(weeksDate.getDate() - weekDayOfWeek);
        
        // End of the week (Saturday)
        const endDay = new Date(weeksDate);
        endDay.setDate(weeksDate.getDate() + (6 - weekDayOfWeek));
        
        const start = createDate(startDay.getFullYear(), startDay.getMonth(), startDay.getDate(), 0, 0);
        const end = createDate(endDay.getFullYear(), endDay.getMonth(), endDay.getDate(), 23, 59);
        
        return { success: true, start, end };
      }
      
      // Relative date ranges like "from X to Y"
      const rangeMatch = normalizedRef.match(/^from\s+(.+)\s+to\s+(.+)$/);
      if (rangeMatch) {
        const fromRef = rangeMatch[1].trim();
        const toRef = rangeMatch[2].trim();
        
        // Parse the individual references
        const fromResult = this.parseTimeReference(fromRef, refDate, timezone);
        const toResult = this.parseTimeReference(toRef, refDate, timezone);
        
        if (!fromResult.success || !fromResult.start) {
          return { 
            success: false, 
            error: `Could not parse the start date: ${fromRef}` 
          };
        }
        
        if (!toResult.success || !toResult.end) {
          return { 
            success: false, 
            error: `Could not parse the end date: ${toRef}` 
          };
        }
        
        return { 
          success: true, 
          start: fromResult.start, 
          end: toResult.end 
        };
      }
      
      // If we couldn't match any pattern
      return { 
        success: false, 
        error: `Could not parse time reference: "${reference}"` 
      };
      
    } catch (error) {
      return { 
        success: false, 
        error: `Error parsing time reference: ${error}` 
      };
    }
  }
  
  // Helper to get timezone offset in milliseconds
  private getTimezoneOffset(timezone: string, date: Date): number {
    try {
      // Get the time in the specified timezone
      const options: Intl.DateTimeFormatOptions = {
        timeZone: timezone,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false
      };
      
      // Use the formatter to get date parts in the target timezone
      const formatter = new Intl.DateTimeFormat('en-US', options);
      const parts = formatter.formatToParts(date);
      
      // Extract the date components
      const timeParts: Record<string, number> = {};
      parts.forEach(part => {
        if (part.type !== 'literal') {
          timeParts[part.type] = parseInt(part.value, 10);
        }
      });
      
      // Create a date in UTC with these components
      const targetDate = Date.UTC(
        timeParts.year,
        timeParts.month - 1, // JavaScript months are 0-indexed
        timeParts.day,
        timeParts.hour,
        timeParts.minute,
        timeParts.second
      );
      
      // Calculate the offset
      return date.getTime() - targetDate;
      
    } catch (error) {
      console.error(`Error calculating timezone offset:`, error);
      return 0; // Default to no offset
    }
  }
}