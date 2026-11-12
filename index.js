import { chromium } from 'playwright';
import fetch from 'node-fetch';

// 設定情報
const PROJECT_ID = '1439348321'; // あなたのプロジェクトID
const USERNAME = 'SyllivaUser1'; // あなたのScratchユーザー名（クッキーから推測）

// クッキー情報
const SESSION_ID = (process.env.SCRATCH_SESSION_ID || '.eJxVj81OwzAQBt_F5zbEmx87vcEJVSqHUiTEJVrbm8YksavYpRTEu-NIFRI3a2Y90vfNzoFmhxOxDXu-qtF-4EsinK1Yi-fYt4tvrUmai0aWoq4Wp9A5SrDDMdCKRQpRez_YJXPx85Dcv4BCPZBbKgsjF63GaL3LbiJkezqNN_hwO05dnx7pU15JSXlRQAW8FI1ojOlkVRrdcci5Epuznp62l_0nvooadoe3EorH9Q6aaXtJmdEfrVvbUyo1PINcZFyUWZFM0DNG3dP8N8W8ozv6NtqJvrxb9twHi3cHP1z9_009hj5pqKUCUAZLIGmogk4KJQuta6SCOIou74ADsp9fGEJ1sw:1xRTFF:GAAAhTQTeJERiQWmUrcJY5JWj20').trim();
const CSRF_TOKEN = (process.env.SCRATCH_CSRF_TOKEN || 'j7I1nnsY5NpK745qxpSIal9Ki6M082h9').trim();

// 自分がキュレーター・マネージャーとして参加しているスタジオ一覧を取得
async function getCuratingStudios() {
    try {
        console.log(`ユーザー "${USERNAME}" の参加スタジオを取得中...`);
        const url = `https://api.scratch.mit.edu/users/${USERNAME}/studios/curating?limit=40`;
        const res = await fetch(url);
        const studios = await res.json();
        
        if (Array.isArray(studios)) {
            return studios;
        } else {
            console.log("スタジオの取得に失敗しました:", studios);
            return [];
        }
    } catch (e) {
        console.error("参加スタジオ取得エラー:", e);
        return [];
    }
}

async function main() {
    console.log("=== 参加スタジオ自動追加ボット実行開始 ===");

    const studios = await getCuratingStudios();
    console.log(`対象スタジオ数: ${studios.length}件\n`);

    if (studios.length === 0) {
        console.log("処理を終了します（対象スタジオがありません）");
        return;
    }

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

    for (const studio of studios) {
        const studioId = studio.id;
        const studioTitle = studio.title || 'タイトル不明';
        const studioUrl = `https://scratch.mit.edu/studios/${studioId}/`;

        try {
            console.log(`[処理中] スタジオ: "${studioTitle}" (ID: ${studioId})`);
            await page.goto(studioUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await page.waitForTimeout(2000);

            // プロジェクトのURL
            const projectUrl = `https://scratch.mit.edu/projects/${PROJECT_ID}`;

            // 「Add Projects」の入力欄を探してURLを入力
            const inputField = await page.$('input[placeholder*="scratch.mit.edu/projects"]');
            
            if (inputField) {
                await inputField.fill(projectUrl);
                await page.waitForTimeout(1000);

                // 「Add by URL」ボタンをクリック
                const addByUrlBtn = await page.$('button:has-text("Add by URL")');
                if (addByUrlBtn) {
                    await addByUrlBtn.click();
                    await page.waitForTimeout(3000); // 追加完了待ち
                    console.log(` => [成功] プロジェクトを追加しました！`);
                } else {
                    console.log(` => [スキップ] "Add by URL" ボタンが見つかりませんでした。`);
                }
            } else {
                console.log(` => [スキップ] 入力欄が見つかりませんでした（権限がない可能性）`);
            }
        } catch (err) {
            console.log(` => [エラー] 処理失敗:`, err.message);
        }

        // サーバー負荷軽減のウェイト
        await page.waitForTimeout(2000);
    }

    await browser.close();
    console.log("\n=== 全ての処理が完了しました ===");
}

main();
