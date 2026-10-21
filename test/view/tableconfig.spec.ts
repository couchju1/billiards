import { expect } from "chai"
import { TableConfig } from "../../src/view/tableconfig"
import { mu } from "../../src/model/physics/constants"
import { POOL_MU } from "../../src/view/tablegeometry"

describe("TableConfig mu override", () => {
  const originalSearch = globalThis.location.search

  afterEach(() => {
    globalThis.history.replaceState({}, "", originalSearch || "?")
  })

  it("uses POOL_MU for pool when no override is given", () => {
    globalThis.history.replaceState({}, "", "?")
    TableConfig.apply("nineball")
    expect(mu).to.equal(POOL_MU)
  })

  it("applies ?mu= after the rule's friction", () => {
    globalThis.history.replaceState({}, "", "?mu=0.012")
    TableConfig.apply("nineball")
    expect(mu).to.equal(0.012)
  })

  it("clamps ?mu= to 0.004-0.020", () => {
    globalThis.history.replaceState({}, "", "?mu=0.5")
    expect(TableConfig.muFromUrl()).to.equal(0.02)
    globalThis.history.replaceState({}, "", "?mu=0")
    expect(TableConfig.muFromUrl()).to.equal(0.004)
    globalThis.history.replaceState({}, "", "?mu=abc")
    expect(TableConfig.muFromUrl()).to.equal(undefined)
  })
})
