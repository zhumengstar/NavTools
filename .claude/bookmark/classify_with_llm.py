#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
使用 DeepSeek API 对书签进行智能分类
用法: python classify_with_llm.py

环境变量:
- DEEPSEEK_API_KEY: DeepSeek API密钥
"""

import json
import os
import time
from urllib.parse import urlparse

# DeepSeek API配置
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY", "")
DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions"

# 文件路径
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKUP_FILE = os.path.join(SCRIPT_DIR, "导航站备份_2026-02-05.json")
RESULT_FILE = os.path.join(SCRIPT_DIR, "result.json")
OUTPUT_SQL = os.path.join(SCRIPT_DIR, "import_data.sql")
CLASSIFIED_JSON = os.path.join(SCRIPT_DIR, "classified_bookmarks.json")

# 预定义的分组（让LLM从中选择或建议新分组）
PREDEFINED_GROUPS = [
    "AI与大模型",      # ChatGPT, DeepSeek, Gemini等
    "云服务与平台",     # Cloudflare, AWS, 阿里云等
    "开发工具",        # IDE, 调试工具, 代码托管等
    "编程语言",        # Java, Python, JavaScript等
    "数据库",          # MySQL, Redis, MongoDB等
    "大数据",          # Hadoop, Spark, Flink等
    "前端开发",        # React, Vue, CSS等
    "后端开发",        # Spring, Django, Node.js等
    "DevOps",         # Docker, K8s, CI/CD等
    "机器学习",        # TensorFlow, PyTorch等
    "在线工具",        # 画图, 转换, 计算等
    "技术文档",        # 官方文档, API参考等
    "学习教程",        # 视频教程, 在线课程等
    "技术博客",        # CSDN, 知乎, 博客园等
    "开源项目",        # GitHub项目等
    "工作效率",        # 笔记, 任务管理等
    "求职面试",        # 面经, 刷题等
    "娱乐休闲",        # 视频, 音乐等
    "其他",           # 未分类
]


def call_deepseek_api(messages, max_retries=3):
    """调用DeepSeek API"""
    import urllib.request
    import urllib.error
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {DEEPSEEK_API_KEY}"
    }
    
    data = {
        "model": "deepseek-chat",
        "messages": messages,
        "temperature": 0.3,
        "max_tokens": 2000,
    }
    
    for attempt in range(max_retries):
        try:
            req = urllib.request.Request(
                DEEPSEEK_API_URL,
                data=json.dumps(data).encode("utf-8"),
                headers=headers,
                method="POST"
            )
            
            with urllib.request.urlopen(req, timeout=60) as response:
                result = json.loads(response.read().decode("utf-8"))
                return result["choices"][0]["message"]["content"]
                
        except urllib.error.HTTPError as e:
            print(f"  API错误 (尝试 {attempt + 1}/{max_retries}): {e.code}")
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)
        except Exception as e:
            print(f"  请求错误 (尝试 {attempt + 1}/{max_retries}): {e}")
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)
    
    return None


def classify_batch(sites_batch):
    """批量分类书签"""
    
    # 构建分类提示
    sites_info = []
    for i, site in enumerate(sites_batch):
        sites_info.append(f"{i+1}. 名称: {site['name'][:100]}\n   URL: {site['url']}")
    
    prompt = f"""请对以下网站书签进行分类。

可选分组：
{chr(10).join(f'- {g}' for g in PREDEFINED_GROUPS)}

书签列表：
{chr(10).join(sites_info)}

请直接返回JSON数组，每个元素包含序号和分组名称，格式如下：
[{{"index": 1, "group": "分组名"}}, {{"index": 2, "group": "分组名"}}]

