require('dotenv').config();

const fetch = require('node-fetch');

// 配置
const SUPABASE_URL = 'https://dhsyfimtdxtmzmoqfwdj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImLoc3lmaW10ZHh0bXptb3Fmd2RqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDgwNjY1NDUsImV4cCI6MjAyMzY0MjU0NX0.Q9q2f0X7bZ8tY7U0Z5B7N7N7O7O7O7O7O7O7O7O7';
const FAL_API_KEY = '859ee451-e739-442d-8b52-8accd79a8996:abd2107b55b9b04565bf6c9f3d145632';
const BATCH_SIZE = 5;
const DELAY_BETWEEN_BATCHES = 30000; // 30秒
const DELAY_BETWEEN_REQUESTS = 5000; // 5秒

// 获取所有角色
async function getCharacters() {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/characters?select=id,visual_desc,avatar_url&order=id`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`获取角色失败: ${response.status} - ${errorData.message || '未知错误'}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`获取角色失败: ${error.message}`);
        return null;
    }
}

// 调用Fal.ai API生成图片
async function generateImage(prompt) {
    try {
        const response = await fetch('https://api.fal.ai/v1/inference/fal-ai/flux/schnell', {
            method: 'POST',
            headers: {
                'Authorization': `Key ${FAL_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: prompt,
                image_size: '512x512'
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`API调用失败: ${response.status} - ${errorData.detail || errorData.message || '未知错误'}`);
        }

        const data = await response.json();
        return data.images?.[0]?.url || null;
    } catch (error) {
        console.error(`图片生成失败: ${error.message}`);
        return null;
    }
}

// 更新角色头像URL
async function updateAvatarUrl(characterId, avatarUrl) {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/characters?id=eq.${characterId}`, {
            method: 'PATCH',
            headers: {
                'apikey': SUPABASE_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ avatar_url: avatarUrl })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`更新失败: ${response.status} - ${errorData.message || '未知错误'}`);
        }

        return true;
    } catch (error) {
        console.error(`更新角色 ${characterId} 失败: ${error.message}`);
        return false;
    }
}

// 延迟函数
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 主函数
async function main() {
    console.log('========== 开始批量生成角色头像 ==========');
    console.log(`配置信息:`);
    console.log(`  Supabase URL: ${SUPABASE_URL}`);
    console.log(`  批量大小: ${BATCH_SIZE}`);
    console.log(`  批次间隔: ${DELAY_BETWEEN_BATCHES / 1000}秒`);
    console.log('==========================================\n');

    try {
        // 获取所有角色
        const characters = await getCharacters();

        if (!characters || characters.length === 0) {
            console.log('未找到任何角色');
            return;
        }

        console.log(`共找到 ${characters.length} 个角色`);

        // 过滤掉已有头像的角色
        const charactersWithoutAvatar = characters.filter(c => !c.avatar_url || c.avatar_url.trim() === '');
        console.log(`需要生成头像的角色: ${charactersWithoutAvatar.length} 个\n`);

        if (charactersWithoutAvatar.length === 0) {
            console.log('所有角色都已有头像，无需生成');
            return;
        }

        // 分批处理
        const totalBatches = Math.ceil(charactersWithoutAvatar.length / BATCH_SIZE);
        let successCount = 0;
        let failCount = 0;

        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
            const start = batchIndex * BATCH_SIZE;
            const end = Math.min(start + BATCH_SIZE, charactersWithoutAvatar.length);
            const batch = charactersWithoutAvatar.slice(start, end);

            console.log(`\n========== 处理批次 ${batchIndex + 1}/${totalBatches} ==========`);
            console.log(`处理角色 ${start + 1}-${end}`);

            // 逐个处理批次中的角色
            for (const character of batch) {
                console.log(`\n处理角色 #${character.id}`);
                console.log(`Prompt: ${character.visual_desc.substring(0, 100)}...`);

                // 生成图片
                const imageUrl = await generateImage(character.visual_desc);

                if (imageUrl) {
                    console.log(`生成成功: ${imageUrl}`);

                    // 更新数据库
                    const updateSuccess = await updateAvatarUrl(character.id, imageUrl);
                    if (updateSuccess) {
                        console.log(`更新成功`);
                        successCount++;
                    } else {
                        console.log(`更新失败`);
                        failCount++;
                    }
                } else {
                    console.log(`生成失败`);
                    failCount++;
                }

                // 角色之间的延迟
                await delay(DELAY_BETWEEN_REQUESTS);
            }

            // 批次之间的延迟（最后一批不需要）
            if (batchIndex < totalBatches - 1) {
                console.log(`\n等待 ${DELAY_BETWEEN_BATCHES / 1000} 秒后继续下一批...`);
                await delay(DELAY_BETWEEN_BATCHES);
            }
        }

        // 输出最终统计
        console.log('\n========== 任务完成 ==========');
        console.log(`总角色数: ${characters.length}`);
        console.log(`成功生成并更新: ${successCount} 个`);
        console.log(`失败: ${failCount} 个`);
        console.log(`已有头像跳过: ${characters.length - charactersWithoutAvatar.length} 个`);
        console.log('==============================');

    } catch (error) {
        console.error(`程序出错: ${error.message}`);
        process.exit(1);
    }
}

main();