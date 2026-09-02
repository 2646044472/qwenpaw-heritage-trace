export type HunterMapDragState = { pointerId: number; x: number; y: number; moved?: boolean };

export function isMatchingPointer(drag: HunterMapDragState | null, pointerId: number): drag is HunterMapDragState {
  return drag?.pointerId === pointerId;
}
