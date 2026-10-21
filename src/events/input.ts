/** How long a key had been held at the previous event and at this one (ms),
 * and whether Control was down. */
export type Hold = { from: number; to: number; fine: boolean }

export class Input {
  t: number
  key: string
  hold?: Hold

  constructor(t, key, hold?: Hold) {
    this.t = t
    this.key = key
    this.hold = hold
  }
}
