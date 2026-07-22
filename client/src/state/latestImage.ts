import type { CaptureMode } from "../types/app";

export type LatestImage = {
  blob: Blob;
  width: number;
  height: number;
  mode: CaptureMode;
  capturedAt: number;
};

const DATABASE_NAME = "chesscoach.local";
const DATABASE_VERSION = 1;
const STORE_NAME = "captures";
const LATEST_KEY = "latest";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not open local image storage."));
  });
}

async function transact<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const request = action(transaction.objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Local image storage failed."));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("Local image storage was interrupted."));
    });
  } finally {
    database.close();
  }
}

export function saveLatestImage(image: LatestImage): Promise<IDBValidKey> {
  return transact("readwrite", (store) => store.put(image, LATEST_KEY));
}

export function loadLatestImage(): Promise<LatestImage | undefined> {
  return transact<LatestImage | undefined>("readonly", (store) => store.get(LATEST_KEY));
}
