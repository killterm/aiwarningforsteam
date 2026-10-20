/**
 * @jest-environment-options {"url": "https://store.steampowered.com/search/?term=demo"}
 */
const {
	createResponse,
	flush,
	installBrowserMock,
	runScript,
	setUp,
	tearDown,
} = require("./helpers");

/** Renders the parts of the search page the script attaches to. */
function renderSearchPage() {
	document.body.innerHTML = `
		<div id="additional_search_options"><div class="block"></div></div>
		<div id="search_results"><div id="search_resultsRows"></div></div>
	`;
	// jsdom does not support `:nth-last-child(An+B of S)`, which browsers do,
	// so the lookup of the last filter block is answered directly.
	const lastBlock = document.querySelector("#additional_search_options .block");
	const querySelector = document.querySelector.bind(document);
	jest.spyOn(document, "querySelector").mockImplementation((selector) => (
		selector.includes(" of .block") ? lastBlock : querySelector(selector)
	));
}

/** Appends a search result row for the given app. */
function addSearchResultRow(appid) {
	const row = document.createElement("a");
	row.className = "search_result_row";
	row.dataset.dsAppid = appid;
	row.href = `https://store.steampowered.com/app/${appid}`;
	document.getElementById("search_resultsRows").append(row);
	return row;
}

describe("search page", () => {
	beforeEach(setUp);
	afterEach(tearDown);

	test("marks result rows whose store page has an AI disclosure", async () => {
		installBrowserMock();
		renderSearchPage();
		window.fetch.mockResolvedValue(createResponse({hasDisclosure: true}));

		await runScript();
		const row = addSearchResultRow(2073850);
		await flush();

		expect(window.fetch).toHaveBeenCalledWith("https://store.steampowered.com/app/2073850?l=english");
		expect(row.classList.contains("aiwarning_hasdisclosure")).toBe(true);
	});

	test("does not check rows when the filter is turned off", async () => {
		installBrowserMock({sync: {filtermode: "show"}});
		renderSearchPage();

		await runScript();
		addSearchResultRow(620);
		await flush();

		expect(window.fetch).not.toHaveBeenCalled();
	});
});
