import { expect } from "chai"
import { Container } from "../../src/container/container"
import { Ball, State } from "../../src/model/ball"
import { Outcome } from "../../src/model/outcome"
import { TenBall } from "../../src/controller/rules/tenball"
import { Assets } from "../../src/view/assets"
import { initDom } from "../view/dom"
import { End } from "../../src/controller/end"
import { Session } from "../../src/network/client/session"
import { Rack } from "../../src/utils/rack"
import { R } from "../../src/model/physics/constants"
import { TableGeometry } from "../../src/view/tablegeometry"

initDom()

function initTenBall(): { container: Container; tenball: TenBall } {
  Ball.id = 0
  Session.reset()
  Session.init("test-client", "TestPlayer", "test-table", false, false, false)
  const container = new Container({
    element: undefined,
    log: (_: any) => {},
    assets: Assets.localAssets("tenball"),
    ruletype: "tenball",
  })
  return { container, tenball: container.rules as TenBall }
}

describe("TenBall Rules", () => {
  let container: Container
  let tenball: TenBall

  beforeEach(() => {
    ;({ container, tenball } = initTenBall())
  })

  afterEach(() => {
    Session.reset()
  })

  it("racks the cue ball and ten object balls", () => {
    expect(tenball.rulename).to.equal("tenball")
    expect(container.table.balls).to.have.length(11)
    expect(container.table.balls.map((b) => b.label)).to.deep.equal([
      undefined,
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
    ])
  })

  it("puts the 1 on the apex and the 10 in the middle of the third row", () => {
    const balls = container.table.balls
    const one = balls[1]
    const ten = balls[10]
    const apexX = Math.min(...balls.slice(1).map((b) => b.pos.x))
    expect(one.pos.x).to.be.closeTo(apexX, R)
    expect(one.pos.x).to.be.closeTo(TableGeometry.tableX / 2, R)
    expect(ten.pos.y).to.be.closeTo(0, R / 2)
    expect(ten.pos.x - one.pos.x).to.be.closeTo(2 * Math.sqrt(3) * R, R / 2)
  })

  it("ends the game when the 10 is potted legally", () => {
    const ten = container.table.balls[10]
    container.table.balls.forEach((b) => {
      if (b !== container.table.cueball && b !== ten) {
        b.state = State.InPocket
      }
    })
    const outcome = [
      Outcome.collision(container.table.cueball, ten, 1),
      Outcome.pot(ten, 1),
    ]
    expect(tenball.update(outcome)).to.be.an.instanceof(End)
  })

  it("does not end the game when the 9 is potted", () => {
    const one = container.table.balls[1]
    const nine = container.table.balls[9]
    const outcome = [
      Outcome.collision(container.table.cueball, one, 1),
      Outcome.pot(nine, 1),
    ]
    expect(tenball.isEndOfGame(outcome)).to.be.false
  })

  it("respots the 10 if it is potted on a foul", () => {
    const ten = container.table.balls[10]
    const outcome = [
      Outcome.pot(container.table.cueball, 1),
      Outcome.pot(ten, 1),
    ]
    expect(tenball.isEndOfGame(outcome)).to.be.false
    expect(tenball.respot(outcome)).to.deep.equal([ten])
  })

  it("racks ten balls from Rack.tenBall", () => {
    expect(Rack.tenBall()).to.have.length(11)
  })
})
