import { expect } from "chai"
import { Container } from "../../src/container/container"
import { Ball, State } from "../../src/model/ball"
import { Outcome } from "../../src/model/outcome"
import { FreePlay } from "../../src/controller/rules/freeplay"
import { EightBall } from "../../src/controller/rules/eightball"
import { Assets } from "../../src/view/assets"
import { initDom } from "../view/dom"
import { Aim } from "../../src/controller/aim"
import { PlaceBall } from "../../src/controller/placeball"
import { End } from "../../src/controller/end"
import { Session } from "../../src/network/client/session"

initDom()

function init(ruletype: string): Container {
  Ball.id = 0
  Session.reset()
  Session.init("test-client", "TestPlayer", "test-table", false, false, false)
  return new Container({
    element: undefined,
    log: (_: any) => {},
    assets: Assets.localAssets(ruletype),
    ruletype,
  })
}

const label = (container: Container, n: number) =>
  container.table.balls.find((b) => b.label === n)!

describe("Practice (freeplay)", () => {
  let container: Container
  let rules: FreePlay

  beforeEach(() => {
    container = init("freeplay")
    rules = container.rules as FreePlay
  })

  afterEach(() => {
    Session.reset()
  })

  it("racks all fifteen balls", () => {
    expect(rules.rulename).to.equal("freeplay")
    expect(container.table.balls).to.have.length(16)
  })

  it("has no fouls, even hitting the 8 first with nothing potted", () => {
    const eight = label(container, 8)
    const outcome = [Outcome.collision(container.table.cueball, eight, 1, 0)]
    expect(rules.foulReason(outcome)).to.be.null
    expect(rules.update(outcome)).to.be.an.instanceof(Aim)
  })

  it("keeps going when the 8 is potted early", () => {
    const eight = label(container, 8)
    eight.state = State.InPocket
    const outcome = [
      Outcome.collision(container.table.cueball, eight, 1, 0),
      Outcome.pot(eight, 1, 1),
    ]
    expect(rules.update(outcome)).to.be.an.instanceof(Aim)
  })

  it("hands the cue ball back after a scratch, without a foul", () => {
    const cueball = container.table.cueball
    cueball.state = State.InPocket
    const outcome = [Outcome.pot(cueball, 1, 0)]
    expect(rules.foulReason(outcome)).to.be.null
    expect(rules.update(outcome)).to.be.an.instanceof(PlaceBall)
  })

  it("ends only when every object ball is off the table", () => {
    const balls = container.table.balls.filter(
      (b) => b !== container.table.cueball
    )
    balls.forEach((b) => (b.state = State.InPocket))
    const last = balls[balls.length - 1]
    const outcome = [
      Outcome.collision(container.table.cueball, last, 1, 0),
      Outcome.pot(last, 1, 1),
    ]
    expect(rules.update(outcome)).to.be.an.instanceof(End)
  })
})

describe("Eight-ball played alone", () => {
  afterEach(() => {
    Session.reset()
  })

  it("switches to the other group after a miss", () => {
    const container = init("eightball")
    const rules = container.rules as EightBall
    Session.getInstance().p1type = 1
    const one = label(container, 1)
    const outcome = [
      Outcome.collision(container.table.cueball, one, 1, 0),
      Outcome.cushion(one, 1, 1),
    ]
    expect(rules.update(outcome)).to.be.an.instanceof(Aim)
    expect(Session.getInstance().p1type).to.equal(2)
  })

  it("keeps the group after potting one of its own", () => {
    const container = init("eightball")
    const rules = container.rules as EightBall
    Session.getInstance().p1type = 2
    const ten = label(container, 10)
    ten.state = State.InPocket
    const outcome = [
      Outcome.collision(container.table.cueball, ten, 1, 0),
      Outcome.pot(ten, 1, 1),
    ]
    rules.update(outcome)
    expect(Session.getInstance().p1type).to.equal(2)
  })

  it("does not switch while the table is still open", () => {
    const container = init("eightball")
    const rules = container.rules as EightBall
    const one = label(container, 1)
    const outcome = [
      Outcome.collision(container.table.cueball, one, 1, 0),
      Outcome.cushion(one, 1, 1),
    ]
    rules.update(outcome)
    expect(Session.getInstance().p1type).to.equal(0)
  })
})
