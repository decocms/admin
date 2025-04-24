<prompt>
  <instructions>
    You are to generate a single valid TypeScript module that exports a default class using the `export default class` syntax. Your response must strictly follow the constraints below.

    After creating this file, please run:
    ```bash
    deno run -A https://mcp.deco.host
    ```
  </instructions>

<requirements>
    <typescript>
      <strictTyping>Use well-defined TypeScript types. Avoid using <code>any</code> or <code>unknown</code>.</strictTyping>
      <functionTyping>All function inputs and outputs must be explicitly typed.</functionTyping>
    </typescript>

    <imports>
      <noImportAlias>Do not use import aliases.</noImportAlias>
      <npmSpecifier>For NPM modules, use <code>npm:</code> specifiers (e.g., <code>npm:colors</code>).</npmSpecifier>
      <jsrSpecifier>For JSR modules, use <code>jsr:</code> specifiers (e.g., <code>jsr:@std/assert</code>).</jsrSpecifier>
    </imports>

    <class>
      <syntax>Must be declared as <code>export default class ClassName</code>.</syntax>
      <constructor>
        <jsDoc>
          <nameTag>Use <code>@name</code> with the app name in <strong>ALL_CAPS_SNAKE_CASE</strong>.</nameTag>
        </jsDoc>
      </constructor>
      <publicMethods>
        <documentation>
          <descriptionTag>Each method must have a <code>@description</code> JSDoc describing its functionality and purpose clearly for LLM context.</descriptionTag>
        </documentation>
      </publicMethods>
    </class>

</requirements>

<types>
    <declaration>Use TypeScript <code>interface</code> or <code>type</code> for any structured data. Each type should have:</declaration>
    <jsDoc>
      <nameTag><code>@name</code> annotation with PascalCase naming.</nameTag>
      <descriptionTag><code>@description</code> annotation that clearly defines the purpose of the type.</descriptionTag>
    </jsDoc>
    <rule>Don't just add comments on top of types or properties, always use @description</rule>
  </types>

<example>
    <code language="typescript">
{`/**
 * @name ListTweetsInput
 * @description Input type for listing tweets.
 */
interface ListTweetsInput {
  /** @description Twitter username (without @) */
  username: string;
  /** @description Number of tweets to fetch (default: 5) */
  count?: number;
}

/**

- @name Tweet
- @description Type representing a tweet. */ interface Tweet { id: string; text:
  string; time: string; url: string; }

/**

- @name TwitterPublicClient
- @description A client to fetch public tweets from Twitter ("X") without
  authentication, by scraping the public web page. _/ export default class
  TwitterPublicClient { /_*
  - @name TWITTER
  - @description Initializes the TwitterPublicClient. */ constructor() { }

/**

- @name LIST_TWEETS
- @description Lists public tweets from a given Twitter username.
- @param input - The input containing the username and optional count.
- @returns An array of tweets. */ public async listTweets(input:
  ListTweetsInput): Promise<Tweet[]> { const { username, count = 5 } = input;
  const url = \`https://nitter.net/\${encodeURIComponent(username)}\`; const res
  = await fetch(url); if (!res.ok) throw new Error('Failed to fetch tweets');
  const html = await res.text();

    // Simple HTML parsing to extract tweets
    const tweetRegex = /<div class="tweet-content media-body">([\\s\\S]*?)<\\/div>/g;
    const timeRegex = /<span class="tweet-date">.*?title="([^"]+)"/;
    const idRegex = /href="\\/[^\\/]+\\/status\\/(\\d+)"/;
    const urlRegex = /href="(\\/[^\\/]+\\/status\\/\\d+)"/;

    const tweets: Tweet[] = [];
    let match;
    while ((match = tweetRegex.exec(html)) && tweets.length < count) {
      const content = match[1].replace(/<[^>]+>/g, '').trim();
      const timeMatch = timeRegex.exec(match[0]);
      const idMatch = idRegex.exec(match[0]);
      const urlMatch = urlRegex.exec(match[0]);
      if (content && idMatch && timeMatch && urlMatch) {
        tweets.push({
          id: idMatch[1],
          text: content,
          time: timeMatch[1],
          url: \`https://nitter.net\${urlMatch[1]}\`,
        });
      }
    }
    return tweets;

} }`}
</code>
</example>

<utils>
    In case of util functions, don't implement them as class methods. Use normal functions in the file scope
</utils>

<output>
    The output should be a **single valid TypeScript file** with the default class export and accompanying interfaces/types. Do not output anything else.
  </output>
</prompt>