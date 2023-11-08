export interface GitLabIssue {
  id: number;
  iid: number;
  project_id: number;
  title: string;
  description: null | string;
  state: "opened" | "closed";
  created_at: Date;
  updated_at: Date;
  closed_at: null;
  closed_by: null;
  labels: string[];
  milestone: GitLabMilestone | null;
  assignees: Author[];
  author: Author;
  type: Type;
  assignee: Author | null;
  user_notes_count: number;
  merge_requests_count: number;
  upvotes: number;
  downvotes: number;
  due_date: null;
  confidential: boolean;
  discussion_locked: null;
  issue_type: IssueType;
  web_url: string;
  time_stats: TimeStats;
  task_completion_status: TaskCompletionStatus;
  blocking_issues_count: number;
  has_tasks: boolean;
  task_status: string;
  _links: Links;
  references: References;
  severity: Severity;
  moved_to_id: null;
  service_desk_reply_to: null;
}

export interface Links {
  self: string;
  notes: string;
  award_emoji: string;
  project: string;
  closed_as_duplicate_of: null;
}

export interface Author {
  id: number;
  username: string;
  name: string;
  state: AuthorState;
  locked: boolean;
  avatar_url: string;
  web_url: string;
}

export enum AuthorState {
  Active = "active",
}

export enum IssueType {
  Issue = "issue",
}

export interface References {
  short: string;
  relative: string;
  full: string;
}

export enum Severity {
  Unknown = "UNKNOWN",
}

export interface TaskCompletionStatus {
  count: number;
  completed_count: number;
}

export interface TimeStats {
  time_estimate: number;
  total_time_spent: number;
  human_time_estimate: null;
  human_total_time_spent: null;
}

export enum Type {
  Issue = "ISSUE",
}

/*







*/

export interface GitLabLabel {
  id: number;
  name: string;
  color: string;
  text_color: string;
  description: string;
  description_html: string;
  open_issues_count: number;
  closed_issues_count: number;
  open_merge_requests_count: number;
  subscribed: boolean;
  priority: number | null;
  is_project_label: boolean;
}

export interface GitLabMilestone {
  id: number;
  iid: number;
  project_id: number;
  title: string;
  description: string;
  due_date: Date;
  start_date: Date;
  state: string;
  updated_at: Date;
  created_at: Date;
  expired: boolean;
}
