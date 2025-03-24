四柱选择器是一个Obsidian插件，可以帮助您在笔记中插入和显示传统的中国四柱八字记法。
主要功能

交互式选择器：为每个柱子（年、月、日、时）选择合适的天干地支组合
验证功能：确保您的选择遵循传统规则（例如，阳干配阳支，阴干配阴支）
颜色编码：根据五行关联，以适当的颜色显示元素：

木：绿色 - 对应 甲、乙、寅、卯
火：红色 - 对应 丙、丁、巳、午
土：棕色 - 对应 戊、己、辰、戌、丑、未
金：金黄色 - 对应 庚、辛、申、酉
水：蓝色 - 对应 壬、癸、亥、子


多种显示模式：可以插入为交互式选择器或格式化文本
数据存储：将您的选择保存在localStorage或笔记的frontmatter中
自定义设置：在设置中调整每种元素类型的颜色

使用方法
有几种方式可以使用四柱选择器：

侧边栏图标：点击左侧边栏中的四柱图标
命令面板：使用"打开四柱选择器"命令
插入到笔记：使用"在当前位置插入四柱选择器"命令
## 设置选项

- **在编辑器中显示**：切换选择器是否在编辑模式中显示
- **保存到Frontmatter**：可选择将您的选择保存在笔记的frontmatter中
- **以文本形式插入**：选择交互式选择器或文本显示方式
- **颜色自定义**：修改每种五行元素的颜色

## 四柱逻辑

此插件强制执行传统的四柱排列规则：
- 阳干（甲、丙、戊、庚、壬）必须与阳支（子、寅、辰、午、申、戌）配对
- 阴干（乙、丁、己、辛、癸）必须与阴支（丑、卯、巳、未、酉、亥）配对
- 月柱的天干取决于年柱的天干
- 时柱的天干取决于日柱的天干

## 安装方法

1. 在Obsidian中，转到设置 > 第三方插件
2. 关闭安全模式
3. 点击"浏览"并搜索"四柱选择器"
4. 安装插件并启用

## 手动安装

1. 下载最新版本
2. 将文件解压到您的Obsidian插件文件夹：`{vault}/.obsidian/plugins/four-pillars-selector/`
3. 重新加载Obsidian并在设置 > 第三方插件中启用插件

## 支持与贡献

如果您遇到任何问题或有改进建议，请在GitHub仓库上提交issue。

## 许可证

[MIT许可证](LICENSE)