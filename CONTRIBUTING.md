# 🤝 贡献指南

感谢您对 Downie Enhanced 项目的关注！我们欢迎各种形式的贡献。

## 📋 目录

- [如何贡献](#如何贡献)
- [开发环境搭建](#开发环境搭建)
- [代码规范](#代码规范)
- [提交规范](#提交规范)
- [问题报告](#问题报告)
- [功能请求](#功能请求)

## 🚀 如何贡献

### 💻 代码贡献

1. **Fork 仓库**
   ```bash
   # 在 GitHub 上点击 Fork 按钮
   git clone https://github.com/YOUR-USERNAME/downie-enhanced.git
   cd downie-enhanced
   ```

2. **创建分支**
   ```bash
   git checkout -b feature/your-feature-name
   # 或
   git checkout -b bugfix/your-bugfix-name
   ```

3. **开发和测试**
   ```bash
   # 安装依赖
   cd backend && pip install -r requirements.txt
   cd ../frontend && npm install
   
   # 运行测试
   python -m pytest  # 后端测试
   npm test          # 前端测试
   ```

4. **提交更改**
   ```bash
   git add .
   git commit -m "feat: 添加新功能描述"
   git push origin feature/your-feature-name
   ```

5. **创建 Pull Request**
   - 在 GitHub 上创建 PR
   - 填写详细的描述
   - 等待代码审查

### 🎨 其他贡献方式

- **📝 文档改进** - 完善 README、API 文档等
- **🐛 问题报告** - 发现 bug 并提供详细信息
- **💡 功能建议** - 提出新功能想法
- **🌍 本地化** - 翻译到其他语言
- **🎨 UI/UX 设计** - 界面和体验优化

## 🛠️ 开发环境搭建

### 系统要求

- Python 3.9+
- Node.js 16+
- FFmpeg
- Git

### 快速开始

1. **克隆仓库**
   ```bash
   git clone https://github.com/ychenfen/downie-enhanced.git
   cd downie-enhanced
   ```

2. **后端设置**
   ```bash
   cd backend
   
   # 创建虚拟环境
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   
   # 安装依赖
   pip install -r requirements.txt
   
   # 运行开发服务器
   python main.py
   ```

3. **前端设置**
   ```bash
   cd frontend
   
   # 安装依赖
   npm install
   
   # 启动开发服务器
   npm start
   ```

4. **浏览器扩展**
   ```bash
   # Chrome 扩展开发
   1. 打开 chrome://extensions/
   2. 启用"开发者模式"
   3. 点击"加载已解压的扩展程序"
   4. 选择 browser-extension 文件夹
   ```

### 项目结构

```
downie-enhanced/
├── backend/                 # FastAPI 后端
│   ├── app/
│   │   ├── api/            # API 路由
│   │   ├── core/           # 核心功能
│   │   ├── models/         # 数据模型
│   │   └── utils/          # 工具函数
│   ├── tests/              # 后端测试
│   ├── main.py            # 应用入口
│   └── requirements.txt    # Python 依赖
├── frontend/               # React 前端
│   ├── src/
│   │   ├── components/     # React 组件
│   │   ├── pages/         # 页面组件
│   │   ├── hooks/         # 自定义 Hook
│   │   ├── utils/         # 工具函数
│   │   └── types/         # TypeScript 类型
│   ├── public/            # 静态资源
│   ├── tests/             # 前端测试
│   └── package.json       # Node.js 依赖
├── browser-extension/      # 浏览器扩展
│   ├── manifest.json      # 扩展清单
│   ├── background.js      # 后台脚本
│   ├── content.js         # 内容脚本
│   └── popup.html         # 弹出页面
└── docs/                  # 项目文档
```

## 📝 代码规范

### Python 代码规范

- 使用 **Black** 进行代码格式化
- 遵循 **PEP 8** 编码规范
- 使用 **Type Hints** 进行类型注解
- 编写 **Docstring** 文档

```python
# 好的示例
async def download_video(
    url: str, 
    quality: VideoQuality = VideoQuality.HIGH
) -> DownloadResult:
    """
    下载视频文件
    
    Args:
        url: 视频链接
        quality: 视频质量
        
    Returns:
        下载结果对象
        
    Raises:
        DownloadError: 下载失败时抛出
    """
    # 实现代码...
```

### TypeScript 代码规范

- 使用 **Prettier** 进行代码格式化
- 遵循 **ESLint** 规则
- 使用 **严格的 TypeScript** 配置
- 组件使用 **函数式组件** + **Hooks**

```typescript
// 好的示例
interface VideoInfo {
  url: string;
  title: string;
  duration: number;
}

const VideoDownloader: React.FC = () => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  const handleDownload = useCallback(async (url: string) => {
    setIsLoading(true);
    try {
      await downloadVideo(url);
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    // JSX...
  );
};
```

### Git 提交规范

使用 **Conventional Commits** 规范：

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

#### 类型说明

- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式化
- `refactor`: 代码重构
- `test`: 测试相关
- `chore`: 构建或工具相关

#### 示例

```bash
feat(api): 添加批量下载接口

- 实现批量下载功能
- 添加任务队列管理
- 支持并发控制

Closes #123
```

## 🐛 问题报告

### 报告 Bug

使用 [Bug Report 模板](https://github.com/ychenfen/downie-enhanced/issues/new?template=bug_report.md)

**包含信息：**
- 问题描述
- 复现步骤
- 预期行为
- 实际行为
- 环境信息 (操作系统、浏览器版本等)
- 错误日志
- 截图 (如适用)

### 功能请求

使用 [Feature Request 模板](https://github.com/ychenfen/downie-enhanced/issues/new?template=feature_request.md)

**包含信息：**
- 功能描述
- 使用场景
- 预期收益
- 可能的实现方案
- 相关资料

## 🧪 测试

### 运行测试

```bash
# 后端测试
cd backend
python -m pytest tests/ -v

# 前端测试
cd frontend
npm test

# E2E 测试
npm run test:e2e
```

### 编写测试

- **单元测试** - 测试单个函数/组件
- **集成测试** - 测试模块间交互
- **E2E 测试** - 测试完整用户流程

```python
# Python 测试示例
import pytest
from app.core.video_extractor import VideoExtractor

@pytest.mark.asyncio
async def test_extract_youtube_video():
    extractor = VideoExtractor()
    result = await extractor.extract_video_info(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    )
    assert result.title is not None
    assert len(result.formats) > 0
```

```typescript
// React 测试示例
import { render, screen, fireEvent } from '@testing-library/react';
import VideoDownloader from '../VideoDownloader';

test('renders download button', () => {
  render(<VideoDownloader />);
  const downloadButton = screen.getByText(/download/i);
  expect(downloadButton).toBeInTheDocument();
});
```

## 🎯 开发指南

### 添加新的视频网站支持

1. 在 `video_extractor.py` 中添加提取器
2. 在 `supported_sites` 列表中注册
3. 编写对应的测试用例
4. 更新文档

### 添加新的 API 端点

1. 在 `app/api/` 中创建路由文件
2. 定义 Pydantic 模型
3. 实现业务逻辑
4. 添加 API 文档
5. 编写测试用例

### 添加新的前端组件

1. 在 `src/components/` 中创建组件
2. 使用 TypeScript 和 Props 接口
3. 添加样式 (Tailwind CSS)
4. 编写 Storybook 故事
5. 添加单元测试

## 📚 资源链接

- **React 文档**: https://reactjs.org/docs
- **FastAPI 文档**: https://fastapi.tiangolo.com/
- **TypeScript 文档**: https://www.typescriptlang.org/docs/
- **Tailwind CSS**: https://tailwindcss.com/docs
- **FFmpeg 文档**: https://ffmpeg.org/documentation.html

## 💬 获取帮助

- **GitHub Issues**: 技术问题和 Bug 报告
- **GitHub Discussions**: 一般讨论和想法交流
- **Email**: [维护者邮箱]

## 🙏 致谢

感谢所有为项目做出贡献的开发者！

---

> **记住**: 好的代码不仅要能工作，还要易于理解和维护。让我们一起构建更好的 Downie Enhanced！