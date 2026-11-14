import { chromium } from 'playwright';

const PROJECT_ID = '1439348321'; 
const SEARCH_KEYWORDS = ['なんでも', 'anything', 'Japanese', '日本'];

const SESSION_ID = (process.env.SCRATCH_SESSION_ID || '').trim();
const CSRF_TOKEN = (process.env.SCRATCH_CSRF_TOKEN || '').trim();

// 💡 ページネーション（offset）を使って、取得できる限界までスタジオを全件自動取得する関数
async function searchAllStudios(keyword) {
    let allStudios = [];
    let offset = 0;
    const limit = 20; // 1回あたりの取得数（APIがエラーを出さない安全な単位）

    console.log(`\n「${keyword}」のスタジオを全件検索中...`);

    while (true) {
        try {
            const url = `https://api.scratch.mit.edu/search/studios?q=${encodeURIComponent(keyword)}&limit=${limit}&offset=${offset}`;
            const res = await fetch(url);
            const data = await res.json();

            // データが配列ではない、または空になったらこれ以上ページがないので終了
            if (!Array.isArray(data) || data.length === 0) {
                break;
            }

            allStudios = allStudios.concat(data);

            // 今回取得できた件数がlimitより少ない ＝ 最後のページなので終了
            if (data.length < limit) {
                break;
            }

            offset += limit; // 次の20件へ進む

            // ※安全装置: 1キーワードあたり最大200件で一旦ストップ（必要に応じてこの数字は増やせます）
            if (allStudios.length >= 200) {
                console.log(`[情報] 安全のため「${keyword}」の取得上限（200件）に達しました。`);
                break;
            }

            // APIに負荷をかけすぎないよう少し待機
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (e) {
            console.error(`検索エラー (offset: ${offset}):`, e);
            break;
        }
    }

    return allStudios;
}

async function main() {
    console.log("=== Playwright ボット実行開始 (全件自動検知版) ===");

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

    if (SESSION_ID) {
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
    }

    const page = await context.newPage();
    let totalAdded = 0;

    for (const keyword of SEARCH_KEYWORDS) {
        // 限界まで自動取得する関数を呼び出す
        const studios = await searchAllStudios(keyword);
        console.log(`「${keyword}」の検索結果: 合計 ${studios.length}件のスタジオが見つかりました`);

        for (const studio of studios) {
            const studioId = studio.id;
            const studioUrl = `https://scratch.mit.edu/studios/${studioId}/`;

            try {
                console.log(`スタジオアクセス中: ID ${studioId} (${studio.title || 'タイトルなし'})`);
                await page.goto(studioUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                await page.waitForTimeout(2500); // 描画をしっかり待つ

                const projectUrl = `https://scratch.mit.edu/projects/${PROJECT_ID}`;

                // 入力欄が出現するまで最大5秒待つ
                let inputField = null;
                try {
                    inputField = await page.waitForSelector('input[placeholder*="scratch.mit.edu/projects"]', { timeout: 5000 });
                } catch (e) {
                    // 見つからない場合はnull
                }
                
                if (inputField) {
                    await inputField.fill(projectUrl);
                    await page.waitForTimeout(1000);

                    // 「Add by URL」ボタンを探してクリック
                    const addByUrlBtn = await page.$('button:has-text("Add by URL")');
                    if (addByUrlBtn) {
                        await addByUrlBtn.click();
                        await page.waitForTimeout(3000); // 追加処理待ち
                        console.log(`[成功] スタジオ ID: ${studioId} にプロジェクトを追加しました！`);
                        totalAdded++;
                    } else {
                        console.log(`[スキップ] スタジオ ID: ${studioId} ("Add by URL" ボタンが見つかりません)`);
                    }
                } else {
                    console.log(`[スキップ] スタジオ ID: ${studioId} (プロジェクト追加用の入力欄が見つかりません)`);
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
