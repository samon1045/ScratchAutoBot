import { chromium } from 'playwright';

// 設定情報
const PROJECT_ID = '1439348321'; // あなたのプロジェクトID
const SEARCH_KEYWORDS = ['アニメ', '共有', 'game', 'scratch']; // 検索キーワード

// クッキー情報（GitHub Secretsや環境変数、または直接記述）
const SESSION_ID = (process.env.SCRATCH_SESSION_ID || '.eJxVj81OwzAQBt_F5zbEmx87vcEJVSqHUiTEJVrbm8YksavYpRTEu-NIFRI3a2Y90vfNzoFmhxOxDXu-qtF-4EsinK1Yi-fYt4tvrUmai0aWoq4Wp9A5SrDDMdCKRQpRez_YJXPx85Dcv4BCPZBbKgsjF63GaL3LbiJkezqNN_hwO05dnx7pU15JSXlRQAW8FI1ojOlkVRrdcci5Epuznp62l_0nvooadoe3EorH9Q6aaXtJmdEfrVvbUyo1PINcZFyUWZFM0DNG3dP8N8W8ozv6NtqJvrxb9twHi3cHP1z9_009hj5pqKUCUAZLIGmogk4KJQuta6SCOIou74ADsp9fGEJ1sw:1xRTFF:GAAAhTQTeJERiQWmUrcJY5JWj20').trim();
const CSRF_TOKEN = (process.env.SCRATCH_CSRF_TOKEN || 'j7I1nnsY5NpK745qxpSIal9Ki6M082h9').trim();

async function searchStudios(keyword) {
    try {
        const url = `https://api.scratch.mit.edu/search/studios?q=${encodeURIComponent(keyword)}&limit=5`;
        const res = await fetch(url);
        return await res.json();
    } catch (e) {
        console.error("検索エラー:", e);
        return [];
    }
}

async function main() {
    console.log("=== Playwright ボット実行開始 ===");

    // ヘッドレスモードでブラウザを起動
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();

    // Scratchのドメインに対してログイン用クッキーをセット
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

                // 「プロジェクトを追加」ボタンを探してクリック（UIのセレクタは状況に応じて調整）
                // スタジオページ内の追加ボタンをクリックする処理
                const addBtn = await page.$('button.add-projects-button, .studio-compose-projects button, button:has-text("プロジェクトを追加")');
                
                if (addBtn) {
                    await addBtn.click();
                    await page.waitForTimeout(1000);

                    // 自分のプロジェクト一覧から該当IDのものを選択して追加する処理
                    // （モーダルが表示される想定）
                    const projectCheckbox = await page.$(`input[value="${PROJECT_ID}"], [data-project-id="${PROJECT_ID}"]`);
                    if (projectCheckbox) {
                        await projectCheckbox.click();
                        console.log(`[成功] スタジオ ID: ${studioId} にプロジェクトを追加しました！`);
                    } else {
                        console.log(`[スキップ] スタジオ ID: ${studioId} (プロジェクトが見つからないか、既に追加済みです)`);
                    }
                } else {
                    console.log(`[スキップ] スタジオ ID: ${studioId} (追加権限がない、またはボタンが見つかりません)`);
                }
            } catch (err) {
                console.log(`[エラー] スタジオ ID ${studioId} の処理失敗:`, err.message);
            }

            // サーバーやScratch側に負荷をかけないための待機
            await page.waitForTimeout(3000);
        }
    }

    await browser.close();
    console.log("\n=== 処理完了 ===");
}

main();
