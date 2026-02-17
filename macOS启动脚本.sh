#!/bin/bash

################################################################################
# NaviHive macOS 本地启动脚本
# 适用于 macOS 11.7.10 (20G1427), Intel Core i7 四核 2.3GHz
################################################################################

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目根目录
PROJECT_DIR="/Users/zgh/Desktop/workspace/Cloudflare-Navihive"
cd "$PROJECT_DIR"

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查命令是否存在
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# 检查环境
check_environment() {
    print_info "检查系统环境..."

    # 检查操作系统
    if [[ "$(uname)" != "Darwin" ]]; then
        print_error "此脚本仅适用于 macOS"
        exit 1
    fi

    # 检查 macOS 版本
    MACOS_VERSION=$(sw_vers -productVersion)
    print_info "macOS 版本: $MACOS_VERSION"

    # 检查 Node.js
    if ! command_exists node; then
        print_error "Node.js 未安装，请先安装 Node.js"
        print_info "建议使用: brew install node"
        exit 1
    fi

    NODE_VERSION=$(node --version)
    print_success "Node.js: $NODE_VERSION"

    # 检查 npm
    if ! command_exists npm; then
        print_error "npm 未安装"
        exit 1
    fi

    NPM_VERSION=$(npm --version)
    print_success "npm: $NPM_VERSION"

    # 检查 Wrangler
    if command_exists wrangler; then
        WRANGLER_VERSION=$(wrangler --version)
        print_success "Wrangler: $WRANGLER_VERSION"
    else
        print_warning "Wrangler 未安装，将安装..."
        npm install -g wrangler
    fi

    echo
}

# 安装依赖
install_dependencies() {
    print_info "检查依赖..."

    if [ ! -d "node_modules" ]; then
        print_info "安装项目依赖..."
        npm install
        print_success "依赖安装完成"
    else
        print_success "依赖已存在"
    fi

    echo
}

# 初始化数据库
init_database() {
    print_info "检查本地数据库..."

    # 检查是否已创建本地数据库
    if ! wrangler d1 info mynav-local --local >/dev/null 2>&1; then
        print_warning "本地数据库不存在，创建中..."
        wrangler d1 create mynav-local || true
        print_info "初始化数据库表..."
        wrangler d1 execute mynav-local --local --file=./init_table.sql
        print_success "数据库初始化完成"
    else
        print_success "数据库已存在"
    fi

    echo
}

# 构建项目
build_project() {
    print_info "构建项目..."
    npm run build
    print_success "构建完成"
    echo
}

# 启动菜单
show_menu() {
    echo
    echo "==================================================="
    echo "       NaviHive macOS 本地部署启动脚本"
    echo "==================================================="
    echo
    echo "请选择启动方式:"
    echo
    echo "  1) 前端开发模式（Mock 数据，无需后端）"
    echo "  2) 本地完整部署（前端 + Worker）"
    echo "  3) 分离式开发（Worker + 前端热更新）"
    echo "  4) 仅启动 Worker API"
    echo "  5) 仅启动前端（连接真实 API）"
    echo "  6) 部署到 Cloudflare"
    echo "  7) 初始化数据库"
    echo "  8) 退出"
    echo
    echo -n "请输入选项 [1-8]: "
}

# 启动前端开发模式
start_frontend_dev() {
    print_info "启动前端开发服务器（Mock 数据模式）..."
    print_success "访问地址: http://localhost:5173"
    echo
    npm run dev
}

# 启动本地完整部署
start_full_local() {
    print_info "启动本地完整部署..."
    print_success "访问地址: http://localhost:8788"
    echo
    wrangler dev --config wrangler.local.jsonc --port 8788
}

# 启动分离式开发
start_separated_dev() {
    print_info "启动分离式开发模式..."
    print_info "Worker API: http://localhost:8788"
    print_success "前端开发: http://localhost:5173"
    echo

    # 创建后台进程目录
    mkdir -p .dev

    # 启动 Worker（后台）
    print_info "启动 Worker API..."
    nohup wrangler dev --config wrangler.local.jsonc --port 8788 > .dev/worker.log 2>&1 &
    WORKER_PID=$!
    echo $WORKER_PID > .dev/worker.pid

    # 等待 Worker 启动
    sleep 5

    # 启动前端
    print_info "启动前端开发服务器..."
    VITE_USE_REAL_API=true VITE_API_BASE_URL=http://localhost:8788 npm run dev

    # 清理后台进程
    kill $WORKER_PID 2>/dev/null || true
}

# 仅启动 Worker
start_worker_only() {
    print_info "启动 Worker API..."
    print_success "API 地址: http://localhost:8788"
    echo
    wrangler dev --config wrangler.local.jsonc --port 8788
}

# 仅启动前端
start_frontend_with_api() {
    print_info "启动前端（连接真实 API）..."
    print_success "访问地址: http://localhost:5173"
    echo
    VITE_USE_REAL_API=true VITE_API_BASE_URL=http://localhost:8788 npm run dev
}

# 部署到 Cloudflare
deploy_to_cloudflare() {
    print_info "部署到 Cloudflare..."
    print_warning "确保已登录 Cloudflare: wrangler login"
    echo

    # 构建项目
    build_project

    # 部署
    print_info "正在部署..."
    wrangler deploy

    print_success "部署完成！"
}

# 初始化数据库
reset_database() {
    print_warning "这将重新初始化数据库，所有数据将被清空"
    read -p "确认继续? [y/N] " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "初始化数据库..."
        wrangler d1 execute mynav-local --local --file=./init_table.sql
        print_success "数据库初始化完成"
    else
        print_info "已取消"
    fi

    echo
}

# 主函数
main() {
    check_environment
    install_dependencies

    while true; do
        show_menu
        read -r choice

        case $choice in
            1)
                start_frontend_dev
                ;;
            2)
                init_database
                start_full_local
                ;;
            3)
                init_database
                start_separated_dev
                ;;
            4)
                init_database
                start_worker_only
                ;;
            5)
                start_frontend_with_api
                ;;
            6)
                deploy_to_cloudflare
                ;;
            7)
                reset_database
                ;;
            8)
                print_info "退出"
                exit 0
                ;;
            *)
                print_error "无效的选项"
                ;;
        esac

        echo
        read -p "按 Enter 继续..."
    done
}

# 运行主函数
main
