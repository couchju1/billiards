import { expect } from "chai"
import { Vector3 } from "three"
import { Container } from "../../src/container/container"
import { Ball, State } from "../../src/model/ball"
import { Aim } from "../../src/controller/aim"
import { Assets } from "../../src/view/assets"
import { Cue } from "../../src/view/cue"
import { Session } from "../../src/network/client/session"
import { planShot } from "../../src/utils/shotplanner"
import { initDom } from "../view/dom"

initDom()

function eightBallOnSolids(): Container {
  Ball.id = 0
  Session.reset()
  Session.init("test-client", "TestPlayer", "test-table", false, false, false)
  Session.getInstance().p1type = 1
  return new Container({
    element: undefined,
    log: (_: any) => {},
    assets: Assets.localAssets("eightball"),
    ruletype: "eightball",
  })
}

/** Cue ball in the middle, the 3 and the 11 close to it in open table, every
 * other object ball pocketed. */
function layout(container: Container) {
  const balls = container.table.balls
  balls.forEach((b) => {
    if (b !== container.table.cueball) b.state = State.InPocket
  })
  const place = (label: number, pos: Vector3) => {
    const ball = balls.find((b) => b.label === label)!
    ball.pos.copy(pos)
    ball.state = State.Stationary
    return ball
  }
  container.table.cueball.pos.set(0, 0, 0)
  const stripe = place(11, new Vector3(0.15, 0.1, 0))
  const nearSolid = place(3, new Vector3(-0.4, 0.2, 0))
  const farSolid = place(5, new Vector3(0.9, -0.4, 0))
  return { stripe, nearSolid, farSolid }
}

describe("Beginner aim", () => {
  afterEach(() => {
    Cue.aimHelp = "advanced"
    Cue.helperEnabled = true
    Session.reset()
  })

  it("lines up the closest makeable ball of the player's group, power included", () => {
    const container = eightBallOnSolids()
    const { nearSolid, farSolid } = layout(container)
    Cue.aimHelp = "beginner"
    new Aim(container)
    const expected = planShot(container.table, [nearSolid, farSolid])!
    expect(expected.ball).to.equal(nearSolid)
    expect(container.table.cue.aim.angle).to.be.closeTo(expected.angle, 1e-6)
    expect(container.table.cue.aim.power).to.be.closeTo(expected.power, 1e-4)
  })

  it("aims at the next ball without planning at advanced", () => {
    const container = eightBallOnSolids()
    const { nearSolid, farSolid } = layout(container)
    new Aim(container)
    const planned = planShot(container.table, [nearSolid, farSolid])!
    expect(container.table.cue.aim.angle).to.not.be.closeTo(planned.angle, 1e-3)
  })
})
