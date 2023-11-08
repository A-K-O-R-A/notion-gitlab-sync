/* 

This code is based on the github-sync example of the @notionhq/client package.

https://github.com/makenotion/notion-sdk-js/blob/ba873383d5416405798c66d0b47fed3717c14f6a/examples/notion-github-sync/index.js

*/

/**
 * @typedef {import("./types.d.ts").GitLabIssue} GitLabIssue
 */

const { Client } = require("@notionhq/client");
const dotenv = require("dotenv");
const { default: fetch } = require("node-fetch");
const _ = require("lodash");

dotenv.config();

const notion = new Client({ auth: process.env.NOTION_KEY });

const databaseId = process.env.NOTION_DATABASE_ID;
const OPERATION_BATCH_SIZE = 10;

/**
 * Local map to store  GitLab issue ID to its Notion pageId.
 * { [issueId: string]: string }
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
  const pages = [];
  let cursor = undefined;
  while (true) {
    const { results, next_cursor } = await notion.databases.query({
      database_id: databaseId,
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
    const issueNumberPropertyId = page.properties["Issue Number"].id;
    const propertyResult = await notion.pages.properties.retrieve({
      page_id: page.id,
      property_id: issueNumberPropertyId,
    });
    issues.push({
      pageId: page.id,
      issueNumber: propertyResult.number,
    });
  }

  return issues;
}

let groupId = 77497647;
let projectID = 51934668;

async function createDummyIssues(count) {
  let proms = [];
  for (let i = 0; i < count; i++) {
    proms.push(
      fetch(
        `https://gitlab.com/api/v4/projects/${projectID}/issues?title=Personal%20Issues%20with%20auth${i}&labels=bug`,
        {
          headers: {
            "PRIVATE-TOKEN": process.env.GITLAB_TOKEN,
          },
          method: "POST",
        }
      )
    );
  }

  await Promise.all(proms);
}

/**
 * Gets issues from a GitLab repository. Pull requests are omitted.
 *
 * https://docs.github.com/en/rest/guides/traversing-with-pagination
 * https://docs.github.com/en/rest/reference/issues
 *
 * @returns {Promise<Array<GitLabIssue>>}
 */
async function getGitLabIssuesForRepository() {
  const issues = [];

  // await createDummyIssues(10);
  let page = 1;
  let pageSize = 100;
  let lastPageSize = 100;

  do {
    let response = await fetch(
      `https://gitlab.com/api/v4/projects/${projectID}/issues?scope=all&pagination=keyset&sort=asc&page=${page}&per_page=${pageSize}`,
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

  console.log("GITLAB", await response.text());

  return issues;
}

/**
 * Determines which issues already exist in the Notion database.
 *
 * @param {Array < { number: number, title: string, state: "open" | "closed", comment_count: number, url: string } >} issues
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
          parent: { database_id: databaseId },
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
 * @param {{ number: number, title: string, state: "open" | "closed", comment_count: number, url: string }} issue
 */
function getPropertiesFromIssue(issue) {
  const { title, number, state, comment_count, url } = issue;
  return {
    Name: {
      title: [{ type: "text", text: { content: title } }],
    },
    "Issue Number": {
      number,
    },
    State: {
      select: { name: state },
    },
    "Number of Comments": {
      number: comment_count,
    },
    "Issue URL": {
      url,
    },
  };
}
