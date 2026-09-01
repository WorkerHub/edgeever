export default {
  activate(context) {
    return context.commands.register({
      id: "exercise-capabilities",
      title: "Exercise capabilities",
      async run() {
        const notebook = await context.notebooks.create({ name: "Created by plugin" });
        const moved = await context.notes.move(["note-1"], notebook.id);
        const pinned = await context.notes.pin(["note-1"], true);
        const revisions = await context.notes.revisions.list("note-1");
        const resources = await context.resources.list("note-1");
        const uploaded = await context.resources.upload("note-1", new File(["hello"], "hello.txt", { type: "text/plain" }));
        const endpoint = await context.settings.get("endpoint");
        globalThis.edgeeverPluginCapabilityResult = { notebook, moved, pinned, revisions, resources, uploaded, endpoint };
      },
    });
  },
};
