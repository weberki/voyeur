import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  manifest: {
    name: 'Voyeur',
    description:
      "Privacy-first tracker blocker & X-ray — see who's watching you and block web trackers in real time. Zero telemetry, local.",
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
