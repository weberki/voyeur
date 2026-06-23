import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  manifest: {
    name: 'Voyeur',
    description: 'See who is watching you. Voyeur X-rays and blocks web trackers in real time.',
    permissions: ['webRequest', 'declarativeNetRequest', 'webNavigation', 'storage'],
    host_permissions: ['<all_urls>'],
    action: {},
    declarative_net_request: {
      rule_resources: [
        { id: 'tracker_rules', enabled: true, path: 'rules/tracker-rules.json' },
      ],
    },
  },
});
