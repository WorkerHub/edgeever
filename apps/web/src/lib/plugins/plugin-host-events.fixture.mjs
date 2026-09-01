export default {
  activate(context) {
    return context.events.on("note.updated", ({ note }) => {
      globalThis.edgeeverPluginObservedNote = note;
    });
  },
};
