/**
 * Common phrases to exclude from topic extraction
 */
export const commonPhrases = [
    "going to", "able to", "want to", "need to", "trying to",
    "would be", "could be", "will be", "should be", "might be",
    "this is", "that is", "there is", "these are", "those are",
    "it is", "they are", "we are", "you are", "i am"
];
/**
 * Generate a time range description from a list of lifelogs
 */
export function getTimeRangeText(lifelogs) {
    if (!lifelogs.length)
        return '';
    // Find earliest and latest timestamps
    let earliestTime = null;
    let latestTime = null;
    lifelogs.forEach(log => {
        if (log.startTime) {
            const startTime = new Date(log.startTime);
            if (!earliestTime || startTime < earliestTime) {
                earliestTime = startTime;
            }
        }
        if (log.endTime) {
            const endTime = new Date(log.endTime);
            if (!latestTime || endTime > latestTime) {
                latestTime = endTime;
            }
        }
    });
    if (!earliestTime)
        return '';
    // Format time range
    const formatDate = (date) => {
        return date.toLocaleString();
    };
    if (latestTime) {
        return `${formatDate(earliestTime)} - ${formatDate(latestTime)}`;
    }
    else {
        return formatDate(earliestTime);
    }
}
/**
 * Count occurrences of a term in a text
 */
export function countOccurrences(text, term) {
    const regex = new RegExp(`\\b${term}\\b`, 'gi');
    const matches = text.match(regex);
    return matches ? matches.length : 0;
}
/**
 * Extract a snippet of text around a query term
 */
export function extractSnippet(text, query, contextLength = 100) {
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerText.indexOf(lowerQuery);
    if (index === -1)
        return text.substring(0, 150) + '...';
    const start = Math.max(0, index - contextLength);
    const end = Math.min(text.length, index + query.length + contextLength);
    let snippet = '';
    if (start > 0)
        snippet += '...';
    snippet += text.substring(start, end);
    if (end < text.length)
        snippet += '...';
    return snippet;
}
/**
 * Extract topics from a collection of lifelogs
 */
export function extractTopics(lifelogs, maxTopics = 10, minOccurrences = 3, mode = "keywords", excludeCommonWords = true) {
    if (lifelogs.length === 0)
        return [];
    // Common English words to exclude if requested
    const commonWords = new Set([
        "about", "after", "again", "also", "another", "back", "because", "been", "before",
        "being", "between", "both", "cannot", "could", "does", "during", "each", "either",
        "every", "first", "from", "going", "great", "have", "having", "here", "into", "just",
        "like", "more", "most", "much", "must", "never", "only", "other", "over", "same",
        "should", "since", "some", "still", "such", "than", "that", "their", "them", "then",
        "there", "these", "they", "this", "those", "through", "under", "very", "well", "were",
        "what", "when", "where", "which", "while", "will", "with", "would", "your"
    ]);
    // Combine all content
    const allContent = lifelogs.map(log => log.markdown || "").join(" ");
    let topics = [];
    if (mode === "keywords") {
        // Extract individual keywords
        const words = allContent.toLowerCase().split(/\W+/).filter(word => word.length > 4 &&
            (!excludeCommonWords || !commonWords.has(word)));
        // Count word frequency
        const wordFrequency = {};
        words.forEach(word => {
            wordFrequency[word] = (wordFrequency[word] || 0) + 1;
        });
        // Filter by minimum occurrences
        topics = Object.entries(wordFrequency)
            .filter(([_, count]) => count >= minOccurrences)
            .map(([word, count]) => {
            // Calculate TF-IDF scoring for better relevance
            const docsWithTerm = lifelogs.filter(log => log.markdown?.toLowerCase().includes(word.toLowerCase())).length;
            const tf = count / words.length; // Term frequency
            const idf = Math.log(lifelogs.length / (1 + docsWithTerm)); // Inverse document frequency
            const tfidf = tf * idf;
            // Final score combines raw count and TF-IDF
            const score = (count * 0.5) + (tfidf * 100);
            return {
                name: word,
                count,
                score
            };
        })
            .sort((a, b) => b.score - a.score)
            .slice(0, maxTopics);
    }
    else if (mode === "phrases") {
        // Extract frequent phrases (2-3 words)
        const text = allContent.toLowerCase();
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        // Generate n-grams (phrases of 2-3 words)
        const phrases = {};
        sentences.forEach(sentence => {
            const words = sentence.split(/\W+/).filter(w => w.length > 2 && (!excludeCommonWords || !commonWords.has(w)));
            // Generate 2-word phrases
            for (let i = 0; i < words.length - 1; i++) {
                const phrase = `${words[i]} ${words[i + 1]}`;
                phrases[phrase] = (phrases[phrase] || 0) + 1;
            }
            // Generate 3-word phrases
            for (let i = 0; i < words.length - 2; i++) {
                const phrase = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
                phrases[phrase] = (phrases[phrase] || 0) + 1;
            }
        });
        // Filter by minimum occurrences and length
        topics = Object.entries(phrases)
            .filter(([phrase, count]) => count >= minOccurrences &&
            phrase.length > 5 &&
            !commonPhrases.some(common => phrase.includes(common)))
            .map(([phrase, count]) => {
            // Calculate how many lifelogs contain this phrase
            const docsWithPhrase = lifelogs.filter(log => log.markdown?.toLowerCase().includes(phrase.toLowerCase())).length;
            // Score based on count, phrase length, and document frequency
            const score = count * (phrase.length / 10) * (docsWithPhrase / lifelogs.length);
            return {
                name: phrase,
                count,
                score
            };
        })
            .sort((a, b) => b.score - a.score)
            .slice(0, maxTopics);
    }
    return topics;
}
/**
 * Generate a summary for a single lifelog
 */
