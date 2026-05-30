"use client";

import { openDB, type IDBPDatabase, type DBSchema } from "idb";

export type MutationStatus = "pending" | "in_flight" | "failed";

export interface PendingMutation {
  id: string;
  kind: string;
  args: unknown;
  createdAt: number;
  attempts: number;
  status: MutationStatus;
  lastError?: string;
}

export interface CachedPage {
  key: string;
  data: unknown;
  fetchedAt: number;
  stale?: boolean;
}

interface SyncSchema extends DBSchema {
  pending_mutations: {
    key: string;
    value: PendingMutation;
    indexes: { createdAt: number };
  };
  cache_pages: {
    key: string;
    value: CachedPage;
  };
}

const DB_VERSION = 1;
const UID_STORAGE_KEY = "__habit_log_uid";

export function currentUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(UID_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setCurrentUserId(uid: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (uid) window.localStorage.setItem(UID_STORAGE_KEY, uid);
    else window.localStorage.removeItem(UID_STORAGE_KEY);
  } catch {
    /* storage disabled */
  }
}

function dbNameFor(uid: string | null): string {
  return uid ? `habit_log_sync_u${uid}` : "habit_log_sync";
}

let cachedUid: string | null | undefined = undefined;
let dbPromise: Promise<IDBPDatabase<SyncSchema>> | null = null;

export function openSyncDB(): Promise<IDBPDatabase<SyncSchema>> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }
  const uid = currentUserId();
  if (cachedUid !== uid && dbPromise) {
    // User changed — drop the cached connection so the next open uses the new DB name.
    dbPromise.then((db) => db.close()).catch(() => {});
    dbPromise = null;
  }
  cachedUid = uid;
  if (!dbPromise) {
    dbPromise = openDB<SyncSchema>(dbNameFor(uid), DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("pending_mutations")) {
          const store = db.createObjectStore("pending_mutations", { keyPath: "id" });
          store.createIndex("createdAt", "createdAt");
        }
        if (!db.objectStoreNames.contains("cache_pages")) {
          db.createObjectStore("cache_pages", { keyPath: "key" });
        }
      },
    });
  }
  return dbPromise;
}
