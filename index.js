import { AtpAgent } from '@atproto/api';
import 'dotenv/config';

console.log(process.env);

const agent = new AtpAgent({
  service: 'https://bsky.social'
});

(async () => {
    const result = await agent.login({
        identifier: process.env.BSKY_USER,
        password: process.env.BSKY_PASS
      });
    console.log(result);
})();

