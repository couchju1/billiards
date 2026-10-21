/**
 * True in a build made with `OFFLINE=true yarn build`, for self-hosting
 * single-player: the game then makes no requests beyond its own files, so no
 * lobby presence, usage ping, score upload or link shortening. Fixed at build
 * time rather than read from the URL so a hosted copy can't be switched back.
 */
export const OFFLINE = process.env.OFFLINE === "true"
