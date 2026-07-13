// ─────────────────────────────────────────────────────────────────────────
//  Stolio Goalio — snapshot cron pinger
//  Cloudflare Cron Triggers fire reliably (unlike GitHub's own scheduler),
//  so every 5 min this Worker asks GitHub to run the "EA snapshot" workflow.
//  GitHub's runner has a trusted IP and does the actual EA fetch.
//
//  Secret required:  GH_TOKEN  (fine-grained PAT, Actions: read+write, this repo)
//    set with:  npx wrangler secret put GH_TOKEN   (run in this folder)
// ─────────────────────────────────────────────────────────────────────────

const REPO = 'atn/stoliogoalio';
const WORKFLOW = 'snapshot.yml';
const REF = 'main';

async function dispatch(env) {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.GH_TOKEN}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        'user-agent': 'stolio-snapshot-cron',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ ref: REF }),
    },
  );
  // 204 = accepted. Anything else, surface it in the logs.
  const ok = res.status === 204;
  if (!ok) console.log('dispatch failed', res.status, await res.text().catch(() => ''));
  return { ok, status: res.status };
}

export default {
  // fires on the cron schedule in wrangler.jsonc
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(dispatch(env));
  },

  // health check / manual kick (visit the worker URL to confirm it's alive)
  async fetch(req, env) {
    if (!env.GH_TOKEN) {
      return new Response('cron worker up — GH_TOKEN secret NOT set yet', { status: 200 });
    }
    const url = new URL(req.url);
    if (url.searchParams.get('run') === '1') {
      const r = await dispatch(env);
      return new Response(`manual dispatch → ${r.status}`, { status: r.ok ? 200 : 502 });
    }
    return new Response('cron worker up — pings GitHub every 5 min. add ?run=1 to trigger now', {
      status: 200,
    });
  },
};
