export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const GITHUB_TOKEN  = process.env.GITHUB_TOKEN;
  const GITHUB_REPO   = 'richpeniche/design-ai';
  const GITHUB_FILE   = 'index.html';
  const GITHUB_BRANCH = 'main';

  const { url, name, category, maturity, whatItIs, whatItIsNot, speedAdvantage, whatsGreatFor, flowInSteps } = req.body;

  if (!url || !name) return res.status(400).json({ error: 'url and name are required' });

  const headers = {
    'Authorization': `token ${GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json'
  };

  const esc = s => (s || '').replace(/"/g, '\\"');
  const newEntry = `  {
    name: "${esc(name)}",
    category: "${esc(category)}",
    maturity: "${esc(maturity)}",
    whatItIs: "${esc(whatItIs)}",
    whatItIsNot: "${esc(whatItIsNot)}",
    speedAdvantage: "${esc(speedAdvantage)}",
    whatsGreatFor: "${esc(whatsGreatFor)}",
    flowInSteps: "${esc(flowInSteps)}",
    website: "${url}"
  },`;

  const CATEGORY_ORDER = [
    'Figma MCPs', 'Design-to-Code', 'Vibe-Code / Builders',
    'AI Visual Generation', 'UI Components & Systems', 'AI Design Skills',
    'Research', 'Web Publishing', 'Presentations', 'Marketing & Brand', 'Color & Tokens'
  ];

  function getNextCategory(category) {
    const idx = CATEGORY_ORDER.indexOf(category);
    return CATEGORY_ORDER[idx + 1] || 'END';
  }

  try {
    const refRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/git/ref/heads/${GITHUB_BRANCH}`, { headers });
    const refData = await refRes.json();
    if (!refRes.ok || !refData.object) throw new Error(refData.message || 'Could not get branch ref');
    const mainSha = refData.object.sha;

    const branchName = `add-tool-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`;
    const branchRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/git/refs`, {
      method: 'POST', headers,
      body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: mainSha })
    });
    if (!branchRes.ok) throw new Error((await branchRes.json()).message || 'Could not create branch');

    const fileRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE}?ref=${branchName}`, { headers });
    const fileData = await fileRes.json();
    if (!fileRes.ok) throw new Error(fileData.message || 'Could not fetch file');
    const fileSha = fileData.sha;
    const currentContent = Buffer.from(fileData.content.replace(/\n/g, ''), 'base64').toString('utf8');

    let updated = currentContent;
    updated = updated.replace(
      `  "https://oklch.fyi/":`,
      `  "${url}": null,\n  "https://oklch.fyi/":`
    );
    const nextCat = getNextCategory(category);
    const insertAfter = nextCat === 'END'
      ? `\n];\n`
      : `\n  },\n\n  // ── ${nextCat} ──`;
    const replacement = nextCat === 'END'
      ? `\n  },\n${newEntry}\n];\n`
      : `\n  },\n${newEntry}\n\n  // ── ${nextCat} ──`;
    updated = updated.replace(insertAfter, replacement);

    const encoded = Buffer.from(updated, 'utf8').toString('base64');
    const commitRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE}`, {
      method: 'PUT', headers,
      body: JSON.stringify({ message: `feat: add ${name}`, content: encoded, sha: fileSha, branch: branchName })
    });
    if (!commitRes.ok) throw new Error((await commitRes.json()).message || 'Could not commit');

    const prRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/pulls`, {
      method: 'POST', headers,
      body: JSON.stringify({
        title: `feat: add ${name}`,
        body: `Added via / command.\n\n**Category:** ${category} — update before merging.\n**Maturity:** ${maturity} — update before merging.\n**URL:** ${url}`,
        head: branchName,
        base: GITHUB_BRANCH
      })
    });
    const prData = await prRes.json();
    if (!prRes.ok) throw new Error(prData.message || 'Could not open PR');

    return res.status(200).json({ pr_url: prData.html_url, branch: branchName });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
