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

const DB_NAME = "habit_log_sync";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<SyncSchema>> | null = null;

export function openSyncDB(): Promise<IDBPDatabase<SyncSchema>> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }
  if (!dbPromise) {
    dbPromise = openDB<SyncSchema>(DB_NAME, DB_VERSION, {
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
