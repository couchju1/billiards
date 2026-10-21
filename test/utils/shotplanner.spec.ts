import { expect } from "chai"
import { Vector3 } from "three"
import { Ball, State } from "../../src/model/ball"
import { Table } from "../../src/model/table"
import { R, setmu } from "../../src/model/physics/constants"
import { cueStrike, mathavanAdapter } from "../../src/model/physics/physics"
import { planShot } from "../../src/utils/shotplanner"
import { TableConfig } from "../../src/view/tableconfig"
import { TableGeometry } from "../../src/view/tablegeometry"

function play(table: Table, angle: number, power: number) {
  table.cushionModel = mathavanAdapter
  const strike = cueStrike(angle, power, new Vector3(), 0)
  table.cueball.vel.copy(strike.vel)
  table.cueball.rvel.copy(strike.rvel)
  table.cueball.state = State.Sliding
  for (let i = 0; i < 40000 && !table.allStationary(); i++) {
    table.advance(0.005)
  }
}

describe("planShot", () => {
  beforeEach(() => {
    Ball.id = 0
    TableConfig.apply("nineball", 10)
    setmu(0.01)
  })

  it("lines up a straight-in shot with no cut", () => {
    const corner = new Vector3(TableGeometry.tableX, TableGeometry.tableY, 0)
    const dir = corner.clone().normalize()
    const cue = new Ball(dir.clone().multiplyScalar(-0.2))
    const object = new Ball(dir.clone().multiplyScalar(0.4))
    const plan = planShot(new Table([cue, object]), [object])!
    expect(plan.ball).to.equal(object)
    expect(plan.cut).to.be.lessThan(0.05)
    expect(plan.pocket.x).to.be.greaterThan(0)
    expect(plan.pocket.y).to.be.greaterThan(0)
  })

  it("picks the closest ball that has a makeable pot", () => {
    const cue = new Ball(new Vector3(0, 0, 0))
    const near = new Ball(new Vector3(0.3, 0.2, 0))
    const far = new Ball(new Vector3(-0.9, -0.3, 0))
    const plan = planShot(new Table([cue, near, far]), [far, near])!
    expect(plan.ball).to.equal(near)
  })

  /** A ball with six neighbours touching it all round: every ghost-ball
   * position overlaps a neighbour, so nothing can pot it. */
  function boxedIn(at: Vector3): Ball[] {
    const ring: Ball[] = []
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3
      ring.push(
        new Ball(
          at
            .clone()
            .add(
              new Vector3(Math.cos(a), Math.sin(a), 0).multiplyScalar(2.05 * R)
            )
        )
      )
    }
    return ring
  }

  it("skips a ball that is boxed in for a farther one that is open", () => {
    const cue = new Ball(new Vector3(-0.6, 0, 0))
    const boxed = new Ball(new Vector3(-0.3, 0, 0))
    // Behind the cue ball, away from the cluster, and farther than `boxed`.
    const open = new Ball(new Vector3(-0.9, 0.4, 0))
    const table = new Table([cue, boxed, open, ...boxedIn(boxed.pos)])
    expect(planShot(table, [boxed, open])?.ball).to.equal(open)
  })

  it("finds nothing when no pot is makeable", () => {
    const cue = new Ball(new Vector3(-0.6, 0, 0))
    const boxed = new Ball(new Vector3(-0.3, 0, 0))
    const table = new Table([cue, boxed, ...boxedIn(boxed.pos)])
    expect(planShot(table, [boxed])).to.be.undefined
  })

  it("pots a straight shot with the planned aim and power", () => {
    const cue = new Ball(new Vector3(-0.5, 0.1, 0))
    const object = new Ball(new Vector3(0.4, 0.3, 0))
    const table = new Table([cue, object])
    const plan = planShot(table, [object])!
    play(table, plan.angle, plan.power)
    expect(object.onTable()).to.be.false
  })

  it("pots a cut shot with the planned aim and power", () => {
    const cue = new Ball(new Vector3(-0.8, -0.4, 0))
    const object = new Ball(new Vector3(0.2, 0.35, 0))
    const table = new Table([cue, object])
    const plan = planShot(table, [object])!
    expect(plan.cut).to.be.greaterThan(0.2)
    play(table, plan.angle, plan.power)
    expect(object.onTable()).to.be.false
  })
})
