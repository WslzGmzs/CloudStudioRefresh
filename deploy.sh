#!/bin/bash

# CloudStudio 监控管理系统部署脚本
# 用于自动化部署到 Deno Deploy

set -e

echo "🚀 CloudStudio 监控管理系统部署脚本"
echo "======================================"

# 检查 Deno 是否安装
if ! command -v deno &> /dev/null; then
    echo "❌ Deno 未安装，请先安装 Deno"
    echo "安装命令: curl -fsSL https://deno.land/install.sh | sh"
    exit 1
fi

echo "✅ Deno 版本: $(deno --version | head -n1)"

# 检查必要文件
if [ ! -f "cloudStudioRefresh.ts" ]; then
    echo "❌ 找不到 cloudStudioRefresh.ts 文件"
    exit 1
fi

echo "✅ 找到主应用文件"

# 代码检查
echo "🔍 执行代码检查..."
deno check cloudStudioRefresh.ts
echo "✅ 代码检查通过"

# 代码格式化
echo "🎨 格式化代码..."
deno fmt cloudStudioRefresh.ts README.md deno.json
echo "✅ 代码格式化完成"

# 代码 Lint
echo "🔧 执行 Lint 检查..."
deno lint cloudStudioRefresh.ts
echo "✅ Lint 检查通过"

# 运行测试
echo "🧪 运行集成测试..."
timeout 30s deno run --allow-net --allow-kv cloudStudioRefresh.ts --test || {
    echo "⚠️ 测试超时或失败，但继续部署"
}

# 检查 Deno Deploy CLI
if command -v deployctl &> /dev/null; then
    echo "🌐 检测到 Deno Deploy CLI"
    
    read -p "是否要部署到 Deno Deploy? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🚀 部署到 Deno Deploy..."
        
        # 检查是否有项目配置
        if [ -f ".deployctl.json" ]; then
            deployctl deploy
        else
            echo "请先配置 Deno Deploy 项目:"
            echo "1. 访问 https://dash.deno.com/"
            echo "2. 创建新项目"
            echo "3. 运行: deployctl deploy --project=your-project-name cloudStudioRefresh.ts"
        fi
    fi
else
    echo "ℹ️ 未检测到 Deno Deploy CLI"
    echo "安装命令: deno install --allow-read --allow-write --allow-env --allow-net --allow-run --no-check -r -f https://deno.land/x/deploy/deployctl.ts"
fi

echo ""
echo "📋 部署检查清单:"
echo "✅ 代码检查通过"
echo "✅ 格式化完成"
echo "✅ Lint 检查通过"
echo "✅ 集成测试执行"
echo ""
echo "📖 手动部署步骤:"
echo "1. 访问 https://dash.deno.com/"
echo "2. 创建新项目"
echo "3. 上传 cloudStudioRefresh.ts 文件"
echo "4. 设置环境变量 (可选):"
echo "   - PORT: 服务器端口"
echo "5. 部署完成"
echo ""
echo "🎉 部署准备完成！"
