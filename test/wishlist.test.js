/**
 * @jest-environment-options {"url": "https://store.steampowered.com/wishlist/profiles/76561198028121353/"}
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

/** Points a capsule at another app, as the virtualized wishlist does when it is re-sorted. */
function reuseCapsuleFor(capsule, appid) {
	capsule.href = `https://store.steampowered.com/app/${appid}/?snr=1_25_4__318`;
}

describe("wishlist page", () => {
	beforeEach(setUp);
	afterEach(tearDown);

	test("marks a visible capsule whose store page has an AI disclosure", async () => {
		installBrowserMock();
		const capsule = createCapsule(772260);
		document.body.append(capsule);
		window.fetch.mockResolvedValue(createResponse({hasDisclosure: true}));

		await runScript();
		FakeIntersectionObserver.latest().intersect([capsule]);
		await flush();

		expect(window.fetch).toHaveBeenCalledWith("https://store.steampowered.com/app/772260?l=english");
		expect(capsule.classList.contains("aiwarning_hasdisclosure")).toBe(true);
	});

	test("re-checks a capsule that is reused for another app after re-sorting", async () => {
		installBrowserMock();
		const capsule = createCapsule(100);
		document.body.append(capsule);
		window.fetch.mockResolvedValueOnce(createResponse({hasDisclosure: true}));
		window.fetch.mockResolvedValueOnce(createResponse({hasDisclosure: false}));

		await runScript();
		FakeIntersectionObserver.latest().intersect([capsule]);
		await flush();
		reuseCapsuleFor(capsule, 200);
		await flush();

		expect(capsule.classList.contains("aiwarning_hasdisclosure")).toBe(false);

		FakeIntersectionObserver.latest().intersect([capsule]);
		await flush();

		expect(window.fetch).toHaveBeenLastCalledWith("https://store.steampowered.com/app/200?l=english");
		expect(capsule.classList.contains("aiwarning_hasdisclosure")).toBe(false);
	});

	test("ignores a late result for the app a reused capsule pointed to before", async () => {
		installBrowserMock();
		const capsule = createCapsule(300);
		document.body.append(capsule);
		let resolveFirstApp;
		window.fetch.mockImplementationOnce(() => new Promise((resolve) => {
			resolveFirstApp = resolve;
		}));

		await runScript();
		FakeIntersectionObserver.latest().intersect([capsule]);
		await flush();
		reuseCapsuleFor(capsule, 400);
		await flush();
		resolveFirstApp(createResponse({hasDisclosure: true}));
		await flush();

		expect(capsule.classList.contains("aiwarning_hasdisclosure")).toBe(false);
	});
});
