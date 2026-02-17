"""
书签重新分类脚本
根据书签名称和URL智能分类书签
输出格式: groups和sites分离，包含configs/version/exportDate
"""
import json
import re
from collections import defaultdict
from urllib.parse import urlparse
from datetime import datetime

def get_favicon_url(url):
    """从URL提取域名并生成faviconextractor URL"""
    try:
        parsed = urlparse(url)
        domain = parsed.netloc
        if domain:
            return f"https://www.faviconextractor.com/favicon/{domain}?larger=true"
    except:
        pass
    return ""

def load_bookmarks(file_path):
    """加载书签JSON文件"""
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def classify_bookmark(name, url):
    """根据书签名称和URL进行分类"""
    name_lower = name.lower()
    url_lower = url.lower()
    
    # 定义分类规则 - 按优先级排序
    categories = {
        "大数据与数据仓库": [
            "flink", "kafka", "hbase", "hadoop", "spark", "hive", "数据仓库", "数据湖",
            "etl", "kettle", "starrocks", "druid", "presto", "iceberg", "cdc", 
            "olap", "oltp", "数仓", "ods", "dwd", "dws", "ads", "大数据",
            "zookeeper", "hdfs", "yarn", "mapreduce", "实时数仓", "lambda", 
            "kappa", "数据分层", "流式处理", "批处理", "维表"
        ],
        "数据库": [
            "db2", "mysql", "oracle", "postgresql", "mongodb", "redis", 
            "sql", "数据库", "索引", "备份", "恢复", "表空间", "derby",
            "tdsql", "分布式数据库", "sharding", "xa事务", "tcc"
        ],
        "编程开发": [
            "java", "python", "spring", "dubbo", "nacos", "jvm", "maven",
            "gradle", "idea", "编程", "代码", "开发", "debug", "调试",
            "设计模式", "架构", "循环依赖", "反射", "线程池", "并发"
        ],
        "版本控制与Git": [
            "git", "github", "gitlab", "分支", "提交", "merge", "commit",
            "版本控制"
        ],
        "Docker与容器": [
            "docker", "container", "容器", "k8s", "kubernetes", "compose",
            "镜像", "集群"
        ],
        "云计算与云服务": [
            "aliyun", "阿里云", "腾讯云", "aws", "azure", "云", "cloud"
        ],
        "Linux与运维": [
            "linux", "shell", "bash", "ubuntu", "centos", "ssh", "chmod",
            "chown", "命令", "运维", "服务器"
        ],
        "机器学习与AI": [
            "机器学习", "深度学习", "ai", "人工智能", "神经网络", "opencv",
            "直方图", "nlp", "模型"
        ],
        "前端开发": [
            "vue", "react", "angular", "javascript", "css", "html", "前端",
            "nodejs", "webpack"
        ],
        "算法与数据结构": [
            "算法", "数据结构", "codeforces", "leetcode", "vjudge", "oj",
            "acm", "竞赛", "cs61b"
        ],
        "学习教程": [
            "教程", "学习", "入门", "博客", "csdn", "博客园", "简书", 
            "知乎", "掘金", "tutorial", "文档", "手册"
        ],
        "工具与效率": [
            "工具", "效率", "下载", "motrix", "速盘", "百度云", "网盘"
        ],
        "社交娱乐": [
            "微博", "acfun", "bilibili", "b站", "视频", "图片", "unsplash"
        ],
        "资格认证": [
            "认证", "考试", "hcia", "系统分析师", "软考", "四级", "英语"
        ],
        "工作相关": [
            "极客企业", "浙江农商", "96596", "银行"
        ]
    }
    
    # 遍历分类规则进行匹配
    for category, keywords in categories.items():
        for keyword in keywords:
            if keyword in name_lower or keyword in url_lower:
                return category
    
    # 默认分类
    return "其他"

