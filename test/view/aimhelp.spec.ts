import { expect } from "chai"
import { Vector3 } from "three"
import { Ball } from "../../src/model/ball"
import { Cue } from "../../src/view/cue"
import { R } from "../../src/model/physics/constants"
import { TableGeometry } from "../../src/view/tablegeometry"
import { listenForEmbedSettings } from "../../src/utils/embedsettings"
import { mu } from "../../src/model/physics/constants"

function aiming() {
  return {
    isDisabled: () => false,
    updateVisualState: () => {},
    updatePowerSlider: () => {},
    showOverlap: () => {},
  } as any
}

/** Cue ball at the origin aiming straight along +x at a ball four ball
 * widths away, so the object ball travels straight on toward the foot rail. */
function straightShot(cue: Cue) {
  const cueball = new Ball(new Vector3(0, 0, 0))
  const object = new Ball(new Vector3(8 * R, 0, 0))
  cue.aim.angle = 0
  cue.updateGhost(cueball, {
    ball: object,
    ghost: new Vector3(6 * R, 0, 0),
  })
  return object
}

describe("Aim help levels", () => {
  afterEach(() => {
    Cue.aimHelp = "advanced"
    Cue.helperEnabled = true
  })

  it("measures the distance from a ball to the rail it is heading for", () => {
    const from = new Vector3(0, 0, 0)
    expect(Cue.distanceToRail(from, new Vector3(1, 0, 0))).to.be.closeTo(
      TableGeometry.tableX,
      1e-9
    )
    expect(Cue.distanceToRail(from, new Vector3(0, -1, 0))).to.be.closeTo(
      TableGeometry.tableY,
      1e-9
    )
  })

  it("draws a short line at advanced", () => {
    const cue = new Cue()
    cue.aimInputs = aiming()
    cue.setAimHelp("advanced")
    straightShot(cue)
    expect(cue.ghostLine.scale.x).to.equal(Cue.shortLineLength)
    expect(cue.helperMesh.visible).to.be.true
  })

  it("draws the line out to the rail at beginner", () => {
    const cue = new Cue()
    cue.aimInputs = aiming()
    cue.setAimHelp("beginner")
    const object = straightShot(cue)
    expect(cue.ghostLine.scale.x).to.be.closeTo(
      TableGeometry.tableX - object.pos.x - R,
      1e-6
    )
    expect(cue.ghostLine.scale.x).to.be.greaterThan(Cue.shortLineLength)
  })

  it("hides the whole helper at pro", () => {
    const cue = new Cue()
    cue.aimInputs = aiming()
    cue.setAimHelp("pro")
    expect(cue.helperMesh.visible).to.be.false
    expect(Cue.helperEnabled).to.be.false
  })

  it("applies settings posted by a same-origin page", () => {
    const cue = new Cue()
    cue.aimInputs = aiming()
    listenForEmbedSettings(() => cue)
    globalThis.dispatchEvent(
      new MessageEvent("message", {
        origin: globalThis.location.origin,
        data: { type: "settings", mu: 0.5, aid: "beginner" },
      })
    )
    expect(Cue.aimHelp).to.equal("beginner")
    expect(mu).to.be.closeTo(0.02, 1e-12)
  })

  it("ignores settings from another origin", () => {
    const cue = new Cue()
    listenForEmbedSettings(() => cue)
    globalThis.dispatchEvent(
      new MessageEvent("message", {
        origin: "https://example.com",
        data: { type: "settings", aid: "pro" },
      })
    )
    expect(Cue.aimHelp).to.equal("advanced")
  })
})
