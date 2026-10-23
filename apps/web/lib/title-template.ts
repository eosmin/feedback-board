/**
 * The tab-title template ("Boards · FeedbackBoard"). Next drops the inherited template for every
 * segment below a layout whose `title` is a plain string or lacks its own `template`, so any
 * layout that sets a title must restate it or the pages under it lose the app name.
 */
export function titleTemplate(appName: string): string {
  return `%s · ${appName}`;
}
