import { Vector3 } from "three"
import { Ball } from "../model/ball"
import { Table } from "../model/table"
import { maxPower, mu, R } from "../model/physics/constants"
import { Collision } from "../model/physics/collision"
import { PocketGeometry } from "../view/pocketgeometry"
import { TableGeometry } from "../view/tablegeometry"
import { atan2 } from "./utils"
import { unitAtAngle, up } from "./three-utils"

/** A pot the beginner aim help can line up: cue ball into the object ball so
 * that it rolls through the mouth of `pocket`. */
export type PlannedShot = {
  ball: Ball
  pocket: Vector3
  /** Cue aim angle, as in AimEvent.angle. */
  angle: number
  /** Cue power, as in AimEvent.power. */
  power: number
  /** Cut angle in radians; 0 is a straight-in shot. */
  cut: number
}

/** Thinner cuts than this are too hard to call makeable for a beginner. */
const maxCut = (70 * Math.PI) / 180

/**
 * Pick the shot the beginner aim help sets up: of the balls the player may
 * hit, the one closest to the cue ball that has a makeable pot, sent into
 * whichever pocket needs the smallest cut. A pot is makeable when the cue
 * ball's path to the object ball and the object ball's path through the
 * pocket mouth are both clear, and the cut is no thinner than 70 degrees.
 */
export function planShot(
  table: Table,
  candidates: Ball[]
): PlannedShot | undefined {
  const cueball = table.cueball
  const byDistance = [...candidates].sort(
    (a, b) => a.pos.distanceTo(cueball.pos) - b.pos.distanceTo(cueball.pos)
  )
  for (const ball of byDistance) {
    const shots = pocketMouths()
      .map((mouth) => potInto(table, ball, mouth))
      .filter((shot): shot is PlannedShot => shot !== undefined)
      .sort((a, b) => a.cut - b.cut)
    if (shots.length > 0) {
      return shots[0]
    }
  }
  return undefined
}

type Knuckle = { pos: Vector3; radius: number }
type Mouth = { pocket: Vector3; centre: Vector3; knuckles: Knuckle[] }

/** Each pocket's opening: the point midway between its two knuckles is
 * where an object ball should cross the cushion line. Aiming at the pocket's
 * own centre, which sits behind that line, sends shallow approaches into a
 * knuckle. */
function pocketMouths(): Mouth[] {
  // Keyed rather than `instanceof Knuckle`: knuckle.ts and pocketgeometry.ts
  // import each other, and importing knuckle.ts here first breaks that cycle.
  return Object.values(PocketGeometry.pockets).map((entry: any) => {
    const knuckles = Object.entries(entry)
      .filter(([key]) => key.startsWith("knuckle"))
      .map(([, knuckle]) => knuckle as Knuckle)
    const centre = knuckles
      .reduce((sum, k) => sum.add(k.pos), new Vector3())
      .divideScalar(knuckles.length)
      .setZ(0)
    return { pocket: entry.pocket.pos, centre, knuckles }
  })
}

function potInto(
  table: Table,
  ball: Ball,
  mouth: Mouth
): PlannedShot | undefined {
  const cueball = table.cueball
  const toPocket = mouth.centre.clone().sub(ball.pos).setZ(0).normalize()
  const intoPocket = mouth.centre.clone().addScaledVector(toPocket, 2 * R)
  if (
    mouth.knuckles.some((k) =>
      nearSegment(k.pos, ball.pos, intoPocket, R + k.radius)
    )
  ) {
    return undefined
  }

  const ghost = ball.pos
    .clone()
    .addScaledVector(toPocket, -2 * R)
    .setZ(0)
  if (
    Math.abs(ghost.x) > TableGeometry.tableX ||
    Math.abs(ghost.y) > TableGeometry.tableY
  ) {
    return undefined
  }

  const toGhost = ghost.clone().sub(cueball.pos).setZ(0)
  const cueTravel = toGhost.length()
  toGhost.normalize()
  const cut = Math.acos(Math.min(1, Math.max(-1, toGhost.dot(toPocket))))
  if (cut > maxCut) return undefined

  const others = table.balls.filter(
    (b) => b !== cueball && b !== ball && b.onTable()
  )
  if (others.some((b) => nearSegment(b.pos, cueball.pos, ghost, 2 * R))) {
    return undefined
  }
  if (others.some((b) => nearSegment(b.pos, ball.pos, intoPocket, 2 * R))) {
    return undefined
  }

  const speed = shotSpeeds(cueTravel, ball.pos.distanceTo(mouth.centre), cut)
  const angle = correctForThrow(
    cueball.pos,
    ball.pos,
    toPocket,
    atan2(toGhost.y, toGhost.x),
    speed.atContact
  )
  return {
    ball,
    pocket: mouth.pocket,
    angle,
    power: Math.min(speed.start, maxPower),
    cut,
  }
}

