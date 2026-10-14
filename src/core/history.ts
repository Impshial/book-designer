import type { Project } from "./model";
export class History {
  private past: Project[] = [];
  private future: Project[] = [];
  private mergeKey = "";
  private lastEdit = 0;
  constructor(public current: Project) {}
  breakGroup() {
    this.mergeKey = "";
  }
  commit(update: (draft: Project) => void, mergeKey = "") {
    // Original asset strings are immutable and shared across history snapshots.
    const draft = structuredClone({ ...this.current, assets: {} });
    draft.assets = { ...this.current.assets };
    update(draft);
    if (JSON.stringify(draft) === JSON.stringify(this.current))
      return this.current;
    const now = Date.now();
    if (!mergeKey || mergeKey !== this.mergeKey || now - this.lastEdit > 650)
      this.past.push(this.current);
    this.mergeKey = mergeKey;
    this.lastEdit = now;
    if (this.past.length > 80) this.past.shift();
    this.future = [];
    draft.revision = this.current.revision + 1;
    draft.modified = new Date().toISOString();
    return (this.current = draft);
  }
  undo() {
    this.mergeKey = "";
    const p = this.past.pop();
    if (p) {
      this.future.push(this.current);
      this.current = {
        ...p,
        revision: this.current.revision + 1,
        modified: new Date().toISOString(),
      };
    }
    return this.current;
  }
  redo() {
    this.mergeKey = "";
    const p = this.future.pop();
    if (p) {
      this.past.push(this.current);
      this.current = {
        ...p,
        revision: this.current.revision + 1,
        modified: new Date().toISOString(),
      };
    }
    return this.current;
  }
  get canUndo() {
    return !!this.past.length;
  }
  get canRedo() {
    return !!this.future.length;
  }
}
