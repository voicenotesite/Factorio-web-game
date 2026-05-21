export interface CoopCallbacks {
  onBuildingAction?: (action: 'place' | 'remove', type: string, x: number, y: number, dir: string) => void
}

export class CoopManager {
  private callbacks: CoopCallbacks

  constructor(callbacks: CoopCallbacks = {}) {
    this.callbacks = callbacks
  }

  setCallbacks(callbacks: CoopCallbacks): void {
    this.callbacks = callbacks
  }

  placeBuilding(type: string, x: number, y: number, dir: string): void {
    this.callbacks.onBuildingAction?.('place', type, x, y, dir)
  }

  removeBuilding(x: number, y: number): void {
    this.callbacks.onBuildingAction?.('remove', '', x, y, '')
  }
}