def reorganize_bookmarks(data):
    """重新组织书签分类 - 输出正确格式"""
    # 收集所有书签 - 处理两种可能的输入格式
    all_sites = []
    
    # 检查输入格式
    if "sites" in data:
        # 新格式: groups和sites分离
        all_sites = data.get("sites", [])
    else:
        # 旧格式: sites嵌套在groups中
        for group in data.get("groups", []):
            all_sites.extend(group.get("sites", []))
    
    # 按分类整理书签
    categorized = defaultdict(list)
    for site in all_sites:
        category = classify_bookmark(site.get("name", ""), site.get("url", ""))
        categorized[category].append(site)
    
    # 定义分类顺序
    category_order = [
        "大数据与数据仓库",
        "数据库",  
        "编程开发",
        "版本控制与Git",
        "Docker与容器",
        "云计算与云服务",
        "Linux与运维",
        "机器学习与AI",
        "前端开发",
        "算法与数据结构",
        "学习教程",
        "工具与效率",
        "社交娱乐",
        "资格认证",
        "工作相关",
        "其他"
    ]
    
    # 构建新的分组和站点列表（分离格式）
    new_groups = []
    new_sites = []
    group_id = 1
    site_id = 1
    
    for order_num, category in enumerate(category_order):
        if category in categorized and categorized[category]:
            # 添加分组
            new_groups.append({
                "id": group_id,
                "name": category,
                "order_num": order_num
            })
            
            # 添加该分组的站点
            for site_order, site in enumerate(categorized[category]):
                new_site = {
                    "id": site_id,
                    "group_id": group_id,
                    "name": site.get("name", ""),
                    "url": site.get("url", ""),
                    "icon": get_favicon_url(site.get("url", "")),
                    "description": site.get("description", ""),
                    "notes": site.get("notes", ""),
                    "order_num": site_order,
                    "is_public": site.get("is_public", 1),
                    "created_at": site.get("created_at", datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
                    "updated_at": site.get("updated_at", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
                }
                new_sites.append(new_site)
                site_id += 1
            
            group_id += 1
    
    # 构建完整输出
    result = {
        "groups": new_groups,
        "sites": new_sites,
        "configs": data.get("configs", {
            "site.title": "导航站",
            "site.name": "导航站",
            "site.customCss": "",
            "site.backgroundImage": "",
            "site.backgroundOpacity": "0.15",
            "site.iconApi": "https://www.faviconextractor.com/favicon/{domain}?larger=true",
            "site.searchBoxEnabled": "true",
            "site.searchBoxGuestEnabled": "true",
            "DB_INITIALIZED": "true"
        }),
        "version": data.get("version", "1.0"),
        "exportDate": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.000Z")
    }
    
    return result

def main():
    input_file = "result.json"
    output_file = "result_reorganized.json"
    
    print(f"正在加载书签文件: {input_file}")
    data = load_bookmarks(input_file)
    
    # 统计原始书签数量
    if "sites" in data:
        total_original = len(data.get("sites", []))
    else:
        total_original = sum(len(g.get("sites", [])) for g in data.get("groups", []))
    print(f"原始书签数量: {total_original}")
    
    print("正在重新分类书签...")
    new_data = reorganize_bookmarks(data)
    
    # 统计新分类结果
    print("\n分类结果统计:")
    group_map = {g["id"]: g["name"] for g in new_data["groups"]}
    group_counts = defaultdict(int)
    for site in new_data["sites"]:
        group_counts[site["group_id"]] += 1
    
    for group in new_data["groups"]:
        print(f"  {group['name']}: {group_counts[group['id']]} 个书签")
    
    print(f"\n总计: {len(new_data['sites'])} 个书签")
    print(f"分组数: {len(new_data['groups'])} 个")
    
    # 保存结果
    print(f"\n正在保存到: {output_file}")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(new_data, f, ensure_ascii=False, indent=2)
    
    print("完成!")

if __name__ == "__main__":
    main()
