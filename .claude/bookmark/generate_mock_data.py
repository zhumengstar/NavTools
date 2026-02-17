#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从分类后的书签生成 TypeScript mock 数据
用法: python generate_mock_data.py
输出: 生成 mockData.ts 文件供前端使用
"""

import json
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CLASSIFIED_JSON = os.path.join(SCRIPT_DIR, "classified_bookmarks.json")
OUTPUT_TS = os.path.join(SCRIPT_DIR, "..", "..", "src", "API", "mockData.ts")


def escape_ts_string(s):
    """转义 TypeScript 字符串"""
    if s is None:
        return ""
    return str(s).replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n")


def main():
    print("加载分类后的书签...")
    with open(CLASSIFIED_JSON, "r", encoding="utf-8") as f:
        sites = json.load(f)
    
    # 统计各分组
    group_sites = {}
    for site in sites:
        group = site.get("group", "其他")
        if group not in group_sites:
            group_sites[group] = []
        group_sites[group].append(site)
    
    # 排序分组
    sorted_groups = sorted(
        group_sites.keys(),
        key=lambda g: (g == "其他", -len(group_sites[g]))
    )
    
    # 生成 TypeScript 代码
    ts_lines = []
    ts_lines.append("// 自动生成的 Mock 数据")
    ts_lines.append("// 生成时间: 2026-02-05")
    ts_lines.append("// 数据来源: 分类后的书签数据")
    ts_lines.append("")
    ts_lines.append("import { Group, Site } from './http';")
    ts_lines.append("")
    
    # 生成分组数据
    ts_lines.append("export const mockGroups: Group[] = [")
    for idx, group_name in enumerate(sorted_groups, start=1):
        site_count = len(group_sites[group_name])
        name = escape_ts_string(group_name)
        ts_lines.append(f"  {{")
        ts_lines.append(f"    id: {idx},")
        ts_lines.append(f"    name: '{name}',")
        ts_lines.append(f"    order_num: {idx - 1},")
        ts_lines.append(f"    is_public: 1,")
        ts_lines.append(f"    created_at: '2024-01-01T00:00:00Z',")
        ts_lines.append(f"    updated_at: '2024-01-01T00:00:00Z',")
        ts_lines.append(f"  }}, // {site_count} 个站点")
    ts_lines.append("];")
    ts_lines.append("")
    
    # 生成站点数据（每个分组取前10个）
    ts_lines.append("export const mockSites: Site[] = [")
    site_id = 1
    for idx, group_name in enumerate(sorted_groups, start=1):
        group_site_list = group_sites[group_name]
        # 每个分组最多取5个站点
        for site in group_site_list[:5]:
            name = escape_ts_string(site["name"][:80])  # 截断过长的名称
            url = escape_ts_string(site["url"])
            icon = escape_ts_string(site.get("icon", ""))
            description = escape_ts_string(site.get("description", ""))
            
            ts_lines.append(f"  {{")
            ts_lines.append(f"    id: {site_id},")
            ts_lines.append(f"    group_id: {idx},")
            ts_lines.append(f"    name: '{name}',")
            ts_lines.append(f"    url: '{url}',")
            ts_lines.append(f"    icon: '{icon}',")
            ts_lines.append(f"    description: '{description}',")
            ts_lines.append(f"    notes: '',")
            ts_lines.append(f"    order_num: {site_id},")
            ts_lines.append(f"    is_public: 1,")
            ts_lines.append(f"    created_at: '2024-01-01T00:00:00Z',")
            ts_lines.append(f"    updated_at: '2024-01-01T00:00:00Z',")
            ts_lines.append(f"  }},")
            site_id += 1
    ts_lines.append("];")
    ts_lines.append("")
    
    # 生成配置数据
    ts_lines.append("export const mockConfigs: Record<string, string> = {")
    ts_lines.append("  'site.title': 'NaviHive 导航站',")
    ts_lines.append("  'site.name': '个人书签导航',")
    ts_lines.append("  'site.customCss': '',")
    ts_lines.append("};")
    ts_lines.append("")
    
    # 写入文件
    with open(OUTPUT_TS, "w", encoding="utf-8") as f:
        f.write("\n".join(ts_lines))
    
    print(f"已生成: {OUTPUT_TS}")
    print(f"分组数: {len(sorted_groups)}")
    print(f"站点数: {site_id - 1}")


if __name__ == "__main__":
    main()
