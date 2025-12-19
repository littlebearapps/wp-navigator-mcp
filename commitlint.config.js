export default {
  extends: ['@commitlint/config-conventional'],
  // Ignore merge commits
  ignores: [(commit) => commit.startsWith('Merge')],
  rules: {
    // Allow longer subjects for detailed commit messages
    'header-max-length': [2, 'always', 100],
    // Disable body line length limit (common in detailed commits)
    'body-max-line-length': [0, 'always'],
    // Conventional commit types
    'type-enum': [
      2,
      'always',
      [
        'feat',     // New feature
        'fix',      // Bug fix
        'docs',     // Documentation only
        'style',    // Formatting, no code change
        'refactor', // Code change that neither fixes a bug nor adds a feature
        'perf',     // Performance improvement
        'test',     // Adding or updating tests
        'build',    // Build system or external dependencies
        'ci',       // CI configuration
        'chore',    // Other changes that don't modify src or test files
        'revert',   // Revert a previous commit
      ],
    ],
  },
};
