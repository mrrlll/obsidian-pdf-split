import { Plugin, WorkspaceLeaf, FileSystemAdapter } from "obsidian";
import { PdfSplitView, VIEW_TYPE_PDF_SPLITTER } from "./PdfSplitView";

export default class PdfSplitterPlugin extends Plugin {
	async onload() {
		this.registerView(
			VIEW_TYPE_PDF_SPLITTER,
			(leaf: WorkspaceLeaf) => new PdfSplitView(leaf)
		);

		this.addRibbonIcon("square-scissors", "PDF Splitter", () => {
			this.activateView();
		});

		this.addCommand({
			id: "open-pdf-splitter-view",
			name: "Open PDF Splitter Pane",
			callback: () => this.activateView(),
		});

		this.registerStylesheet();
	}

	async activateView() {
		const leaf =
			this.app.workspace.getRightLeaf(false) ||
			this.app.workspace.getLeaf();
		await leaf.setViewState({ type: VIEW_TYPE_PDF_SPLITTER, active: true });
		this.app.workspace.revealLeaf(leaf);
	}

	registerStylesheet() {
		const linkEl = document.createElement("link");
		linkEl.rel = "stylesheet";
		linkEl.type = "text/css";
		linkEl.href =
			this.app.vault.adapter instanceof FileSystemAdapter
				? `${this.app.vault.adapter.getBasePath()}/${
						this.manifest.dir
				  }/styles.css`
				: "";
		document.head.appendChild(linkEl);
	}

	onunload() {}
}
