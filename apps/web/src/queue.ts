/** Round-robin admission with at most one active request per transfer. */
export class FairScheduler {
  private queues = new Map<string, Array<() => void>>();
  private order: string[] = [];
  private active = new Set<string>();
  constructor(private concurrency = 2) {}
  run<T>(owner: string, work: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const pending = this.queues.get(owner) || [];
      pending.push(() => {
        this.active.add(owner);
        void Promise.resolve()
          .then(work)
          .then(resolve, reject)
          .finally(() => {
            this.active.delete(owner);
            const index = this.order.indexOf(owner);
            if (index >= 0) {
              this.order.splice(index, 1);
              this.order.push(owner);
            }
            this.drain();
          });
      });
      this.queues.set(owner, pending);
      if (!this.order.includes(owner)) this.order.push(owner);
      this.drain();
    });
  }
  private drain() {
    let checked = this.order.length;
    while (this.active.size < this.concurrency && checked-- > 0) {
      const owner = this.order.shift()!;
      const pending = this.queues.get(owner)!;
      if (this.active.has(owner)) {
        this.order.push(owner);
        continue;
      }
      const next = pending.shift();
      if (pending.length) this.order.push(owner);
      else this.queues.delete(owner);
      next?.();
    }
  }
}

type StoredFile = {
  id: string;
  scope: string;
  file: File;
  sha256: string;
  created: number;
};
async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("flowdrop-queue-v3", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("files", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function transaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("files", mode);
    const request = operation(tx.objectStore("files"));
    tx.oncomplete = () => {
      db.close();
      resolve(request.result);
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(tx.error || request.error);
    };
  });
}
export async function persistFile(entry: Omit<StoredFile, "created">) {
  await transaction("readwrite", (store) =>
    store.put({ ...entry, created: Date.now() }),
  );
}
export async function recoverFiles(scope: string) {
  const items = await transaction<StoredFile[]>("readonly", (store) =>
    store.getAll(),
  );
  const cutoff = Date.now() - 86400000;
  for (const entry of items)
    if (entry.created < cutoff) await forgetFile(entry.id);
  return items.filter(
    (entry) => entry.scope === scope && entry.created >= cutoff,
  );
}
export async function forgetFile(id: string) {
  await transaction("readwrite", (store) => store.delete(id));
}
