const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

function extractFunction(source, name) {
  const functionStart = source.indexOf(`function ${name}(`);
  assert.notEqual(functionStart, -1, `index.html should define ${name}`);
  const bodyStart = source.indexOf("{", functionStart);
  let depth = 0;
  let bodyEnd = -1;

  for (let index = bodyStart; index < source.length; index++) {
    if (source[index] === "{") depth++;
    if (source[index] === "}") {
      depth--;
      if (depth === 0) {
        bodyEnd = index + 1;
        break;
      }
    }
  }

  assert.notEqual(bodyEnd, -1, `${name} should have a closing brace`);
  return source.slice(functionStart, bodyEnd);
}

function loadAudioController() {
  return vm.runInNewContext(`(${extractFunction(html, "createAudioController")})`, {
    console: { warn() {} }
  });
}

function createAudioContextHarness() {
  const events = [];
  const gainParam = {
    value: 1,
    setValueAtTime(value, time) {
      events.push(["gain", value, time]);
    },
    exponentialRampToValueAtTime(value, time) {
      events.push(["ramp", value, time]);
    },
    setTargetAtTime(value, time, constant) {
      events.push(["target", value, time, constant]);
    }
  };
  let createdContexts = 0;

  class FakeAudioContext {
    constructor() {
      createdContexts++;
      this.currentTime = 0;
      this.state = "suspended";
      this.destination = {};
    }

    resume() {
      events.push(["resume"]);
      this.state = "running";
      return Promise.resolve();
    }

    createGain() {
      return {
        gain: gainParam,
        connect(destination) {
          events.push(["gain-connect", destination]);
        }
      };
    }

    createOscillator() {
      const oscillator = {
        frequency: {
          setValueAtTime(frequency, time) {
            events.push(["frequency", frequency, time]);
          }
        },
        connect(destination) {
          events.push(["oscillator-connect", destination]);
        },
        start(time) {
          events.push(["start", time]);
        },
        stop(time) {
          events.push(["stop", time]);
        }
      };
      return oscillator;
    }
  }

  return { FakeAudioContext, events, getCreatedContexts: () => createdContexts };
}

test("audio preference defaults on and persists toggles", () => {
  const stored = new Map();
  const storage = {
    getItem(key) {
      return stored.get(key) || null;
    },
    setItem(key, value) {
      stored.set(key, value);
    }
  };
  const { FakeAudioContext } = createAudioContextHarness();
  const createAudioController = loadAudioController();
  const controller = createAudioController(FakeAudioContext, storage);

  assert.equal(controller.isEnabled(), true);
  controller.setEnabled(false);
  assert.equal(controller.isEnabled(), false);
  controller.setEnabled(true);
  assert.equal(controller.isEnabled(), true);
  assert.equal(stored.get("spaceQuizAudioEnabled"), "true");
});

test("audio cues lazily initialize Web Audio and synthesize distinct tones", () => {
  const storage = { getItem: () => null, setItem: () => {} };
  const { FakeAudioContext, events, getCreatedContexts } = createAudioContextHarness();
  const createAudioController = loadAudioController();
  const controller = createAudioController(FakeAudioContext, storage);

  assert.equal(getCreatedContexts(), 0);
  controller.playSelection();
  controller.playCorrect();
  controller.playIncorrect();
  controller.playCitation();
  controller.setEnabled(false);
  controller.setEnabled(true);

  assert.equal(getCreatedContexts(), 1);
  assert.ok(events.some(([type]) => type === "resume"));
  assert.deepEqual(
    events.filter(([type]) => type === "target").map(([, value]) => value),
    [0, 0.12]
  );
  assert.deepEqual(
    events.filter(([type]) => type === "frequency").map(([, frequency]) => frequency),
    [880, 523, 784, 1046, 220, 165, 523, 659, 784, 1047]
  );
});

test("disabled audio stays silent and unsupported Web Audio is safe", () => {
  const storage = {
    getItem: () => "false",
    setItem: () => {}
  };
  const { FakeAudioContext, events, getCreatedContexts } = createAudioContextHarness();
  const createAudioController = loadAudioController();
  const controller = createAudioController(FakeAudioContext, storage);

  controller.playSelection();
  assert.equal(getCreatedContexts(), 0);
  assert.equal(events.length, 0);
  assert.doesNotThrow(() => {
    const unsupportedController = createAudioController(null, storage);
    unsupportedController.playCorrect();
    unsupportedController.setEnabled(true);
  });
});

test("audio synthesis failures do not interrupt quiz interactions", () => {
  const storage = { getItem: () => null, setItem: () => {} };
  const { FakeAudioContext } = createAudioContextHarness();
  FakeAudioContext.prototype.createOscillator = () => {
    throw new Error("Audio node unavailable");
  };
  const createAudioController = loadAudioController();
  const controller = createAudioController(FakeAudioContext, storage);

  assert.doesNotThrow(() => controller.playSelection());
});

test("quiz feedback triggers the matching cue and citation only at the score threshold", () => {
  const selectionHandler = extractFunction(html, "handleSelectOption");
  const resultsHandler = extractFunction(html, "showResults");

  assert.match(selectionHandler, /audioController\.playSelection\(\)/);
  assert.match(selectionHandler, /if \(isCorrect\) \{\s*audioController\.playCorrect\(\)/);
  assert.match(selectionHandler, /\} else \{\s*audioController\.playIncorrect\(\)/);
  assert.match(resultsHandler, /if \(score >= 8\) \{\s*audioController\.playCitation\(\)/);
});

test("audio toggle exposes its persisted state accessibly", () => {
  assert.match(html, /id="audioToggle"[^>]*aria-pressed="true"/);
  assert.match(html, /audioToggleBtn\.setAttribute\("aria-pressed", String\(enabled\)\)/);
  assert.match(html, /AUDIO \[" \+ \(enabled \? "ON" : "OFF"\) \+ "\]"/);
});

test("storage failures do not interrupt audio controls", () => {
  const { FakeAudioContext } = createAudioContextHarness();
  const createAudioController = loadAudioController();
  const storage = {
    getItem() {
      throw new Error("Storage unavailable");
    },
    setItem() {
      throw new Error("Storage unavailable");
    }
  };
  const controller = createAudioController(FakeAudioContext, storage);

  assert.doesNotThrow(() => {
    controller.setEnabled(false);
    controller.setEnabled(true);
    controller.playSelection();
  });
});
