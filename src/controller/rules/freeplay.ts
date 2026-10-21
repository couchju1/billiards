import { Ball } from "../../model/ball"
import { Outcome } from "../../model/outcome"
import { Controller } from "../controller"
import { Aim } from "../aim"
import { PlaceBall } from "../placeball"
import { PlaceBallEvent } from "../../events/placeballevent"
import { WatchEvent } from "../../events/watchevent"
import { Session } from "../../network/client/session"
import { roundVec } from "../../utils/three-utils"
import { EightBall } from "./eightball"

/**
 * Practice: a full eight-ball rack with no rules. Any ball may be hit or
 * potted at any time, the 8 included, and nothing is a foul; a scratch just
 * hands the cue ball back. The rack is over when every object ball is down.
 */
export class FreePlay extends EightBall {
  override rulename = "freeplay"

  override foulReason(_outcome: Outcome[], _type?: number): string | null {
    return null
  }

  override isFoul(_outcome: Outcome[]): boolean {
    return false
  }

  override nextCandidateBall(_p1type?: number): Ball | undefined {
    const cueball = this.container.table.cueball
    const balls = this.legalTargets()
    return balls.sort(
      (a, b) => a.pos.distanceTo(cueball.pos) - b.pos.distanceTo(cueball.pos)
    )[0]
  }

  override legalTargets(): Ball[] {
    return this.container.table.balls.filter(
      (b) => b !== this.container.table.cueball && b.onTable()
    )
  }

  override isEndOfGame(_outcome: Outcome[], _type?: number): boolean {
    return this.legalTargets().length === 0
  }

  override update(outcome: Outcome[]): Controller {
    const table = this.container.table
    const pots = Outcome.pots(outcome).filter((b) => b !== table.cueball)
    if (pots.length > 0) {
      this.currentBreak += pots.length
      Session.getInstance().addMyScore(pots.length)
      this.container.sound.playSuccess(table.inPockets())
    }

    if (this.isEndOfGame(outcome)) {
      return this.handleGameEnd(true, "Table cleared")
    }

    if (!table.cueball.onTable()) {
      const startPos = this.placeBall()
      roundVec(startPos)
      this.container.sendEvent(new PlaceBallEvent(startPos, undefined, true))
      return new PlaceBall(this.container, startPos)
    }

    this.container.sendEvent(new WatchEvent(table.serialise()))
    return new Aim(this.container)
  }
}
