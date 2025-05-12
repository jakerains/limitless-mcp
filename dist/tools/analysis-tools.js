import { McpError, ErrorCode } from '../utils/errors';
import { z } from "zod";
import callLimitlessApi from "../api/client";
import cache from "../cache";
import config from "../config";
import { generateSummary, generateCombinedSummary, extractTopics, getTimeRangeText } from "../utils";
/**
 * Register analysis tools on the MCP server
 */
export function registerAnalysisTools(server) {
    // Single lifelog summarization tool
    server.tool("summarize_lifelog", {
        id: z.string().describe("The ID of the lifelog to summarize"),
        level: z.enum(["brief", "detailed", "comprehensive"]).default("detailed").describe("Level of summarization detail"),
        focus: z.enum(["general", "key_points", "decisions", "questions", "action_items"]).default("general").describe("Focus of the summary")
    }, async ({ id, level, focus }) => {
        try {
            // Check cache first for this summary
            const summaryCacheKey = `summary_${id}_${level}_${focus}`;
            const cachedSummary = cache.get(summaryCacheKey);
            if (cachedSummary) {
                console.error(`Cache hit for summary: ${summaryCacheKey}`);
                return {
                    content: [{
                            type: "text",
                            text: cachedSummary
                        }]
                };
            }
            console.error(`Cache miss for summary: ${summaryCacheKey}`);
            // Get the lifelog data
            const response = await callLimitlessApi(`/lifelogs/${id}`);
            const lifelog = response.data.lifelog;
            if (!lifelog || !lifelog.markdown) {
                throw new McpError(ErrorCode.NotFound, `No content found for lifelog with ID: ${id}`, { id });
            }
            // Generate the summary based on the content
            const summary = generateSummary(lifelog, level, focus);
            // Store in cache with a longer TTL since summaries are expensive to regenerate
            // and don't change unless the underlying data changes (which is rare for lifelogs)
            const summaryTtl = config.CACHE_TTL * config.CACHE_TTL_MULTIPLIERS.SUMMARIES;
            cache.set(summaryCacheKey, summary, summaryTtl);
            console.error(`Cached summary for ${id} with TTL ${summaryTtl}s`);
            return {
                content: [{
                        type: "text",
                        text: summary
                    }]
            };
        }
        catch (error) {
            console.error(`Error summarizing lifelog ${id}:`, error);
            // If it's already an McpError, rethrow it
            if (error instanceof McpError) {
                throw error;
            }
            // Handle HTTP status errors
            if (error.statusCode) {
                if (error.statusCode === 404) {
                    throw new McpError(`Lifelog with ID ${id} not found`, ErrorCode.NotFound);
                }
                else if (error.statusCode === 401 || error.statusCode === 403) {
                    throw new McpError(`Unauthorized access to Limitless API`, ErrorCode.Unauthorized);
                }
                else if (error.statusCode >= 500) {
                    throw new McpError(`Limitless API service error: ${error.statusCode}`, ErrorCode.ServiceUnavailable);
                }
            }
            // Generic error fallback
            throw new McpError(`Error summarizing lifelog ${id}: ${error.message || 'Unknown error'}`, ErrorCode.Internal);
        }
    });
    // Multi-lifelog summarization tool
    server.tool("summarize_lifelogs", {
        ids: z.array(z.string()).describe("Array of lifelog IDs to summarize"),
        level: z.enum(["brief", "detailed"]).default("brief").describe("Level of summarization detail"),
        combinedView: z.boolean().default(true).describe("Whether to provide a combined summary")
    }, async ({ ids, level, combinedView }) => {
        if (!ids || ids.length === 0) {
            throw new McpError(ErrorCode.InvalidParams, "Please provide at least one lifelog ID to summarize.", { ids });
        }
        try {
            // Generate a cache key for the multi-lifelog summary
            const sortedIds = [...ids].sort().join(',');
            const multiSummaryCacheKey = `multi_summary_${sortedIds}_${level}_${combinedView ? 'combined' : 'separate'}`;
            // Check cache first
            const cachedSummary = cache.get(multiSummaryCacheKey);
            if (cachedSummary) {
                console.error(`Cache hit for multi-lifelog summary: ${multiSummaryCacheKey}`);
                return {
                    content: [{
                            type: "text",
                            text: cachedSummary
                        }]
                };
            }
            console.error(`Cache miss for multi-lifelog summary: ${multiSummaryCacheKey}`);
            // Fetch all the lifelogs in parallel
            const fetchPromises = ids.map(id => callLimitlessApi(`/lifelogs/${id}`));
            const responses = await Promise.all(fetchPromises);
            // Extract and validate the lifelogs
            const lifelogs = responses
                .map(response => response.data.lifelog)
                .filter(log => log && log.markdown);
            if (lifelogs.length === 0) {
                throw new McpError(ErrorCode.NotFound, "None of the provided lifelog IDs contained valid content.", { ids });
            }
            // Sort lifelogs by time if available
            lifelogs.sort((a, b) => {
                if (!a.startTime || !b.startTime)
                    return 0;
                return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
            });
            // Generate summary content
            let summaryText = "";
            if (combinedView) {
                // Generate a single combined summary
                const timeRange = getTimeRangeText(lifelogs);
                summaryText = `# Combined Summary of ${lifelogs.length} Lifelogs\n\n`;
                summaryText += timeRange ? `Time Range: ${timeRange}\n\n` : "";
                // Extract all speakers across logs
                const allSpeakers = new Set();
                lifelogs.forEach(log => {
                    if (log.contents) {
                        log.contents.forEach(content => {
                            if (content.speakerName) {
                                allSpeakers.add(content.speakerName);
                            }
                        });
                    }
                });
                if (allSpeakers.size > 0) {
                    summaryText += `Participants: ${Array.from(allSpeakers).join(', ')}\n\n`;
                }
                // Generate the combined summary
                summaryText += generateCombinedSummary(lifelogs, level);
            }
            else {
                // Generate individual summaries
                summaryText = `# Summaries of ${lifelogs.length} Lifelogs\n\n`;
                lifelogs.forEach((log, index) => {
                    const individualSummary = generateSummary(log, level, "general");
                    summaryText += `## ${index + 1}. ${log.title}\n\n${individualSummary}\n\n---\n\n`;
                });
            }
            // Cache the summary results for future use
            const summaryTtl = config.CACHE_TTL * config.CACHE_TTL_MULTIPLIERS.SUMMARIES;
            cache.set(multiSummaryCacheKey, summaryText, summaryTtl);
            console.error(`Cached multi-lifelog summary with TTL ${summaryTtl}s`);
            return {
                content: [{
                        type: "text",
                        text: summaryText
                    }]
            };
        }
        catch (error) {
            console.error(`Error summarizing multiple lifelogs:`, error);
            // If it's already an McpError, rethrow it
            if (error instanceof McpError) {
                throw error;
            }
            // Generic error fallback
            throw new McpError(ErrorCode.Internal, `Error summarizing lifelogs: ${error.message || 'Unknown error'}`, { ids });
        }
    });
    // Topic extraction from lifelogs
    server.tool("extract_topics", {
        ids: z.array(z.string()).describe("Array of lifelog IDs to analyze"),
        maxTopics: z.number().default(10).describe("Maximum number of topics to extract"),
        minOccurrences: z.number().default(3).describe("Minimum occurrences required to include a topic"),
        mode: z.enum(["keywords", "phrases"]).default("keywords").describe("Extraction mode: keywords or phrases"),
        excludeCommonWords: z.boolean().default(true).describe("Whether to exclude common English words")
    }, async ({ ids, maxTopics, minOccurrences, mode, excludeCommonWords }) => {
        if (!ids || ids.length === 0) {
            throw new McpError(ErrorCode.InvalidParams, "Please provide at least one lifelog ID to analyze", { ids });
        }
        try {
            // Generate a cache key based on input parameters
            const sortedIds = [...ids].sort().join(',');
            const topicsCacheKey = `topics_${sortedIds}_${maxTopics}_${minOccurrences}_${mode}_${excludeCommonWords}`;
            // Check if we have cached results
            const cachedTopics = cache.get(topicsCacheKey);
            let topics;
            let lifelogsCount;
            if (cachedTopics) {
                console.error(`Cache hit for topics: ${topicsCacheKey}`);
                topics = cachedTopics.topics;
                lifelogsCount = cachedTopics.lifelogsCount;
            }
            else {
                console.error(`Cache miss for topics: ${topicsCacheKey}`);
                // Fetch all the lifelogs in parallel
                const fetchPromises = ids.map(id => callLimitlessApi(`/lifelogs/${id}`));
                const responses = await Promise.all(fetchPromises);
                // Extract and validate the lifelogs
                const lifelogs = responses
                    .map(response => response.data.lifelog)
                    .filter(log => log && log.markdown);
                if (lifelogs.length === 0) {
                    throw new McpError(ErrorCode.NotFound, "None of the provided lifelog IDs contained valid content.", { ids });
                }
                // Extract topics from the lifelogs
                topics = extractTopics(lifelogs, maxTopics, minOccurrences, mode, excludeCommonWords);
                lifelogsCount = lifelogs.length;
                // Cache the results for future use
                // Topic extraction is computationally expensive, so cache for longer duration
                const topicsTtl = config.CACHE_TTL * config.CACHE_TTL_MULTIPLIERS.SUMMARIES; // Use same TTL as summaries
                cache.set(topicsCacheKey, { topics, lifelogsCount }, topicsTtl);
                console.error(`Cached topics with TTL ${topicsTtl}s`);
            }
            // Format the response
            let resultText = `# Topics Extracted from ${lifelogsCount} Lifelogs\n\n`;
            if (topics.length === 0) {
                resultText += "No significant topics were found matching the criteria.\n";
            }
            else {
                // Add metadata about the extraction
                resultText += `## Extraction Parameters\n`;
                resultText += `- Mode: ${mode}\n`;
                resultText += `- Minimum occurrences: ${minOccurrences}\n`;
                resultText += `- Common words excluded: ${excludeCommonWords ? "Yes" : "No"}\n\n`;
                // List the topics with their frequency
                resultText += `## ${topics.length} Topics Found\n\n`;
                topics.forEach((topic, index) => {
                    resultText += `${index + 1}. **${topic.name}** - ${topic.count} occurrences\n`;
                });
                // Add usage suggestion
                resultText += `\n_Use these topics to guide further analysis or as search terms._`;
            }
            return {
                content: [{
                        type: "text",
                        text: resultText
                    }]
            };
        }
        catch (error) {
            console.error(`Error extracting topics:`, error);
            // If it's already an McpError, rethrow it
            if (error instanceof McpError) {
                throw error;
            }
            // Generic error fallback
            throw new McpError(ErrorCode.Internal, `Error extracting topics: ${error.message || 'Unknown error'}`, { ids });
        }
    });
}
