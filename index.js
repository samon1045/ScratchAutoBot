import { chromium } from 'playwright';
import fs from 'fs';

// 設定情報
const PROJECT_ID = '1439348321'; // あなたのプロジェクトID
const SCAN_COUNT_PER_RUN = 15; // 1回の実行でスキャンするスタジオの数（GitHub Actionsのタイムアウト防止）

// スキャン開始ID（最新のスタジオID付近を指定。前回の続きから再開する仕組みも搭載）
const DEFAULT_START_ID = 35369190; 
const STATE_FILE = 'last_studio_id.txt';

// クッキー情報
const SESSION_ID = (process.env.SCRATCH_SESSION_ID || '.eJxVj81OwzAQBt_F5zbEmx87vcEJVSqHUiTEJVrbm8YksavYpRTEu-NIFRI3a2Y90vfNzoFmhxOxDXu-qtF-4EsinK1Yi-fYt4tvrUmai0aWoq4Wp9A5SrDDMdCKRQpRez_YJXPx85Dcv4BCPZBbKgsjF63GaL3LbiJkezqNN_hwO05dnx7pU15JSXlRQAW8FI1ojOlkVRrdcci5Epuznp62l_0nvooadoe3EorH9Q6aaXtJmdEfrVvbUyo1PINcZFyUWZFM0DNG3dP8N8W8ozv6NtqJvrxb9twHi3cHP1z9_009hj5pqKUCUAZLIGmogk4KJQuta6SCOIou74ADsp9fGEJ1sw:1xRTFF:GAAAhTQTeJERiQWmUrcJY5JWj20').trim();
const CSRF_TOKEN = (process.env.SCRATCH_CSRF_TOKEN || 'j7I1nnsY5NpK745qxpSIal9Ki6M082h9').trim();

// 前回スキャンしたIDを読み込む（なければデフォルト値を使用）
function getStartId() {
    if (fs.existsSync(STATE_FILE)) {
        const saved = parseInt(fs.readFileSync(STATE_FILE, 'utf8').trim(), 10);
        if (!isNaN(saved)) return saved;
    }
    return DEFAULT_START_ID;
}

// 次にスキャンするIDを保存する
function saveNextId(nextId) {
    fs.writeFileSync(STATE_FILE, String(nextId), 'utf8');
}

async function main() {
    console.log("=== スタジオID連番スキャンボット 実行開始 ===");

    const startId = getStartId();
    console.log(`スキャン開始ID: ${startId} 〜 ${startId + SCAN_COUNT_PER_RUN - 1}`);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();

    await context.addCookies([
        {
            name: 'scratchsessionsid',
            value: SESSION_ID,
            domain: '.scratch.mit.edu',
            path: '/',
            secure: true,
            httpOnly: true
        },
        {
            name: 'scratchcsrftoken',
            value: CSRF_TOKEN,
            domain: '.scratch.mit.edu',
            path: '/',
            secure: true,
            httpOnly: false
        }
    ]);

    const page = await context.newPage();
    const projectUrl = `https://scratch.mit.edu/projects/${PROJECT_ID}`;

    let currentId = startId;

    for (let i = 0; i < SCAN_COUNT_PER_RUN; i++) {
        currentId = startId + i;
        const studioUrl = `https://scratch.mit.edu/studios/${currentId}/`;

        try {
            console.log(`\n[${i + 1}/${SCAN_COUNT_PER_RUN}] スタジオID: ${currentId} を確認中...`);
            const response = await page.goto(studioUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });

            // 404（存在しない・削除されたスタジオ）の場合は即スキップ
            if (response && response.status() === 404) {
                console.log(` => [スキップ] 存在しないスタジオです (404)`);
                continue;
            }

            await page.waitForTimeout(1500);

            // 「Add Projects」の入力欄があるかチェック（＝誰でも追加できる権限があるか）
            const inputField = await page.$('input[placeholder*="scratch.mit.edu/projects"]');

            if (inputField) {
                console.log(` => [発見！] 追加可能なオープンスタジオです！`);
                await inputField.fill(projectUrl);
                await page.waitForTimeout(800);

                const addByUrlBtn = await page.$('button:has-text("Add by URL")');
                if (addByUrlBtn) {
                    await addByUrlBtn.click();
                    await page.waitForTimeout(2500); // 追加完了待ち
                    console.log(` => [成功] スタジオ ID: ${currentId} にプロジェクトを追加しました！`);
                }
            } else {
                console.log(` => [スキップ] 追加権限がありません（マネージャー限定など）`);
            }
        } catch (err) {
            console.log(` => [エラー] ID ${currentId} の確認中にエラー: ${err.message}`);
        }

        // サーバー負荷軽減のためのウェイト
        await page.waitForTimeout(1500);
    }

    // 次回の実行のために次のIDを保存
    saveNextId(currentId + 1);

    await browser.close();
    console.log(`\n=== 処理完了 (次回開始ID: ${currentId + 1}) ===`);
}

main();
