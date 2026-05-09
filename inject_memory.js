require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function main() {
    // 检查环境变量
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.error('❌ 请设置环境变量 SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY');
        process.exit(1);
    }

    // 初始化 Supabase 客户端
    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 读取角色数据
    let characters;
    try {
        const data = fs.readFileSync('./characters.json', 'utf8');
        characters = JSON.parse(data).characters;
        console.log(`✅ 成功读取 ${characters.length} 个角色`);
    } catch (error) {
        console.error('❌ 读取 characters.json 失败:', error.message);
        process.exit(1);
    }

    // 批量插入数据
    const chunkSize = 10;
    let totalInserted = 0;

    for (let i = 0; i < characters.length; i += chunkSize) {
        const chunk = characters.slice(i, i + chunkSize);
        
        const { error } = await supabase
            .from('characters')
            .insert(chunk);

        if (error) {
            console.error('❌ 插入数据失败:', error.message);
            process.exit(1);
        }

        totalInserted += chunk.length;
        console.log(`📥 已插入 ${totalInserted}/${characters.length} 个角色`);
    }

    console.log('\n🎉 导入完成！所有角色已成功插入 Supabase 数据库');
    
    // 验证插入结果
    const { count } = await supabase
        .from('characters')
        .select('id', { count: 'exact', head: true });
    
    console.log(`📊 数据库中当前共有 ${count} 个角色`);
}

main().catch(error => {
    console.error('❌ 脚本执行失败:', error.message);
    process.exit(1);
});
