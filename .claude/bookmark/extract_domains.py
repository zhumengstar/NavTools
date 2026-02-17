#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从已分类的书签中提取纯域名站点到单独分组
用法: python extract_domains.py
"""

import json
import os
from urllib.parse import urlparse

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CLASSIFIED_JSON = os.path.join(SCRIPT_DIR, "classified_bookmarks.json")
OUTPUT_SQL = os.path.join(SCRIPT_DIR, "import_data.sql")


def is_root_domain(url):
    """
    判断URL是否为根域名/首页
    严格匹配：只有 https://example.com/ 或 https://example.com 这种才算
    """
    try:
        parsed = urlparse(url)
        path = parsed.path.rstrip('/')
        
        # 路径必须为空
        if path == '' or path == '/':
            # 没有查询参数（或只有很简单的参数）
            if not parsed.query or len(parsed.query) < 20:
                return True
        return False
    except:
        return False


def escape_sql_string(s):
    """转义SQL字符串"""
    if s is None:
        return ""
    return str(s).replace("'", "''")


def main():
    print("=" * 50)
    print("提取纯域名站点到单独分组")
    print("=" * 50)
    
    # 加载已分类的数据
    print("\n[1/3] 加载已分类的书签...")
    with open(CLASSIFIED_JSON, "r", encoding="utf-8") as f:
        sites = json.load(f)
    print(f"  共 {len(sites)} 个书签")
    
    # 区分根域名和其他站点
    print("\n[2/3] 识别纯域名站点（仅匹配首页）...")
    domain_sites = []
    other_sites = []
    
    for site in sites:
        if is_root_domain(site["url"]):
            site["group"] = "常用站点"
            domain_sites.append(site)
        else:
            other_sites.append(site)
    
    print(f"  纯域名站点: {len(domain_sites)} 个")
    print(f"  其他站点: {len(other_sites)} 个")
    
    # 打印一些纯域名示例
    print("\n  纯域名站点列表:")
    for site in domain_sites[:30]:  # 只显示前30个
        try:
            name = site['name'][:50].encode('gbk', errors='replace').decode('gbk')
            print(f"    - {name}: {site['url']}")
        except:
            print(f"    - [name]: {site['url']}")
    
    # 合并站点
    all_sites = domain_sites + other_sites
    
    # 统计各分组
    group_sites = {}
    for site in all_sites:
        group = site.get("group", "其他")
        if group not in group_sites:
            group_sites[group] = []
        group_sites[group].append(site)
    
    # 排序分组：常用站点在最前面，其他在最后
    sorted_groups = sorted(
        group_sites.keys(),
        key=lambda g: (g != "常用站点", g == "其他", -len(group_sites[g]))
    )
    
    print("\n分组统计:")
    for group in sorted_groups:
        print(f"  {group}: {len(group_sites[group])} 个")
    
    # 生成SQL
    print("\n[3/3] 生成SQL文件...")
    
    sql_lines = []
    sql_lines.append("-- ================================")
    sql_lines.append("-- 导航站数据导入SQL")
    sql_lines.append("-- 使用 DeepSeek 智能分类 + 域名提取")
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
        sites_list = group_sites[group_name]
        for order, site in enumerate(sites_list):
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
    
    # 配置（保留原有配置）
    sql_lines.append("-- 插入配置")
    sql_lines.append("INSERT INTO configs (key, value) VALUES ('DB_INITIALIZED', 'true');")
    sql_lines.append("")
    sql_lines.append("PRAGMA foreign_keys = ON;")
    
    # 写入文件
    with open(OUTPUT_SQL, "w", encoding="utf-8") as f:
        f.write("\n".join(sql_lines))
    
    print(f"  已保存到: {OUTPUT_SQL}")
    
    print("\n" + "=" * 50)
    print("完成！")
    print(f"共 {len(sorted_groups)} 个分组，{total_sites} 个站点")
    print("=" * 50)


if __name__ == "__main__":
    main()
