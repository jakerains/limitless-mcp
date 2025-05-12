# Limitless MCP Usage Examples

This document provides comprehensive examples of how to use the various Limitless MCP tools from Claude or other LLM assistants that support the Model Context Protocol.

## Basic Lifelog Navigation

### Listing Recent Lifelogs

Ask Claude:
```
Show me my most recent lifelogs.
```

Behind the scenes, Claude will use:
```json
{
  "name": "list_lifelogs",
  "params": {
    "limit": 10,
    "direction": "desc"
  }
}
```

Result example:
```
ae12b34c — Morning coffee meeting (2025-04-30 09:15:22)

ab56e78d — Team planning session (2025-04-29 14:30:45)

cd90f12g — Grocery shopping notes (2025-04-28 18:22:10)
```

### Getting a Specific Lifelog

Ask Claude:
```
Show me the full content of lifelog ae12b34c.
```

Behind the scenes, Claude will use:
```json
{
  "name": "get_lifelog",
  "params": {
    "id": "ae12b34c",
    "includeContent": true
  }
}
```

Result example:
```markdown
# Morning coffee meeting (2025-04-30 09:15:22)

ID: ae12b34c

Duration: 32m 15s

Speakers: Jake, Sarah, Carlos

## Notes from our coffee chat

Points we discussed:
- Project timeline adjustments
- New client onboarding process
- Upcoming team offsites

Action items:
- Jake to draft new timeline by Friday
- Sarah to reach out to the client about requirements
- Carlos to book venue for the offsite
```

### Navigating Paged Results

Ask Claude:
```
Show me more lifelogs after the previous list.
```

If the previous list returned a pagination cursor, Claude will use:
```json
{
  "name": "get_paged_lifelogs",
  "params": {
    "cursor": "next_page_cursor_id",
    "limit": 10
  }
}
```

## Search Functionality

### Basic Search

Ask Claude:
```
Search my lifelogs for conversations about "project timeline".
```

Behind the scenes, Claude will use:
```json
{
  "name": "search_lifelogs",
  "params": {
    "query": "project timeline",
    "searchMode": "advanced",
    "includeSnippets": true
  }
}
```

Result example:
```
Found 3 results for "project timeline":

1. Morning coffee meeting (2025-04-30)
   "...we need to adjust the project timeline due to new requirements..."

2. Weekly standup (2025-04-27)
   "...concerns about the project timeline slipping if we don't address..."

3. Client call with XYZ Corp (2025-04-25)
   "...the client is happy with the project timeline we proposed..."
```

### Date-Filtered Search

Ask Claude:
```
Search my lifelogs from last week for mentions of "budget".
```

Behind the scenes, Claude will use the time parser plugin first, then search:
```json
{
  "name": "parse_time_reference",
  "params": {
    "timeReference": "last week"
  }
}
```

Then:
```json
{
  "name": "search_lifelogs",
  "params": {
    "query": "budget",
    "start": "2025-04-22T00:00:00",
    "end": "2025-04-29T23:59:59"
  }
}
```

## Advanced Analysis

### Topic Extraction

Ask Claude:
```
What are the main topics in my lifelogs from yesterday?
```

Behind the scenes, Claude will first get yesterday's lifelogs, then extract topics:
```json
{
  "name": "parse_time_reference",
  "params": {
    "timeReference": "yesterday"
  }
}
```

Then:
```json
{
  "name": "list_lifelogs",
  "params": {
    "date": "2025-05-07",
    "includeContent": false
  }
}
```

Finally:
```json
{
  "name": "extract_topics",
  "params": {
    "ids": ["id1", "id2", "id3"],
    "mode": "keywords",
    "maxTopics": 10,
    "minOccurrences": 3
  }
}
```

Result example:
```
# Topics Extracted from 3 Lifelogs

## Extraction Parameters
- Mode: keywords
- Minimum occurrences: 3
- Common words excluded: Yes

## 10 Topics Found

1. **project** - 24 occurrences
2. **timeline** - 18 occurrences
3. **budget** - 15 occurrences
4. **marketing** - 12 occurrences
5. **requirements** - 11 occurrences
6. **client** - 9 occurrences
7. **deliverables** - 8 occurrences
8. **meeting** - 7 occurrences
9. **presentation** - 6 occurrences
10. **schedule** - 5 occurrences
```

### Content Summarization

Ask Claude:
```
Give me a detailed summary of lifelog ae12b34c, focusing on decisions made.
```

Behind the scenes, Claude will use:
```json
{
  "name": "summarize_lifelog",
  "params": {
    "id": "ae12b34c",
    "level": "detailed",
    "focus": "decisions"
  }
}
```

Result example:
```markdown
# Summary of "Morning coffee meeting" (2025-04-30 09:15:22)

## Decisions & Conclusions

- Decided to extend the project timeline by two weeks to accommodate new requirements
- Agreed to hire an additional designer to help with the increased workload
- Resolved to use the new client onboarding process starting next month
- Approved the budget increase for the team offsite event
- Determined that weekly status meetings will move from Monday to Wednesday
```

### Multi-Lifelog Analysis

Ask Claude:
```
Summarize all my meetings with Sarah from yesterday.
```