export function generateSummary(lifelog, level, focus) {
    if (!lifelog.markdown)
        return "No content available.";
    let summary = "";
    // Add header with basic metadata
    let formattedTime = "";
    if (lifelog.startTime) {
        const startDate = new Date(lifelog.startTime);
        formattedTime = ` (${startDate.toLocaleString()})`;
    }
    summary += `# Summary of "${lifelog.title}"${formattedTime}\n\n`;
    // Extract different types of content based on focus
    const text = lifelog.markdown;
    const lines = text.split('\n');
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    // Different strategies based on level of detail
    if (level === "brief") {
        // Very concise summary
        summary += `Brief overview of the content (${Math.round(text.length / 100)} paragraphs)\n\n`;
        // Extract key headings (if any)
        const headings = lines.filter(line => line.startsWith('#')).slice(0, 3);
        if (headings.length > 0) {
            summary += "Key topics:\n";
            headings.forEach(heading => {
                summary += `- ${heading.replace(/^#+\s*/, '')}\n`;
            });
            summary += "\n";
        }
        // Extract a snippet of the content
        const contentSample = text.substring(0, 300) + (text.length > 300 ? "..." : "");
        summary += contentSample;
    }
    else if (level === "detailed") {
        // More comprehensive summary implementation
        // [Implementation details omitted for brevity]
        // Would include focus-specific extraction logic
        summary += "Detailed summary would be generated here based on focus: " + focus;
    }
    else if (level === "comprehensive") {
        // Most detailed summary implementation
        // [Implementation details omitted for brevity]
        summary += "Comprehensive summary would be generated here based on focus: " + focus;
    }
    return summary;
}
/**
 * Generate a combined summary for multiple lifelogs
 */
export function generateCombinedSummary(lifelogs, level) {
    if (lifelogs.length === 0)
        return "No content available.";
    let summary = "";
    // Total stats
    const totalContent = lifelogs.reduce((acc, log) => acc + (log.markdown?.length || 0), 0);
    const totalWordCount = lifelogs.reduce((acc, log) => {
        return acc + (log.markdown?.split(/\s+/).length || 0);
    }, 0);
    summary += `## Overview\n\n`;
    summary += `This is a summary of ${lifelogs.length} lifelogs containing approximately ${totalWordCount} words.\n\n`;
    // Basic content for different detail levels
    if (level === "brief") {
        // Brief level implementation
        summary += "Brief multi-lifelog summary would be generated here";
    }
    else {
        // Detailed level implementation
        summary += "Detailed multi-lifelog summary would be generated here";
    }
    return summary;
}
