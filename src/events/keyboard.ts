import { Input } from "./input"
import interact from "interactjs"

/**
 * Maintains a map of pressed keys.
 *
 * Produces events while key is pressed with elapsed time
 */
export class Keyboard {
  pressed = {}
  released = {}
  heldSince = {}
  tapped = {}
  private readonly disabled: boolean
  /** Early-return guard for mousetouch; set by Container to suppress
   * aim-rotate / camera-height drags while the CueHit gesture is active. */
  mousetouchGuard: (() => boolean) | null = null

  getEvents() {
    const keys = Object.keys(this.pressed)
      .filter((key) => !/Shift/.test(key))
      .filter((key) => !/Control/.test(key))
    const shift = Object.keys(this.pressed).some((key) => /Shift/.test(key))
    const control = Object.keys(this.pressed).some((key) => /Control/.test(key))
    const result: Input[] = []

    keys.forEach((k) => {
      const now = performance.now()
      const t = now - this.pressed[k]
      result.push(this.input(k, t, now - this.heldSince[k], shift, control))
      if (k != "Space") {
        this.pressed[k] = now
      }
    })

    Object.keys(this.tapped).forEach((k) => {
      const t = this.tapped[k]
      result.push(this.input(k, t, t, shift, control))
    })
    this.tapped = {}

    Object.keys(this.released).forEach((key) =>
      result.push(new Input(this.released[key], key + "Up"))
    )

    this.released = {}
    return result
  }

  private input(k, t, held, shift, control) {
    return new Input(control ? t / 3 : t, shift ? "Shift" + k : k, {
      from: held - t,
      to: held,
      fine: control,
    })
  }

  constructor(element: HTMLCanvasElement, opts: { disabled?: boolean } = {}) {
    this.disabled = opts.disabled ?? false
    this.addHandlers(element)
    if (!/Android|iPhone/i.test(navigator.userAgent)) {
      element.contentEditable = "true"
    }
  }

  /** True while the chat input is focused, so typing there never reaches the game. */
  private chatFocused() {
    const active = document.activeElement as HTMLElement | null
    return !!active?.closest("#inputTextDiv")
  }

  keydown = (e) => {
    if (this.disabled || this.chatFocused()) return
    this.pressed[e.code] ??= performance.now()
    this.heldSince[e.code] ??= this.pressed[e.code]
    e.stopImmediatePropagation()
    if (e.key !== "F12") {
      e.preventDefault()
    }
  }

  keyup = (e) => {
    if (this.disabled || this.chatFocused()) return
    this.released[e.code] = performance.now() - this.pressed[e.code]
    // Pressed and released between two frames: still deliver it once.
    if (
      e.code !== "Space" &&
      this.pressed[e.code] !== undefined &&
      this.pressed[e.code] === this.heldSince[e.code]
    ) {
      this.tapped[e.code] = this.released[e.code]
    }
    delete this.pressed[e.code]
    delete this.heldSince[e.code]
    e.stopImmediatePropagation()
    if (e.key !== "F12") {
      e.preventDefault()
    }
  }

  mousetouch = (e) => {
    if (this.mousetouchGuard?.()) return
    const k = this.released
    const topHalf = e.client.y < e.rect.height / 2
    const factor = topHalf || e.ctrlKey ? 0.5 : 1
    const dx = e.dx * factor
    const dy = e.dy * 0.8
    k["movementY"] = (k["movementY"] ?? 0) + dy
    k["movementX"] = (k["movementX"] ?? 0) + dx
    if (Math.abs(k["movementX"]) > Math.abs(k["movementY"])) {
      k["movementY"] = 0
    }
  }

  private addHandlers(element: HTMLCanvasElement) {
    element.addEventListener("keydown", this.keydown)
    element.addEventListener("keyup", this.keyup)
    // A key released while focus has moved elsewhere (e.g. into the chat input)
    // never reaches this canvas — clear held state so it isn't stuck.
    element.addEventListener("blur", () => {
      this.pressed = {}
      this.released = {}
      this.heldSince = {}
      this.tapped = {}
    })
    element.addEventListener("dragstart", (e) => e.preventDefault())
    element.focus()

    interact(element).draggable({
      mouseButtons: 1,
      listeners: {
        move: (e) => {
          this.mousetouch(e)
        },
      },
    })
    interact(element).gesturable({
      onmove: (e) => {
        e.dx /= 3
        this.mousetouch(e)
      },
    })
  }
}
