import { Dexie, type EntityTable } from "dexie";

interface Note {
    id?: number;
    timestamp: number;
    note: string;
}


export const db = new Dexie("SocratesDB") as Dexie & {
  notes: EntityTable<Note, "id">;
};

db.version(1).stores({
    notes: "++id, timestamp, note",
});

export type {Note}
