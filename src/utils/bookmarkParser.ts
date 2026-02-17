/**
 * Chrome 书签 HTML 文件解析工具
 * 
 * 解析 Netscape Bookmark File Format（Chrome/Edge/Firefox 导出格式）
 * 按文件夹递归提取书签，归入对应分组
 */

export interface ParsedBookmark {
  url: string;
  title: string;
}

export interface BookmarkGroup {
  groupName: string;
  bookmarks: ParsedBookmark[];
}

/**
 * 解析 Chrome 书签 HTML 文件内容
 * @param htmlContent - 书签 HTML 文件的字符串内容
 * @param defaultGroupName - 无文件夹时的默认分组名，默认为"其他"
 * @returns 按分组整理的书签数组
 */
export function parseBookmarks(
  htmlContent: string,
  defaultGroupName: string = '书签'
): BookmarkGroup[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');

  // 结果 map：groupName -> bookmarks[]
  const groupMap = new Map<string, ParsedBookmark[]>();

  // 找到根 DL 元素（Chrome 书签的顶层列表）
  const rootDL = doc.querySelector('DL');
  if (!rootDL) {
    throw new Error('无法识别的书签文件格式：未找到书签列表');
  }

  /**
   * 递归遍历 DL 列表，提取书签
   * @param dlElement - 当前 DL 元素
   * @param folderName - 当前文件夹名称，null 表示顶层无文件夹
   */
  function traverseDL(dlElement: Element, folderName: string | null): void {
    // 遍历 DL 的直接子 DT 元素
    const children = dlElement.children;

    for (let i = 0; i < children.length; i++) {
      const child = children[i] as Element | undefined;
      if (!child) continue;

      if (child.tagName === 'DT') {
        // 检查是否是文件夹（包含 H3 + DL 子结构）
        const h3 = child.querySelector(':scope > H3');
        const subDL = child.querySelector(':scope > DL');

        if (h3 && subDL) {
          // 这是一个文件夹
          const subFolderName = h3.textContent?.trim() || defaultGroupName;
          traverseDL(subDL, subFolderName);
        } else {
          // 这是一个书签链接
          const anchor = child.querySelector(':scope > A');
          if (anchor) {
            const url = anchor.getAttribute('HREF');
            const title = anchor.textContent?.trim() || '';

            // 只导入有效的 URL（跳过 javascript:、空 URL 等）
            if (url && /^https?:\/\//i.test(url)) {
              const groupName = folderName || defaultGroupName;

              if (!groupMap.has(groupName)) {
                groupMap.set(groupName, []);
              }
              groupMap.get(groupName)!.push({ url, title });
            }
          }
        }
      }
      // 跳过 <p> 和其他非 DT 元素
    }
  }

  traverseDL(rootDL, null);

  // 转换为数组格式
  const result: BookmarkGroup[] = [];
  groupMap.forEach((bookmarks, groupName) => {
    result.push({ groupName, bookmarks });
  });

  return result;
}
