import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, addIcon } from 'obsidian';
// 添加在顶部
declare const require: (module: string) => any;
declare global {
    interface Window {
        yaml?: any;
        fourPillarsBackupStorage?: Record<string, any>;
    }
}
// 定义插件图标
const FOUR_PILLARS_ICON = `<svg viewBox="0 0 100 100" width="100" height="100" xmlns="http://www.w3.org/2000/svg">
  <rect x="10" y="20" width="15" height="60" fill="currentColor" opacity="0.8"/>
  <rect x="32" y="20" width="15" height="60" fill="currentColor" opacity="0.8"/>
  <rect x="54" y="20" width="15" height="60" fill="currentColor" opacity="0.8"/>
  <rect x="76" y="20" width="15" height="60" fill="currentColor" opacity="0.8"/>
</svg>`;

// 定义设置接口
interface FourPillarsSettings {
	displayInEditor: boolean;
	saveToFrontmatter: boolean;
	insertAsText: boolean; // 新增设置：是否以纯文本形式插入
	// 干支颜色设置
	colors: {
		// 木：甲、乙、寅、卯
		wood: string;
		// 火：丙、丁、巳、午
		fire: string;
		// 土：戊、己、辰、戌、丑、未
		earth: string;
		// 金：庚、辛、申、酉
		metal: string;
		// 水：壬、癸、亥、子
		water: string;
	}
}

// 默认设置
const DEFAULT_SETTINGS: FourPillarsSettings = {
	displayInEditor: true,
	saveToFrontmatter: false,
	insertAsText: true, // 默认以纯文本形式插入
	colors: {
		wood: "#4CAF50",  // 绿色
		fire: "#F44336",  // 红色
		earth: "#8D6E63", // 褐色
		metal: "#FFC107", // 金黄色
		water: "#2196F3"  // 蓝色
	}
}

export default class FourPillarsPlugin extends Plugin {
	settings: FourPillarsSettings;

	async onload() {
		await this.loadSettings();

		// 添加插件图标
		addIcon('four-pillars', FOUR_PILLARS_ICON);

		// 添加ribbon图标
		this.addRibbonIcon('four-pillars', '四柱选择器', (evt: MouseEvent) => {
			new FourPillarsModal(this.app, this).open();
		});

		// 添加命令 - 打开四柱选择器
		this.addCommand({
			id: 'open-four-pillars-selector',
			name: '打开四柱选择器',
			callback: () => {
				new FourPillarsModal(this.app, this).open();
			}
		});

		// 添加命令 - 插入四柱选择器到当前位置
		this.addCommand({
			id: 'insert-four-pillars-selector',
			name: '在当前位置插入四柱选择器',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				const currentPosition = editor.getCursor();
				const uniqueId = Date.now().toString();
				const codeBlock = `\`\`\`fourpillars-selector
id: ${uniqueId}
\`\`\``;
				editor.replaceRange(codeBlock, currentPosition);
			}
		});

		// 添加命令 - 插入干支结果
	this.addCommand({
		id: 'insert-four-pillars-result',
		name: '在当前位置插入干支结果',
		editorCallback: (editor: Editor, view: MarkdownView) => {
			this.insertFourPillarsResult(editor);
		}
	});

		// 注册代码块处理器
		this.registerMarkdownCodeBlockProcessor('fourpillars-selector', (source, el, ctx) => {
			// 解析source获取id
			let selectorId = 'default';
			const idMatch = source.match(/id:\s*([^\s]+)/);
			if (idMatch && idMatch[1]) {
				selectorId = idMatch[1];
			}

			// 检查是否有指定的显示方式
			const displayMatch = source.match(/display:\s*([^\s]+)/);
			let displayMode = this.settings.insertAsText ? 'text' : 'selector';
			if (displayMatch && displayMatch[1]) {
				displayMode = displayMatch[1];
			}

			if (displayMode === 'text') {
				// 以文本形式显示
				this.displayFourPillarsAsText(el, selectorId);
			} else {
				// 以选择器形式显示
				createFourPillarsUI(el, this.app, this, source);
			}
		});

