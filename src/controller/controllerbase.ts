import { Controller, Input } from "./controller"
import { exportGltf } from "../utils/gltf"
import { ChatEvent } from "../events/chatevent"
import { NotificationEvent } from "../events/notificationevent"
import { ScoreEvent } from "../events/scoreevent"
import { ConcedeEvent } from "../events/concedeevent"
import { Outcome } from "../model/outcome"
import { MathUtils, Vector3 } from "three"
import { Session } from "../network/client/session"

const flipP1type = (t: number) => (t === 1 ? 2 : 1)

const flipX = new URLSearchParams(globalThis.location?.search).has("flip")

const aimTap = MathUtils.degToRad(0.05)
const aimRepeatDelay = 250
const aimRampEnd = 700
const aimSlow = MathUtils.degToRad(10) / 1000
const aimFast = MathUtils.degToRad(80) / 1000
const aimFine = MathUtils.degToRad(1) / 1000

/**
 * Cue rotation (radians) after an arrow key has been held for `held` ms.
 * A press moves one tiny step and then waits, like key repeat, so a tap stays
 * barely visible. Holding then turns at aimSlow, easing (smoothstep) up to
 * aimFast by aimRampEnd; with Control it turns at aimFine throughout.
 */
export function aimTravel(held: number, fine: boolean): number {
  if (held <= 0) return 0
  const t = held - aimRepeatDelay
  if (t <= 0) return aimTap
  if (fine) return aimTap + aimFine * t
  const ramp = aimRampEnd - aimRepeatDelay
  const u = Math.min(t / ramp, 1)
  const extra = ramp * (u ** 3 - u ** 4 / 2) + Math.max(t - ramp, 0)
  return aimTap + aimSlow * t + (aimFast - aimSlow) * extra
}

export abstract class ControllerBase extends Controller {
  readonly scale = 0.001

  constructor(container) {
    super(container)
    container.table.proximityIndicator.hide()
  }

  override handleChat(chatevent: ChatEvent): Controller {
    if (chatevent.message) {
      this.container.chat.showMessage(chatevent.message)
    }
    if (chatevent.line) {
      this.container.view.addLine(chatevent.line)
    }
    return this
  }

  override handleNotification(event: NotificationEvent): Controller {
    const data = event.data
    if (
      typeof data !== "string" &&
      data.type === "GameOver" &&
      !data.highBreaks
    ) {
      data.highBreaks = this.container.ballTray
        .getTopBreaks(3)
        .map(({ score, hiScoreUri }) => ({ score, url: hiScoreUri }))
    }
    this.container.notification.show(data, event.duration)
    return this
  }

  override handleScore(event: ScoreEvent): Controller {
    const session = Session.getInstance()
    if (
      event.p1type !== undefined &&
      event.p1type !== 0 &&
      session.p1type === 0
    ) {
      session.p1type =
        session.playerIndex === 0 ? event.p1type : flipP1type(event.p1type)
    }
    this.container.updateScoreHud(event.p1, event.p2, event.b, event.active)

    const rulename = this.container.rules.rulename
    if (!this.container.replayMode && this.name !== "End") {
      if (
        (rulename === "threecushion" || rulename === "sagu") &&
        this.container.rules.isEndOfGame([])
      ) {
        const myTarget = session.getRaceTargetForPlayer(session.clientId)
        const amIWinner = session.myScore() >= myTarget
        return this.container.rules.handleGameEnd(amIWinner)
      }
      // Snooker ends by clearing the table; the shooter is authoritative for
      // the final score, so the watcher must conclude from the received
      // ScoreEvent (synced above) rather than from its own local physics.
      if (rulename === "snooker" && this.container.rules.isEndOfGame([])) {
        return this.container.rules.handleGameEnd(false)
      }
    }

    return this
  }

  override handleConcede(_: ConcedeEvent): Controller {
    return this.container.rules.handleGameEnd(true, "opponent conceded")
  }

  hit() {
    this.container.sound.lastOutcomeTime = -1
    this.container.table.outcome = [
      Outcome.hit(
        this.container.table.cueball,
        this.container.table.cue.aim.power,
        0
      ),
    ]
    this.container.table.hit()
    const camera = this.container.view.camera
    if (camera.mode !== camera.aimzView) {
      camera.suggestMode(camera.aimView)
    }
    this.container.table.cue.showHelper(false)
  }

  aimDelta(input: Input): number {
    if (!input.hold) return input.t * this.scale
    const { from, to, fine } = input.hold
    return aimTravel(to, fine) - aimTravel(from, fine)
  }

  commonKeyHandler(input) {
    const cue = this.container.table.cue
    const delta = input.t * this.scale
    switch (input.key) {
      case "ArrowLeft":
        cue.rotateAim(-this.aimDelta(input), this.container.table)
        return true
      case "ArrowRight":
        cue.rotateAim(this.aimDelta(input), this.container.table)
        return true
      case "ArrowDown":
        cue.adjustSpin(new Vector3(0, -delta), this.container.table)
        return true
      case "ArrowUp":
        cue.adjustSpin(new Vector3(0, delta), this.container.table)
        return true
      case "ShiftArrowLeft":
        cue.adjustSpin(new Vector3(delta, 0), this.container.table)
        return true
      case "ShiftArrowRight":
        cue.adjustSpin(new Vector3(-delta, 0), this.container.table)
        return true
      case "KeyPUp":
        exportGltf(this.container.view.scene)
        return true
      case "KeyAUp":
        if (!this.container.freeAim) {
          cue.toggleHelper()
        }
        return true
      case "KeyMUp":
        if (document.body.classList.contains("chromeless")) {
          this.container.menu.toggleChromeless()
        }
        this.container.table.cue.aimInputs?.toggleTiltControl()
        return true
      case "KeyHUp":
        this.container.menu.toggleHelpOverlay()
        return true
      case "movementXUp":
        cue.rotateAim((flipX ? -delta : delta) * 1.2, this.container.table)
        return true
      case "movementYUp":
        if (!cue.aimInputs?.isDisabled()) {
          this.container.view.camera.adjustHeight(delta * 4)
        }
        return true
      case "NumpadSubtract":
        this.container.view.camera.adjustHeight(delta * 4)
        return true
      case "NumpadAdd":
        this.container.view.camera.adjustHeight(-delta * 4)
        return true
      case "KeyOUp":
        this.container.view.camera.toggleMode()
        return true
      case "KeyZ":
      case "KeyZUp":
        this.container.view.camera.cycleMode()
        return true
      case "KeyD":
        this.container.view.minimap.keyDown()
        return true
      case "KeyDUp":
        this.container.view.minimap.keyUp()
        return true
      case "KeyFUp":
        this.container.menu.toggleFullscreen()
        return true
      case "KeyLUp":
        this.container.menu.toggleChromeless()
        this.container.view.camera.setAimPreset()
        return true
      case "KeyCUp":
        this.container.comment.openChat()
        return true
      case "Digit1":
        this.container.view.camera.adjustFov(-delta * 20)
        return true
      case "Digit2":
        this.container.view.camera.adjustFov(delta * 20)
        return true
      case "Digit3":
        this.container.view.camera.adjustDistance(-delta * 4)
        return true
      case "Digit4":
        this.container.view.camera.adjustDistance(delta * 4)
        return true
      case "Digit5":
        this.container.view.camera.adjustLook(-delta * 0.25)
        return true
      case "Digit6":
        this.container.view.camera.adjustLook(delta * 0.25)
        return true
      case "Digit7Up":
        this.container.view.camera.setAimPreset()
        return true
      default:
        return false
    }
  }
}
