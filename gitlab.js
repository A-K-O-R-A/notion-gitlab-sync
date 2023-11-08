/**
 * @typedef {import("./types/gitlab.d.ts").GitLabIssue} GitLabIssue
 * @typedef {import("./types/gitlab.d.ts").GitLabLabel} GitLabLabel
 * @typedef {import("./types/notion.d.ts").NotionPage} NotionPage
 */

const GROUP_ID = 77497647;
const PROJECT_ID = 51934668;
const GITLAB_DOMAIN = "gitlab.com";

const { default: fetch } = require("node-fetch");

/**
 * Gets issues from a GitLab repository. Pull requests are omitted.
 *
 * https://docs.gitlab.com/ee/api/rest/#keyset-based-pagination
 * https://docs.gitlab.com/ee/api/issues.html#list-project-issues
 *
 * @returns {Promise<Array<GitLabIssue>>}
 */
async function getGitLabIssuesForRepository() {
  /** @type {GitLabIssue[]} */
  const issues = [];

  let page = 1;
  let pageSize = 100;
  let lastPageSize = -1;

  do {
    let response = await fetch(
      `https://${GITLAB_DOMAIN}/api/v4/projects/${PROJECT_ID}/issues?scope=all&pagination=keyset&sort=asc&page=${page}&per_page=${pageSize}`,
      {
        headers: {
          "PRIVATE-TOKEN": process.env.GITLAB_TOKEN,
        },
      }
    );
    let data = await response.json();
    issues.push(...data);

    // For pagination
    lastPageSize = data.length;
    page++;
  } while (lastPageSize == 100);

  return issues;
}

/**
 * Gets labels from the GitLab project
 *
 * https://docs.gitlab.com/ee/api/labels.html
 *
 * @returns {Promise<GitLabLabel>}
 */
async function getGitLabLabelsForProject() {
  let response = await fetch(
    `https://${GITLAB_DOMAIN}/api/v4/projects/${PROJECT_ID}/labels`,
    {
      headers: {
        "PRIVATE-TOKEN": process.env.GITLAB_TOKEN,
      },
    }
  );

  return await response.json();
}

module.exports = {
  getGitLabIssuesForRepository,
  getGitLabLabelsForProject,
};