		// 添加设置选项卡
		this.addSettingTab(new FourPillarsSettingTab(this.app, this));
	}

	// 获取干支对应的颜色
	getGanZhiColor(char: string): string {
		// 木：甲、乙、寅、卯
		if (['甲', '乙', '寅', '卯'].includes(char)) {
			return this.settings.colors.wood;
		}
		// 火：丙、丁、巳、午
		else if (['丙', '丁', '巳', '午'].includes(char)) {
			return this.settings.colors.fire;
		}
		// 土：戊、己、辰、戌、丑、未
		else if (['戊', '己', '辰', '戌', '丑', '未'].includes(char)) {
			return this.settings.colors.earth;
		}
		// 金：庚、辛、申、酉
		else if (['庚', '辛', '申', '酉'].includes(char)) {
			return this.settings.colors.metal;
		}
		// 水：壬、癸、亥、子
		else if (['壬', '癸', '亥', '子'].includes(char)) {
			return this.settings.colors.water;
		}
		return '';
	}

	// 显示四柱结果为文本
	displayFourPillarsAsText(el: HTMLElement, selectorId: string) {
		const resultEl = el.createEl('div', {
			cls: 'four-pillars-result-text'
		});

		// 添加样式
		const styleEl = document.createElement('style');
		styleEl.textContent = `
			.four-pillars-result-text {
				padding: 10px 0;
				font-size: 16px;
				line-height: 1.5;
			}
			.ganzhi-char {
				display: inline-block;
			}
			.position-label {
				font-weight: normal;
				font-size: 1em;
			}
		`;
		el.appendChild(styleEl);

		// 尝试获取保存的数据
		try {
			// 从frontmatter读取
			const activeFile = this.app.workspace.getActiveFile();
			if (activeFile) {
				const metadataCache = this.app.metadataCache.getFileCache(activeFile);
				const frontmatter = metadataCache?.frontmatter;
				
				if (frontmatter && frontmatter.fourPillars && frontmatter.fourPillars[selectorId]) {
					const data = frontmatter.fourPillars[selectorId];
					const positions = ['年', '月', '日', '时'];
					
					resultEl.textContent = '干支: ';
					
					positions.forEach((pos, index) => {
						const 天干 = data[pos]?.['天干'] || '';
						const 地支 = data[pos]?.['地支'] || '';
						
						if (天干) {
							const 天干Span = document.createElement('span');
							天干Span.className = 'ganzhi-char';
							天干Span.textContent = 天干;
							天干Span.style.color = this.getGanZhiColor(天干);
							resultEl.appendChild(天干Span);
						}
						
						if (地支) {
							const 地支Span = document.createElement('span');
							地支Span.className = 'ganzhi-char';
							地支Span.textContent = 地支;
							地支Span.style.color = this.getGanZhiColor(地支);
							resultEl.appendChild(地支Span);
						}
						
						const posSuffix = document.createElement('span');
						posSuffix.textContent = pos;
						posSuffix.className = 'position-label';
						resultEl.appendChild(posSuffix);
						
						if (index < positions.length - 1) {
							const separator = document.createElement('span');
							separator.textContent = ' | ';
							resultEl.appendChild(separator);
						}
					});
					
					return;
				}
			}

			// 从本地存储读取
			const key = `fourPillars_${selectorId}`;
			const dataStr = localStorage.getItem(key);
			if (dataStr) {
				const data = JSON.parse(dataStr);
				const positions = ['年', '月', '日', '时'];
				
				resultEl.textContent = '干支: ';
				
				positions.forEach((pos, index) => {
					const 天干 = data[pos]?.['天干'] || '';
					const 地支 = data[pos]?.['地支'] || '';
					
					if (天干) {
						const 天干Span = document.createElement('span');
						天干Span.className = 'ganzhi-char';
						天干Span.textContent = 天干;
						天干Span.style.color = this.getGanZhiColor(天干);
						resultEl.appendChild(天干Span);
					}
					
					if (地支) {
						const 地支Span = document.createElement('span');
						地支Span.className = 'ganzhi-char';
						地支Span.textContent = 地支;
						地支Span.style.color = this.getGanZhiColor(地支);
						resultEl.appendChild(地支Span);
					}
					
					const posSuffix = document.createElement('span');
					posSuffix.textContent = pos;
					posSuffix.className = 'position-label';
					resultEl.appendChild(posSuffix);
					
					if (index < positions.length - 1) {
						const separator = document.createElement('span');
						separator.textContent = ' | ';
						resultEl.appendChild(separator);
					}
				});
				
				return;
			}

			// 如果没有找到数据
			resultEl.textContent = "未找到四柱数据，请使用四柱选择器设置";
		} catch (error) {
			console.error('读取四柱数据失败:', error);
			resultEl.textContent = "读取四柱数据失败";
		}
	}

	// 插入四柱结果到编辑器
	async insertFourPillarsResult(editor: Editor) {
		try {
			// 从模态窗口的数据或最后保存的数据获取四柱信息
			const data = localStorage.getItem('fourPillars_modal');
			if (data) {
				const selections = JSON.parse(data);
				const positions = ['年', '月', '日', '时'];
				
				// 使用HTML span标签和内联样式来实现颜色
				let resultHtml = '干支: ';
				positions.forEach((pos, index) => {
					const 天干 = selections[pos]?.['天干'] || '';
					const 地支 = selections[pos]?.['地支'] || '';
					
					if (天干) {
						const 天干Color = this.getGanZhiColor(天干);
						resultHtml += `<span style="color:${天干Color}">${天干}</span>`;
					}
					
					if (地支) {
						const 地支Color = this.getGanZhiColor(地支);
						resultHtml += `<span style="color:${地支Color}">${地支}</span>`;
					}
					
					resultHtml += pos;
					
					if (index < positions.length - 1) {
						resultHtml += ' | ';
					}
				});
				
				editor.replaceSelection(resultHtml);
				new Notice('干支结果已插入文档');
				return;
			}

			// 如果没有找到数据，给出提示
			new Notice('未找到四柱数据，请先在四柱选择器中设置');
		} catch (error) {
			console.error('插入干支结果失败:', error);
			new Notice('插入干支结果失败，请查看控制台了解详情');
		}
	}

	onunload() {
		console.log('四柱选择器插件已卸载');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

// 四柱选择器的主要UI创建函数
function createFourPillarsUI(containerEl: HTMLElement, app: App, plugin: FourPillarsPlugin, source: string): HTMLElement {
	// 初始化常量
	const positions = ['年', '月', '日', '时'];
	const 天干 = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
	const 地支 = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

	// 解析source获取id
	let selectorId = 'default';
	const idMatch = source.match(/id:\s*([^\s]+)/);
	if (idMatch && idMatch[1]) {
		selectorId = idMatch[1];
	}

	// 保存选择结果的对象
	const selections: Record<string, {天干: string, 地支: string}> = {};
	positions.forEach(pos => {
		selections[pos] = {
			'天干': '',
			'地支': ''
		};
	});

	// 判断函数
	const is阳干 = (干: string) => ['甲', '丙', '戊', '庚', '壬'].includes(干);
	const is阳支 = (支: string) => ['子', '寅', '辰', '午', '申', '戌'].includes(支);

	// 获取匹配的地支
	const get匹配地支 = (天干选择: string) => {
		if (!天干选择) return 地支;
		
		// 阳干：甲丙戊庚壬，阳支：子寅辰午申戌
		// 阴干：乙丁己辛癸，阴支：丑卯巳未酉亥
		const 阳干 = ['甲', '丙', '戊', '庚', '壬'];
		const 阳支 = ['子', '寅', '辰', '午', '申', '戌'];
		const 阴支 = ['丑', '卯', '巳', '未', '酉', '亥'];
		
		return 阳干.includes(天干选择) ? 阳支 : 阴支;
	};

	// 数据持久化工具
	const DataPersistence = {
		// 检查localStorage是否可用
		isLocalStorageAvailable: () => {
			try {
				const test = 'test';
				localStorage.setItem(test, test);
				localStorage.removeItem(test);
				return true;
			} catch (e) {
				return false;
			}
		},
		// 保存到本地存储（带降级方案）
		saveToLocalStorage: (data: any) => {
			try {
				const key = `fourPillars_${selectorId}`;
				if (DataPersistence.isLocalStorageAvailable()) {
					localStorage.setItem(key, JSON.stringify(data));
					return true;
				} else {
					// 降级到内存存储或其他方案
					if (!window.fourPillarsBackupStorage) {
						window.fourPillarsBackupStorage = {};
					}
					window.fourPillarsBackupStorage[key] = data;
					console.warn('localStorage不可用，使用内存存储');
					return true;
				}
			} catch (e) {
				console.error('保存到存储失败:', e);
				return false;
			}
		},
		
		// 从本地存储读取（带降级方案）
		loadFromLocalStorage: () => {
			try {
				const key = `fourPillars_${selectorId}`;
				if (DataPersistence.isLocalStorageAvailable()) {
					const data = localStorage.getItem(key);
					return data ? JSON.parse(data) : null;
				} else if (window.fourPillarsBackupStorage && window.fourPillarsBackupStorage[key]) {
					return window.fourPillarsBackupStorage[key];
				}
				return null;
			} catch (e) {
				console.error('从存储读取失败:', e);
				return null;
			}
		},

		// 保存到文件的 frontmatter (如果设置允许)
		saveToFrontmatter: async (data: any) => {
			try {
				if (!plugin.settings.saveToFrontmatter) return false;
				
				const activeFile = app.workspace.getActiveFile();
				if (!activeFile) {
					new Notice('无法保存：没有激活的文件');
					return false;
				}

				const fileContent = await app.vault.read(activeFile);
				const metadataCache = app.metadataCache.getFileCache(activeFile);
				let frontmatter = metadataCache?.frontmatter || {};
				
				// 如果没有fourPillars键，添加它
				if (!frontmatter.hasOwnProperty('fourPillars')) {
					frontmatter.fourPillars = {};
				}
				
				// 更新特定的选择器数据
				frontmatter.fourPillars[selectorId] = data;
				
				// 准备新的frontmatter
				let yaml;
				try {
					yaml = window.hasOwnProperty('yaml') ? window.yaml : require('yaml');
				} catch (e) {
					console.error('YAML 模块不可用:', e);
					new Notice('保存失败: YAML模块不可用，请确保插件正确安装');
					return false;
				}
				const newFrontmatter = `---\n${yaml.stringify(frontmatter)}---\n`;

				// 替换或添加frontmatter
				let newContent;
				if (fileContent.startsWith('---')) {
					newContent = fileContent.replace(/^---\n[\s\S]*?\n---\n/, newFrontmatter);
				} else {
					newContent = newFrontmatter + fileContent;
				}

				// 写入文件
				await app.vault.modify(activeFile, newContent);
				return true;
			} catch (error) {
				console.error('保存到 frontmatter 失败:', error);
				new Notice(`保存到 frontmatter 失败: ${error.message || '未知错误'}`);
				return false;
			}
		},

		// 从frontmatter读取
		loadFromFrontmatter: () => {
			try {
				const activeFile = app.workspace.getActiveFile();
				if (!activeFile) return null;
				
				const metadataCache = app.metadataCache.getFileCache(activeFile);
				const frontmatter = metadataCache?.frontmatter;
				
				if (frontmatter && frontmatter.fourPillars && frontmatter.fourPillars[selectorId]) {
					return frontmatter.fourPillars[selectorId];
				}
				return null;
			} catch (error) {
				console.error('从 frontmatter 读取失败:', error);
				return null;
			}
		},

		// 保存到隐藏div
		saveToHiddenDiv: (container: HTMLElement, data: any) => {
			let dataDiv = container.querySelector('[data-four-pillars]') as HTMLElement;
			if (!dataDiv) {
				dataDiv = document.createElement('div');
				dataDiv.style.display = 'none';
				container.appendChild(dataDiv);
			}
			dataDiv.setAttribute('data-four-pillars', JSON.stringify(data));
		},

		// 从隐藏div读取数据
		loadFromHiddenDiv: (container: HTMLElement) => {
			const dataDiv = container.querySelector('[data-four-pillars]');
			if (dataDiv) {
				try {
					return JSON.parse(dataDiv.getAttribute('data-four-pillars') || '');
				} catch (error) {
					return null;
				}
			}
			return null;
		},

		// 保存所有数据
		saveAll: async (data: any) => {
			DataPersistence.saveToLocalStorage(data);
			await DataPersistence.saveToFrontmatter(data);
			DataPersistence.saveToHiddenDiv(containerEl, data);
		},

		// 加载数据
		loadAll: () => {
			return DataPersistence.loadFromFrontmatter() || 
				   DataPersistence.loadFromLocalStorage() || 
				   DataPersistence.loadFromHiddenDiv(containerEl);
		}
	};
	const validateFourPillars = (pillars: Record<string, {天干: string, 地支: string}>) => {
		// 结果对象
		const result = {
			isValid: true,
			errorPillars: [] as string[],
			errorDetails: [] as string[],
			errorMessage: ""
		};
		
		// 检查是否有未完成的组合
		const incomplete: string[] = [];
		positions.forEach(pos => {
			const 天干 = pillars[pos]?.天干;
			const 地支 = pillars[pos]?.地支;
			
			if ((!天干 && 地支) || (天干 && !地支)) {
				incomplete.push(pos);
				result.isValid = false;
			}
		});
		
		if (incomplete.length > 0) {
			result.errorMessage = `以下位置的干支组合不完整: ${incomplete.join('、')}柱`;
			return result;
		}
		
		// 阳干阳支，阴干阴支的规则
		const 阳干 = ['甲', '丙', '戊', '庚', '壬'];
		const 阳支 = ['子', '寅', '辰', '午', '申', '戌'];
		
		// 检查每一柱的阴阳配对
		positions.forEach(pos => {
			const 天干 = pillars[pos].天干;
			const 地支 = pillars[pos].地支;
			
			if (天干 && 地支) {
				const 天干是阳 = 阳干.includes(天干);
				const 地支是阳 = 阳支.includes(地支);
				
				if (天干是阳 !== 地支是阳) {
					result.isValid = false;
					result.errorPillars.push(pos);
					result.errorDetails.push(`${pos}柱：${天干}${地支} - ${天干是阳 ? '阳' : '阴'}干不能配${地支是阳 ? '阳' : '阴'}支`);
				}
			}
		});
		
		// 检查年柱和月柱的关系
		if (pillars["年"].天干 && pillars["月"].天干 && pillars["月"].地支) {
			const yearGanIndex = 天干.indexOf(pillars["年"].天干);
			const monthGanIndex = 天干.indexOf(pillars["月"].天干);
			const monthZhiIndex = 地支.indexOf(pillars["月"].地支);
			const yearGanGroup = yearGanIndex % 5; // 0-4分别代表甲己、乙庚、丙辛、丁壬、戊癸
			
			// 根据年干确定正月(寅月)的天干
			// 甲己年起丙寅月，乙庚年起戊寅月，丙辛年起庚寅月，丁壬年起壬寅月，戊癸年起甲寅月
			const baseMonthGan = [2, 4, 6, 8, 0]; // 对应丙、戊、庚、壬、甲
			const startGan = baseMonthGan[yearGanGroup];
			
			if (monthZhiIndex !== -1) {
				// 寅月在地支中索引为2，作为正月(农历一月)
				// 计算当前月支对应的正确天干
				const monthOffset = (monthZhiIndex - 2 + 12) % 12; // 相对于寅月的偏移
				const correctMonthGanIndex = (startGan + monthOffset) % 10;
				
				if (monthGanIndex !== correctMonthGanIndex) {
					result.isValid = false;
					if (!result.errorPillars.includes("月")) {
						result.errorPillars.push("月");
					}
					result.errorDetails.push(`月柱：${pillars["月"].天干}${pillars["月"].地支} - 与年干${pillars["年"].天干}不匹配，应为${天干[correctMonthGanIndex]}${pillars["月"].地支}`);
				}
			}
		}
		
		// 检查日柱和时柱的关系
		if (pillars["日"].天干 && pillars["时"].天干 && pillars["时"].地支) {
			const dayGanIndex = 天干.indexOf(pillars["日"].天干);
			const hourGanIndex = 天干.indexOf(pillars["时"].天干);
			const hourZhiIndex = 地支.indexOf(pillars["时"].地支);
			
			// 根据日干确定子时（第一个时辰）的天干
			// 甲己日起甲子时，乙庚日起丙子时，丙辛日起戊子时，丁壬日起庚子时，戊癸日起壬子时
			const baseHourGan = [0, 2, 4, 6, 8]; // 对应甲、丙、戊、庚、壬
			const dayGanGroup = dayGanIndex % 5;
			const startGan = baseHourGan[dayGanGroup];
			
			// 计算正确的时干索引
			const correctHourGanIndex = (startGan + hourZhiIndex) % 10;
			
			if (hourGanIndex !== correctHourGanIndex) {
				result.isValid = false;
				if (!result.errorPillars.includes("时")) {
					result.errorPillars.push("时");
				}
				result.errorDetails.push(`时柱：${pillars["时"].天干}${pillars["时"].地支} - 与日干${pillars["日"].天干}不匹配，应为${天干[correctHourGanIndex]}${pillars["时"].地支}`);
			}
		}
		
		// 生成详细错误信息
		if (!result.isValid) {
			if (result.errorDetails.length > 0) {
				result.errorMessage = `四柱组合不符合传统历法规则：\n${result.errorDetails.join('\n')}`;
			} else {
				result.errorMessage = `四柱组合不符合传统历法规则，请检查${result.errorPillars.join("、")}柱。`;
			}
		}
		
		return result;
	};
	// 添加样式
	const styleEl = document.createElement('style');
	styleEl.textContent = `
		.four-pillars-container {
			margin: 10px 0;
		}
		.selector-container {
			display: flex;
			gap: 10px;
			margin-bottom: 10px;
			flex-wrap: wrap;
			justify-content: center; /* 居中对齐 */
		}
		.pillar-container {
			display: flex;
			flex-direction: column;
			align-items: center;
			margin-bottom: 5px;
			min-width: 60px; /* 确保最小宽度 */
		}
				/* 添加响应式设计 */
		@media (max-width: 480px) {
			.selector-container {
				flex-direction: column;
				align-items: center;
			}
			.pillar-container {
				width: 100%;
				max-width: 200px;
			}
		}

		.dropdown {
			position: relative;
			display: inline-block;
			margin: 2px 0;
			width: 100%; /* 使下拉框占满容器 */
		}
		.dropdown-button {
			padding: 5px;
			min-width: 40px;
			text-align: center;
			cursor: pointer;
			background: var(--background-secondary);
			border: 1px solid var(--background-modifier-border);
			border-radius: 4px;
			color: var(--text-normal);
		}
		.dropdown-content {
			display: none;
			position: absolute;
			background-color: var(--background-primary);
			min-width: 40px;
			box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2);
			z-index: 1000;
			max-height: 200px;
			overflow-y: auto;
			border-radius: 4px;
		}
		.dropdown-content div {
			padding: 8px;
			text-align: center;
			cursor: pointer;
			color: var(--text-normal);
		}
		.dropdown-content div:hover {
			background-color: var(--background-secondary);
		}
		.confirm-button {
			margin-top: 10px;
			padding: 8px 16px;
			background: var(--interactive-accent);
			color: var(--text-on-accent);
			border: none;
			border-radius: 4px;
			cursor: pointer;
		}
		.result-container {
			margin-top: 10px;
			padding: 10px;
			border: 1px solid var(--background-modifier-border);
			border-radius: 4px;
			background: var(--background-secondary);
		}
		.warning-message {
			color: red;
			padding: 10px;
			margin-top: 5px;
		}
		.position-label {
			font-weight: bold;
			font-size: 1.2em;
		}
	`;
	containerEl.appendChild(styleEl);

	// 创建主容器
	const mainContainer = containerEl.createEl('div', {
		cls: 'four-pillars-container',
		attr: { 'data-selector-id': selectorId }
	});

	// 创建选择器容器
	const selectorContainer = mainContainer.createEl('div', {
		cls: 'selector-container'
	});

	// 为每个位置创建选择器
	positions.forEach(pos => {
		const pillarContainer = selectorContainer.createEl('div', {
			cls: 'pillar-container',
			attr: { 'data-position': pos }
		});
		
		pillarContainer.createEl('div', {
			text: pos,
			cls: 'position-label'
		});

		const 天干Dropdown = pillarContainer.createEl('div', {
			cls: 'dropdown'
		});
		const 天干Button = 天干Dropdown.createEl('div', {
			text: '天干',
			cls: 'dropdown-button 天干-button'
		});
		const 天干Content = 天干Dropdown.createEl('div', {
			cls: 'dropdown-content'
		});

		const 地支Dropdown = pillarContainer.createEl('div', {
			cls: 'dropdown'
		});
		const 地支Button = 地支Dropdown.createEl('div', {
			text: '地支',
			cls: 'dropdown-button 地支-button'
		});
		const 地支Content = 地支Dropdown.createEl('div', {
			cls: 'dropdown-content'
		});

		// 修改天干选择事件处理函数
		天干.forEach(gan => {
			const option = 天干Content.createEl('div', {
				text: gan,
				attr: {
					style: `color: ${plugin.getGanZhiColor(gan)};`
				}
			});
			option.addEventListener('click', () => {
				天干Button.textContent = gan;
				天干Button.style.color = plugin.getGanZhiColor(gan);
				天干Content.style.display = 'none';
				selections[pos]['天干'] = gan;
				
				// 清空地支下拉内容，重新填充
				地支Content.empty();
				
				// 判断选择的天干是阴还是阳
				const isYangGan = is阳干(gan);
				
				// 根据天干的阴阳筛选匹配的地支
				地支.forEach(zhi => {
					const isYangZhi = is阳支(zhi);
					// 只显示匹配的地支: 阳干配阳支，阴干配阴支
					if (isYangGan === isYangZhi) {
						const zhiOption = 地支Content.createEl('div', {
							text: zhi,
							attr: {
								style: `color: ${plugin.getGanZhiColor(zhi)};`
							}
						});
						zhiOption.addEventListener('click', () => {
							地支Button.textContent = zhi;
							地支Button.style.color = plugin.getGanZhiColor(zhi);
							地支Content.style.display = 'none';
							selections[pos]['地支'] = zhi;
							DataPersistence.saveAll(selections);
							updateResult();
						});
					}
				});
		
				// 如果已经选择了不匹配的地支，清除它
				if (selections[pos]['地支']) {
					const 当前地支 = selections[pos]['地支'];
					const 是阳干 = is阳干(gan);
					const 是阳支 = is阳支(当前地支);
					if (是阳干 !== 是阳支) {
						地支Button.textContent = '地支';
						地支Button.style.color = 'var(--text-normal)';
						selections[pos]['地支'] = '';
					}
				}
				
				DataPersistence.saveAll(selections);
				updateResult();
			});
		});

		// 移除原有的地支选项填充代码（因为现在我们是根据所选天干动态填充）
		/*
		地支.forEach(zhi => {
			const option = 地支Content.createEl('div', {
				text: zhi,
				attr: {
					style: `color: ${plugin.getGanZhiColor(zhi)};`
				}
			});
			option.addEventListener('click', () => {
				地支Button.textContent = zhi;
				地支Button.style.color = plugin.getGanZhiColor(zhi);
				地支Content.style.display = 'none';
				selections[pos]['地支'] = zhi;
				DataPersistence.saveAll(selections);
				updateResult();
			});
		});
        */
		天干Button.addEventListener('click', (e: MouseEvent) => {
			e.stopPropagation();
			(天干Content as HTMLElement).style.display = (天干Content as HTMLElement).style.display === 'block' ? 'none' : 'block';
			document.querySelectorAll('.dropdown-content').forEach(content => {
				if (content !== 天干Content) {
					(content as HTMLElement).style.display = 'none';
				}
			});
		});

		地支Button.addEventListener('click', (e: MouseEvent) => {
			e.stopPropagation();
			(地支Content as HTMLElement).style.display = (地支Content as HTMLElement).style.display === 'block' ? 'none' : 'block';
			document.querySelectorAll('.dropdown-content').forEach(content => {
				if (content !== 地支Content) {
					(content as HTMLElement).style.display = 'none';
				}
			});
		});
	});

	// 点击外部区域关闭下拉菜单
	document.addEventListener('click', () => {
		const dropdowns = containerEl.querySelectorAll('.dropdown-content');
		dropdowns.forEach(dropdown => {
			(dropdown as HTMLElement).style.display = 'none';
		});
	});

	// 创建确认按钮
	const confirmButton = mainContainer.createEl('button', {
		text: '确定',
		cls: 'confirm-button'
	});

	// 创建结果容器
	const resultContainer = mainContainer.createEl('div', {
		cls: 'result-container'
	});

	// 创建水平结果显示
	const horizontalResult = resultContainer.createEl('div');

	// 更新结果函数
	const updateResult = () => {
		// 清空现有内容
		horizontalResult.innerHTML = '';
		
		// 添加干支前缀
		const prefixSpan = document.createElement('span');
		prefixSpan.textContent = '干支: ';
		horizontalResult.appendChild(prefixSpan);
		
		// 为每个位置添加带颜色的干支
		positions.forEach((pos, index) => {
			const 天干 = selections[pos]['天干'] || '';
			const 地支 = selections[pos]['地支'] || '';
			
			if (天干) {
				const 天干Span = document.createElement('span');
				天干Span.textContent = 天干;
				天干Span.style.color = plugin.getGanZhiColor(天干);
				horizontalResult.appendChild(天干Span);
			}
			
			if (地支) {
				const 地支Span = document.createElement('span');
				地支Span.textContent = 地支;
				地支Span.style.color = plugin.getGanZhiColor(地支);
				horizontalResult.appendChild(地支Span);
			}
			
			const posSuffix = document.createElement('span');
			posSuffix.textContent = pos;
			// 移除年月日时的加粗和放大样式
			horizontalResult.appendChild(posSuffix);
			
			if (index < positions.length - 1) {
				const separator = document.createElement('span');
				separator.textContent = ' | ';
				horizontalResult.appendChild(separator);
			}
		});
	};

	// 确认按钮点击事件
	confirmButton.addEventListener('click', async () => {
		let missingSelections: string[] = [];
		positions.forEach(pos => {
			if (!selections[pos]['天干']) {
				missingSelections.push(`${pos}柱天干`);
			}
			if (!selections[pos]['地支']) {
				missingSelections.push(`${pos}柱地支`);
			}
		});
	
		if (missingSelections.length > 0) {
			let warningDiv = mainContainer.querySelector('.warning-message') as HTMLElement;
			if (!warningDiv) {
				warningDiv = mainContainer.createEl('div', {
					cls: 'warning-message'
				});
				resultContainer.after(warningDiv);
			}
			warningDiv.innerHTML = `⚠️ 请补充选择：${missingSelections.join('、')}`;
			return;
		}
	
		// 添加四柱组合有效性验证
		const validationResult = validateFourPillars(selections);
		if (!validationResult.isValid) {
			let warningDiv = mainContainer.querySelector('.warning-message') as HTMLElement;
			if (!warningDiv) {
				warningDiv = mainContainer.createEl('div', {
					cls: 'warning-message'
				});
				resultContainer.after(warningDiv);
			}
			warningDiv.innerHTML = `⚠️ ${validationResult.errorMessage}`;
			return;
		}
	
		const warningDiv = mainContainer.querySelector('.warning-message');
		if (warningDiv) {
			warningDiv.remove();
		}
	
		updateResult();
	
		try {
			// 只保存到localStorage
			DataPersistence.saveToLocalStorage(selections);
			DataPersistence.saveToHiddenDiv(containerEl, selections);
			// 临时禁用保存到frontmatter
			// await DataPersistence.saveToFrontmatter(selections); 
			new Notice('四柱数据已保存');
		} catch (error) {
			console.error('保存失败:', error);
			new Notice('保存失败，请查看控制台了解详情');
		}
	});

	// 初始化加载保存的数据
	const initializeData = async () => {
		const savedData = DataPersistence.loadAll();
		
		if (savedData) {
			positions.forEach(pos => {
				if (savedData[pos]) {
					selections[pos] = savedData[pos];
					const pillarContainer = selectorContainer.querySelector(`[data-position="${pos}"]`);
					if (pillarContainer) {
						const 天干Button = pillarContainer.querySelector('.天干-button') as HTMLElement;
						const 地支Button = pillarContainer.querySelector('.地支-button') as HTMLElement;
						if (天干Button && savedData[pos]['天干']) {
							天干Button.textContent = savedData[pos]['天干'];
							天干Button.style.color = plugin.getGanZhiColor(savedData[pos]['天干']);
						}
						if (地支Button && savedData[pos]['地支']) {
							地支Button.textContent = savedData[pos]['地支'];
							地支Button.style.color = plugin.getGanZhiColor(savedData[pos]['地支']);
						}
					}
				}
			});
			updateResult();
		}
	};

	// 执行初始化
	initializeData();

	return mainContainer;
}

// 四柱选择器的模态框
class FourPillarsModal extends Modal {
    plugin: FourPillarsPlugin;
    selections: Record<string, {天干: string, 地支: string}>;

    constructor(app: App, plugin: FourPillarsPlugin) {
        super(app);
        this.plugin = plugin;
        
        // 初始化模态窗口专用的选择数据
        this.selections = {};
        const positions = ['年', '月', '日', '时'];
        positions.forEach(pos => {
            this.selections[pos] = {
                '天干': '',
                '地支': ''
            };
        });
        
        // 尝试从localStorage加载最后保存的模态窗口数据
        try {
            const savedData = localStorage.getItem('fourPillars_modal');
            if (savedData) {
                const parsed = JSON.parse(savedData);
                positions.forEach(pos => {
                    if (parsed[pos]) {
                        this.selections[pos] = parsed[pos];
                    }
                });
            }
        } catch (e) {
            console.error('加载模态窗口数据失败:', e);
        }
    }

    onOpen() {
        const {contentEl} = this;
        contentEl.empty();
        
        contentEl.createEl('h2', {text: '四柱选择器'});
        
        // 创建四柱选择器UI
        createFourPillarsUI(contentEl, this.app, this.plugin, 'id: modal');
        
        // 只添加插入结果按钮
        const insertResultButton = contentEl.createEl('button', {
            text: '插入干支结果到文档',
            cls: 'mod-cta'
        });
        insertResultButton.style.marginTop = '15px';
        
        insertResultButton.addEventListener('click', () => {
            // 获取当前编辑器
            const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
            if (activeView) {
                const editor = activeView.editor;
                // 使用模态窗口的selections进行插入
                this.plugin.insertFourPillarsResult(editor);
                this.close();
            } else {
                new Notice('无法插入，请确保当前视图是Markdown编辑器');
            }
        });
    }

    // 添加一个方法来更新选择数据
    updateSelections(pos: string, type: '天干' | '地支', value: string) {
        this.selections[pos][type] = value;
        localStorage.setItem('fourPillars_modal', JSON.stringify(this.selections));
    }

    onClose() {
        const {contentEl} = this;
        contentEl.empty();
    }
}
	// 设置选项卡
class FourPillarsSettingTab extends PluginSettingTab {
	plugin: FourPillarsPlugin;

	constructor(app: App, plugin: FourPillarsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: '四柱选择器设置'});

		new Setting(containerEl)
			.setName('在编辑器中显示')
			.setDesc('启用后，选择器会在笔记的编辑模式中显示')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.displayInEditor)
				.onChange(async (value) => {
					this.plugin.settings.displayInEditor = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('保存到Frontmatter')
			.setDesc('启用后，选择的四柱数据会保存到笔记的frontmatter中')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.saveToFrontmatter)
				.onChange(async (value) => {
					this.plugin.settings.saveToFrontmatter = value;
					await this.plugin.saveSettings();
				}));
				
		new Setting(containerEl)
			.setName('以文本形式插入')
			.setDesc('启用后，插入的四柱选择器将以文本形式显示结果，而不是选择器界面')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.insertAsText)
				.onChange(async (value) => {
					this.plugin.settings.insertAsText = value;
					await this.plugin.saveSettings();
				}));
				
		// 添加颜色设置
		containerEl.createEl('h3', {text: '干支颜色设置'});
		
		new Setting(containerEl)
			.setName('木（甲、乙、寅、卯）')
			.setDesc('选择木属性字符的颜色')
			.addText(text => text
				.setValue(this.plugin.settings.colors.wood)
				.onChange(async (value) => {
					this.plugin.settings.colors.wood = value;
					await this.plugin.saveSettings();
				}));
				
		new Setting(containerEl)
			.setName('火（丙、丁、巳、午）')
			.setDesc('选择火属性字符的颜色')
			.addText(text => text
				.setValue(this.plugin.settings.colors.fire)
				.onChange(async (value) => {
					this.plugin.settings.colors.fire = value;
					await this.plugin.saveSettings();
				}));
				
		new Setting(containerEl)
			.setName('土（戊、己、辰、戌、丑、未）')
			.setDesc('选择土属性字符的颜色')
			.addText(text => text
				.setValue(this.plugin.settings.colors.earth)
				.onChange(async (value) => {
					this.plugin.settings.colors.earth = value;
					await this.plugin.saveSettings();
				}));
				
		new Setting(containerEl)
			.setName('金（庚、辛、申、酉）')
			.setDesc('选择金属性字符的颜色')
			.addText(text => text
				.setValue(this.plugin.settings.colors.metal)
				.onChange(async (value) => {
					this.plugin.settings.colors.metal = value;
					await this.plugin.saveSettings();
				}));
				
		new Setting(containerEl)
			.setName('水（壬、癸、亥、子）')
			.setDesc('选择水属性字符的颜色')
			.addText(text => text
				.setValue(this.plugin.settings.colors.water)
				.onChange(async (value) => {
					this.plugin.settings.colors.water = value;
					await this.plugin.saveSettings();
				}));
	}
}