'use strict';

var obsidian = require('obsidian');
var view = require('@codemirror/view');

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global Reflect, Promise, SuppressedError, Symbol, Iterator */


function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};

// CodeMirror 6 ViewPlugin の実装
class LineCharCountViewPlugin {
    constructor(view, plugin) {
        this.lastReportedCharCount = -1; // 前回報告した文字数（同じ行でも変更があった場合に対応するため）
        this.lastLineNumber = -1; // 前回の行番号
        this.view = view;
        this.plugin = plugin;
        this.updateCount(view, true); // 初期表示 (強制更新)
    }
    update(update) {
        // ドキュメント変更、選択範囲変更、またはビューポート変更があった場合に評価
        if (update.docChanged || update.selectionSet || update.viewportChanged) {
            this.updateCount(update.view);
        }
    }
    updateCount(view, forceUpdate = false) {
        if (!view.hasFocus) { // エディタがフォーカスを持っていない場合は何もしない (またはN/A表示)
            this.plugin.updateStatusBar(null); // フォーカスが外れたらN/Aにする
            return;
        }

        const cursorPos = view.state.selection.main.head;
        const currentLine = view.state.doc.lineAt(cursorPos);
        const currentLineNumber = currentLine.number;

        // --- ここから修正部分 ---
        let lineText = currentLine.text;

        // 1. 行頭・行末の空白をトリム
        lineText = lineText.trim();

        // 2. Markdownの記号やリスト記号、チェックボックスなどを除去する正規表現
        //    一般的なMarkdown記号: # (ヘッダー), * - + (リスト), > (引用), = (セクション),
        //    ` (コード), ~ (打ち消し), _ (斜体), ** __ (強調), []() (リンク), ![]() (画像)
        //    チェックボックス: - [ ] または - [x]
        //    これらは一例であり、Obsidianで使われる全ての記号を網羅するものではありません。
        //    複雑なMarkdown構文に対応するには、より高度なパースが必要になりますが、
        //    ここでは一般的な記号を除去することを目的とします。
        const markdownRegex = /(^#+\s*)|(^[\s\t]*[-*+]\s+\[[ xX]?\]\s+)|(^[\s\t]*[-*+]\s+)|(^>\s*)|([`*~_])|(\[.*?\]\(.*?\))|(!\[.*?\]\(.*?\))/g;
        lineText = lineText.replace(markdownRegex, '');

        // 3. 複数の連続する空白を1つの空白に置換し、さらにトリムして単語間の空白のみにする
        //    これにより、途中の空白もカウントされなくなる（厳密には単語間の空白は残る）
        //    もし単語間の空白もカウントしたくない場合は、次の行をコメントアウトして
        //    lineText = lineText.replace(/\s+/g, ''); を使用してください。
        lineText = lineText.replace(/\s+/g, ' ');
        lineText = lineText.trim(); // 複数空白置換後に再度トリム

        // 最終的な文字数を計算
        const charCount = lineText.length;
        // --- 修正部分ここまで ---

        // 行が変わったか、文字数が変わったか、強制更新の場合のみステータスバーを更新
        if (forceUpdate || currentLineNumber !== this.lastLineNumber || charCount !== this.lastReportedCharCount) {
            this.plugin.updateStatusBar(charCount);
            this.lastReportedCharCount = charCount;
            this.lastLineNumber = currentLineNumber;
        }
    }
    destroy() {
        // クリーンアップ処理があればここに記述
    }
}
class CurrentLineCharCountPlugin extends obsidian.Plugin {
    constructor() {
        super(...arguments);
        this.cmExtension = []; // CM6拡張を保持する配列
        // アクティブなリーフが変更されたときのハンドラ
        this.handleActiveLeafChange = (leaf) => {
            if (leaf && leaf.view instanceof obsidian.MarkdownView && leaf.view.editor) ;
            else {
                // MarkdownViewでない、またはエディタがない場合はN/Aを表示
                this.updateStatusBar(null);
            }
        };
    }
    onload() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('Loading Current Line Character Count plugin');
            this.statusBarItemEl = this.addStatusBarItem();
            this.updateStatusBar(null); // 初期はN/A
            // CodeMirror 6 拡張機能のセットアップ
            const pluginInstance = this; // ViewPlugin内でプラグインインスタンスを参照するため
            this.cmExtension.push(view.ViewPlugin.define(view => new LineCharCountViewPlugin(view, pluginInstance)));
            this.registerEditorExtension(this.cmExtension);
            // アクティブなリーフが変更されたときの処理 (MarkdownView以外になった場合の対応など)
            this.registerEvent(this.app.workspace.on('active-leaf-change', this.handleActiveLeafChange));
            // 初期表示のために現在の状態をチェック
            this.handleActiveLeafChange(this.app.workspace.activeLeaf);
        });
    }
    onunload() {
        console.log('Unloading Current Line Character Count plugin');
        // ステータスバーアイテムやイベントリスナーはObsidianが自動的にクリーンアップ
        // CM6拡張も自動的に解除される
    }
    // ステータスバーの表示を更新するメソッド
    updateStatusBar(charCount) {
        if (charCount !== null) {
            this.statusBarItemEl.setText(`Chars: ${charCount}`);
        }
        else {
            this.statusBarItemEl.setText('Chars: N/A');
        }
    }
}

module.exports = CurrentLineCharCountPlugin;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsiLi4vbm9kZV9tb2R1bGVzL3RzbGliL3RzbGliLmVzNi5qcyIsIi4uL21haW4udHMiXSwic291cmNlc0NvbnRlbnQiOm51bGwsIm5hbWVzIjpbIlBsdWdpbiIsIk1hcmtkb3duVmlldyIsIlZpZXdQbHVnaW4iXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFrR0E7QUFDTyxTQUFTLFNBQVMsQ0FBQyxPQUFPLEVBQUUsVUFBVSxFQUFFLENBQUMsRUFBRSxTQUFTLEVBQUU7QUFDN0QsSUFBSSxTQUFTLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxPQUFPLEtBQUssWUFBWSxDQUFDLEdBQUcsS0FBSyxHQUFHLElBQUksQ0FBQyxDQUFDLFVBQVUsT0FBTyxFQUFFLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUU7QUFDaEgsSUFBSSxPQUFPLEtBQUssQ0FBQyxLQUFLLENBQUMsR0FBRyxPQUFPLENBQUMsRUFBRSxVQUFVLE9BQU8sRUFBRSxNQUFNLEVBQUU7QUFDL0QsUUFBUSxTQUFTLFNBQVMsQ0FBQyxLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFO0FBQ25HLFFBQVEsU0FBUyxRQUFRLENBQUMsS0FBSyxFQUFFLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFO0FB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
