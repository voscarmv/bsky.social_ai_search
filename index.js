import { AtpAgent } from '@atproto/api';
import 'dotenv/config';
import OpenAI from "openai";
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';
import optionParser from "option-parser";

const parser = optionParser();

parser.addOption('h', 'help', 'Display this help message')
  .action(parser.helpAction());

let description = '';

parser.addOption('d', 'description', 'Describe the type of posts you want to see')
  .argument('DESCRIPTION')  // You can name the argument anything you like
  .action(function (value) {
    description = value;
  });

  parser.parse();
console.log(description);

const agent = new AtpAgent({
  service: 'https://bsky.social'
});
const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });
// from https://docs.bsky.app/docs/api/app-bsky-feed-search-posts
const searchQuerySchema = {
  "type": "json_schema",
  "json_schema": {
    name: "search_query_schema",
    schema: {
      type: "object",
      properties: {
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
        // "since": {
        //   "type": "string",
        //   "description": "Filter results for posts after the indicated datetime (inclusive). Expected to use 'sortAt' timestamp, which may not match 'createdAt'. Can be a datetime, or just an ISO date (YYYY-MM-DD).",
        //   "format": "date-time"
        // },
        // "until": {
        //   "type": "string",
        //   "description": "Filter results for posts before the indicated datetime (not inclusive). Expected to use 'sortAt' timestamp, which may not match 'createdAt'. Can be a datetime, or just an ISO date (YYYY-MM-DD).",
        //   "format": "date-time"
        // },
        // "mentions": {
        //   "type": "string",
        //   "description": "Filter to posts which mention the given account. Handles are resolved to DID before query-time. Only matches rich-text facet mentions."
        // },
        // "author": {
        //   "type": "string",
        //   "description": "Filter to posts by the given account. Handles are resolved to DID before query-time."
        // },
        "lang": {
          "type": "string",
          "description": "Filter to posts in the given language. Expected to be based on post language field, though server may override language detection."
        },
        // "domain": {
        //   "type": "string",
        //   "description": "Filter to posts with URLs (facet links or embeds) linking to the given domain (hostname). Server may apply hostname normalization."
        // },
        // "url": {
        //   "type": "string",
        //   "description": "Filter to posts with links (facet links or embeds) pointing to this URL. Server may apply URL normalization or fuzzy matching.",
        //   "format": "uri"
        // },
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
        // "cursor": {
        //   "type": "string",
        //   "description": "Optional pagination mechanism; may not necessarily allow scrolling through entire result set."
        // }
      }
    }
  }
};
const searchQuerySchema2 = z.object({
  q: z.string()
});

(async () => {
  const result = await agent.login({
    identifier: process.env.BSKY_USER,
    password: process.env.BSKY_PASS
  });
//  const description = 'Find a conversation where people are discussing the geopolitics of the American economy';
  const instruction = 'Create the best possible search query to maximize the number of post results. Use single keywords, and also keyphrases inside quotes. You may use some words outside the given description if that will yield better results. Use different subqueries in parentheses separated by || for OR. Also you may use && for "AND" inside the subqueries that are written inside the parentheses, using Lucene query syntax to increase the number of posts found by the search.';
  const completion = await openai.beta.chat.completions.parse({
    model: "gpt-4o",
    messages: [
      { role: "system", content: instruction },
      { role: "user", content: description },
    ],
    /* response_format: zodResponseFormat(searchQuerySchema, "searchq") */
    response_format: searchQuerySchema
  });
  const searchq = completion.choices[0].message
  console.log(searchq);
  // If the model refuses to respond, you will get a refusal message
  if (searchq.refusal) {
    console.log(searchq.refusal);
  } else {
    const search = await agent.app.bsky.feed.searchPosts(
      searchq.parsed
    );
    console.log(search.data.posts);
  }
  // Perhaps use the results to refine the search recursively.
  // That is: figure out new search queries based on the results of the previous search, etc, etc.

  await agent.logout();
})();

