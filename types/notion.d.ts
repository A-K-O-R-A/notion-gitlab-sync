export interface NotionPage {
  object: string;
  id: string;
  created_time: Date;
  last_edited_time: Date;
  created_by: TedBy;
  last_edited_by: TedBy;
  cover: null;
  icon: null;
  parent: Parent;
  archived: boolean;
  properties: Properties;
  url: string;
  public_url: null;
}

export interface TedBy {
  object: string;
  id: string;
}

export interface Parent {
  type: string;
  database_id: string;
}

export interface Properties {
  created_at: CreatedAt;
  open: Open;
  id: Assignees;
  updated_at: UpdatedAt;
  assignees: Assignees;
  title: Title;
}

export interface Assignees {
  id: string;
  type: string;
  rich_text: RichText[];
}

export interface RichText {
  type: string;
  text: Text;
  annotations: Annotations;
  plain_text: string;
  href: null | string;
}

export interface Annotations {
  bold: boolean;
  italic: boolean;
  strikethrough: boolean;
  underline: boolean;
  code: boolean;
  color: string;
}

export interface Text {
  content: string;
  link: Link | null;
}

export interface Link {
  url: string;
}

export interface CreatedAt {
  id: string;
  type: string;
  created_time: Date;
}

export interface Open {
  id: string;
  type: string;
  checkbox: boolean;
}

export interface Title {
  id: string;
  type: string;
  title: RichText[];
}

export interface UpdatedAt {
  id: string;
  type: string;
  last_edited_time: Date;
}
