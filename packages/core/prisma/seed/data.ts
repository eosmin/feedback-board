import type {
  Plan,
  PostCategory,
  PostPriority,
  PostStatus,
  Role,
} from '../../src/generated/prisma/client';

export const USER_KEYS = ['maya', 'tomas', 'lena', 'ravi', 'sofia', 'dan', 'nora', 'ivan'] as const;
export type UserKey = (typeof USER_KEYS)[number];

export const USER_NAMES: Record<UserKey, string> = {
  maya: 'Maya Chen',
  tomas: 'Tomás Herrera',
  lena: 'Lena Fischer',
  ravi: 'Ravi Patel',
  sofia: 'Sofía Alvarez',
  dan: 'Dan Okafor',
  nora: 'Nora Lindqvist',
  ivan: 'Ivan Petrov',
};

export interface CommentSeed {
  readonly by: UserKey;
  readonly body: string;
}

export interface PostSeed {
  readonly key: string;
  readonly title: string;
  readonly body: string;
  readonly status: PostStatus;
  readonly aiCategory: PostCategory;
  readonly aiPriority: PostPriority;
  readonly author: UserKey;
  readonly daysAgo: number;
  readonly votes: readonly UserKey[];
  readonly comments: readonly CommentSeed[];
}

export interface BoardSeed {
  readonly slug: string;
  readonly name: string;
  readonly posts: readonly PostSeed[];
}

export interface OrgSeed {
  readonly slug: string;
  readonly name: string;
  readonly plan: Plan;
  readonly members: readonly { readonly user: UserKey; readonly role: Role }[];
  readonly boards: readonly BoardSeed[];
}

const ALL = USER_KEYS;

