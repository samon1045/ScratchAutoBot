import fetch from 'node-fetch';

// 設定情報
const PROJECT_ID = '1439348321'; // あなたのプロジェクトID
const SEARCH_KEYWORDS = ['アニメ', '共有', 'game', 'scratch']; // 検索キーワード
const SESSIONID = process.env.SCRATCH_SESSION_ID || 'ここに直接セッションIDを入れることも可能'; 
const CSRF_TOKEN = process.env.SCRATCH_CSRF_TOKEN || 'ここに直接CSRFトークンを入れることも可能';

async function searchStudios(keyword) {
    try {
        const url = `https://api.scratch.mit.edu/search/studios?q=${encodeURIComponent(keyword)}&limit=10`;
        const res = await fetch(url);
        const data = await res.json();
        return data; 
    } catch (e) {
        console.error("検索エラー:", e);
        return [];
    }
}

async function addProjectToStudio(studioId) {
    try {
        const url = `https://api.scratch.mit.edu/studios/${studioId}/projects/${PROJECT_ID}`;
        
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Cookie': `scratchsessionsid=${SESSIONID};`,
                'X-CSRF-Token': CSRF_TOKEN,
                'X-Requested-With': 'XMLHttpRequest',
                'Referer': `https://scratch.mit.edu/studios/${studioId}/`,
                'Origin': 'https://scratch.mit.edu',
                'Content-Type': 'application/json'
            }
        });

        if (res.ok) {
            console.log(`[成功] スタジオ ID: ${studioId} にプロジェクトを追加しました！`);
        } else {
            const errText = await res.text();
            console.log(`[スキップ/失敗] スタジオ ID: ${studioId} (ステータス: ${res.status} - ${errText})`);
        }
    } catch (e) {
        console.error(`[エラー] スタジオ ID ${studioId} への追加失敗:`, e.message);
    }
}

async function main() {
    console.log("=== ボット実行開始 ===");
    
    for (const keyword of SEARCH_KEYWORDS) {
        console.log(`「${keyword}」でスタジオを検索中...`);
        const studios = await searchStudios(keyword);
        
        for (const studio of studios) {
            const studioId = studio.id;
            await addProjectToStudio(studioId);
            
            // サーバーに負荷をかけないためのウェイト (3秒待機)
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }
    
    console.log("=== 処理完了 ===");
}

main();
