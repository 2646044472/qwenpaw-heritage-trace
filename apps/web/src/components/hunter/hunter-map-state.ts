export type HunterMapDragState = { pointerId: number; x: number; y: number };

export function isMatchingPointer(drag: HunterMapDragState | null, pointerId: number): drag is HunterMapDragState {
  return drag?.pointerId === pointerId;
}
