#!/bin/bash

################################################################################
# NaviHive 本地开发启动脚本
#
# 使用方法:
#   chmod +x 启动脚本.sh
#   ./启动脚本.sh
################################################################################

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_header() {
    echo ""
    echo -e "${GREEN}================================${NC}"
    echo -e "${GREEN}  $1${NC}"
    echo -e "${GREEN}================================${NC}"
    echo ""
}

# 检查命令是否存在
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# 检查 Node.js
check_node() {
    print_info "检查 Node.js..."

    if ! command_exists node; then
        print_error "未找到 Node.js，请先安装 Node.js"
        print_info "下载地址: https://nodejs.org/"
        exit 1
    fi

    NODE_VERSION=$(node -v)
    print_success "Node.js 版本: $NODE_VERSION"

    # 检查版本是否 >= 18
    MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
    if [ "$MAJOR_VERSION" -lt 18 ]; then
        print_warning "Node.js 版本过低，建议升级到 18 或更高版本"
    fi
}

# 检查包管理器
check_package_manager() {
    print_info "检查包管理器..."

    if command_exists pnpm; then
        PKG_MANAGER="pnpm"
        print_success "找到包管理器: pnpm"
    elif command_exists npm; then
        PKG_MANAGER="npm"
        print_success "找到包管理器: npm"
    else
        print_error "未找到包管理器 (npm 或 pnpm)"
        exit 1
    fi
}

# 检查依赖是否已安装
check_dependencies() {
    print_info "检查项目依赖..."

    if [ -d "node_modules" ]; then
        print_success "依赖已安装"
        return 0
    else
        print_warning "依赖未安装，将开始安装..."
        return 1
    fi
}

# 安装依赖
install_dependencies() {
    print_header "安装项目依赖"

    if [ "$PKG_MANAGER" = "pnpm" ]; then
        pnpm install
    else
        npm install
    fi

    print_success "依赖安装完成"
}

# 检查 Wrangler
check_wrangler() {
    print_info "检查 Wrangler CLI..."

    if command_exists wrangler; then
        print_success "Wrangler 已安装"
    else
        print_warning "Wrangler 未安装"
        print_info "是否现在安装 Wrangler? (y/n)"
        read -r INSTALL_WRANGLER

        if [ "$INSTALL_WRANGLER" = "y" ] || [ "$INSTALL_WRANGLER" = "Y" ]; then
            print_info "安装 Wrangler..."
            if [ "$PKG_MANAGER" = "pnpm" ]; then
                pnpm add -g wrangler
            else
                npm install -g wrangler
            fi
            print_success "Wrangler 安装完成"
        else
            print_warning "跳过 Wrangler 安装"
        fi
    fi
}

# 检查本地数据库配置
check_local_db() {
    print_info "检查本地数据库配置..."

    if [ -f "wrangler.local.jsonc" ]; then
        print_success "找到本地数据库配置: wrangler.local.jsonc"
    elif [ -f "wrangler.jsonc" ]; then
        print_warning "未找到 wrangler.local.jsonc"
        print_info "将使用 wrangler.jsonc（生产配置）"
        print_warning "建议创建 wrangler.local.jsonc 用于本地开发"
    else
        print_warning "未找到 Wrangler 配置文件"
        print_info "创建本地开发需要先配置 wrangler.local.jsonc"
        print_info "请参考《本地运行指南.md》文档"
    fi
}

# 选择启动模式
select_mode() {
    print_header "选择启动模式"
    echo "1) 前端开发模式 (Mock 数据，快速启动)"
    echo "2) 完整开发模式 (前端 + Worker，需要配置数据库)"
    echo "3) 退出"
    echo ""
    read -p "请选择模式 (1-3): " MODE

    case $MODE in
        1)
            MODE="frontend"
            ;;
        2)
            MODE="full"
            ;;
        3)
            print_info "退出"
            exit 0
            ;;
        *)
            print_error "无效选择"
            exit 1
            ;;
    esac
}

# 启动前端开发服务器
start_frontend() {
    print_header "启动前端开发服务器"

    print_info "启动命令: $PKG_MANAGER dev"
    print_info "访问地址: http://localhost:5173"
    print_info ""
    print_info "按 Ctrl+C 停止服务器"
    echo ""

    $PKG_MANAGER dev
}

# 启动完整开发环境
start_full() {
    print_header "启动完整开发环境"

    # 检查是否配置了本地数据库
    if [ ! -f "wrangler.local.jsonc" ]; then
        print_error "未找到 wrangler.local.jsonc"
        print_info "请先创建并配置 wrangler.local.jsonc"
        print_info "参考《本地运行指南.md》的 方式二 步骤 2-4"
        exit 1
    fi

    # 创建启动脚本
    cat > start-worker.sh <<'EOF'
#!/bin/bash
echo "🔧 启动 Worker 服务器..."
wrangler dev --config wrangler.local.jsonc
EOF
    chmod +x start-worker.sh

    cat > start-frontend.sh <<'EOF'
#!/bin/bash
echo "🎨 启动前端服务器..."
export VITE_USE_REAL_API=true
$PKG_MANAGER dev
EOF
    chmod +x start-frontend.sh

    print_success "已创建启动脚本"
    echo ""
    print_info "请在新终端窗口中执行以下命令："
    echo ""
    echo -e "${YELLOW}终端 1 (Worker):${NC}"
    echo "  ./start-worker.sh"
    echo ""
    echo -e "${YELLOW}终端 2 (前端):${NC}"
    echo "  ./start-frontend.sh"
    echo ""
    print_info "访问地址:"
    echo "  前端: http://localhost:5173"
    echo "  API:  http://localhost:8788"
    echo ""
    print_info "按任意键退出，或按 Ctrl+C 在当前终端启动 Worker..."
    read -n 1 -s

    # 启动 Worker
    wrangler dev --config wrangler.local.jsonc
}

# 显示运行信息
show_info() {
    print_header "开发环境信息"
    echo "包管理器: $PKG_MANAGER"
    echo "启动模式: $MODE"
    echo ""
    print_info "有用链接:"
    echo "  前端文档: https://vitejs.dev/"
    echo "  Worker 文档: https://developers.cloudflare.com/workers/"
    echo "  项目文档: ./本地运行指南.md"
}

# 主函数
main() {
    print_header "NaviHive 本地开发环境"

    # 检查环境
    check_node
    check_package_manager

    # 检查依赖
    if ! check_dependencies; then
        install_dependencies
    fi

    # 检查 Wrangler
    check_wrangler

    # 检查数据库配置
    check_local_db

    # 选择启动模式
    select_mode

    # 显示信息
    show_info

    # 启动
    if [ "$MODE" = "frontend" ]; then
        start_frontend
    elif [ "$MODE" = "full" ]; then
        start_full
    fi
}

# 运行主函数
main
