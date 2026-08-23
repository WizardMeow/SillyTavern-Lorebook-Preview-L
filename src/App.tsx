import { useEffect, useRef, useState, type ChangeEvent, type ClipboardEvent, type DragEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Alert,
  Badge,
  Button,
  Card,
  Collapse,
  ConfigProvider,
  Descriptions,
  Divider,
  Empty,
  Flex,
  Input,
  Layout,
  Menu,
  Segmented,
  Space,
  Tag,
  Typography,
} from 'antd';
import { useAtom } from 'jotai';
import { contentRenderModeSchema, matchesEntry, type ContentRenderMode, type Lorebook } from './domain/lorebook';
import { importLorebook, isHttpUrl, looksLikeHttpUrl } from './features/import/importer';
import { contentRenderModeAtom, lorebookAtom, searchQueryAtom, selectedEntryIdAtom } from './state/lorebook';
import './App.css';

type LoadState = { kind: 'idle' | 'loading' | 'error'; message?: string };

function positionLabel(position: string | number | undefined): string | number | undefined {
  const nativePositions: Record<number, string> = {
    0: '角色定义之前', 1: '角色定义之后', 2: '作者注释顶部', 3: '作者注释底部',
    4: '指定深度', 5: '示例消息之前', 6: '示例消息之后', 7: 'Outlet',
  };
  return typeof position === 'number' ? nativePositions[position] ?? position : position;
}

function entryTitle(entry: Lorebook['entries'][number]) {
  return entry.comment || entry.keys[0] || `条目 ${entry.id}`;
}

function ContentRenderer({ content, mode }: { content: string; mode: ContentRenderMode }) {
  if (!content) return <Typography.Text type="secondary" italic>此条目没有可显示的 content。</Typography.Text>;
  if (mode === 'text') return <Typography.Paragraph className="entry-content">{content}</Typography.Paragraph>;
  return <div className="markdown-content"><ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown></div>;
}

function EntryDetail({ entry, renderMode }: { entry: Lorebook['entries'][number]; renderMode: ContentRenderMode }) {
  const details = [
    entry.position !== undefined ? { key: 'position', label: '注入位置', children: positionLabel(entry.position) } : null,
    entry.order !== undefined ? { key: 'order', label: '排序', children: entry.order } : null,
    entry.depth !== undefined ? { key: 'depth', label: '深度', children: entry.depth } : null,
  ].filter(Boolean);

  return (
    <Space orientation="vertical" size="large" className="detail-stack">
      <Flex justify="space-between" align="flex-start" gap="middle">
        <div>
          <Typography.Text type="secondary">条目 #{entry.id}</Typography.Text>
          <Typography.Title level={2}>{entryTitle(entry)}</Typography.Title>
        </div>
        <Space wrap>
          {entry.disabled && <Badge status="default" text="已禁用" />}
          {entry.constant && <Tag color="gold">常驻</Tag>}
        </Space>
      </Flex>
      <div>
        <Typography.Text type="secondary">主关键词</Typography.Text>
        <div className="tag-group">
          {entry.keys.length ? entry.keys.map((key, index) => <Tag key={`${key}-${index}`}>{key}</Tag>) : <Typography.Text type="secondary">无</Typography.Text>}
        </div>
        {entry.secondaryKeys.length > 0 && <><Typography.Text type="secondary">次要关键词</Typography.Text><div className="tag-group">{entry.secondaryKeys.map((key, index) => <Tag color="blue" key={`${key}-${index}`}>{key}</Tag>)}</div></>}
      </div>
      <Divider />
      <ContentRenderer content={entry.content} mode={renderMode} />
      {details.length > 0 && <Descriptions size="small" column={{ xs: 1, sm: 3 }} items={details} />}
    </Space>
  );
}

