import { z } from "zod";
/**
 * A plugin that provides content processing capabilities
 */
export class ContentProcessorPlugin {
    constructor() {
        this.name = "content-processor";
        this.description = "Processes and transforms lifelog content with various filters";
        this.version = "1.0.0";
        this.config = {};
    }
    async initialize(server, config) {
        this.server = server;
        this.config = config;
        // Register tool for text processing
        server.tool("process_content", {
            id: z.string().describe("The ID of the lifelog to process"),
            operations: z.array(z.object({
                type: z.enum(["filter", "replace", "extract", "transform"]),
                params: z.record(z.any())
            })).describe("List of operations to perform on the content"),
            format: z.enum(["markdown", "text", "json"]).default("markdown").describe("Output format")
        }, async ({ id, operations, format }) => {
            try {
                // Get lifelog content
                const response = await this.callLimitlessAPI(`/lifelogs/${id}`);
                const lifelog = response.data.lifelog;
                if (!lifelog || !lifelog.markdown) {
                    return {
                        content: [{
                                type: "text",
                                text: `No content found for lifelog with ID: ${id}`
                            }]
                    };
                }
                // Apply all specified operations in sequence
                let processedContent = lifelog.markdown || "";
                for (const operation of operations) {
                    processedContent = await this.applyOperation(processedContent, operation.type, operation.params);
                }
                // Format the result
                let formattedResult;
                switch (format) {
                    case "json":
                        formattedResult = JSON.stringify({
                            id: lifelog.id,
                            title: lifelog.title,
                            content: processedContent
                        }, null, 2);
                        break;
                    case "text":
                        // Simple text with no markdown formatting
                        formattedResult = processedContent.replace(/#+\s+/g, '') // Remove markdown headers
                            .replace(/\*\*/g, '') // Remove bold
                            .replace(/\*/g, '') // Remove italic
                            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // Replace links with text
                        break;
                    case "markdown":
                    default:
                        formattedResult = processedContent;
                        break;
                }
                return {
                    content: [{
                            type: "text",
                            text: formattedResult
                        }]
                };
            }
            catch (error) {
                console.error(`Error processing content for lifelog ${id}:`, error);
                return {
                    content: [{
                            type: "text",
                            text: `Error processing lifelog content: ${error}`
                        }]
                };
            }
        });
        // Register tool for batch content processing
        server.tool("batch_process", {
            ids: z.array(z.string()).describe("Array of lifelog IDs to process"),
            operations: z.array(z.object({
                type: z.enum(["filter", "replace", "extract", "transform"]),
                params: z.record(z.any())
            })).describe("List of operations to perform on the content"),
            mergeResults: z.boolean().default(false).describe("Whether to merge results into a single output")
        }, async ({ ids, operations, mergeResults }) => {
            if (!ids || ids.length === 0) {
                return {
                    content: [{
                            type: "text",
                            text: "Please provide at least one lifelog ID to process."
                        }]
                };
            }
            try {
                // Process each lifelog
                const processedResults = [];
                for (const id of ids) {
                    // Get lifelog content
                    const response = await this.callLimitlessAPI(`/lifelogs/${id}`);
                    const lifelog = response.data.lifelog;
                    if (!lifelog || !lifelog.markdown) {
                        continue; // Skip if no content
                    }
                    // Apply operations
                    let processedContent = lifelog.markdown || "";
                    for (const operation of operations) {
                        processedContent = await this.applyOperation(processedContent, operation.type, operation.params);
                    }
                    // Add to results
                    processedResults.push({
                        id: lifelog.id,
                        title: lifelog.title,
                        content: processedContent
                    });
                }
                if (processedResults.length === 0) {
                    return {
                        content: [{
                                type: "text",
                                text: "No valid content found for the specified lifelog IDs."
                            }]
                    };
                }
                // Format output based on mergeResults flag
                let resultText;
                if (mergeResults) {
                    // Combine all processed content
                    resultText = `# Combined Processed Content\n\n`;
                    processedResults.forEach(result => {
                        resultText += `## ${result.title}\n\n${result.content}\n\n---\n\n`;
                    });
                }
                else {
                    // Keep separate
                    resultText = `# Processed Content for ${processedResults.length} Lifelogs\n\n`;
                    processedResults.forEach((result, index) => {
                        resultText += `## ${index + 1}. ${result.title} (ID: ${result.id})\n\n${result.content}\n\n---\n\n`;
                    });
                }
                return {
                    content: [{
                            type: "text",
                            text: resultText
                        }]
                };
            }
            catch (error) {
                console.error(`Error batch processing lifelogs:`, error);
                return {
                    content: [{
                            type: "text",
                            text: `Error batch processing lifelogs: ${error}`
                        }]
                };
            }
        });
    }
    // Helper to call the Limitless API
    async callLimitlessAPI(path, qs = {}) {
        // This assumes the API call function is implemented elsewhere
        // In a real plugin, you would need to either pass this function in or use a service
        // since we don't have access to direct network calls from the plugin
        console.error(`Would call API: ${path} with params:`, qs);
        throw new Error("API access not implemented for this example plugin");
    }
    // Apply an operation to the content
    async applyOperation(content, type, params) {
        switch (type) {
            case "filter":
                return this.filterContent(content, params);
            case "replace":
                return this.replaceContent(content, params);
            case "extract":
                return this.extractContent(content, params);
            case "transform":
                return this.transformContent(content, params);
            default:
                console.error(`Unknown operation type: ${type}`);
                return content;
        }
    }
    // Filter content based on criteria
    filterContent(content, params) {
        const { include, exclude, caseSensitive = false } = params;
        // Split into lines for line-by-line filtering
        const lines = content.split('\n');
        let result = [];
        // Helper for case-insensitive comparison
        const createMatcher = (pattern, caseSensitive) => {
            if (caseSensitive) {
                return (text) => text.includes(pattern);
            }
            else {
                const lowerPattern = pattern.toLowerCase();
                return (text) => text.toLowerCase().includes(lowerPattern);
            }
        };
        // Process includes
        if (include) {
            const patterns = Array.isArray(include) ? include : [include];
            const matchers = patterns.map(pattern => createMatcher(pattern, caseSensitive));
            // Keep lines that match any pattern
            result = lines.filter(line => matchers.some(matcher => matcher(line)));
        }
        else {
            result = lines;
        }
        // Process excludes
        if (exclude) {
            const patterns = Array.isArray(exclude) ? exclude : [exclude];
            const matchers = patterns.map(pattern => createMatcher(pattern, caseSensitive));
            // Remove lines that match any pattern
            result = result.filter(line => !matchers.some(matcher => matcher(line)));
        }
        return result.join('\n');
    }
    // Replace content with regex or string patterns
    replaceContent(content, params) {
        const { pattern, replacement, global = true, caseSensitive = false } = params;
        if (!pattern || replacement === undefined) {
            return content;
        }
        try {
            if (typeof pattern === 'string') {
                // Simple string replacement
                const regex = new RegExp(this.escapeRegExp(pattern), `${global ? 'g' : ''}${caseSensitive ? '' : 'i'}`);
                return content.replace(regex, replacement);
            }
            else {
                // Assume it's already a regex pattern string
                const regex = new RegExp(pattern, `${global ? 'g' : ''}${caseSensitive ? '' : 'i'}`);
                return content.replace(regex, replacement);
            }
        }
        catch (error) {
            console.error(`Error in replace operation:`, error);
            return content;
        }
    }
    // Extract specific sections or matches from content
    extractContent(content, params) {
        const { type = "regex", pattern, context = 0 } = params;
        if (!pattern) {
            return content;
        }
        try {
            switch (type) {
                case "regex": {
                    // Extract content matching a regex
                    const regex = new RegExp(pattern, 'g');
                    const matches = [...content.matchAll(regex)];
                    if (matches.length === 0) {
                        return "No matches found.";
                    }
                    return matches.map(match => match[0]).join('\n\n');
                }
                case "section": {
                    // Extract sections with headings matching the pattern
                    const lines = content.split('\n');
                    const results = [];
                    let inMatchingSection = false;
                    let currentSection = [];
                    // Convert pattern to regex if it's a string
                    const regex = typeof pattern === 'string'
                        ? new RegExp(this.escapeRegExp(pattern), 'i')
                        : new RegExp(pattern, 'i');
                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i];
                        // Check if this is a heading
                        if (line.match(/^#+\s+/)) {
                            // If we were in a matching section, save it
                            if (inMatchingSection && currentSection.length > 0) {
                                results.push(currentSection.join('\n'));
                                currentSection = [];
                            }
                            // Check if this heading matches our pattern
                            inMatchingSection = regex.test(line);
                            if (inMatchingSection) {
                                currentSection.push(line);
                            }
                        }
                        else if (inMatchingSection) {
                            // Continue adding to current section
                            currentSection.push(line);
                        }
                    }
                    // Add the last section if it was matching
                    if (inMatchingSection && currentSection.length > 0) {
                        results.push(currentSection.join('\n'));
                    }
                    return results.join('\n\n---\n\n');
                }
                default:
                    return content;
            }
        }
        catch (error) {
            console.error(`Error in extract operation:`, error);
            return content;
        }
    }
    // Transform content structure or format
    transformContent(content, params) {
        const { type = "none" } = params;
        try {
            switch (type) {
                case "uppercase":
                    return content.toUpperCase();
                case "lowercase":
                    return content.toLowerCase();
                case "titlecase":
                    return content.replace(/\b\w+/g, word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
                case "bulletList": {
                    // Convert paragraphs to bullet list
                    const paragraphs = content.split(/\n\n+/);
                    return paragraphs
                        .filter(p => p.trim().length > 0)
                        .map(p => `- ${p.replace(/\n/g, '\n  ')}`)
                        .join('\n\n');
                }
                case "numberedList": {
                    // Convert paragraphs to numbered list
                    const paragraphs = content.split(/\n\n+/);
                    return paragraphs
                        .filter(p => p.trim().length > 0)
                        .map((p, i) => `${i + 1}. ${p.replace(/\n/g, '\n   ')}`)
                        .join('\n\n');
                }
                default:
                    return content;
            }
        }
        catch (error) {
            console.error(`Error in transform operation:`, error);
            return content;
        }
    }
    // Helper to escape special regex characters
    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}
