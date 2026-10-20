/**
 * @jest-environment-options {"url": "https://store.steampowered.com/personalcalendar/"}
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

describe("personal calendar page", () => {
	beforeEach(setUp);
	afterEach(tearDown);

	test("marks a visible capsule whose store page has an AI disclosure", async () => {
		installBrowserMock();
		const capsule = createCapsule(4708060);
		document.body.append(capsule);
		window.fetch.mockResolvedValue(createResponse({hasDisclosure: true}));

		await runScript();
		FakeIntersectionObserver.latest().intersect([capsule]);
		await flush();

		expect(window.fetch).toHaveBeenCalledWith("https://store.steampowered.com/app/4708060?l=english");
		expect(capsule.classList.contains("aiwarning_hasdisclosure")).toBe(true);
	});

	test("ignores links to app news events, which are not store page capsules", async () => {
		installBrowserMock();
		const eventLink = document.createElement("a");
		eventLink.href = "https://store.steampowered.com/news/app/4708060/view/123";
		eventLink.innerHTML = "<img alt=\"Event\">";
		document.body.append(eventLink);

		await runScript();

		expect(FakeIntersectionObserver.latest().observed.has(eventLink)).toBe(false);
	});
});
