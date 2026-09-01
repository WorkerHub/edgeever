import { beforeEach, describe, expect, test } from "bun:test";

const values = new Map();
const styles = new Map();
const eventListeners = new Map();

globalThis.window = {
  location: { href: "https://edgeever.example/settings" },
  localStorage: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    get length() { return values.size; },
    key: (index) => [...values.keys()][index] ?? null,
  },
  addEventListener: (name, listener) => eventListeners.set(name, listener),
  removeEventListener: (name) => eventListeners.delete(name),
};

globalThis.document = {
  documentElement: {
    classList: { contains: () => false },
    dataset: {},
    style: {
      setProperty: (key, value) => styles.set(key, value),
      removeProperty: (key) => styles.delete(key),
    },
    removeAttribute: (name) => {
      if (name === "data-edgeever-extension-theme") delete globalThis.document.documentElement.dataset.edgeeverExtensionTheme;
    },
  },
};

globalThis.MutationObserver = class {
  observe() {}
  disconnect() {}
};

const { EdgeEverPluginHost } = await import("./plugin-host.ts");
const { sha256Hex } = await import("./github-plugin-distribution.ts");
const { withRepositoryMutationEvents } = await import("../repository-events.ts");

const repository = {
  listMemos: async () => ({ memos: [], totalCount: 0, nextCursor: null }),
};

beforeEach(() => {
  values.clear();
  styles.clear();
  eventListeners.clear();
  delete globalThis.window.fetch;
  globalThis.document.documentElement.dataset = {};
});

