// Эксперименты лаборатории методов. Исходник каждого подключается как текст («?raw») для вкладки «Код».
import waves from "./exp-waves.mjs";
import wavesRaw from "./exp-waves.mjs?raw";
import link from "./exp-link.mjs";
import linkRaw from "./exp-link.mjs?raw";
import thrust from "./exp-thrust.mjs";
import thrustRaw from "./exp-thrust.mjs?raw";
import flight from "./exp-flight.mjs";
import flightRaw from "./exp-flight.mjs?raw";

const LIST = [
  [waves, wavesRaw, ["8", "9", "13"]],
  [link, linkRaw, ["9", "11"]],
  [thrust, thrustRaw, ["5", "2"]],
  [flight, flightRaw, ["6", "7"]],
];
export const EXPERIMENTS = LIST.map(([e, raw, ch]) => ({ ...e, raw, chapterIds: ch }));
