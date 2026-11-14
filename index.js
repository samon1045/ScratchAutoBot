import { chromium } from 'playwright';

const PROJECT_ID = '1439348005'; 
const SEARCH_KEYWORDS = ['なんでも', 'anything', 'Japanese', '日本'];
const LIMIT_PER_KEYWORD = 50; // 1キーワードあたりの取得件数を増やす (例: 20件)

const SESSION_ID = (process.env.SCRATCH_SESSION_ID || '.eJxVj81OwzAQBt_F5zbEmx87vcEJVSqHUiTEJVrbm8YksavYpRTEu-NIFRI3a2Y90vfNzoFmhxOxDXu-qtF-4EsinK1Yi-fYt4tvrUmai0aWoq4Wp9A5SrDDMdCKRQpRez_YJXPx85Dcv4BCPZBbKgsjF63GaL3LbiJkezqNN_hwO05dnx7pU15JSXlRQAW8FI1ojOlkVRrdcci5Epuznp62l_0nvooadoe3EorH9Q6aeXtJmdEfrVvbUyo1PINcZFyUWZFM0DNG3dP8N8W8ozv6NtqJvrxb9twHi3cHP1z9_009hj5pqKUCUAZLIGmogk4KJQuta6SCOIou74ADsp9fGEJ1sw:1xRTFF:GAAAhTQTeJERiQWmUrcJY5JWj20').trim();
const CSRF_TOKEN = (process.env.SCRATCH_CSRF_TOKEN || 'j7I1nnsY5NpK745qxpSIal9Ki6M082h9').trim();

async function searchStudios(keyword) {
    try {
        const url = `https://api.scratch.mit.edu/search/studios?q=${encodeURIComponent(keyword)}&limit=${LIMIT_PER_KEYWORD}`;
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
    let totalAdded = 0;

    for (const keyword of SEARCH_KEYWORDS) {
        console.log(`\n「${keyword}`でスタジオを検索中...);
        const studios = await searchStudios(keyword);
        console.log(`「${keyword}」の検索結果: ${studios.length}件のスタジオが見つかりました`);

        for (const studio of studios) {
            const studioId = studio.id;
            const studioUrl = `https://scratch.mit.edu/studios/${studioId}/`;

            try {
                console.log(`スタジオアクセス中: ID ${studioId} (${studio.title || 'タイトルなし'})`);
                await page.goto(studioUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                await page.waitForTimeout(2000); // 描画待ち

                // スクリーンショット保存
                const ssPath = `screenshot_${studioId}.png`;
                await page.screenshot({ path: ssPath, fullPage: true });

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
                        totalAdded++;
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
    console.log(`\n=== 処理完了 (合計 ${totalAdded} 個のスタジオに追加しました) ===`);
}

main();
