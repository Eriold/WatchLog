export default {
  branches: ['main', { name: 'beta', prerelease: 'beta' }],
  tagFormat: 'v${version}',
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    ['@semantic-release/npm', { npmPublish: false }],
    ['@semantic-release/changelog', { changelogFile: 'CHANGELOG.md' }],
    './scripts/semantic-release-build-plugin.mjs',
    [
      '@semantic-release/git',
      {
        assets: ['CHANGELOG.md', 'package.json', 'pnpm-lock.yaml'],
        message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
      },
    ],
    [
      '@semantic-release/github',
      {
        successComment: false,
        failComment: false,
        assets: [
          { path: 'release/watchlog-chrome.zip', label: 'WatchLog Chrome bundle' },
          { path: 'release/watchlog-firefox.zip', label: 'WatchLog Firefox bundle' },
        ],
      },
    ],
  ],
}