Behind the scenes, Claude will first search for meetings with Sarah, then summarize:
```json
{
  "name": "search_lifelogs",
  "params": {
    "query": "Sarah",
    "date": "2025-05-07"
  }
}
```

Then:
```json
{
  "name": "summarize_lifelogs",
  "params": {
    "ids": ["id1", "id2"],
    "level": "brief",
    "combinedView": true
  }
}
```

## Content Processing

### Filtering by Speaker

Ask Claude:
```
Show me only what Sarah said in lifelog ae12b34c.
```

Behind the scenes, Claude will use:
```json
{
  "name": "filter_lifelog_contents",
  "params": {
    "id": "ae12b34c",
    "speakerName": "Sarah"
  }
}
```

Result example:
```
# Morning coffee meeting (filtered by speaker: Sarah)

- "I think we need to adjust the timeline to be realistic."
- "My concern is that we're not allocating enough time for testing."
- "I can reach out to the client about their requirements today."
- "What if we brought in another designer to help with the workload?"
```

### Generating a Transcript

Ask Claude:
```
Create a dialogue transcript from lifelog ae12b34c.
```

Behind the scenes, Claude will use:
```json
{
  "name": "generate_transcript",
  "params": {
    "id": "ae12b34c",
    "format": "dialogue"
  }
}
```

Result example:
```
# Transcript: Morning coffee meeting

Jake: Good morning everyone, thanks for joining. Let's go through the agenda.

Sarah: I think we need to adjust the timeline to be realistic.

Carlos: I agree. The current deadline doesn't account for the new requirements.

Jake: How much more time do you think we need?

Sarah: My concern is that we're not allocating enough time for testing.

Carlos: Two weeks should be sufficient if we can get an extra person.

Jake: Let's plan for that then...
```

## Cache Management

### Viewing Cache Statistics

Ask Claude:
```
Show me the cache statistics for the Limitless MCP server.
```

Behind the scenes, Claude will use:
```json
{
  "name": "manage_cache",
  "params": {
    "action": "stats"
  }
}
```

Result example:
```
# Cache Statistics

## Performance Metrics
- **Total Keys**: 42
- **Hits**: 156
- **Misses**: 78
- **Hit Ratio**: 66.67%
- **Avg. TTL Remaining**: ~120s

## Cache Composition
- **full_lifelog**: 15 (35.7%)
- **lifelog_metadata**: 12 (28.6%)
- **lifelog_listings**: 10 (23.8%)
- **search_results**: 5 (11.9%)
```

### Clearing the Cache

Ask Claude:
```
Clear the Limitless MCP cache.
```

Behind the scenes, Claude will use:
```json
{
  "name": "manage_cache",
  "params": {
    "action": "clear"
  }
}
```

Result example:
```
Cache cleared successfully. 42 entries removed.
```

## Semantic Search

### Creating Embeddings

Ask Claude:
```
Create embeddings for lifelog ae12b34c to enable semantic search.
```

Behind the scenes, Claude will use:
```json
{
  "name": "create_embeddings",
  "params": {
    "id": "ae12b34c"
  }
}
```

### Performing Semantic Search

Ask Claude:
```
Find lifelogs similar to the concept of "team collaboration challenges".
```

Behind the scenes, Claude will use:
```json
{
  "name": "semantic_search",
  "params": {
    "query": "team collaboration challenges",
    "topK": 5,
    "threshold": 0.7
  }
}
```

Result example:
```
# Semantic Search Results for "team collaboration challenges"

1. **Team communication breakdown** (0.91 similarity)
   ID: cf34d56e - 2025-05-02

2. **Project roadblocks discussion** (0.85 similarity)
   ID: ab12c34d - 2025-04-28

3. **Cross-department workflow issues** (0.79 similarity)
   ID: ef56g78h - 2025-04-25

4. **Remote work coordination meeting** (0.72 similarity)
   ID: ij90k12l - 2025-04-22
```

## Tips for Using With Claude

For the best experience with Claude, try these techniques:

1. **Be specific with dates**: "Show me lifelogs from April 25th, 2025" works better than "Show me recent lifelogs".

2. **Use IDs for precision**: When Claude shows you lifelog IDs, use them in follow-up questions for more accurate results.

3. **Combine multiple operations**: Claude can perform sequences of operations, like "Search for meetings with Sarah from last week, summarize them, and extract the key topics."

4. **Refine gradually**: Start with broader searches, then narrow down with more specific filters.

5. **Ask for explanations**: If you're not sure what a tool does, ask Claude to explain it before using it.

6. **Try different formats**: For content like transcripts, try different formats (simple, detailed, dialogue) to find what works best for you.

## Common Troubleshooting

If you encounter issues:

1. **No lifelogs found**: Make sure your Pendant has recorded data and is syncing properly.

2. **API key errors**: Verify your LIMITLESS_API_KEY environment variable is set correctly.

3. **Slow performance**: Try using the manage_cache tool to check cache statistics and see if your cache is being utilized effectively.

4. **Date filtering issues**: Make sure you're using the correct format (YYYY-MM-DD) or try the time parser plugin for natural language dates.

5. **Search not finding expected results**: Try using more specific terms or the semantic search for concept-based retrieval.

---

For more advanced usage and configuration options, see the [README](../README.md) and [plugins.md](plugins.md) documentation.