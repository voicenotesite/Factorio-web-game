export interface InputCallbacks {
  onKeyDown: (key: string) => void
  onKeyUp: (key: string) => void
  onMouseMove: (x: number, y: number) => void
  onMouseDown: (button: number) => void
  onMouseUp: (button: number) => void
  onWheel: (delta: number) => void
}

export class InputManager {
  private keyDownHandler: ((e: KeyboardEvent) => void) | null = null
  private keyUpHandler: ((e: KeyboardEvent) => void) | null = null
  private callbacks: InputCallbacks

  constructor(callbacks: InputCallbacks) {
    this.callbacks = callbacks
  }

  attach(canvas: HTMLCanvasElement): void {
    this.keyDownHandler = (e: KeyboardEvent) => {
      this.callbacks.onKeyDown(e.key)
      if (['w', 'W', 'a', 'A', 's', 'S', 'd', 'D', ' ', 'Escape'].includes(e.key)) {
        e.preventDefault()
      }
    }
    this.keyUpHandler = (e: KeyboardEvent) => {
      this.callbacks.onKeyUp(e.key)
    }

    window.addEventListener('keydown', this.keyDownHandler)
    window.addEventListener('keyup', this.keyUpHandler)

    canvas.addEventListener('mousemove', (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      this.callbacks.onMouseMove(e.clientX - rect.left, e.clientY - rect.top)
    })

    canvas.addEventListener('mousedown', (e: MouseEvent) => {
      e.preventDefault()
      this.callbacks.onMouseDown(e.button)
    })

    canvas.addEventListener('mouseup', (e: MouseEvent) => {
      e.preventDefault()
      this.callbacks.onMouseUp(e.button)
    })

    canvas.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault()
      this.callbacks.onWheel(e.deltaY > 0 ? -0.1 : 0.1)
    }, { passive: false })

    // Touch support
    canvas.addEventListener('touchstart', (e: TouchEvent) => {
      e.preventDefault()
      const touch = e.touches[0]
      const rect = canvas.getBoundingClientRect()
      this.callbacks.onMouseMove(touch.clientX - rect.left, touch.clientY - rect.top)
      this.callbacks.onMouseDown(0)
    }, { passive: false })

    canvas.addEventListener('touchmove', (e: TouchEvent) => {
      e.preventDefault()
      const touch = e.touches[0]
      const rect = canvas.getBoundingClientRect()
      this.callbacks.onMouseMove(touch.clientX - rect.left, touch.clientY - rect.top)
    }, { passive: false })

    canvas.addEventListener('touchend', (e: TouchEvent) => {
      e.preventDefault()
      this.callbacks.onMouseUp(0)
    }, { passive: false })
  }

  detach(): void {
    if (this.keyDownHandler) window.removeEventListener('keydown', this.keyDownHandler)
    if (this.keyUpHandler) window.removeEventListener('keyup', this.keyUpHandler)
    this.keyDownHandler = null
    this.keyUpHandler = null
  }
}
