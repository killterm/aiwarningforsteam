/**
 * @jest-environment-options {"url": "https://store.steampowered.com/sale/nextfest"}
 */
const {
	FakeIntersectionObserver,
	createCapsule,
	createResponse,
	flush,
	installBrowserMock,
	runScript,
	setUp,
	tearDown,
} = require("./helpers");

describe("sale page", () => {
	beforeEach(setUp);
	afterEach(tearDown);

	test("marks a visible capsule whose store page has an AI disclosure", async () => {
		installBrowserMock();
		const capsule = createCapsule(5295390);
		document.body.append(capsule);
		window.fetch.mockResolvedValue(createResponse({hasDisclosure: true}));

		await runScript();
		FakeIntersectionObserver.latest().intersect([capsule]);
		await flush();

		expect(window.fetch).toHaveBeenCalledWith("https://store.steampowered.com/app/5295390?l=english");
		expect(capsule.classList.contains("aiwarning_hasdisclosure")).toBe(true);
		expect(capsule.classList.contains("aiwarning_checking")).toBe(false);
	});

	test("leaves a capsule unmarked and caches the result when there is no AI disclosure", async () => {
		const browser = installBrowserMock();
		const capsule = createCapsule(620);
		document.body.append(capsule);
		window.fetch.mockResolvedValue(createResponse({hasDisclosure: false}));

		await runScript();
		FakeIntersectionObserver.latest().intersect([capsule]);
		await flush();

		expect(capsule.classList.contains("aiwarning_hasdisclosure")).toBe(false);
		expect(browser.storage.local.data["app-620"].aidisclosure).toBe(false);
	});

	test("does not fetch anything before a capsule becomes visible", async () => {
		installBrowserMock();
		document.body.append(createCapsule(1));

		await runScript();

		expect(window.fetch).not.toHaveBeenCalled();
	});

	test("ignores app links without an image, such as text links", async () => {
		installBrowserMock();
		const textLink = createCapsule(2, {withImage: false});
		document.body.append(textLink);

		await runScript();

		expect(FakeIntersectionObserver.latest().observed.has(textLink)).toBe(false);
	});

	test("observes capsules that React renders after the script has started", async () => {
		installBrowserMock();
		window.fetch.mockResolvedValue(createResponse({hasDisclosure: true}));

		await runScript();
		const capsule = createCapsule(3);
		document.body.append(capsule);
		await flush();
		FakeIntersectionObserver.latest().intersect([capsule]);
		await flush();

		expect(capsule.classList.contains("aiwarning_hasdisclosure")).toBe(true);
	});

	test("uses the cached result without fetching the store page", async () => {
		installBrowserMock({
			local: {"app-4": {aidisclosure: true, updated: new Date().toISOString()}},
		});
		const capsule = createCapsule(4);
		document.body.append(capsule);

		await runScript();
		FakeIntersectionObserver.latest().intersect([capsule]);
		await flush();

		expect(window.fetch).not.toHaveBeenCalled();
		expect(capsule.classList.contains("aiwarning_hasdisclosure")).toBe(true);
	});

	test("marks the check as failed and does not cache an error response", async () => {
		const browser = installBrowserMock();
		const capsule = createCapsule(5);
		document.body.append(capsule);
		window.fetch.mockResolvedValue(createResponse({status: 429}));

		await runScript();
		FakeIntersectionObserver.latest().intersect([capsule]);
		await flush();

		expect(capsule.classList.contains("aiwarning_failed")).toBe(true);
		expect(browser.storage.local.data["app-5"]).toBeUndefined();
	});

	test("marks the check as failed when the store page redirects to the age check", async () => {
		const browser = installBrowserMock();
		const capsule = createCapsule(6);
		document.body.append(capsule);
		window.fetch.mockResolvedValue(createResponse({url: "https://store.steampowered.com/agecheck/app/6/"}));

		await runScript();
		FakeIntersectionObserver.latest().intersect([capsule]);
		await flush();

		expect(capsule.classList.contains("aiwarning_failed")).toBe(true);
		expect(browser.storage.local.data["app-6"]).toBeUndefined();
	});

	test("limits concurrent store page requests to three", async () => {
		installBrowserMock();
		const capsules = [10, 11, 12, 13, 14].map((appid) => createCapsule(appid));
		document.body.append(...capsules);
		const pendingResponses = [];
		window.fetch.mockImplementation(() => new Promise((resolve) => pendingResponses.push(resolve)));

		await runScript();
		FakeIntersectionObserver.latest().intersect(capsules);
		await flush();

		expect(window.fetch).toHaveBeenCalledTimes(3);

		pendingResponses.shift()(createResponse());
		await flush();

		expect(window.fetch).toHaveBeenCalledTimes(4);
	});

	test.each([
		[undefined, "blur"],
		["hide", "hide"],
		["show", "show"],
	])("applies the saved filter mode %s as %s on the document", async (savedMode, expectedMode) => {
		installBrowserMock({sync: savedMode ? {filtermode: savedMode} : {}});

		await runScript();

		expect(document.documentElement.dataset.aiwarning).toBe(expectedMode);
	});
});
