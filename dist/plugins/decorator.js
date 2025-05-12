import { z } from "zod";
/**
 * A plugin that adds decorations and formatting to lifelog content
 */
export class DecoratorPlugin {
    constructor() {
        this.name = "decorator";
        this.description = "Adds decorations and formatting options to lifelog content";
        this.version = "1.0.0";
        this.config = {};
        // Keeps track of templates
        this.templates = new Map();
    }
    async initialize(server, config) {
        this.server = server;
        this.config = config;
        // Load default templates
        this.templates.set("simple", "# {title}\n\n{content}");
        this.templates.set("detailed", "# {title}\n\nDate: {date}\nID: {id}\n\n{content}");
        this.templates.set("report", "# Report: {title}\n\n## Summary\n\n{summary}\n\n## Details\n\n{content}");
        // Load custom templates from config if available
        if (config.templates && typeof config.templates === 'object') {
            for (const [name, template] of Object.entries(config.templates)) {
                if (typeof template === 'string') {
                    this.templates.set(name, template);
                }
            }
        }
        // Register tool for templating
        server.tool("apply_template", {
            id: z.string().describe("The ID of the lifelog to format"),
            template: z.string().describe("Name of the template to use or custom template string"),
            variables: z.record(z.string()).optional().describe("Additional variables to use in the template")
        }, async ({ id, template, variables = {} }) => {
            try {
                // Get lifelog content
                const response = await this.callLimitlessAPI(`/lifelogs/${id}`);
                const lifelog = response.data.lifelog;
                if (!lifelog) {
                    return {
                        content: [{
                                type: "text",
                                text: `No lifelog found with ID: ${id}`
                            }]
                    };
                }
                // Get the template - either a named one or the string itself
                let templateText = this.templates.get(template) || template;
                // Prepare the data for template variables
                const data = {
                    id: lifelog.id,
                    title: lifelog.title || 'Untitled',
                    content: lifelog.markdown || '',
                    date: lifelog.startTime ? new Date(lifelog.startTime).toLocaleString() : 'Unknown date',
                    ...variables
                };
                // If no summary provided but requested in template, generate one
                if (templateText.includes('{summary}') && !data.summary) {
                    data.summary = this.generateSummary(lifelog.markdown || '');
                }
                // Apply the template
                const result = this.applyTemplate(templateText, data);
                return {
                    content: [{
                            type: "text",
                            text: result
                        }]
                };
            }
            catch (error) {
                console.error(`Error applying template to lifelog ${id}:`, error);
                return {
                    content: [{
                            type: "text",
                            text: `Error applying template: ${error}`
                        }]
                };
            }
        });
        // Register tool to manage templates
        server.tool("manage_templates", {
            action: z.enum(["list", "get", "add", "delete"]).describe("Action to perform"),
            name: z.string().optional().describe("Template name for get/add/delete actions"),
            template: z.string().optional().describe("Template content for add action")
        }, async ({ action, name, template }) => {
            try {
                switch (action) {
                    case "list":
                        // List all available templates
                        const templateList = Array.from(this.templates.keys());
                        let result = "# Available Templates\n\n";
                        templateList.forEach(templateName => {
                            result += `- ${templateName}\n`;
                        });
                        return {
                            content: [{
                                    type: "text",
                                    text: result
                                }]
                        };
                    case "get":
                        // Get a specific template
                        if (!name) {
                            return {
                                content: [{
                                        type: "text",
                                        text: "Please provide a template name to get."
                                    }]
                            };
                        }
                        const templateContent = this.templates.get(name);
                        if (!templateContent) {
                            return {
                                content: [{
                                        type: "text",
                                        text: `Template "${name}" not found.`
                                    }]
                            };
                        }
                        return {
                            content: [{
                                    type: "text",
                                    text: `# Template: ${name}\n\n\`\`\`\n${templateContent}\n\`\`\``
                                }]
                        };
                    case "add":
                        // Add or update a template
                        if (!name || !template) {
                            return {
                                content: [{
                                        type: "text",
                                        text: "Please provide both name and template content to add a template."
                                    }]
                            };
                        }
                        this.templates.set(name, template);
                        return {
                            content: [{
                                    type: "text",
                                    text: `Template "${name}" has been ${this.templates.has(name) ? "updated" : "added"}.`
                                }]
                        };
                    case "delete":
                        // Delete a template
                        if (!name) {
                            return {
                                content: [{
                                        type: "text",
                                        text: "Please provide a template name to delete."
                                    }]
                            };
                        }
                        if (!this.templates.has(name)) {
                            return {
                                content: [{
                                        type: "text",
                                        text: `Template "${name}" not found.`
                                    }]
                            };
                        }
                        this.templates.delete(name);
                        return {
                            content: [{
                                    type: "text",
                                    text: `Template "${name}" has been deleted.`
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
            }
            catch (error) {
                console.error(`Error managing templates:`, error);
                return {
                    content: [{
                            type: "text",
                            text: `Error managing templates: ${error}`
                        }]
                };
            }
        });
    }
    // Apply a template with variable substitution
    applyTemplate(template, data) {
        return template.replace(/{([^}]+)}/g, (match, key) => {
            return data[key] !== undefined ? data[key] : match;
        });
    }
    // Generate a simple summary (first paragraph or first few sentences)
    generateSummary(content) {
        // Try to get first paragraph
        const firstParagraph = content.split(/\n\n+/)[0];
        if (firstParagraph && firstParagraph.length > 20) {
            return firstParagraph;
        }
        // If first paragraph is too short, try to get first 2-3 sentences
        const sentences = content.split(/[.!?]+\s+/).filter(s => s.trim().length > 0);
        if (sentences.length > 0) {
            return sentences.slice(0, Math.min(3, sentences.length)).join('. ') + '.';
        }
        return "No content available for summary.";
    }
    // Helper to call the Limitless API
    async callLimitlessAPI(path, qs = {}) {
        // This assumes the API call function is implemented elsewhere
        // In a real plugin, you would need to either pass this function in or use a service
        console.error(`Would call API: ${path} with params:`, qs);
        throw new Error("API access not implemented for this example plugin");
    }
}
