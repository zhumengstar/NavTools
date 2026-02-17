#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
合并两个JSON书签文件并生成SQL语句
用法: python merge_bookmarks_to_sql.py

功能：
1. 合并两个JSON文件的分组和站点
2. 提取通用网站（GitHub、Google等常用工具）到"常用工具"分组
3. 将博客学习资料（CSDN、知乎、博客园等）放到最后一个分组
"""

import json
import os
from urllib.parse import urlparse

# 文件路径
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKUP_FILE = os.path.join(SCRIPT_DIR, "导航站备份_2026-02-05.json")
RESULT_FILE = os.path.join(SCRIPT_DIR, "result.json")
OUTPUT_SQL = os.path.join(SCRIPT_DIR, "import_data.sql")

# 常用工具网站域名 - 提取到"常用工具"分组
COMMON_TOOLS_DOMAINS = {
    "github.com",
    "google.com",
    "youtube.com",
    "stackoverflow.com",
    "cloudflare.com",
    "console.cloud.google.com",
    "gemini.google.com",
    "chat.openai.com",
    "chat.deepseek.com",
    "app.diagrams.net",
    "notebooklm.google.com",
    "tasks.google.com",
    "arxiv.org",
    "developer.aliyun.com",
    "cloud.tencent.com",
    "aws.amazon.com",
    "spring.io",
    "maven.org",
    "npmjs.com",
    "pypi.org",
    "docker.com",
    "hub.docker.com",
    "kubernetes.io",
    "reactjs.org",
    "vuejs.org",
    "angular.io",
    "nodejs.org",
}

# 博客/学习资料网站域名 - 放到"博客学习资料"分组（最后）
BLOG_LEARNING_DOMAINS = {
    "csdn.net",
    "blog.csdn.net",
    "zhihu.com",
    "zhuanlan.zhihu.com",
    "cnblogs.com",
    "jianshu.com",
    "segmentfault.com",
    "juejin.cn",
    "juejin.im",
    "oschina.net",
    "iteye.com",
    "51cto.com",
    "blog.51cto.com",
    "infoq.cn",
    "v2ex.com",
    "nowcoder.com",
    "leetcode.cn",
    "leetcode.com",
    "geeksforgeeks.org",
    "runoob.com",
    "w3school.com.cn",
    "菜鸟教程",
    "baidu.com",
    "baijiahao.baidu.com",
    "wenku.baidu.com",
    "jingyan.baidu.com",
    "sohu.com",
    "360doc.com",
    "bokeyuan.net",
    "ibm.com",  # IBM 文档
    "docs.oracle.com",
    "testerhome.com",
    "modb.pro",  # 墨天轮
    "talkwithtrend.com",
    "jb51.net",  # 脚本之家
    "yiibai.com",  # 易百教程
    "ruanyifeng.com",  # 阮一峰博客
    "liaoxuefeng.com",
    "how2j.cn",
    "docs4dev.com",
    "apachecn.org",
    "gitbook.io",
    "readthedocs.io",
}


def get_domain(url):
    """从URL提取域名"""
    try:
        parsed = urlparse(url)
        domain = parsed.netloc.lower()
        # 移除 www. 前缀
        if domain.startswith("www."):
            domain = domain[4:]
        return domain
    except:
        return ""


def match_domain(url, domain_set):
    """检查URL是否匹配域名集合中的任一域名"""
    domain = get_domain(url)
    if not domain:
        return False
    
    # 精确匹配
    if domain in domain_set:
        return True
    
    # 子域名匹配 (如 blog.csdn.net 匹配 csdn.net)
    for d in domain_set:
        if domain.endswith("." + d) or domain == d:
            return True
    
    return False


def escape_sql_string(s):
    """转义SQL字符串中的特殊字符"""
    if s is None:
        return ""
    return str(s).replace("'", "''")


def load_json_file(filepath):
    """加载JSON文件"""
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


def merge_data(backup_data, result_data):
    """
    合并两个数据集
    1. 保留原有分组
    2. 提取通用工具网站到"常用工具"分组
    3. 将博客学习资料放到最后一个分组
    """
    
    # 使用字典来合并分组（按名称去重）
    groups_by_name = {}
    
    # 首先添加 result.json 的分组（作为基础）
    for group in result_data.get("groups", []):
        groups_by_name[group["name"]] = {
            "name": group["name"],
            "order_num": group.get("order_num", 0),
            "is_public": group.get("is_public", 1),
            "original_id": group.get("id")
        }
    
    # 然后添加 backup 中独有的分组
    next_order = len(groups_by_name)
    for group in backup_data.get("groups", []):
        if group["name"] not in groups_by_name:
            groups_by_name[group["name"]] = {
                "name": group["name"],
                "order_num": next_order,
                "is_public": group.get("is_public", 1),
                "original_id": group.get("id"),
                "from_backup": True
            }
            next_order += 1
    
    # 添加两个新分组：常用工具 和 博客学习资料
    if "常用工具" not in groups_by_name:
        groups_by_name["常用工具"] = {
            "name": "常用工具",
            "order_num": 0,  # 放在最前面
            "is_public": 1,
        }
    
    if "博客学习资料" not in groups_by_name:
        groups_by_name["博客学习资料"] = {
            "name": "博客学习资料",
            "order_num": 9999,  # 放在最后
            "is_public": 1,
        }
    
    # 重新排序分组，确保：常用工具在前，博客学习资料在最后
    sorted_groups = []
    common_tools = None
    blog_learning = None
    other_groups = []
    
    for name, info in groups_by_name.items():
        if name == "常用工具":
            common_tools = info
        elif name == "博客学习资料":
            blog_learning = info
        else:
            other_groups.append(info)
    
    # 按原始 order_num 排序其他分组
    other_groups.sort(key=lambda x: x.get("order_num", 0))
    
    # 组合最终顺序：常用工具 -> 其他分组 -> 博客学习资料
    if common_tools:
        sorted_groups.append(common_tools)
    sorted_groups.extend(other_groups)
    if blog_learning:
        sorted_groups.append(blog_learning)
    
    # 重新分配 order_num 和生成最终分组列表
    final_groups = []
    group_name_to_id = {}
    
    for idx, group_info in enumerate(sorted_groups, start=1):
        final_groups.append({
            "id": idx,
            "name": group_info["name"],
            "order_num": idx - 1,
            "is_public": group_info.get("is_public", 1)
        })
        group_name_to_id[group_info["name"]] = idx
    
    # 创建旧分组ID到名称的映射
    result_group_id_to_name = {g["id"]: g["name"] for g in result_data.get("groups", [])}
    backup_group_id_to_name = {g["id"]: g["name"] for g in backup_data.get("groups", [])}
    
    # 合并站点（按URL去重）并根据域名分类
    sites_by_url = {}
    
    # 处理 result.json 的站点
    for site in result_data.get("sites", []):
        url = site["url"]
        old_group_id = site.get("group_id")
        original_group_name = result_group_id_to_name.get(old_group_id, "其他")
        
        # 根据域名决定分组
        if match_domain(url, COMMON_TOOLS_DOMAINS):
            target_group = "常用工具"
        elif match_domain(url, BLOG_LEARNING_DOMAINS):
            target_group = "博客学习资料"
        else:
            target_group = original_group_name
        
        if target_group in group_name_to_id:
            new_group_id = group_name_to_id[target_group]
            sites_by_url[url] = {
                "group_id": new_group_id,
                "group_name": target_group,
                "name": site["name"],
                "url": url,
                "icon": site.get("icon", ""),
                "description": site.get("description", ""),
                "notes": site.get("notes", ""),
                "order_num": site.get("order_num", 0),
                "is_public": site.get("is_public", 1)
            }
    
    # 处理 backup 中独有的站点
    for site in backup_data.get("sites", []):
        url = site["url"]
        if url not in sites_by_url:
            old_group_id = site.get("group_id")
            original_group_name = backup_group_id_to_name.get(old_group_id, "其他")
            
            # 根据域名决定分组
            if match_domain(url, COMMON_TOOLS_DOMAINS):
                target_group = "常用工具"
            elif match_domain(url, BLOG_LEARNING_DOMAINS):
                target_group = "博客学习资料"
            else:
                target_group = original_group_name
            
            if target_group in group_name_to_id:
                new_group_id = group_name_to_id[target_group]
                sites_by_url[url] = {
                    "group_id": new_group_id,
                    "group_name": target_group,
                    "name": site["name"],
                    "url": url,
                    "icon": site.get("icon", ""),
                    "description": site.get("description", ""),
                    "notes": site.get("notes", ""),
                    "order_num": site.get("order_num", 0),
                    "is_public": site.get("is_public", 1)
                }
    
    # 生成最终站点列表
    final_sites = list(sites_by_url.values())
    
    # 按分组和order_num排序
    final_sites.sort(key=lambda s: (s["group_id"], s["order_num"]))
    
    # 重新分配每个分组内的 order_num
    current_group = None
    order_in_group = 0
    for site in final_sites:
        if site["group_id"] != current_group:
            current_group = site["group_id"]
            order_in_group = 0
        site["order_num"] = order_in_group
        order_in_group += 1
    
    # 给站点分配新的ID
    for idx, site in enumerate(final_sites, start=1):
        site["id"] = idx
    
    # 合并配置（优先使用 backup 的配置）
    configs = {**result_data.get("configs", {}), **backup_data.get("configs", {})}
    
    # 统计各分组站点数量
    group_stats = {}
    for site in final_sites:
        group_name = site["group_name"]
        group_stats[group_name] = group_stats.get(group_name, 0) + 1
    
    print("\n分组站点统计:")
    for group in final_groups:
        count = group_stats.get(group["name"], 0)
        print(f"  {group['name']}: {count} 个站点")
    
    return final_groups, final_sites, configs


def generate_sql(groups, sites, configs):
    """生成SQL语句"""
    sql_lines = []
    
    # 添加头部注释
    sql_lines.append("-- ================================")
    sql_lines.append("-- 导航站数据导入SQL")
    sql_lines.append("-- 自动生成于: 2026-02-05")
    sql_lines.append("-- 功能: 合并书签并按类型分组")
    sql_lines.append("-- ================================")
    sql_lines.append("")
    
    # 禁用外键检查
    sql_lines.append("-- 禁用外键检查")
    sql_lines.append("PRAGMA foreign_keys = OFF;")
    sql_lines.append("")
    
    # 清空现有数据（先删sites再删groups）
    sql_lines.append("-- 清空现有数据")
    sql_lines.append("DELETE FROM sites;")
    sql_lines.append("DELETE FROM groups;")
    sql_lines.append("DELETE FROM configs;")
    sql_lines.append("")
    
    # 重置自增序列
    sql_lines.append("-- 重置自增序列")
    sql_lines.append("DELETE FROM sqlite_sequence WHERE name='groups';")
    sql_lines.append("DELETE FROM sqlite_sequence WHERE name='sites';")
    sql_lines.append("")
    
    # 插入分组数据（明确指定ID）
    sql_lines.append("-- ================================")
    sql_lines.append(f"-- 插入分组数据 (共 {len(groups)} 个)")
    sql_lines.append("-- ================================")
    
    for group in groups:
        group_id = group["id"]
        name = escape_sql_string(group["name"])
        order_num = group["order_num"]
        is_public = group.get("is_public", 1)
        sql_lines.append(
            f"INSERT INTO groups (id, name, order_num, is_public) VALUES ({group_id}, '{name}', {order_num}, {is_public});"
        )
    
    sql_lines.append("")
    
    # 插入站点数据
    sql_lines.append("-- ================================")
    sql_lines.append(f"-- 插入站点数据 (共 {len(sites)} 个)")
    sql_lines.append("-- ================================")
    
    for site in sites:
        group_id = site["group_id"]
        name = escape_sql_string(site["name"])
        url = escape_sql_string(site["url"])
        icon = escape_sql_string(site.get("icon", ""))
        description = escape_sql_string(site.get("description", ""))
        notes = escape_sql_string(site.get("notes", ""))
        order_num = site["order_num"]
        is_public = site.get("is_public", 1)
        
        sql_lines.append(
            f"INSERT INTO sites (group_id, name, url, icon, description, notes, order_num, is_public) "
            f"VALUES ({group_id}, '{name}', '{url}', '{icon}', '{description}', '{notes}', {order_num}, {is_public});"
        )
    
    sql_lines.append("")
    
    # 插入配置数据
    sql_lines.append("-- ================================")
    sql_lines.append(f"-- 插入配置数据 (共 {len(configs)} 个)")
    sql_lines.append("-- ================================")
    
    for key, value in configs.items():
        key_escaped = escape_sql_string(key)
        value_escaped = escape_sql_string(value)
        sql_lines.append(
            f"INSERT INTO configs (key, value) VALUES ('{key_escaped}', '{value_escaped}');"
        )
    
    sql_lines.append("")
    
    # 重新启用外键检查
    sql_lines.append("-- 重新启用外键检查")
    sql_lines.append("PRAGMA foreign_keys = ON;")
    
    return "\n".join(sql_lines)


def main():
    print("正在加载JSON文件...")
    
    # 加载数据
    backup_data = load_json_file(BACKUP_FILE)
    result_data = load_json_file(RESULT_FILE)
    
    print(f"备份文件: {len(backup_data.get('groups', []))} 个分组, {len(backup_data.get('sites', []))} 个站点")
    print(f"结果文件: {len(result_data.get('groups', []))} 个分组, {len(result_data.get('sites', []))} 个站点")
    
    # 合并数据
    print("\n正在合并数据并按类型分组...")
    groups, sites, configs = merge_data(backup_data, result_data)
    
    print(f"\n合并后总计: {len(groups)} 个分组, {len(sites)} 个站点, {len(configs)} 个配置项")
    
    # 生成SQL
    print("\n正在生成SQL...")
    sql_content = generate_sql(groups, sites, configs)
    
    # 写入文件
    with open(OUTPUT_SQL, "w", encoding="utf-8") as f:
        f.write(sql_content)
    
    print(f"\nSQL文件已生成: {OUTPUT_SQL}")
    print("完成!")


if __name__ == "__main__":
    main()
