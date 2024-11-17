import { AtpAgent } from '@atproto/api';
import 'dotenv/config';
import OpenAI from "openai";
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';

const agent = new AtpAgent({
  service: 'https://bsky.social'
});
const openai = new OpenAI();
// from https://docs.bsky.app/docs/api/app-bsky-feed-search-posts
const searchQuerySchema = z.object({
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "Search Query Schema",
  "description": "Schema for defining search query parameters in a structured way.",
  "properties": {
    "q": {
      "type": "string",
      "description": "Search query string; syntax, phrase, boolean, and faceting is unspecified, but Lucene query syntax is recommended.",
      "minLength": 1
    },
    "sort": {
      "type": "string",
      "description": "Specifies the ranking order of results.",
      "enum": ["top", "latest"],
      "default": "latest"
    },
    "since": {
      "type": "string",
      "description": "Filter results for posts after the indicated datetime (inclusive). Expected to use 'sortAt' timestamp, which may not match 'createdAt'. Can be a datetime, or just an ISO date (YYYY-MM-DD).",
      "format": "date-time"
    },
    "until": {
      "type": "string",
      "description": "Filter results for posts before the indicated datetime (not inclusive). Expected to use 'sortAt' timestamp, which may not match 'createdAt'. Can be a datetime, or just an ISO date (YYYY-MM-DD).",
      "format": "date-time"
    },
    "mentions": {
      "type": "string",
      "description": "Filter to posts which mention the given account. Handles are resolved to DID before query-time. Only matches rich-text facet mentions."
    },
    "author": {
      "type": "string",
      "description": "Filter to posts by the given account. Handles are resolved to DID before query-time."
    },
    "lang": {
      "type": "string",
      "description": "Filter to posts in the given language. Expected to be based on post language field, though server may override language detection."
    },
    "domain": {
      "type": "string",
      "description": "Filter to posts with URLs (facet links or embeds) linking to the given domain (hostname). Server may apply hostname normalization."
    },
    "url": {
      "type": "string",
      "description": "Filter to posts with links (facet links or embeds) pointing to this URL. Server may apply URL normalization or fuzzy matching.",
      "format": "uri"
    },
    "tag": {
      "type": "array",
      "description": "Filter to posts with the given tag (hashtag), based on rich-text facet or tag field. Do not include the hash (#) prefix. Multiple tags can be specified, with 'AND' matching.",
      "items": {
        "type": "string",
        "maxLength": 640
      }
    },
    "limit": {
      "type": "integer",
      "description": "Limit the number of results returned.",
      "minimum": 1,
      "maximum": 100,
      "default": 25
    },
    "cursor": {
      "type": "string",
      "description": "Optional pagination mechanism; may not necessarily allow scrolling through entire result set."
    }
  },
  "required": ["q"]
});

(async () => {
  const result = await agent.login({
    identifier: process.env.BSKY_USER,
    password: process.env.BSKY_PASS
  });
  const description = 'Find a conversation where people are discussing the geopolitics of the American economy';
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "Produce the best search query for finding posts based on the description provided. The search is carried away on BlueSky, a social network very similar to Twitter." },
      { role: "user", content: description },
    ],
    response_format: zodResponseFormat(searchQuerySchema, "searchq")
  });
  const searchq = completion.choices[0].message

  // If the model refuses to respond, you will get a refusal message
  if (searchq.refusal) {
    console.log(searchq.refusal);
  } else {
    const search = await agent.app.bsky.feed.searchPosts(
      searchq.parsed
    );
    console.log(search);
  }
  // Perhaps use the results to refine the search recursively.
  // That is: figure out new search queries based on the results of the previous search, etc, etc.

  await agent.logout();
})();

