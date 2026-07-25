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
