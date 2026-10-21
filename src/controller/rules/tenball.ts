import { Ball } from "../../model/ball"
import { Rack } from "../../utils/rack"
import { NineBall } from "./nineball"

/**
 * Ten-ball played like nine-ball: lowest ball first, and a legal pot of the
 * 10 wins. Shots are not called, so it plays as relaxed practice.
 */
export class TenBall extends NineBall {
  override rulename = "tenball"
  protected override readonly gameBallLabel = 10

  override rack(): Ball[] {
    return Rack.fromInitParam(Rack.tenBall())
  }
}
