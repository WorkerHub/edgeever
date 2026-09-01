# @edgeever/plugin-api

Public TypeScript contracts and runtime manifest helpers for EdgeEver client plugins and code-free themes.

```ts
import { definePlugin } from "@edgeever/plugin-api";

export default definePlugin({
  activate(context) {
    return context.commands.register({
      id: "hello",
      title: "Hello",
      run: () => context.ui.showNotice("Hello from EdgeEver"),
    });
  },
});
```

The package ships ESM JavaScript and TypeScript declarations. Plugin bundles must produce a single `main.js` file without relative imports before distribution. See the EdgeEver plugin development guide for the Manifest format, permissions, settings Schema, release assets, and marketplace verification rules.
