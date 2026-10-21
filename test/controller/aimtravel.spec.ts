import { expect } from "chai"
import { MathUtils } from "three"
import { aimTravel } from "../../src/controller/controllerbase"

const deg = (rad: number) => MathUtils.radToDeg(rad)

describe("aimTravel", () => {
  it("moves a single tap no more than 0.05 degrees", () => {
    expect(deg(aimTravel(16, false))).to.be.closeTo(0.05, 1e-9)
    expect(deg(aimTravel(200, false))).to.be.closeTo(0.05, 1e-9)
  })

  it("starts slow and reaches about 80 degrees per second by 700ms", () => {
    const rate = (held: number) =>
      deg(aimTravel(held + 1, false) - aimTravel(held, false)) * 1000
    expect(rate(260)).to.be.closeTo(10, 0.5)
    expect(rate(800)).to.be.closeTo(80, 0.1)
  })

  it("turns a long way in about three seconds", () => {
    expect(deg(aimTravel(3000, false))).to.be.greaterThan(180)
  })

  it("turns at about 1 degree per second with Control", () => {
    const rate = deg(aimTravel(2001, true) - aimTravel(2000, true)) * 1000
    expect(rate).to.be.closeTo(1, 1e-6)
  })
})
