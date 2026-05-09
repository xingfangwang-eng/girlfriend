// 上传脚本 - 用于将角色数据导入 Supabase

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function uploadCharacters() {
    console.log('🚀 开始上传角色数据到 Supabase...');
    
    // 检查环境变量
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.error('❌ 错误：请设置环境变量 SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY');
        console.error('   请在 .env.local 文件中配置这些变量');
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
        const jsonData = JSON.parse(data);
        characters = jsonData.characters || jsonData;
        console.log(`✅ 成功读取 ${characters.length} 个角色`);
    } catch (error) {
        console.error('❌ 读取 characters.json 失败:', error.message);
        process.exit(1);
    }

    // 批量插入数据（每批 10 条）
    const chunkSize = 10;
    let totalInserted = 0;

    for (let i = 0; i < characters.length; i += chunkSize) {
        const chunk = characters.slice(i, i + chunkSize);
        
        console.log(`📤 正在插入第 ${i + 1}-${Math.min(i + chunkSize, characters.length)} 条...`);
        
        const { error } = await supabase
            .from('characters')
            .insert(chunk);

        if (error) {
            console.error('❌ 插入数据失败:', error.message);
            process.exit(1);
        }

        totalInserted += chunk.length;
        console.log(`✅ 已插入 ${totalInserted}/${characters.length} 个角色`);
    }

    // 验证插入结果
    const { count, error: countError } = await supabase
        .from('characters')
        .select('id', { count: 'exact', head: true });

    if (countError) {
        console.error('❌ 查询计数失败:', countError.message);
    } else {
        console.log(`\n📊 数据库中当前共有 ${count} 个角色`);
    }

    console.log('\n🎉 上传完成！所有角色已成功导入 Supabase');
}

// 执行上传
uploadCharacters().catch(error => {
    console.error('❌ 上传失败:', error.message);
    console.error('📋 错误详情:', error.stack);
    process.exit(1);
});
