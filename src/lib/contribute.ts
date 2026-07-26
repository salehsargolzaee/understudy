/**
 * Where contribution lives. One copy of these URLs, so "be the first" always
 * leads somewhere real and a rename is a one-line change.
 *
 * Change REPO if the repository moves.
 */
export const REPO = "salehsargolzaee/understudy";

const blob = (path: string) => `https://github.com/${REPO}/blob/main/${path}`;
const tree = (path: string) => `https://github.com/${REPO}/tree/main/${path}`;

export const repoUrl = `https://github.com/${REPO}`;
export const contributeGuideUrl = blob("CONTRIBUTING.md");
export const exerciseTemplateUrl = tree("templates/exercise");
export const schemaUrl = blob("content/SCHEMA.md");
export const reviewRubricUrl = blob("docs/REVIEWING.md");
// The landing page points strangers at the machinery itself, not at a description of it.
export const checkerUrl = blob("tools/validate_exercises.py");
export const workflowUrl = blob(".github/workflows/content.yml");
export const prTemplateUrl = blob(".github/PULL_REQUEST_TEMPLATE.md");
