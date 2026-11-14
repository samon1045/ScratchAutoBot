import { chromium } from 'playwright';

const PROJECT_ID = '1439348005'; 
const SEARCH_KEYWORDS = ['なんでも', 'anything', 'Japanese', '日本'];
const LIMIT_PER_KEYWORD = 100;

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
    console.log("=== Playwright ボット実行開始 (詳細スクショ・デバッグ版) ===");

    const browser = await chromium.launch({
        headless: true,
        args: [
            '--disable-blink-features=AutomationControlled',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage'
        ]
    });

    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 800 }
    });

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
        console.log(`\n「${keyword}」でスタジオを検索中...`);
        const studios = await searchStudios(keyword);
        console.log(`「${keyword}」の検索結果: ${studios.length}件のスタジオが見つかりました`);

        for (const studio of studios) {
            const studioId = studio.id;
            const studioUrl = `https://scratch.mit.edu/studios/${studioId}/`;

            try {
                console.log(`\n--- スタジオアクセス中: ID ${studioId} (${studio.title || 'タイトルなし'}) ---`);
                
                // 1. ページ遷移直後
                await page.goto(studioUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                await page.screenshot({ path: `debug_1_loaded_${studioId}.png`, fullPage: true });
                console.log(`[スクショ保存] 1. ページ読み込み直後`);

                // 2. 描画待ち後（2秒経過）
                await page.waitForTimeout(2000);
                await page.screenshot({ path: `debug_2_wait_${studioId}.png`, fullPage: true });
                console.log(`[スクショ保存] 2. 描画待ち後`);

                const projectUrl = `https://scratch.mit.edu/projects/${PROJECT_ID}`;

                // 3. 入力欄を探す試行前
                let inputField = null;
                try {
                    inputField = await page.waitForSelector('input[placeholder*="scratch.mit.edu/projects"]', { timeout: 5000 });
                } catch (e) {
                    // 見つからない
                }

                if (inputField) {
                    console.log(`[検出] プロジェクト追加用の入力欄が見つかりました！`);
                    await page.screenshot({ path: `debug_3_input_found_${studioId}.png`, fullPage: true });

                    await inputField.fill(projectUrl);
                    await page.waitForTimeout(1000);
                    await page.screenshot({ path: `debug_4_filled_${studioId}.png`, fullPage: true });

                    const addByUrlBtn = await page.$('button:has-text("Add by URL")');
                    if (addByUrlBtn) {
                        await addByUrlBtn.click();
                        await page.waitForTimeout(3000);
                        await page.screenshot({ path: `debug_5_success_${studioId}.png`, fullPage: true });
                        console.log(`[成功] スタジオ ID: ${studioId} にプロジェクトを追加しました！`);
                        totalAdded++;
                    } else {
                        console.log(`[スキップ] スタジオ ID: ${studioId} ("Add by URL" ボタンが見つかりません)`);
                        await page.screenshot({ path: `debug_err_nobtn_${studioId}.png`, fullPage: true });
                    }
                } else {
                    console.log(`[スキップ] スタジオ ID: ${studioId} (入力欄が見つかりません)`);
                    // 入力欄が見つからなかった瞬間の画面を詳細に保存
                    await page.screenshot({ path: `debug_err_noinput_${studioId}.png`, fullPage: true });
                }

            } catch (err) {
                console.log(`[エラー] スタジオ ID ${studioId} の処理失敗:`, err.message);
                await page.screenshot({ path: `debug_err_exception_${studioId}.png`, fullPage: true });
            }

            await page.waitForTimeout(2000);
        }
    }

    await browser.close();
    console.log(`\n=== 処理完了 (合計 ${totalAdded} 個のスタジオに追加しました) ===`);
}

main();
