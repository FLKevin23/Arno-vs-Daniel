import { collection, onSnapshot, type DocumentData, type QuerySnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { firestore, functions } from "./firebase.js";
import type { Side, Tally, VoteRecord } from "./types.js";

/**
 * Subscribe to the public tally. Readable signed-out, so the chart renders for
 * viewers who never log in.
 */
export function observeVotes(
  onTally: (tally: Tally) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    collection(firestore(), "votes"),
    (snap: QuerySnapshot<DocumentData>) => onTally(toTally(snap)),
    (error) => onError(error),
  );
}

export async function castVote(): Promise<{ side: Side }> {
  const call = httpsCallable<void, { side: Side; revision: number }>(functions(), "castVote");
  const { data } = await call();
  return { side: data.side };
}

export async function deleteMyVote(): Promise<void> {
  const call = httpsCallable<void, { deleted: boolean }>(functions(), "deleteVote");
  await call();
}

/**
 * Build the tally, discarding anything that isn't a well-formed row (S11).
 * The documents are server-written, but a renderer that trusts its input is one
 * bad migration away from breaking the page.
 */
function toTally(snap: QuerySnapshot<DocumentData>): Tally {
  const arno: VoteRecord[] = [];
  const daniel: VoteRecord[] = [];

  snap.forEach((doc) => {
    const record = toRecord(doc.id, doc.data());
    if (!record) return;
    (record.side === "arno" ? arno : daniel).push(record);
  });

  const byTime = (a: VoteRecord, b: VoteRecord): number => (a.updatedAt ?? 0) - (b.updatedAt ?? 0);
  arno.sort(byTime);
  daniel.sort(byTime);

  return { arno, daniel, total: arno.length + daniel.length };
}

function toRecord(uid: string, data: DocumentData): VoteRecord | null {
  const side: unknown = data["side"];
  if (side !== "arno" && side !== "daniel") return null;

  const handle: unknown = data["handleMasked"];
  const updated: unknown = data["updatedAt"];

  return {
    uid,
    side,
    handleMasked: typeof handle === "string" && handle.length > 0 ? handle.slice(0, 33) : "@***",
    updatedAt:
      updated && typeof updated === "object" && "toMillis" in updated
        ? (updated as { toMillis: () => number }).toMillis()
        : null,
  };
}
