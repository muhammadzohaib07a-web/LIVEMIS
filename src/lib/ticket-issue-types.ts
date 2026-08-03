// The decision branches from the support workflow: picking one previews the
// expected resolution path, so the reporter understands what happens next.
export type IssueTypeKey =
  | "user_issue"
  | "master_data"
  | "configuration"
  | "permission"
  | "bug"
  | "new_requirement";

export type IssueTypeDef = {
  key: IssueTypeKey;
  label: string;
  hint: string;
  path: string[];
};

export const ISSUE_TYPES: IssueTypeDef[] = [
  {
    key: "user_issue",
    label: "User Guidance",
    hint: "I am not sure how to do something",
    path: ["MIS guides the user", "Close ticket"],
  },
  {
    key: "master_data",
    label: "Master Data Issue",
    hint: "Wrong or missing product, customer, vendor, or item data",
    path: ["MIS updates master data", "Verify", "Close ticket"],
  },
  {
    key: "configuration",
    label: "Configuration Issue",
    hint: "A screen or process is set up incorrectly",
    path: ["Functional consultant configures", "Verify", "Close ticket"],
  },
  {
    key: "permission",
    label: "Permission / Access Issue",
    hint: "Access denied, missing screen, or wrong role",
    path: ["Security access updated", "Verify", "Close ticket"],
  },
  {
    key: "bug",
    label: "Software Bug",
    hint: "Something errors out or behaves incorrectly",
    path: ["Developer investigates", "Development", "Testing", "UAT", "Deploy", "Close ticket"],
  },
  {
    key: "new_requirement",
    label: "New Requirement",
    hint: "A new feature, field, or report is needed",
    path: [
      "Business discussion",
      "Approval",
      "Development",
      "Testing",
      "UAT",
      "Production",
      "Close ticket",
    ],
  },
];

export function getIssueType(key: string): IssueTypeDef | undefined {
  return ISSUE_TYPES.find((item) => item.key === key);
}
