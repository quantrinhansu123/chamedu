/**
 * Temporary no-op stubs replacing Firebase Firestore APIs.
 * Pages/features still calling collection/getDocs will get empty data until migrated to Supabase services.
 */

export type StubDoc = { id: string; data: () => Record<string, unknown> };
export type StubSnapshot = { docs: StubDoc[]; empty: boolean; size: number };
export type StubQuery = { _collection: string };
export type StubRef = { id: string; path?: string };

const emptySnap = (): StubSnapshot => ({ docs: [], empty: true, size: 0 });

export const collection = (_db: unknown, name: string): StubQuery => ({ _collection: name });

export const doc = (_db: unknown, ...parts: string[]): StubRef => ({
  id: parts[parts.length - 1],
  path: parts.join('/'),
});

export const query = (..._args: unknown[]): StubQuery => ({ _collection: '' });

export const where = (..._args: unknown[]) => ({});
export const orderBy = (..._args: unknown[]) => ({});
export const limit = (..._args: unknown[]) => ({});

export const getDocs = async (_q: unknown): Promise<StubSnapshot> => {
  console.warn('[legacyFirestoreStub] getDocs — migrate to Supabase');
  return emptySnap();
};

export const getDoc = async (_ref: unknown): Promise<{ exists: () => boolean; data: () => undefined; id: string }> => ({
  exists: () => false,
  data: () => undefined,
  id: '',
});

export const addDoc = async (_col: unknown, _data: unknown): Promise<StubRef> => {
  console.warn('[legacyFirestoreStub] addDoc — migrate to Supabase');
  return { id: crypto.randomUUID() };
};

export const setDoc = async (..._args: unknown[]): Promise<void> => {
  console.warn('[legacyFirestoreStub] setDoc — migrate to Supabase');
};

export const updateDoc = async (..._args: unknown[]): Promise<void> => {
  console.warn('[legacyFirestoreStub] updateDoc — migrate to Supabase');
};

export const deleteDoc = async (..._args: unknown[]): Promise<void> => {
  console.warn('[legacyFirestoreStub] deleteDoc — migrate to Supabase');
};

export const onSnapshot = (
  _q: unknown,
  onNext: (snap: StubSnapshot) => void,
  _onError?: (e: Error) => void
): (() => void) => {
  onNext(emptySnap());
  return () => {};
};

export const writeBatch = (_db: unknown) => ({
  set: () => {},
  update: () => {},
  delete: () => {},
  commit: async () => {},
});

export const runTransaction = async (_db: unknown, fn: (tx: any) => Promise<unknown>) => {
  const tx = {
    get: async () => ({ exists: () => false, data: () => ({}) }),
    set: () => {},
    update: () => {},
    delete: () => {},
  };
  return fn(tx);
};

export const arrayUnion = (...values: unknown[]) => ({ __arrayUnion: values });
export const Timestamp = {
  now: () => new Date().toISOString(),
  fromDate: (d: Date) => d.toISOString(),
};

export const db = null;
