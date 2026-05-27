// IndexedDB-backed retry queue for Auto Clearance offline captures.
//
// HARD RULE: items added to this queue are NOT considered complete.
// They only become complete after the drain pipeline succeeds end-to-end
// (upload + OCR/match + product validation + DB update). Until then the
// corresponding clearance_evidence row stays at verification_state =
// 'manual_review' or 'pending' — never 'complete' / status='cleared'.

export type QueuedCapture = {
  id: string;                  // local uuid
  kind: "tag" | "product";
  itemId: string | null;       // resolved item once tag matched; null if tag not yet matched
  manifestKey: string;
  blob: Blob;
  createdAt: number;
};

const DB_NAME = "auto-clearance-queue";
const STORE = "captures";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueue(item: QueuedCapture): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function list(): Promise<QueuedCapture[]> {
  const db = await openDb();
  const out = await new Promise<QueuedCapture[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as QueuedCapture[]) || []);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return out;
}

export async function remove(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function count(): Promise<number> {
  try {
    const items = await list();
    return items.length;
  } catch {
    return 0;
  }
}
