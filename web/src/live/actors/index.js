// 舞台可用的演員(腳本 cast 裡的 "actor" 名稱 → 演員定義)。新增演員:在 actors/<名稱>/ 寫好 actor.js、actor.css,再在這裡登記。
import claudeDesktop from "./claude-desktop/actor.js";
import finder from "./finder/actor.js";

export const ACTORS = Object.fromEntries([claudeDesktop, finder].map((def) => [def.name, def]));