describe("EdgeEverPluginHost", () => {
  test("applies a validated code-free theme", async () => {
    const host = new EdgeEverPluginHost({ repository, scope: "test" });
    host.installManifest({
      type: "theme",
      id: "org.edgeever.test-theme",
      name: "Test theme",
      version: "1.0.0",
      themeApiVersion: "1",
      modes: ["light"],
      light: {
        "color.background": "#010203",
        "color.accent": "#16a06e",
      },
    }, "https://example.com/theme/manifest.json");

    await host.setEnabled("org.edgeever.test-theme", true);

    expect(styles.get("--edgeever-theme-background")).toBe("#010203");
    expect(styles.get("--edgeever-theme-accent")).toBe("#16a06e");
    expect(globalThis.document.documentElement.dataset.edgeeverExtensionTheme).toBe("org.edgeever.test-theme");
    await host.dispose();
  });

  test("loads a plugin and runs its registered command", async () => {
    const notices = [];
    const secrets = new Map();
    const secretStorage = {
      get: async (pluginId, key) => secrets.get(`${pluginId}:${key}`) ?? null,
      set: async (pluginId, key, value) => secrets.set(`${pluginId}:${key}`, value),
      remove: async (pluginId, key) => secrets.delete(`${pluginId}:${key}`),
      clearNamespace: async (pluginId) => {
        for (const key of [...secrets.keys()]) if (key.startsWith(`${pluginId}:`)) secrets.delete(key);
      },
    };
    const packageStorage = {
      get: async () => null,
      put: async () => undefined,
      remove: async () => undefined,
    };
    const host = new EdgeEverPluginHost({ repository, scope: "test", onNotice: (message) => notices.push(message), secretStorage, packageStorage });
    let replacement = null;
    host.setEditorAdapter({
      getSelection: () => ({ noteId: "note-1", from: 1, to: 6, empty: false, text: "hello", contentMarkdown: "hello" }),
      replaceSelection: (value) => { replacement = value; },
      insertAtCursor: () => undefined,
    });
    const entry = new URL("./plugin-host.fixture.mjs", import.meta.url).href;
    host.installManifest({
      type: "plugin",
      id: "org.edgeever.test-plugin",
      name: "Test plugin",
      version: "1.0.0",
      apiVersion: "1",
      entry,
      permissions: ["notes:write", "ui:commands", "ui:notices", "ui:panels", "editor:read", "editor:write", "secrets", "storage"],
      settings: {
        fields: [
          { key: "endpoint", type: "text", label: "Endpoint", default: "https://default.example" },
          { key: "token", type: "secret", label: "Token", required: true },
          { key: "limit", type: "number", label: "Limit", min: 1, max: 10, default: 5 },
        ],
      },
    }, "https://example.com/plugin/manifest.json");

    await host.setEnabled("org.edgeever.test-plugin", true);
    await host.runCommand("org.edgeever.test-plugin", "hello");

    expect(host.getSnapshot().commands).toHaveLength(7);
    expect(host.getSnapshot().panels).toHaveLength(1);
    expect(notices).toEqual(["hello from plugin"]);
    expect(host.getSnapshot().recentActions[0]).toMatchObject({ id: "hello", type: "command" });
    await expect(host.runCommand("org.edgeever.test-plugin", "read-without-permission")).rejects.toThrow("notes:read");
    await expect(host.runCommand("org.edgeever.test-plugin", "update-without-read-permission")).rejects.toThrow("notes:read");
    await expect(host.runCommand("org.edgeever.test-plugin", "subscribe-without-read-permission")).rejects.toThrow("notes:read");
    await host.runCommand("org.edgeever.test-plugin", "replace-selection");
    expect(replacement).toBe("HELLO");
    await host.runCommand("org.edgeever.test-plugin", "write-secret");
    expect(secrets.get("test:org.edgeever.test-plugin:token")).toBe("secret-value");
    await host.runCommand("org.edgeever.test-plugin", "write-storage");
    expect(values.get("edgeever.plugin-data.v1:test:org.edgeever.test-plugin:preference")).toBe('"stored-value"');
    await expect(host.getSettingValue("org.edgeever.test-plugin", "endpoint")).resolves.toBe("https://default.example");
    await host.setSettingValue("org.edgeever.test-plugin", "endpoint", "https://custom.example");
    await host.setSettingValue("org.edgeever.test-plugin", "token", "configured-token");
    await expect(host.getSettingValue("org.edgeever.test-plugin", "token")).resolves.toBeNull();
    await expect(host.getSettingValue("org.edgeever.test-plugin", "token", true)).resolves.toBe("configured-token");
    await expect(host.setSettingValue("org.edgeever.test-plugin", "limit", 11)).rejects.toThrow("at most 10");
    const container = {};
    const disposePanel = await host.mountPanel("org.edgeever.test-plugin", "fixture", container);
    expect(container.mountedByFixture).toBe(true);
    expect(host.getSnapshot().recentActions[0]).toMatchObject({ id: "fixture", type: "panel" });
    disposePanel();
    expect(container.mountedByFixture).toBe(false);
    const mountedDuringDisable = {};
    await host.mountPanel("org.edgeever.test-plugin", "fixture", mountedDuringDisable);
    await host.setEnabled("org.edgeever.test-plugin", false);
    expect(mountedDuringDisable.mountedByFixture).toBe(false);
    expect(host.getSnapshot().panels).toHaveLength(0);
    expect(host.getSnapshot().recentActions).toHaveLength(0);
    await host.uninstall("org.edgeever.test-plugin");
    expect(secrets.has("test:org.edgeever.test-plugin:token")).toBe(false);
    expect(secrets.has("test:org.edgeever.test-plugin:setting:token")).toBe(false);
    expect(values.has("edgeever.plugin-data.v1:test:org.edgeever.test-plugin:preference")).toBe(false);
    expect(values.has("edgeever.plugin-settings.v1:test:org.edgeever.test-plugin:endpoint")).toBe(false);
    await host.dispose();
  });

  test("installs a checksum-pinned marketplace package and removes its cache on uninstall", async () => {
    const manifest = {
      type: "plugin",
      id: "org.edgeever.marketplace-test",
      name: "Marketplace Test",
      version: "1.0.0",
      apiVersion: "1",
      entry: "./main.js",
      permissions: [],
    };
    const manifestText = JSON.stringify(manifest);
    const mainJs = "export default { activate() {} };";
    globalThis.window.fetch = async (input) => {
      const url = String(input);
      if (url.endsWith("/manifest.json")) return new Response(manifestText, { headers: { "content-type": "application/json" } });
      if (url.endsWith("/main.js")) return new Response(mainJs, { headers: { "content-type": "text/javascript" } });
      return new Response(null, { status: 404 });
    };
    const packages = new Map();
    const packageStorage = {
      get: async (pluginId, version) => packages.get(`${pluginId}:${version}`) ?? null,
      put: async (value) => packages.set(`${value.pluginId}:${value.version}`, value),
      remove: async (pluginId, version) => {
        if (version) packages.delete(`${pluginId}:${version}`);
        else for (const key of [...packages.keys()]) if (key.startsWith(`${pluginId}:`)) packages.delete(key);
      },
    };
    const secretStorage = {
      get: async () => null,
      set: async () => undefined,
      remove: async () => undefined,
      clearNamespace: async () => undefined,
    };
    const host = new EdgeEverPluginHost({ repository, scope: "test", packageStorage, secretStorage });
    const entry = {
      id: manifest.id,
      name: manifest.name,
      description: "Verified test plugin",
      author: "EdgeEver",
      category: "Testing",
      repositoryUrl: "https://github.com/edgeever/marketplace-test",
      distribution: { type: "manifest", manifestUrl: "https://plugins.example/manifest.json" },
      verification: {
        version: manifest.version,
        checksums: { manifestJson: await sha256Hex(manifestText), mainJs: await sha256Hex(mainJs) },
      },
    };

    await host.installMarketplaceEntry(entry);

    expect(host.getSnapshot().extensions[0].source).toMatchObject({ kind: "marketplace", verified: true });
    expect(packages.get(`${manifest.id}:${manifest.version}`)?.checksums.mainJs).toBe(entry.verification.checksums.mainJs);
    await host.uninstall(manifest.id);
    expect([...packages.keys()].some((key) => key.startsWith(`${manifest.id}:`))).toBe(false);
    await host.dispose();
  });

  test("rolls back an enabled plugin when an update cannot activate", async () => {
    const pluginId = "org.edgeever.rollback-test";
    const entry = new URL("./plugin-host.fixture.mjs", import.meta.url).href;
    const packages = new Map();
    const packageStorage = {
      get: async (id, version) => packages.get(`${id}:${version}`) ?? null,
      put: async (value) => packages.set(`${value.pluginId}:${value.version}`, value),
      remove: async (id, version) => {
        if (version) packages.delete(`${id}:${version}`);
        else for (const key of [...packages.keys()]) if (key.startsWith(`${id}:`)) packages.delete(key);
      },
    };
    const host = new EdgeEverPluginHost({ repository, scope: "test", packageStorage });
    host.installManifest({
      type: "plugin",
      id: pluginId,
      name: "Rollback Test",
      version: "1.0.0",
      apiVersion: "1",
      entry,
      permissions: ["notes:write", "ui:commands", "ui:notices", "ui:panels", "editor:read", "editor:write", "secrets", "storage"],
    }, "https://plugins.example/v1/manifest.json");
    await host.setEnabled(pluginId, true);

    const nextManifest = {
      type: "plugin",
      id: pluginId,
      name: "Rollback Test",
      version: "2.0.0",
      apiVersion: "1",
      entry: "./main.js",
      permissions: [],
    };
    globalThis.window.fetch = async (input) => String(input).endsWith("main.js")
      ? new Response("export default {};", { headers: { "content-type": "text/javascript" } })
      : Response.json(nextManifest);

    await expect(host.installFromManifestUrl("https://plugins.example/v2/manifest.json", undefined, nextManifest))
      .rejects.toThrow("activate(context)");

    const restored = host.getSnapshot().extensions.find((extension) => extension.manifest.id === pluginId);
    expect(restored?.manifest.version).toBe("1.0.0");
    expect(restored?.enabled).toBe(true);
    expect(host.getSnapshot().commands.some((command) => command.pluginId === pluginId && command.id === "hello")).toBe(true);
    expect(packages.has(`${pluginId}:2.0.0`)).toBe(false);
    await host.dispose();
  });

  test("rejects a manifest that changed after update confirmation", async () => {
    const confirmedManifest = {
      type: "theme",
      id: "org.edgeever.changed-theme",
      name: "Changed theme",
      version: "2.0.0",
      themeApiVersion: "1",
      modes: ["light"],
      light: { "color.background": "#ffffff" },
    };
    globalThis.window.fetch = async () => Response.json({
      ...confirmedManifest,
      light: { "color.background": "#000000" },
    });
    const host = new EdgeEverPluginHost({ repository, scope: "test" });

    await expect(host.installFromManifestUrl(
      "https://plugins.example/manifest.json",
      undefined,
      confirmedManifest,
    )).rejects.toThrow("changed after update confirmation");

    expect(host.getSnapshot().extensions).toHaveLength(0);
    await host.dispose();
  });

  test("routes P1 notebook, note revision, resource, and setting capabilities through the repository", async () => {
    const resource = {
      id: "resource-1",
      memoId: "note-1",
      originalMemoId: null,
      kind: "attachment",
      mimeType: "text/plain",
      filename: "hello.txt",
      byteSize: 5,
      sha256: null,
      width: null,
      height: null,
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
      url: "https://edgeever.example/resource-1",
    };
    const repositoryWithCapabilities = {
      ...repository,
      createNotebook: async (input) => ({ notebook: { id: "notebook-created", parentId: null, name: input.name, memoCount: 0 } }),
      moveMemos: async () => ({ ok: true, moved: 1 }),
      pinMemos: async () => ({ ok: true, updated: 1 }),
      listMemoRevisions: async () => ({ revisions: [{
        id: "revision-1",
        memoId: "note-1",
        revision: 1,
        title: "First",
        tags: ["test"],
        contentMarkdown: "First",
        contentText: "First",
        createdAt: "2026-09-01T00:00:00.000Z",
      }] }),
      listResources: async () => ({ resources: [{ ...resource, memoTitle: "Note", memoExcerpt: "", memoDeleted: false }], summary: {} }),
      uploadMemoResource: async () => ({ resource }),
    };
    const packageStorage = { get: async () => null, put: async () => undefined, remove: async () => undefined };
    const host = new EdgeEverPluginHost({ repository: repositoryWithCapabilities, scope: "capabilities", packageStorage });
    const entry = new URL("./plugin-host-capabilities.fixture.mjs", import.meta.url).href;
    host.installManifest({
      type: "plugin",
      id: "org.edgeever.capabilities",
      name: "Capabilities",
      version: "1.0.0",
      apiVersion: "1",
      entry,
      permissions: ["notes:read", "notes:write", "metadata:write", "resources:read", "resources:write", "ui:commands"],
      settings: { fields: [{ key: "endpoint", type: "text", label: "Endpoint", default: "https://api.example" }] },
    }, "https://plugins.example/capabilities/manifest.json");

    await host.setEnabled("org.edgeever.capabilities", true);
    await host.runCommand("org.edgeever.capabilities", "exercise-capabilities");

    expect(globalThis.edgeeverPluginCapabilityResult).toMatchObject({
      notebook: { id: "notebook-created", name: "Created by plugin" },
      moved: 1,
      pinned: 1,
      revisions: [{ id: "revision-1", noteId: "note-1", contentMarkdown: "First" }],
      resources: [{ id: "resource-1", noteId: "note-1", filename: "hello.txt" }],
      uploaded: { id: "resource-1", noteId: "note-1" },
      endpoint: "https://api.example",
    });
    delete globalThis.edgeeverPluginCapabilityResult;
    await host.dispose();
  });

  test("delivers successful user and plugin repository mutations through one workspace event stream", async () => {
    const updatedMemo = {
      id: "note-events",
      notebookId: "notebook-1",
      title: "Updated",
      excerpt: "Updated",
      tags: ["events"],
      isPinned: false,
      isArchived: false,
      isDeleted: false,
      revision: 2,
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:01:00.000Z",
      deletedAt: null,
      contentJson: { type: "doc", content: [] },
      contentMarkdown: "Updated",
      contentText: "Updated",
      contentHash: "updated-hash",
      sourceMemoIds: [],
      mergeSourceCount: 0,
      mergedIntoMemoId: null,
    };
    const repositoryWithEvents = withRepositoryMutationEvents({
      ...repository,
      updateMemo: async () => ({ memo: updatedMemo, queued: true }),
    }, "event-workspace");
    const packageStorage = { get: async () => null, put: async () => undefined, remove: async () => undefined };
    const host = new EdgeEverPluginHost({ repository: repositoryWithEvents, scope: "event-workspace", packageStorage });
    host.installManifest({
      type: "plugin",
      id: "org.edgeever.events",
      name: "Events",
      version: "1.0.0",
      apiVersion: "1",
      entry: new URL("./plugin-host-events.fixture.mjs", import.meta.url).href,
      permissions: ["notes:read"],
    }, "https://plugins.example/events/manifest.json");
    await host.setEnabled("org.edgeever.events", true);
    await host.activateEnabled();

    await repositoryWithEvents.updateMemo(updatedMemo, {});

    expect(globalThis.edgeeverPluginObservedNote).toMatchObject({
      id: "note-events",
      contentMarkdown: "Updated",
    });
    delete globalThis.edgeeverPluginObservedNote;
    await host.dispose();
  });
});
