import { ItemView, WorkspaceLeaf, Notice } from "obsidian";
import { FileSystemAdapter } from "obsidian";
import * as path from "path";
import * as fs from "fs";
import { PDFDocument } from "pdf-lib";

export const VIEW_TYPE_PDF_SPLITTER = "pdf-splitter-view";

type IconName = string;

export class PdfSplitView extends ItemView {
	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getIcon(): IconName {
		return "square-scissors";
	}

	getViewType(): string {
		return VIEW_TYPE_PDF_SPLITTER;
	}

	getDisplayText(): string {
		return "PDF Splitter";
	}

	async onOpen() {
		const container = this.containerEl.children[1];
		container.empty();

		container.createEl("h3", { text: "PDFページ分割" });

		const inputContainer = container.createDiv({ cls: "range-inputs" });

		const addRangeInput = () => {
			const wrapper = inputContainer.createDiv({ cls: "range-wrapper" });

			// 入力フィールドをラップするコンテナを追加
			const inputFieldContainer = wrapper.createDiv({ cls: "range-field-container" });
			const input = inputFieldContainer.createEl("input", {
				type: "text",
				placeholder: "例: 1-2 または 5",
			});
			input.addClass("range-field");

			// 削除ボタンをラップするコンテナを追加
			const removeButtonContainer = wrapper.createDiv({ cls: "remove-button-container" });
			const removeBtn = removeButtonContainer.createEl("button", { text: "－" });
			removeBtn.onclick = () => wrapper.remove();
		};

		addRangeInput(); // 初期入力欄

		const addBtn = container.createEl("button", {
			text: "＋ 入力欄を追加",
		});
		addBtn.addClass("add-range");
		addBtn.onclick = () => addRangeInput();

		const runBtn = container.createEl("button", { text: "分割実行" });
		runBtn.addClass("split-run");
		runBtn.onclick = async () => {
			const active = this.app.workspace.getActiveFile();
			if (!active || !active.path.endsWith(".pdf")) {
				new Notice("PDFファイルを開いてください");
				return;
			}

			const fields = inputContainer.getElementsByClassName("range-field");
			const inputs: string[] = [];

			Array.from(fields).forEach((field) => {
				const value = (field as HTMLInputElement).value.trim();
				if (value !== "") inputs.push(value);
			});

			if (inputs.length === 0) {
				new Notice("1つ以上のページ範囲を入力してください");
				return;
			}

			try {
				const buffer = await this.app.vault.readBinary(active);
				const pdfDoc = await PDFDocument.load(buffer);
				const totalPages = pdfDoc.getPageCount();

				const baseName = path.basename(active.path, ".pdf");
				const folderPath = path.dirname(active.path);
				const adapter = this.app.vault.adapter;
				if (!(adapter instanceof FileSystemAdapter)) {
					new Notice("FileSystemAdapterでのみ動作します");
					return;
				}

				const basePath = adapter.getBasePath();
				const outputDir = path.join(basePath, folderPath, "split-pdf");
				fs.mkdirSync(outputDir, { recursive: true });

				for (const inputText of inputs) {
					const subranges = inputText
						.split(",")
						.map((r) => parseRange(r, totalPages));
					const newPdf = await PDFDocument.create();
					const fileSuffixParts: string[] = [];

					for (const [start, end] of subranges) {
						const pageIndexes = Array.from(
							{ length: end - start + 1 },
							(_, i) => start + i - 1
						);
						const copiedPages = await newPdf.copyPages(
							pdfDoc,
							pageIndexes
						);
						copiedPages.forEach((p) => newPdf.addPage(p));
						fileSuffixParts.push(
							`${start}${start !== end ? "-" + end : ""}`
						);
					}

					const outName = `${baseName}-${fileSuffixParts.join(
						"_"
					)}.pdf`;
					const outPath = path.join(outputDir, outName);
					const outBytes = await newPdf.save();
					fs.writeFileSync(outPath, outBytes);
				}

				new Notice("PDFの分割が完了しました");
			} catch (err) {
				console.error(err);
				new Notice("エラーが発生しました");
			}
		};

		const explanation = container.createEl("div");
		explanation.addClass("split-explanation");
		explanation.setText(
			"ハイフン（-）でページ範囲を指定し、カンマ（,）で結合するページを区切って入力してください。\n" +
				"例: 1-3,5 → ページ1〜3と5を結合した1つのPDFが作成されます。\n\n" +
				"入力欄を追加すると、それぞれが別のPDFとして分割出力されます。\n\n" +
				"出力先：元のPDFファイルと同じフォルダ内に「split-pdf」フォルダが自動作成され、" +
				"その中に「ファイル名-ページ範囲.pdf」という形式で保存されます。"
		);
	}

	async onClose() {
		this.containerEl.empty();
	}
}

function parseRange(text: string, maxPages: number): [number, number] {
	const parts = text.split("-").map((s) => parseInt(s.trim()));
	const start = Math.max(1, Math.min(parts[0], maxPages));
	const end = parts[1]
		? Math.max(start, Math.min(parts[1], maxPages))
		: start;
	return [start, end];
}
