import { Octokit } from "octokit";

(async () => {
  try {
    const targetOrg = "uyuni-project";

    const personalAccessToken = process.argv[2];
    if (!personalAccessToken) {
      throw new TypeError("Please provide a Personal Access Token, see https://github.com/settings/tokens");
    }
    const octokit = new Octokit({ auth: personalAccessToken });

    const orgMembers = await octokit.paginate(octokit.rest.orgs.listMembers, {
      org: targetOrg,
    });
    const orgMemberIds = new Set(orgMembers.map(member => member.id));
    console.log(`Found ${orgMemberIds.size} members in the organization "${targetOrg}"`);

    const q = `
      owner:${targetOrg}
      state:open
      draft:false
      type:pr
    `.replace(/\s+/g, " ").trim();
    const prs = await octokit.paginate(octokit.rest.search.issuesAndPullRequests, { q });
    console.log(`Found ${prs.length} pull reqests matching "${q}"`);

    const externalPrs = prs
      .filter(pr => !pr.user || !orgMemberIds.has(pr.user.id))
      .sort((a, b) => a.updated_at.localeCompare(b.updated_at));
    console.log(`Found ${externalPrs.length} open pull requests by external contributors\n`);

    const groups = externalPrs.reduce((result, item) => {
      const key = item.repository_url;
      if (result.has(key)) {
        result.get(key)!.push(item); 
      } else {
        result.set(key, [item]);
      }
      return result;
    }, new Map<string, typeof externalPrs>());

    for (const [repositoryUrl, items] of groups.entries()) {
      const urlName = repositoryUrl.replace(/.*\//, "");
      console.log(`${urlName}:\n${items.map(item => ` - "${item.title}" ${item.html_url}`).join("\n")}\n`);
    }
  } catch(error) {
    console.error(error);
    process.exitCode = 1;
  }
})();
