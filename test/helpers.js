const fs = require("fs");
const path = require("path");

const SCRIPT_SOURCE = fs.readFileSync(
	path.join(__dirname, "..", "aiwarningforsteam.user.js"),
	"utf8",
);
const DISCLOSURE_HEADER = "<h2>AI Generated Content Disclosure</h2>";

/** Creates an in-memory mock of the WebExtension storage area. */
function createStorageArea(initial = {}) {
	const data = {...initial};
	return {
		data,
		get: jest.fn(async (key) => (key in data ? {[key]: data[key]} : {})),
		set: jest.fn(async (items) => {
			Object.assign(data, items);
		}),
	};
}

/** Installs a mock `browser` global that mimics the Chrome extension APIs used by the script. */
function installBrowserMock({sync = {}, local = {}} = {}) {
	const browser = {
		runtime: {
			getManifest: () => ({
				name: "AI warning for Steam",
				version: "1.2.0",
				homepage_url: "https://github.com/seeeeew/aiwarningforsteam",
			}),
		},
		storage: {
			sync: createStorageArea({lastVersion: "1.2.0", lastUpdate: "2000-01-01T00:00:00.000Z", ...sync}),
			local: createStorageArea(local),
		},
	};
	window.browser = browser;
	return browser;
}

/** Fake IntersectionObserver that lets tests decide when elements become visible. */
class FakeIntersectionObserver {
	static instances = [];

	constructor(callback) {
		this.callback = callback;
		this.observed = new Set();
		FakeIntersectionObserver.instances.push(this);
	}

	observe(element) {
		this.observed.add(element);
	}

	unobserve(element) {
		this.observed.delete(element);
	}

	disconnect() {
		this.observed.clear();
	}

	/** Simulates the given elements scrolling into view. */
	intersect(elements) {
		const entries = elements
			.filter((element) => this.observed.has(element))
			.map((target) => ({target, isIntersecting: true}));
		this.callback(entries, this);
	}

	static latest() {
		return FakeIntersectionObserver.instances.at(-1);
	}
}

const mutationObservers = [];

/** Tracks MutationObservers so every test run can be torn down completely. */
class TrackedMutationObserver extends window.MutationObserver {
	constructor(callback) {
		super(callback);
		mutationObservers.push(this);
	}
}

/** Creates a minimal fetch Response for a store page. */
function createResponse({hasDisclosure = false, status = 200, url = "https://store.steampowered.com/app/1"} = {}) {
	const body = hasDisclosure ? `<div>${DISCLOSURE_HEADER}</div>` : "<div></div>";
	return {
		ok: status >= 200 && status < 300,
		status,
		url,
		text: async () => body,
	};
}

/** Creates a Next Fest style capsule link for the given app. */
function createCapsule(appid, {withImage = true} = {}) {
	const link = document.createElement("a");
	link.href = `https://store.steampowered.com/app/${appid}?snr=1_614_615_6000_100703`;
	link.innerHTML = withImage
		? `<div class="x_kq8V9RpcQ0NN1peDKg7"><div class="HeroCapsuleImageContainer"><img alt="Game ${appid}"></div></div>`
		: `<span>Game ${appid}</span>`;
	return link;
}

/** Waits until queued promises and timers have settled. */
async function flush(times = 5) {
	for (let i = 0; i < times; i++) {
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
}

/** Executes the userscript in the current jsdom window and waits for its setup to finish. */
async function runScript() {
	new Function(SCRIPT_SOURCE)();
	await flush();
}

/** Prepares globals before each test. */
function setUp() {
	document.head.innerHTML = "";
	document.body.innerHTML = "";
	delete document.documentElement.dataset.aiwarning;
	FakeIntersectionObserver.instances = [];
	window.IntersectionObserver = FakeIntersectionObserver;
	window.MutationObserver = TrackedMutationObserver;
	window.fetch = jest.fn();
	jest.spyOn(console, "error").mockImplementation(() => {});
}

/** Disconnects observers left over from the previous script run. */
function tearDown() {
	mutationObservers.splice(0).forEach((observer) => observer.disconnect());
	jest.restoreAllMocks();
	delete window.browser;
}

module.exports = {
	FakeIntersectionObserver,
	createCapsule,
	createResponse,
	flush,
	installBrowserMock,
	runScript,
	setUp,
	tearDown,
};