export const ORGS: readonly OrgSeed[] = [
  {
    slug: 'acme-studio',
    name: 'Acme Studio',
    plan: 'FREE',
    members: [
      { user: 'maya', role: 'OWNER' },
      { user: 'tomas', role: 'ADMIN' },
      { user: 'lena', role: 'MEMBER' },
      { user: 'ravi', role: 'MEMBER' },
      { user: 'sofia', role: 'MEMBER' },
      { user: 'dan', role: 'MEMBER' },
      { user: 'nora', role: 'MEMBER' },
      { user: 'ivan', role: 'MEMBER' },
    ],
    boards: [
      {
        slug: 'product-feedback',
        name: 'Product feedback',
        posts: [
          {
            key: 'dark-mode',
            title: 'Dark mode for the whole app',
            body: 'I work late and the white background is hard on the eyes. A dark theme that follows the system setting would be perfect.',
            status: 'IN_PROGRESS',
            aiCategory: 'FEATURE_REQUEST',
            aiPriority: 'MEDIUM',
            author: 'lena',
            daysAgo: 21,
            votes: ALL,
            comments: [
              {
                by: 'tomas',
                body: 'In progress: the colour tokens are done, the settings toggle is next.',
              },
              { by: 'lena', body: 'Great news, thank you!' },
            ],
          },
          {
            key: 'export-csv',
            title: 'Export projects to CSV',
            body: 'Our finance team needs a monthly export of every project with its status and owner. Right now I copy rows by hand.',
            status: 'PLANNED',
            aiCategory: 'FEATURE_REQUEST',
            aiPriority: 'MEDIUM',
            author: 'ravi',
            daysAgo: 18,
            votes: ['ravi', 'maya', 'sofia', 'lena', 'dan', 'nora'],
            comments: [
              { by: 'maya', body: 'Scheduled for next quarter. Would an Excel format help too?' },
            ],
          },
          {
            key: 'login-loop',
            title: 'Login redirects back to the sign-in page on Safari',
            body: 'After clicking the magic link on Safari 18 I land on the sign-in page again. Chrome works fine. Cookies are enabled.',
            status: 'OPEN',
            aiCategory: 'BUG',
            aiPriority: 'HIGH',
            author: 'sofia',
            daysAgo: 4,
            votes: ['sofia', 'ravi', 'lena', 'ivan', 'nora', 'dan', 'tomas'],
            comments: [
              {
                by: 'tomas',
                body: 'Reproduced on Safari 18.2. Looks like a cookie SameSite issue.',
              },
              { by: 'ivan', body: 'Same here on iPad. Private mode does not help.' },
              { by: 'sofia', body: 'Thanks for confirming, happy to test a fix.' },
            ],
          },
          {
            key: 'mobile-nav',
            title: 'Navigation menu is hard to reach on small screens',
            body: 'On my phone the menu button sits at the top and I need two hands to reach it. A bottom bar would be much easier.',
            status: 'OPEN',
            aiCategory: 'UX',
            aiPriority: 'MEDIUM',
            author: 'nora',
            daysAgo: 9,
            votes: ['nora', 'lena', 'dan'],
            comments: [],
          },
          {
            key: 'keyboard-shortcuts',
            title: 'Keyboard shortcuts for common actions',
            body: 'Let me create a project, search and switch workspaces without leaving the keyboard. Something like Cmd+K would be great.',
            status: 'OPEN',
            aiCategory: 'FEATURE_REQUEST',
            aiPriority: 'LOW',
            author: 'dan',
            daysAgo: 12,
            votes: ['dan', 'maya'],
            comments: [{ by: 'maya', body: 'We like this one. Added to the backlog.' }],
          },
          {
            key: 'slow-dashboard',
            title: 'Dashboard takes 8 seconds to load with 200+ projects',
            body: 'Our workspace has 240 projects and the dashboard shows a spinner for around 8 seconds on every visit.',
            status: 'DONE',
            aiCategory: 'BUG',
            aiPriority: 'HIGH',
            author: 'tomas',
            daysAgo: 40,
            votes: ['tomas', 'ravi', 'sofia', 'maya', 'ivan'],
            comments: [
              {
                by: 'maya',
                body: 'Fixed by paginating the list. Load time is under a second now.',
              },
              { by: 'tomas', body: 'Confirmed, huge improvement.' },
            ],
          },
          {
            key: 'tooltip-contrast',
            title: 'Tooltip text is too light to read',
            body: 'The grey tooltips on the settings page have very low contrast against the white card, I cannot read them.',
            status: 'DONE',
            aiCategory: 'UX',
            aiPriority: 'LOW',
            author: 'lena',
            daysAgo: 33,
            votes: ['lena', 'nora'],
            comments: [{ by: 'tomas', body: 'Darkened the text, shipped last week.' }],
          },
          {
            key: 'slack-integration',
            title: 'Post new feedback to a Slack channel',
            body: 'We live in Slack. A message in #product whenever a new request arrives would save us checking the board.',
            status: 'PLANNED',
            aiCategory: 'FEATURE_REQUEST',
            aiPriority: 'HIGH',
            author: 'maya',
            daysAgo: 15,
            votes: ['maya', 'tomas', 'lena', 'ravi', 'sofia', 'dan', 'ivan'],
            comments: [
              {
                by: 'tomas',
                body: 'Outbound webhooks are the first step. Slack formatting comes after.',
              },
            ],
          },
          {
            key: 'duplicate-emails',
            title: 'Two welcome emails when I sign up',
            body: 'I got the welcome email twice within a minute of creating my account.',
            status: 'CLOSED',
            aiCategory: 'BUG',
            aiPriority: 'LOW',
            author: 'ivan',
            daysAgo: 28,
            votes: ['ivan'],
            comments: [
              {
                by: 'tomas',
                body: 'Could not reproduce and no one else reported it. Closing for now.',
              },
            ],
          },
          {
            key: 'bulk-edit',
            title: 'Edit several projects at once',
            body: 'Moving ten projects to a new owner means ten separate edits. A bulk action would save a lot of clicking.',
            status: 'OPEN',
            aiCategory: 'FEATURE_REQUEST',
            aiPriority: 'MEDIUM',
            author: 'ravi',
            daysAgo: 6,
            votes: ['ravi', 'sofia', 'maya', 'nora'],
            comments: [],
          },
          {
            key: 'rename-labels',
            title: 'Rename "Workspace" to "Team"',
            body: 'Everyone on my side calls it a team. The word workspace confuses new colleagues during onboarding.',
            status: 'CLOSED',
            aiCategory: 'OTHER',
            aiPriority: 'LOW',
            author: 'nora',
            daysAgo: 30,
            votes: ['nora', 'dan'],
            comments: [
              { by: 'maya', body: 'Keeping the current name for consistency with our docs.' },
            ],
          },
          {
            key: 'welcome-tour',
            title: 'A short tour for first-time users',
            body: 'I was lost the first day. A three-step tour pointing at the main areas would have helped.',
            status: 'IN_PROGRESS',
            aiCategory: 'UX',
            aiPriority: 'MEDIUM',
            author: 'sofia',
            daysAgo: 11,
            votes: ['sofia', 'lena', 'ivan', 'tomas', 'maya'],
            comments: [{ by: 'maya', body: 'Design is ready, building it this sprint.' }],
          },
        ],
      },
    ],
  },
  {
    slug: 'northwind-labs',
    name: 'Northwind Labs',
    plan: 'PRO',
    members: [
      { user: 'nora', role: 'OWNER' },
      { user: 'ivan', role: 'ADMIN' },
      { user: 'dan', role: 'MEMBER' },
      { user: 'maya', role: 'MEMBER' },
      { user: 'tomas', role: 'MEMBER' },
      { user: 'lena', role: 'MEMBER' },
      { user: 'ravi', role: 'MEMBER' },
      { user: 'sofia', role: 'MEMBER' },
    ],
    boards: [
      {
        slug: 'feature-requests',
        name: 'Feature requests',
        posts: [
          {
            key: 'sso',
            title: 'Single sign-on with our identity provider',
            body: 'Security requires SAML or OIDC sign-in before we can roll this out to the whole company.',
            status: 'PLANNED',
            aiCategory: 'FEATURE_REQUEST',
            aiPriority: 'HIGH',
            author: 'dan',
            daysAgo: 25,
            votes: ['dan', 'nora', 'ivan', 'maya', 'ravi', 'lena'],
            comments: [{ by: 'ivan', body: 'OIDC first, SAML after. Targeting next month.' }],
          },
          {
            key: 'api-rate-limits',
            title: 'Show remaining API quota in the response headers',
            body: 'We hit the rate limit in a batch job without warning. Remaining quota and reset time in headers would let us back off.',
            status: 'IN_PROGRESS',
            aiCategory: 'FEATURE_REQUEST',
            aiPriority: 'MEDIUM',
            author: 'maya',
            daysAgo: 14,
            votes: ['maya', 'dan', 'ivan'],
            comments: [{ by: 'ivan', body: 'Headers are in review, shipping this week.' }],
          },
          {
            key: 'saved-filters',
            title: 'Save filters as reusable views',
            body: 'I apply the same three filters every morning. Saved views that I can share with the team would help.',
            status: 'OPEN',
            aiCategory: 'FEATURE_REQUEST',
            aiPriority: 'MEDIUM',
            author: 'nora',
            daysAgo: 7,
            votes: ['nora', 'sofia', 'tomas', 'dan'],
            comments: [],
          },
          {
            key: 'audit-log',
            title: 'Audit log of who changed what',
            body: 'Compliance asks who edited a record and when. We currently cannot answer that.',
            status: 'OPEN',
            aiCategory: 'FEATURE_REQUEST',
            aiPriority: 'HIGH',
            author: 'ivan',
            daysAgo: 10,
            votes: ['ivan', 'nora', 'dan', 'lena', 'ravi'],
            comments: [{ by: 'nora', body: 'Needed for our next audit, bumping priority.' }],
          },
          {
            key: 'dark-charts',
            title: 'Charts are unreadable in dark mode',
            body: 'The grey gridlines vanish against the dark background and the legend text is nearly invisible.',
            status: 'DONE',
            aiCategory: 'UX',
            aiPriority: 'LOW',
            author: 'dan',
            daysAgo: 35,
            votes: ['dan', 'maya'],
            comments: [{ by: 'ivan', body: 'Fixed in the latest release.' }],
          },
          {
            key: 'gantt',
            title: 'Gantt view for planning',
            body: 'A timeline view would help us plan dependencies between projects.',
            status: 'CLOSED',
            aiCategory: 'FEATURE_REQUEST',
            aiPriority: 'LOW',
            author: 'maya',
            daysAgo: 45,
            votes: ['maya'],
            comments: [
              { by: 'nora', body: 'Out of scope for now, use the calendar view meanwhile.' },
            ],
          },
        ],
      },
      {
        slug: 'bug-reports',
        name: 'Bug reports',
        posts: [
          {
            key: 'upload-timeout',
            title: 'File uploads over 20 MB time out',
            body: 'Uploading a 35 MB PDF fails after about 30 seconds with a generic error message.',
            status: 'IN_PROGRESS',
            aiCategory: 'BUG',
            aiPriority: 'HIGH',
            author: 'dan',
            daysAgo: 3,
            votes: ['dan', 'maya', 'ivan', 'nora'],
            comments: [
              {
                by: 'ivan',
                body: 'Found the proxy timeout. Raising it and adding resumable uploads.',
              },
            ],
          },
          {
            key: 'wrong-timezone',
            title: 'Due dates show in UTC instead of my timezone',
            body: 'A task due at 9am my time shows 2pm on the card. My profile timezone is set correctly.',
            status: 'OPEN',
            aiCategory: 'BUG',
            aiPriority: 'MEDIUM',
            author: 'maya',
            daysAgo: 5,
            votes: ['maya', 'dan', 'lena'],
            comments: [],
          },
          {
            key: 'typo-invoice',
            title: 'Typo on the invoice page',
            body: '"Recieved" is misspelled in the payment confirmation header.',
            status: 'DONE',
            aiCategory: 'OTHER',
            aiPriority: 'LOW',
            author: 'nora',
            daysAgo: 20,
            votes: ['nora'],
            comments: [{ by: 'ivan', body: 'Fixed, thanks.' }],
          },
        ],
      },
    ],
  },
];