const App = () => {
  const [book, setBook] = useAtom(lorebookAtom);
  const [query, setQuery] = useAtom(searchQueryAtom);
  const [selectedEntryId, setSelectedEntryId] = useAtom(selectedEntryIdAtom);
  const [contentRenderMode, setContentRenderMode] = useAtom(contentRenderModeAtom);
  const [pastedText, setPastedText] = useState('');
  const [isImportExpanded, setIsImportExpanded] = useState(true);
  const [loadState, setLoadState] = useState<LoadState>({ kind: 'idle' });
  const fileInput = useRef<HTMLInputElement>(null);
  const autoLoadStarted = useRef(false);

  const accept = (next: Lorebook) => {
    setBook(next);
    setSelectedEntryId(next.entries[0]?.id ?? null);
    setIsImportExpanded(false);
    setLoadState({ kind: 'idle' });
  };
  const report = (error: unknown) => setLoadState({ kind: 'error', message: error instanceof Error ? error.message : '导入失败。' });
  const loadFile = async (file: File | undefined) => {
    if (!file) return;
    setLoadState({ kind: 'loading', message: `正在读取 ${file.name}…` });
    try { accept(await importLorebook({ kind: 'file', file })); } catch (error) { report(error); }
  };
  const loadInput = async () => {
    const input = pastedText.trim();
    if (!input) return;
    setLoadState({ kind: 'loading', message: looksLikeHttpUrl(input) ? '正在从 URL 载入…' : '正在解析 JSON…' });
    try {
      accept(await importLorebook({ kind: 'text', value: input }));
    } catch (error) { report(error); }
  };
  const loadDroppedFile = (event: DragEvent<HTMLTextAreaElement>) => {
    event.preventDefault();
    void loadFile(event.dataTransfer.files[0]);
  };
  const loadPastedFile = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const file = event.clipboardData.files[0]
      ?? Array.from(event.clipboardData.items).find((item) => item.kind === 'file')?.getAsFile()
      ?? undefined;
    if (!file) return;
    event.preventDefault();
    void loadFile(file);
  };
  const selectLocalFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    void loadFile(file);
  };

  useEffect(() => {
    const importUrlParameter = new URLSearchParams(window.location.search).get('url')?.trim();
    if (autoLoadStarted.current || !importUrlParameter || !isHttpUrl(importUrlParameter)) return;

    autoLoadStarted.current = true;
    setPastedText(importUrlParameter);
    setLoadState({ kind: 'loading', message: '正在从 URL 载入…' });
    void importLorebook({ kind: 'text', value: importUrlParameter }).then(accept).catch(report);
  }, []);

  const entries = book?.entries.filter((entry) => matchesEntry(entry, query)) ?? [];
  const selectedEntry = entries.find((entry) => entry.id === selectedEntryId) ?? entries[0];

  return <ConfigProvider theme={{ token: { colorPrimary: '#8b5c31', borderRadius: 10, colorBgLayout: '#f5f2ed', fontFamily: "Inter, 'Noto Sans SC', system-ui, sans-serif" } }}>
    <Layout className="app-layout">
      <Layout.Header className="app-header">
        <Typography.Title level={1}>Lorebook Reader</Typography.Title>
        <Typography.Text type="secondary">本地解析 · 无后端 · SillyTavern 世界书预览</Typography.Text>
      </Layout.Header>
      <Layout.Content className="app-content">
        <Collapse
          className="import-card"
          activeKey={isImportExpanded ? ['import'] : []}
          onChange={(keys) => setIsImportExpanded(keys.includes('import'))}
          items={[{ key: 'import', label: book ? '导入或切换世界书' : '导入世界书', children: <Space orientation="vertical" size="middle" className="import-stack">
            <Typography.Text type="secondary">粘贴世界书 JSON、输入 URL，或将本地 JSON / PNG 角色卡拖入下方输入框。</Typography.Text>
            <Input.TextArea
              className="source-input"
              value={pastedText}
              onChange={(event) => setPastedText(event.target.value)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={loadDroppedFile}
              onPaste={loadPastedFile}
              autoSize={{ minRows: 5, maxRows: 12 }}
              placeholder={'粘贴 JSON 或 URL，例如：\nhttps://example.com/world.json'}
            />
            <Space wrap>
              <Button type="primary" loading={loadState.kind === 'loading'} onClick={() => void loadInput()}>载入</Button>
              <Button onClick={() => fileInput.current?.click()}>导入文件</Button>
              <input ref={fileInput} className="sr-only" type="file" accept="application/json,.json,image/png,.png" onChange={selectLocalFile} />
            </Space>
          </Space> }]}
        />
        {loadState.kind !== 'idle' && <Alert className="load-alert" type={loadState.kind === 'error' ? 'error' : 'info'} showIcon message={loadState.message} />}

        {book && <div className="reader-layout">
          <Card className="navigation-card" title={<span>条目导航 <Typography.Text type="secondary">{entries.length} / {book.entries.length}</Typography.Text></span>}>
            <Typography.Paragraph type="secondary" ellipsis={{ rows: 1 }} title={book.source}>{book.kind === 'world-info' ? '独立世界书' : '角色卡内嵌世界书'} · {book.name}</Typography.Paragraph>
            <Input.Search value={query} onChange={(event) => setQuery(event.target.value)} placeholder="筛选关键词、备注或正文" allowClear />
            <Menu
              className="entry-menu"
              mode="inline"
              selectedKeys={selectedEntry ? [selectedEntry.id] : []}
              onClick={({ key }) => setSelectedEntryId(key)}
              items={entries.map((entry) => ({
                key: entry.id,
                label: <div><span>{entryTitle(entry)}</span><Typography.Text type="secondary">#{entry.id}{entry.disabled ? ' · 已禁用' : ''}</Typography.Text></div>,
              }))}
            />
            {book.warnings.length > 0 && <Alert className="compatibility-alert" type="warning" showIcon message={`${book.warnings.length} 条兼容性提示`} description={<ul>{book.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>} />}
          </Card>
          <Card className="detail-card" title="条目详情" extra={<Space size="middle"><Segmented
            size="small"
            options={[{ label: '纯文本', value: 'text' }, { label: 'Markdown', value: 'markdown' }]}
            value={contentRenderMode}
            onChange={(value) => {
              const parsed = contentRenderModeSchema.safeParse(value);
              if (parsed.success) setContentRenderMode(parsed.data);
            }}
          />{selectedEntry ? `#${selectedEntry.id}` : '—'}</Space>}>
            {selectedEntry ? <EntryDetail entry={selectedEntry} renderMode={contentRenderMode} /> : <Empty description="没有匹配的条目" />}
          </Card>
        </div>}
      </Layout.Content>
    </Layout>
  </ConfigProvider>;
};

export default App;