注意：
1. 只返回JSON数组，不要有其他文字
2. 分组名必须从上面的可选分组中选择
3. 如果无法判断，使用"其他"
"""
    
    messages = [
        {"role": "system", "content": "你是一个书签分类助手，根据网站名称和URL判断其所属分组。只返回JSON格式的分类结果。"},
        {"role": "user", "content": prompt}
    ]
    
    response = call_deepseek_api(messages)
    
    if response:
        try:
            # 清理响应，提取JSON
            response = response.strip()
            if response.startswith("```"):
                response = response.split("```")[1]
                if response.startswith("json"):
                    response = response[4:]
            response = response.strip()
            
            results = json.loads(response)
            return results
        except json.JSONDecodeError as e:
            print(f"  JSON解析错误: {e}")
            print(f"  响应内容: {response[:200]}...")
    
    return None


def escape_sql_string(s):
    """转义SQL字符串"""
    if s is None:
        return ""
    return str(s).replace("'", "''")


def load_json_file(filepath):
    """加载JSON文件"""
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


def merge_sites(backup_data, result_data):
    """合并两个数据源的站点（按URL去重）"""
    sites_by_url = {}
    
    # 添加 result.json 的站点
    for site in result_data.get("sites", []):
        sites_by_url[site["url"]] = {
            "name": site["name"],
            "url": site["url"],
            "icon": site.get("icon", ""),
            "description": site.get("description", ""),
            "notes": site.get("notes", ""),
            "is_public": site.get("is_public", 1)
        }
    
    # 添加 backup 中独有的站点
    for site in backup_data.get("sites", []):
        if site["url"] not in sites_by_url:
            sites_by_url[site["url"]] = {
                "name": site["name"],
                "url": site["url"],
                "icon": site.get("icon", ""),
                "description": site.get("description", ""),
                "notes": site.get("notes", ""),
                "is_public": site.get("is_public", 1)
            }
    
    return list(sites_by_url.values())


def generate_sql(classified_sites, configs):
    """生成SQL文件"""
    
    # 统计各分组的站点
    group_sites = {}
    for site in classified_sites:
        group = site.get("group", "其他")
        if group not in group_sites:
            group_sites[group] = []
        group_sites[group].append(site)
    
    # 按分组中站点数量排序（多的在前），但保证"其他"在最后
    sorted_groups = sorted(
        group_sites.keys(),
        key=lambda g: (g == "其他", -len(group_sites[g]))
    )
    
    sql_lines = []
    
    # 头部
    sql_lines.append("-- ================================")
    sql_lines.append("-- 导航站数据导入SQL")
    sql_lines.append("-- 使用 DeepSeek 智能分类")
    sql_lines.append("-- ================================")
    sql_lines.append("")
    sql_lines.append("PRAGMA foreign_keys = OFF;")
    sql_lines.append("")
    sql_lines.append("DELETE FROM sites;")
    sql_lines.append("DELETE FROM groups;")
    sql_lines.append("DELETE FROM configs;")
    sql_lines.append("")
    sql_lines.append("DELETE FROM sqlite_sequence WHERE name='groups';")
    sql_lines.append("DELETE FROM sqlite_sequence WHERE name='sites';")
    sql_lines.append("")
    
    # 插入分组
    sql_lines.append(f"-- 插入分组 (共 {len(sorted_groups)} 个)")
    for idx, group_name in enumerate(sorted_groups, start=1):
        name = escape_sql_string(group_name)
        sql_lines.append(
            f"INSERT INTO groups (id, name, order_num, is_public) VALUES ({idx}, '{name}', {idx-1}, 1);"
        )
    
    sql_lines.append("")
    
    # 插入站点
    total_sites = sum(len(sites) for sites in group_sites.values())
    sql_lines.append(f"-- 插入站点 (共 {total_sites} 个)")
    
    for idx, group_name in enumerate(sorted_groups, start=1):
        sites = group_sites[group_name]
        for order, site in enumerate(sites):
            name = escape_sql_string(site["name"])
            url = escape_sql_string(site["url"])
            icon = escape_sql_string(site.get("icon", ""))
            description = escape_sql_string(site.get("description", ""))
            notes = escape_sql_string(site.get("notes", ""))
            is_public = site.get("is_public", 1)
            
            sql_lines.append(
                f"INSERT INTO sites (group_id, name, url, icon, description, notes, order_num, is_public) "
                f"VALUES ({idx}, '{name}', '{url}', '{icon}', '{description}', '{notes}', {order}, {is_public});"
            )
    
    sql_lines.append("")
    
    # 插入配置
    sql_lines.append(f"-- 插入配置 (共 {len(configs)} 个)")
    for key, value in configs.items():
        key_escaped = escape_sql_string(key)
        value_escaped = escape_sql_string(value)
        sql_lines.append(
            f"INSERT INTO configs (key, value) VALUES ('{key_escaped}', '{value_escaped}');"
        )
    
    sql_lines.append("")
    sql_lines.append("PRAGMA foreign_keys = ON;")
    
    return "\n".join(sql_lines)


def main():
    if not DEEPSEEK_API_KEY:
        print("错误: 请设置环境变量 DEEPSEEK_API_KEY")
        print("例如: set DEEPSEEK_API_KEY=your_api_key")
        return
    
    print("=" * 50)
    print("书签智能分类 - 使用 DeepSeek API")
    print("=" * 50)
    
    # 加载数据
    print("\n[1/4] 加载书签数据...")
    backup_data = load_json_file(BACKUP_FILE)
    result_data = load_json_file(RESULT_FILE)
    
    # 合并站点
    all_sites = merge_sites(backup_data, result_data)
    print(f"  合并后共 {len(all_sites)} 个书签")
    
    # 合并配置
    configs = {**result_data.get("configs", {}), **backup_data.get("configs", {})}
    
    # 批量分类
    print("\n[2/4] 使用 DeepSeek 进行智能分类...")
    batch_size = 20  # 每批处理20个
    classified_sites = []
    
    for i in range(0, len(all_sites), batch_size):
        batch = all_sites[i:i+batch_size]
        batch_num = i // batch_size + 1
        total_batches = (len(all_sites) + batch_size - 1) // batch_size
        
        print(f"  处理批次 {batch_num}/{total_batches} ({len(batch)} 个书签)...")
        
        results = classify_batch(batch)
        
        if results:
            for result in results:
                idx = result.get("index", 0) - 1
                group = result.get("group", "其他")
                if 0 <= idx < len(batch):
                    site = batch[idx].copy()
                    site["group"] = group
                    classified_sites.append(site)
        else:
            # 如果API失败，使用"其他"分组
            print(f"    警告: 批次 {batch_num} 分类失败，使用默认分组")
            for site in batch:
                site_copy = site.copy()
                site_copy["group"] = "其他"
                classified_sites.append(site_copy)
        
        # 避免API限流
        if i + batch_size < len(all_sites):
            time.sleep(1)
    
    # 保存分类结果
    print("\n[3/4] 保存分类结果...")
    with open(CLASSIFIED_JSON, "w", encoding="utf-8") as f:
        json.dump(classified_sites, f, ensure_ascii=False, indent=2)
    print(f"  已保存到: {CLASSIFIED_JSON}")
    
    # 统计分组
    group_stats = {}
    for site in classified_sites:
        group = site.get("group", "其他")
        group_stats[group] = group_stats.get(group, 0) + 1
    
    print("\n分组统计:")
    for group, count in sorted(group_stats.items(), key=lambda x: -x[1]):
        print(f"  {group}: {count} 个")
    
    # 生成SQL
    print("\n[4/4] 生成SQL文件...")
    sql_content = generate_sql(classified_sites, configs)
    
    with open(OUTPUT_SQL, "w", encoding="utf-8") as f:
        f.write(sql_content)
    print(f"  已保存到: {OUTPUT_SQL}")
    
    print("\n" + "=" * 50)
    print("完成！")
    print(f"共分类 {len(classified_sites)} 个书签到 {len(group_stats)} 个分组")
    print("=" * 50)


if __name__ == "__main__":
    main()
