/* 

This code is based on the github-sync example of the @notionhq/client package.

https://github.com/makenotion/notion-sdk-js/blob/ba873383d5416405798c66d0b47fed3717c14f6a/examples/notion-github-sync/index.js

*/

/**
 * @typedef {import("./types/gitlab.d.ts").GitLabIssue} GitLabIssue
 * @typedef {import("./types/notion.d.ts").NotionPage} NotionPage
 */

const { Client } = require("@notionhq/client");
const dotenv = require("dotenv");
const { default: fetch } = require("node-fetch");
const _ = require("lodash");

dotenv.config();

const notion = new Client({ auth: process.env.NOTION_KEY });

const DATABASE_ID = process.env.NOTION_DATABASE_ID;
const OPERATION_BATCH_SIZE = 10;

const GROUP_ID = 77497647;
const PROJECT_ID = 51934668;
const GITLAB_DOMAIN = "gitlab.com";

/**
 * Local map to store  GitLab issue ID to its Notion pageId.
 * @type { [issueId: string]: string }
 */
const gitLabIssuesIdToNotionPageId = {};

/**
 * Initialize local data store.
 * Then sync with GitLab.
 */
setInitialGitLabToNotionIdMap().then(syncNotionDatabaseWithGitLab);

/**
 * Get and set the initial data store with issues currently in the database.
 */
async function setInitialGitLabToNotionIdMap() {
  const currentIssues = await getIssuesFromNotionDatabase();
  for (const { pageId, issueNumber } of currentIssues) {
    gitLabIssuesIdToNotionPageId[issueNumber] = pageId;
  }
}

async function syncNotionDatabaseWithGitLab() {
  // Get all issues currently in the provided GitLab repository.
  console.log("\nFetching issues from GitLab repository...");
  const issues = await getGitLabIssuesForRepository();
  console.log(`Fetched ${issues.length} issues from GitLab repository.`);

  // Group issues into those that need to be created or updated in the Notion database.
  const { pagesToCreate, pagesToUpdate } = getNotionOperations(issues);

  // Create pages for new issues.
  console.log(`\n${pagesToCreate.length} new issues to add to Notion.`);
  await createPages(pagesToCreate);

  // Updates pages for existing issues.
  console.log(`\n${pagesToUpdate.length} issues to update in Notion.`);
  await updatePages(pagesToUpdate);

  // Success!
  console.log("\n✅ Notion database is synced with GitLab.");
}

/**
 * Gets pages from the Notion database.
 *
 * @returns {Promise<Array<{ pageId: string, issueNumber: number }>>}
 */
async function getIssuesFromNotionDatabase() {
  /** @type {NotionPage[]} */
  const pages = [];
  let cursor = undefined;
  while (true) {
    const { results, next_cursor } = await notion.databases.query({
      database_id: DATABASE_ID,
      start_cursor: cursor,
    });
    pages.push(...results);
    if (!next_cursor) {
      break;
    }
    cursor = next_cursor;
  }
  console.log(`${pages.length} issues successfully fetched from Notion.`);

  const issues = [];
  for (const page of pages) {
    const issueNumberPropertyId = page.properties["id"].id;
    /*
    const propertyResult = await notion.pages.properties.retrieve({
      page_id: page.id,
      property_id: issueNumberPropertyId,
    });
    */
    issues.push({
      pageId: page.id,
      issueNumber: page.properties.id.rich_text[0].plain_text.slice(1),
    });
  }

  return issues;
}

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
 * Determines which issues already exist in the Notion database.
 *
 * @param {Array<GitLabIssue>} issues
 * @returns {{
 *   pagesToCreate: Array<{ number: number, title: string, state: "open" | "closed", comment_count: number, url: string }>;
 *   pagesToUpdate: Array<{ pageId: string, number: number, title: string, state: "open" | "closed", comment_count: number, url: string }>
 * }}
 */
function getNotionOperations(issues) {
  const pagesToCreate = [];
  const pagesToUpdate = [];
  for (const issue of issues) {
    const pageId = gitLabIssuesIdToNotionPageId[issue.number];
    if (pageId) {
      pagesToUpdate.push({
        ...issue,
        pageId,
      });
    } else {
      pagesToCreate.push(issue);
    }
  }
  return { pagesToCreate, pagesToUpdate };
}

/**
 * Creates new pages in Notion.
 *
 * https://developers.notion.com/reference/post-page
 *
 * @param {Array < { number: number, title: string, state: "open" | "closed", comment_count: number, url: string } >} pagesToCreate
 */
async function createPages(pagesToCreate) {
  const pagesToCreateChunks = _.chunk(pagesToCreate, OPERATION_BATCH_SIZE);
  for (const pagesToCreateBatch of pagesToCreateChunks) {
    await Promise.all(
      pagesToCreateBatch.map(issue =>
        notion.pages.create({
          parent: { database_id: DATABASE_ID },
          properties: getPropertiesFromIssue(issue),
        })
      )
    );
    console.log(`Completed batch size: ${pagesToCreateBatch.length}`);
  }
}

/**
 * Updates provided pages in Notion.
 *
 * https://developers.notion.com/reference/patch-page
 *
 * @param {Array < { pageId: string, number: number, title: string, state: "open" | "closed", comment_count: number, url: string } >} pagesToUpdate
 */
async function updatePages(pagesToUpdate) {
  const pagesToUpdateChunks = _.chunk(pagesToUpdate, OPERATION_BATCH_SIZE);
  for (const pagesToUpdateBatch of pagesToUpdateChunks) {
    await Promise.all(
      pagesToUpdateBatch.map(({ pageId, ...issue }) =>
        notion.pages.update({
          page_id: pageId,
          properties: getPropertiesFromIssue(issue),
        })
      )
    );
    console.log(`Completed batch size: ${pagesToUpdateBatch.length}`);
  }
}

//*========================================================================
// Helpers
//*========================================================================

/**
 * Returns the GitLab issue to conform to this database's schema properties.
 *
 * @param {GitLabIssue} issue
 */
function getPropertiesFromIssue(issue) {
  return {
    id: {
      rich_text: [
        {
          type: "text",
          text: {
            content: "#" + issue.iid,
            link: {
              url: issue.web_url,
            },
          },
          annotations: {
            bold: false,
            italic: false,
            strikethrough: false,
            underline: false,
            code: false,
            color: "default",
          },
          plain_text: "#" + issue.iid,
          href: issue.web_url,
        },
      ],
    },
    open: {
      type: "checkbox",
      checkbox: issue.state == "opened",
    },
    title: {
      title: [{ type: "text", text: { content: issue.title } }],
    },

    assignees: {
      rich_text: [
        {
          type: "text",
          text: {
            content: issue.assignees.map(a => a.name).join(", "),
            link: null,
          },
          annotations: {
            bold: false,
            italic: false,
            strikethrough: false,
            underline: false,
            code: false,
            color: "default",
          },
        },
      ],
    },

    created_at: {
      created_time: issue.created_at,
    },

    updated_at: {
      last_edited_time: issue.updated_at,
    },
  };
}
