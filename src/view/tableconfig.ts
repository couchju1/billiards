import { TableGeometry } from "./tablegeometry"
import { PocketGeometry } from "./pocketgeometry"
import { R, setmu } from "../model/physics/constants"

/**
 * Single coordinator for table + pocket geometry configuration.
 *
 * `PocketGeometry` is derived from `TableGeometry` (pocket positions read
 * `TableGeometry.tableX/Y/X/Y`), so the two must always be (re)configured
 * together in that order. Previously every caller had to remember the paired
 * incantation; this enforces it in one spot.
 */
export class TableConfig {
  /**
   * Apply table geometry for a rule and the given tableSize, then re-derive
   * pocket geometry from the updated table dimensions.
   */
  static apply(ruleType: string, tableSize: number = 10): void {
    TableGeometry.configureForRule(ruleType, tableSize)
    PocketGeometry.scaleToRadius(R)
    const mu = TableConfig.muFromUrl()
    if (mu !== undefined) {
      setmu(mu)
    }
  }

  /**
   * Read the `mu` URL query parameter (rolling friction), clamped to
   * [0.004, 0.02]. Undefined when absent or not a number.
   */
  static muFromUrl(): number | undefined {
    const urlParams = new URLSearchParams(globalThis.location?.search ?? "")
    const mu = Number.parseFloat(urlParams.get("mu") ?? "")
    if (Number.isNaN(mu)) {
      return undefined
    }
    return Math.min(0.02, Math.max(0.004, mu))
  }

  /**
   * Read the `tableSize` URL query parameter, defaulting to 10.
   */
  static tableSizeFromUrl(): number {
    const urlParams = new URLSearchParams(globalThis.location?.search ?? "")
    return parseFloat(urlParams.get("tableSize") || "10")
  }
}
