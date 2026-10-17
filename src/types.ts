export type Side = "arno" | "daniel";

export const SIDES: readonly Side[] = ["arno", "daniel"] as const;

export const SIDE_LABEL: Readonly<Record<Side, string>> = {
  arno: "Arno",
  daniel: "Daniel",
};

/** A row of the public tally. Contains no full name and no raw handle (S5). */
export interface VoteRecord {
  readonly uid: string;
  readonly side: Side;
  readonly handleMasked: string;
  readonly updatedAt: number | null;
}

/** What the backend tells us about the signed-in viewer. */
export interface Session {
  readonly uid: string;
  /** null when the Telegram name identifies neither camp: viewer, not voter. */
  readonly side: Side | null;
  readonly handleMasked: string;
  readonly displayName: string;
}

export interface Tally {
  readonly arno: VoteRecord[];
  readonly daniel: VoteRecord[];
  readonly total: number;
}
