import { chromium } from 'playwright';

// 設定情報
const PROJECT_ID = '1439348321'; // あなたのプロジェクトID
const SEARCH_KEYWORDS = ['アニメ']; // 必要に応じてキーワードを追加

// クッキー情報
const SESSION_ID = (process.env.SCRATCH_SESSION_ID || '.eJxVj81OwzAQBt_F5zbEmx87vcEJVSqHUiTEJVrbm8YksavYpRTEu-NIFRI3a2Y90vfNzoFmhxOxDXu-qtF-4EsinK1Yi-fYt4tvrUmai0aWoq4Wp9A5SrDDMdCKRQpRez_YJXPx85Dcv4BCPZBbKgsjF63GaL3LbiJkezqNN_hwO05dnx7pU15JSXlRQAW8FI1ojOlkVRrdcci5Epuznp62l_0nvooadoe3EorH9Q6aaXtJmdEfrVvbUyo1PINcZFyUWZFM0DNG3dP8N8W8ozv6NtqJvrxb9twHi3cHP1z9_009hj5pqKUCUAZLIGmogk4KJQuta6SCOIou74ADsp9fGEJ1sw:1xRTFF:GAAAhTQTeJERiQWmUrcJY5JWj20').trim();
const CSRF_TOKEN = (process.env.SCRATCH_CSRF_TOKEN || 'j7I1nnsY5NpK745qxpSIal9Ki6M082h9').trim();

async function searchStudios(keyword) {
    try {
        const url = `https://api.scratch.mit.edu/search/studios?q=${encodeURIComponent(keyword)}&limit=3`;
        const res = await fetch(url);
        return await res.json();
    } catch (e) {
        console.error("検索エラー:", e);
        return [];
    }
}

async function main() {
    console.log("=== Playwright ボット実行開始 (URL直接入力版) ===");

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

    for (const keyword of SEARCH_KEYWORDS) {
        console.log(`\n「${keyword}」でスタジオを検索中...`);
        const studios = await searchStudios(keyword);

        for (const studio of studios) {
            const studioId = studio.id;
            const studioUrl = `https://scratch.mit.edu/studios/${studioId}/`;

            try {
                console.log(`スタジオアクセス中: ID ${studioId}`);
                await page.goto(studioUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                await page.waitForTimeout(2000); // 描画待ち

                // スクリーンショット保存
                const ssPath = `screenshot_${studioId}.png`;
                await page.screenshot({ path: ssPath, fullPage: true });
                console.log(`[保存] スクリーンショットを保存しました: ${ssPath}`);

                // プロジェクトのURL
                const projectUrl = `https://scratch.mit.edu/projects/${PROJECT_ID}`;

                // 1. 「Add Projects」の入力欄を探してURLを入力
                const inputField = await page.$('input[placeholder*="scratch.mit.edu/projects"]');
                
                if (inputField) {
                    await inputField.fill(projectUrl);
                    await page.waitForTimeout(1000);

                    // 2. 「Add by URL」ボタンをクリック
                    const addByUrlBtn = await page.$('button:has-text("Add by URL")');
                    if (addByUrlBtn) {
                        await addByUrlBtn.click();
                        await page.waitForTimeout(3000); // 追加処理の完了待ち
                        console.log(`[成功] スタジオ ID: ${studioId} にプロジェクトを追加しました！`);
                    } else {
                        console.log(`[スキップ] スタジオ ID: ${studioId} ("Add by URL" ボタンが見つかりません)`);
                    }
                } else {
                    console.log(`[スキップ] スタジオ ID: ${studioId} (プロジェクト追加用の入力欄が見つかりません。権限がない可能性があります)`);
                }
            } catch (err) {
                console.log(`[エラー] スタジオ ID ${studioId} の処理失敗:`, err.message);
            }

            await page.waitForTimeout(2000);
        }
    }

    await browser.close();
    console.log("\n=== 処理完了 ===");
}

main();