/** True when a ball centre at `p` comes within `clearance` of the segment
 * from `a` to `b`. */
function nearSegment(
  p: Vector3,
  a: Vector3,
  b: Vector3,
  clearance: number
): boolean {
  const ab = b.clone().sub(a).setZ(0)
  const lengthSq = ab.lengthSq()
  const t =
    lengthSq === 0
      ? 0
      : Math.min(1, Math.max(0, p.clone().sub(a).setZ(0).dot(ab) / lengthSq))
  const closest = a.clone().addScaledVector(ab, t)
  return closest.distanceTo(p.clone().setZ(0)) < clearance
}

/**
 * Friction between the balls drags a cut object ball a degree or two off the
 * line of centres ("throw"), which on the engine's pockets is the difference
 * between a pot and a jaw. Solve for the aim that sends it along `toPocket`,
 * using the same collision model the game plays the shot with.
 */
function correctForThrow(
  cueStart: Vector3,
  objectPos: Vector3,
  toPocket: Vector3,
  angle: number,
  speedAtContact: number
): number {
  const target = atan2(toPocket.y, toPocket.x)
  const error = (a: number) => {
    const launch = launchAngle(cueStart, objectPos, a, speedAtContact)
    return launch === undefined ? 0 : wrap(launch - target)
  }
  let a0 = angle
  let e0 = error(a0)
  let a1 = a0 - e0
  for (let i = 0; i < 4 && Math.abs(e0) > 1e-5; i++) {
    const e1 = error(a1)
    const slope = (e1 - e0) / (a1 - a0 || 1e-9)
    if (!Number.isFinite(slope) || slope === 0) {
      break
    }
    a0 = a1
    e0 = e1
    a1 = a1 - e1 / slope
  }
  return Math.abs(wrap(a1 - angle)) < 0.1 ? a1 : angle
}

/** Direction the object ball leaves in when a rolling cue ball sent along
 * `angle` reaches it at `speed`. */
function launchAngle(
  cueStart: Vector3,
  objectPos: Vector3,
  angle: number,
  speed: number
): number | undefined {
  const vel = unitAtAngle(angle, new Vector3()).multiplyScalar(speed)
  const cue = {
    pos: cueStart.clone().setZ(0),
    vel,
    rvel: up.clone().cross(vel).divideScalar(R),
  }
  const object = {
    pos: objectPos.clone().setZ(0),
    vel: new Vector3(),
    rvel: new Vector3(),
  }
  const toObject = object.pos.clone().sub(cue.pos)
  const along = toObject.dot(vel) / speed
  const miss = Math.sqrt(Math.max(toObject.lengthSq() - along * along, 0))
  if (along <= 0 || miss >= 2 * R) return undefined
  // Collision.model, not a new CollisionThrow: collision.ts and
  // collisionthrow.ts import each other, and only loading collision.ts first
  // works.
  Collision.model.updateVelocities(cue as Ball, object as Ball)
  return atan2(object.vel.y, object.vel.x)
}

function wrap(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a))
}

/**
 * Rolling deceleration per unit of `mu`, measured from the engine: a rolling
 * ball loses about 15.6 * mu m/s every second.
 */
const rollingDecelPerMu = 15.6
/** A ball that has slid into a roll keeps 5/7 of its speed. */
const rollFraction = 5 / 7
/** Aim to roll the object ball this much further than the pocket, so it
 * arrives moving rather than dying in the jaws. */
const reach = 1.6

/**
 * Cue-ball speeds for a centre hit: at the start (which is the cue power)
 * and on reaching the object ball. Each ball loses 2/7 of its speed while
 * it slides into a roll and then decelerates at a rate set by the cloth's
 * `mu`, which the table-speed setting changes. Only the cosine of the cut
 * reaches the object ball.
 */
function shotSpeeds(cueTravel: number, potDistance: number, cut: number) {
  const decel = rollingDecelPerMu * mu
  const objectRolling = Math.sqrt(2 * decel * (potDistance * reach + 4 * R))
  const objectStart = objectRolling / rollFraction
  const atContact = objectStart / Math.max(Math.cos(cut), 0.2)
  const cueRolling = Math.sqrt(atContact ** 2 + 2 * decel * cueTravel)
  return { atContact, start: cueRolling / rollFraction }
}
