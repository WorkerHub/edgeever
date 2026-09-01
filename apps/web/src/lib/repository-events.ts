import type { MemoDetail } from "@edgeever/shared";
import type { EdgeEverRepository } from "@/lib/repository";

export type RepositoryMutationEvent =
  | { type: "note.created"; note: MemoDetail }
  | { type: "note.updated"; note: MemoDetail }
  | { type: "note.deleted"; noteId: string }
  | { type: "tag.changed"; previousName?: string; name?: string; deleted?: boolean }
  | { type: "workspace.synced"; bootstrapped: boolean; changed: number };

type RepositoryMutationListener = (event: RepositoryMutationEvent) => void;

const listenersByScope = new Map<string, Set<RepositoryMutationListener>>();

export const notifyRepositoryMutation = (scope: string, event: RepositoryMutationEvent) => {
  for (const listener of listenersByScope.get(scope) ?? []) listener(event);
};

export const subscribeRepositoryMutations = (scope: string, listener: RepositoryMutationListener) => {
  const listeners = listenersByScope.get(scope) ?? new Set<RepositoryMutationListener>();
  listeners.add(listener);
  listenersByScope.set(scope, listeners);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) listenersByScope.delete(scope);
  };
};

export const withRepositoryMutationEvents = (repository: EdgeEverRepository, scope: string): EdgeEverRepository => ({
  ...repository,
  async createMemo(input) {
    const result = await repository.createMemo(input);
    notifyRepositoryMutation(scope, { type: "note.created", note: result.memo });
    return result;
  },
  async updateMemo(memo, input) {
    const result = await repository.updateMemo(memo, input);
    notifyRepositoryMutation(scope, { type: "note.updated", note: result.memo });
    return result;
  },
  async deleteMemo(noteId, permanent) {
    const result = await repository.deleteMemo(noteId, permanent);
    notifyRepositoryMutation(scope, { type: "note.deleted", noteId });
    return result;
  },
  async restoreMemo(noteId) {
    const result = await repository.restoreMemo(noteId);
    notifyRepositoryMutation(scope, { type: "note.updated", note: result.memo });
    return result;
  },
  async restoreMemoRevision(noteId, revisionId) {
    const result = await repository.restoreMemoRevision(noteId, revisionId);
    notifyRepositoryMutation(scope, { type: "note.updated", note: result.memo });
    return result;
  },
  async useTemplate(templateId, notebookId) {
    const result = await repository.useTemplate(templateId, notebookId);
    notifyRepositoryMutation(scope, { type: "note.created", note: result.memo });
    return result;
  },
  async mergeMemos(input) {
    const result = await repository.mergeMemos(input);
    notifyRepositoryMutation(scope, { type: "note.created", note: result.memo });
    return result;
  },
  async renameTag(previousName, name) {
    const result = await repository.renameTag(previousName, name);
    notifyRepositoryMutation(scope, { type: "tag.changed", previousName, name });
    return result;
  },
  async deleteTag(previousName) {
    const result = await repository.deleteTag(previousName);
    notifyRepositoryMutation(scope, { type: "tag.changed", previousName, deleted: true });
    return result;
  },
  async sync() {
    const result = await repository.sync();
    notifyRepositoryMutation(scope, { type: "workspace.synced", ...result });
    return result;
  },
});
