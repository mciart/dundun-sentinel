#!/bin/bash

# 炖炖守望 - 本地测试启动脚本

echo "========================================="
echo "  炖炖守望 - 本地开发环境"
echo "========================================="
echo ""

# 检查是否已安装依赖
if [ ! -d "node_modules" ]; then
  echo "📦 检测到未安装依赖，开始安装..."
  npm install
  echo ""
fi

# 检查前端依赖
if [ ! -d "frontend/node_modules" ]; then
  echo "📦 安装前端依赖..."
  cd frontend
  npm install
  cd ..
  echo ""
fi

# 构建前端
echo "🔨 构建前端..."
cd frontend
npm run build
cd ..
echo ""

# 检查是否配置了 KV
if ! grep -q "id = " wrangler.toml; then
  echo "⚠️  未检测到 KV 配置"
  echo ""
  echo "选择运行模式："
  echo "  1) 本地模式（推荐，无需配置）"
  echo "  2) 完整模式（需要 Cloudflare KV）"
  echo ""
  read -p "请选择 (1/2): " choice
  echo ""
  
  if [ "$choice" = "2" ]; then
    echo "📋 请按以下步骤配置："
    echo ""
    echo "1. 运行: npx wrangler login"
    echo "2. 运行: npx wrangler kv:namespace create MONITOR_DATA"
    echo "3. 将返回的 ID 填入 wrangler.toml"
    echo "4. 重新运行此脚本"
    echo ""
    exit 0
  fi
  
  echo "🚀 使用本地模式启动..."
  echo ""
  echo "访问地址: http://localhost:8787"
  echo "默认密码: admin123456"
  echo ""
  echo "按 Ctrl+C 停止服务"
  echo ""
  npx wrangler dev --local
else
  echo "🚀 启动开发服务器..."
  echo ""
  echo "访问地址: http://localhost:8787"
  echo "默认密码: admin123456"
  echo ""
  echo "按 Ctrl+C 停止服务"
  echo ""
  npx wrangler dev
fi
