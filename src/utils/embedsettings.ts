import { setmu } from "../model/physics/constants"
import { Cue, isAimHelp } from "../view/cue"
import { TableConfig } from "../view/tableconfig"

/**
 * Lets the page that frames the game change table speed and aim help while a
 * rack is in play, which a URL change can't do without restarting the game.
 * Only a page on the game's own origin is listened to.
 *
 *   frame.contentWindow.postMessage({ type: "settings", mu: 0.01, aid: "pro" })
 */
export function listenForEmbedSettings(currentCue: () => Cue | undefined) {
  globalThis.addEventListener?.("message", (e: MessageEvent) => {
    if (
      e.origin !== globalThis.location.origin ||
      e.data?.type !== "settings"
    ) {
      return
    }
    const { mu, aid } = e.data
    if (typeof mu === "number" && Number.isFinite(mu)) {
      setmu(TableConfig.clampMu(mu))
    }
    if (isAimHelp(aid)) {
      // Before the game has built its cue, the level is kept for it to apply.
      const cue = currentCue()
      if (cue) {
        cue.setAimHelp(aid)
      } else {
        Cue.aimHelp = aid
      }
    }
  })
}
